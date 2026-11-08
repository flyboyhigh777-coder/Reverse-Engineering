package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.SpeedtestBackend
import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

/**
 * Runs a full test and reports it as a stream of [TestEvent].
 *
 * Stages run in the order given by [SuiteConfig.stages], with the two transfer stages swapped when
 * [EngineConfig.uploadFirst] is set. A stage that cannot produce a figure fails the run with a
 * reason rather than reporting a zero, because "no measurement" and "no throughput" are different
 * answers and a user acting on them would do different things.
 */
class SpeedtestEngine(
    private val config: SuiteConfig = SuiteConfig(),
    private val userAgent: String = DEFAULT_USER_AGENT,
) {
    private val client = HttpClient(
        connectTimeoutMillis = config.engine.connectTimeoutMillis,
        readTimeoutMillis = config.engine.networkTimeoutMillis,
        userAgent = userAgent,
    )

    /** Candidate probing, exposed so a UI can offer a server picker without starting a run. */
    val serverSelector: ServerSelector = ServerSelector(client, config.serverSelection)

    val serverDirectory: ServerDirectory = ServerDirectory(client)

    /**
     * @param candidates servers to choose from. With a single entry the selection stage is a
     *   formality; it still runs so the chosen server's latency is reported the same way.
     */
    fun run(candidates: List<TestServer> = ServerDirectory.BUILT_IN): Flow<TestEvent> = channelFlow {
        if (candidates.isEmpty()) {
            send(TestEvent.Failed(TestFailure.NoServerAvailable("No candidate servers configured")))
            return@channelFlow
        }

        val startedAt = System.currentTimeMillis()
        var server: TestServer? = null
        var metadata = ClientMetadata()
        var idleLatency = LatencyStats.EMPTY
        var download: TransferResult? = null
        var upload: TransferResult? = null

        try {
            // Selection first: every later stage needs a server, and the metadata endpoint belongs
            // to the chosen one.
            val selectionRequested = StageType.SERVER_SELECTION in config.stages
            server = if (selectionRequested && candidates.size > 1) {
                send(TestEvent.StageStarted(StageType.SERVER_SELECTION))
                val probes = serverSelector.probe(candidates) { probe, probed, total ->
                    send(
                        TestEvent.ServerSelectionProgress(probe.server, probe.latency, probed, total)
                    )
                }
                val best = probes.firstOrNull { it.latency != null }
                if (best == null) {
                    send(TestEvent.Failed(TestFailure.NoServerAvailable("No candidate server answered")))
                    return@channelFlow
                }
                send(TestEvent.ServerSelected(best.server, best.latency!!))
                best.server
            } else {
                candidates.first()
            }

            val backend = SpeedtestBackend.create(server)

            if (StageType.METADATA in config.stages) {
                send(TestEvent.StageStarted(StageType.METADATA))
                metadata = fetchMetadata(backend)
                send(TestEvent.MetadataReady(metadata))
            }

            if (StageType.LATENCY in config.stages) {
                send(TestEvent.StageStarted(StageType.LATENCY))
                idleLatency = LatencyStage(backend, client, config.latency).run { completed, total, last ->
                    send(TestEvent.LatencyProgress(completed, total, last))
                }
                if (idleLatency.sampleCount == 0) {
                    send(TestEvent.Failed(TestFailure.LatencyFailed("No latency probe reached ${server.url}")))
                    return@channelFlow
                }
                send(TestEvent.LatencyReady(idleLatency))
            }

            val transferStages = buildList {
                if (StageType.DOWNLOAD in config.stages) add(StageType.DOWNLOAD)
                if (StageType.UPLOAD in config.stages) add(StageType.UPLOAD)
            }.let { if (config.engine.uploadFirst) it.reversed() else it }

            val payload = RandomPayload.of(config.engine.packetSizeBytes)

            for (stage in transferStages) {
                send(TestEvent.StageStarted(stage))
                val result = try {
                    TransferStage(stage, backend, client, config, payload).run { sample, progress ->
                        send(TestEvent.TransferProgress(stage, sample, progress))
                    }
                } catch (cancellation: CancellationException) {
                    throw cancellation
                } catch (error: Exception) {
                    send(
                        TestEvent.Failed(
                            TestFailure.TransferFailed(stage, error.message ?: "transfer failed")
                        )
                    )
                    return@channelFlow
                }
                when (stage) {
                    StageType.DOWNLOAD -> download = result
                    StageType.UPLOAD -> upload = result
                    else -> error("unreachable stage $stage in transfer loop")
                }
                send(TestEvent.TransferReady(result))
            }

            send(
                TestEvent.Completed(
                    TestResult(
                        startedAtEpochMillis = startedAt,
                        server = server,
                        metadata = metadata,
                        idleLatency = idleLatency,
                        download = download,
                        upload = upload,
                        config = config,
                    )
                )
            )
        } catch (cancellation: CancellationException) {
            // The collector went away or the caller cancelled; report nothing further.
            throw cancellation
        }
    }.buffer(EVENT_BUFFER).flowOn(Dispatchers.Default)

    /**
     * Metadata is informational, so a backend that does not answer it costs the run a label, not
     * the measurement.
     */
    private suspend fun fetchMetadata(backend: SpeedtestBackend): ClientMetadata =
        withContext(Dispatchers.IO) {
            val request = backend.metadataRequest(Nonce.next()) ?: return@withContext ClientMetadata()
            runCatching { backend.parseMetadata(client.readText(request)) }.getOrElse { ClientMetadata() }
        }

    companion object {
        /**
         * Progress samples must never block the stage that produces them: a slow collector would
         * otherwise distort the very measurement it is displaying.
         */
        private const val EVENT_BUFFER = 256

        const val DEFAULT_USER_AGENT = "SpeedMeter/1.0 (+https://github.com/flyboyhigh777-coder)"
    }
}

/**
 * Upload payload.
 *
 * The bytes are random because a compressible body would measure the peer's gzip throughput rather
 * than the link's. One buffer is generated per size and reused across connections: regenerating it
 * would spend CPU that the measurement needs.
 */
internal object RandomPayload {
    private val cache = java.util.concurrent.ConcurrentHashMap<Int, ByteArray>()

    fun of(size: Int): ByteArray = cache.computeIfAbsent(size) { requested ->
        ByteArray(requested).also { java.security.SecureRandom().nextBytes(it) }
    }
}
