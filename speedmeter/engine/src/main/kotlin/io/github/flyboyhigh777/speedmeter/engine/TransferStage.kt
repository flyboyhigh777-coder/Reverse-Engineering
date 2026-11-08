package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.SpeedtestBackend
import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import io.github.flyboyhigh777.speedmeter.engine.net.HttpFailure
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Runs one download or upload stage: opens connections, counts bytes, samples throughput, decides
 * when to add a connection and when the measurement has settled.
 *
 * The stage stops at whichever of these comes first - throughput settling, the duration cap, or the
 * byte allowance - but never before [EngineConfig.minTestDurationSeconds].
 */
internal class TransferStage(
    private val stage: StageType,
    private val backend: SpeedtestBackend,
    private val client: HttpClient,
    private val config: SuiteConfig,
    private val payload: ByteArray,
) {
    init {
        require(stage == StageType.DOWNLOAD || stage == StageType.UPLOAD) {
            "TransferStage handles DOWNLOAD and UPLOAD only, got $stage"
        }
    }

    private val engine = config.engine
    private val transferredBytes = AtomicLong(0)
    private val stopRequested = AtomicBoolean(false)
    private val openConnections = AtomicInteger(0)

    private val maxStageBytes: Long = when (stage) {
        StageType.DOWNLOAD -> engine.downloadMaxBytes
        else -> engine.uploadMaxBytes
    }
    private val maxBytesPerConnection: Long = when (stage) {
        StageType.DOWNLOAD -> engine.downloadMaxBytesPerConnection
        else -> engine.uploadMaxBytesPerConnection
    }
    private val chunkBytes: Long = when (stage) {
        StageType.DOWNLOAD -> backend.downloadChunkBytes
        else -> backend.uploadChunkBytes
    }

    /** Failures seen by workers. A stage only fails if it ends up with nothing to report. */
    private val failures = java.util.concurrent.ConcurrentLinkedQueue<HttpFailure>()

    /**
     * @param onSample invoked for each throughput sample with the sample and the stage's progress
     *   in 0..1, so the caller can drive a live readout.
     */
    suspend fun run(onSample: suspend (ThroughputSample, Double) -> Unit): TransferResult {
        val scope = CoroutineScope(coroutineContext)
        val calculator = ThroughputCalculator(
            fastEmaPeriod = config.stableStop.fastEmaPeriod,
            slowEmaPeriod = config.stableStop.slowEmaPeriod,
        )
        val stableStop = StableStop(config.stableStop)
        val loadedLatency = LoadedLatencyProbe(backend, client, config.loadedLatency)

        val workers = ArrayList<Job>(engine.threadCount)
        val startNanos = System.nanoTime()
        calculator.start(startNanos)

        repeat(engine.threadCount) { workers += startWorker(scope) }
        val latencyJob = if (config.loadedLatency.enabled) {
            scope.launch(Dispatchers.IO) { loadedLatency.run { stopRequested.get() } }
        } else {
            null
        }

        var stoppedEarly = false
        var lastScalingCheckNanos = startNanos
        var throughputAtLastCheck = 0.0

        try {
            while (coroutineContext.isActive) {
                delay(engine.sampleIntervalMillis)
                val now = System.nanoTime()
                val elapsedSeconds = (now - startNanos) / 1_000_000_000.0
                val total = transferredBytes.get()

                val sample = calculator.sample(total, now, openConnections.get())
                if (sample != null) {
                    val progress = (elapsedSeconds / engine.testDurationSeconds).coerceIn(0.0, 1.0)
                    onSample(sample, progress)
                }

                if (elapsedSeconds >= engine.minTestDurationSeconds) {
                    if (sample != null && stableStop.accept(sample)) {
                        stoppedEarly = true
                        break
                    }
                }
                if (elapsedSeconds >= engine.testDurationSeconds) break
                if (maxStageBytes > 0L && total >= maxStageBytes) break

                // Every connection that is still gaining throughput is evidence the link is not
                // saturated yet, so add one more and look again.
                if (config.connectionScaling.enabled &&
                    (now - lastScalingCheckNanos) / 1_000_000L >= config.connectionScaling.checkIntervalMillis
                ) {
                    val current = calculator.slowAverageBitsPerSecond
                    val gaining = throughputAtLastCheck > 0.0 &&
                        current > throughputAtLastCheck * (1.0 + config.connectionScaling.factor)
                    if ((gaining || throughputAtLastCheck == 0.0) &&
                        openConnections.get() < config.connectionScaling.maxConnections
                    ) {
                        workers += startWorker(scope)
                    }
                    throughputAtLastCheck = current
                    lastScalingCheckNanos = now
                }

                if (openConnections.get() == 0 && failures.isNotEmpty() && total == 0L) break
            }
        } finally {
            stopRequested.set(true)
            // Workers exit cooperatively at their next chunk boundary; a connection wedged in a
            // blocking read is abandoned rather than allowed to hold up the result.
            withTimeoutOrNull(WORKER_DRAIN_TIMEOUT_MILLIS) { workers.forEach { it.join() } }
            workers.forEach { it.cancel() }
            latencyJob?.cancel()
        }

        val elapsedMillis = (System.nanoTime() - startNanos) / 1_000_000L
        val total = transferredBytes.get()
        if (total == 0L) {
            val cause = failures.firstOrNull()
            throw cause ?: IllegalStateException("$stage transferred no bytes in ${elapsedMillis}ms")
        }

        val warmupMillis = (engine.warmupSeconds * 1_000).toLong()
        val aggregate = calculator.aggregateBitsPerSecond(warmupMillis)
            .takeIf { it.isFinite() && it > 0.0 }
            ?: calculator.aggregateBitsPerSecond(0L)

        return TransferResult(
            stage = stage,
            bitsPerSecond = aggregate,
            peakBitsPerSecond = calculator.peakBitsPerSecond,
            totalBytes = total,
            elapsedMillis = elapsedMillis,
            connections = openConnections.get().coerceAtLeast(1),
            loadedLatency = loadedLatency.result(config.latency.ranking),
            stoppedEarly = stoppedEarly,
        )
    }

    private fun startWorker(scope: CoroutineScope): Job {
        openConnections.incrementAndGet()
        return scope.launch(Dispatchers.IO) {
            var ownBytes = 0L
            try {
                while (!stopRequested.get() && isActive) {
                    if (maxBytesPerConnection > 0L && ownBytes >= maxBytesPerConnection) break
                    val nonce = Nonce.next()
                    val moved = when (stage) {
                        StageType.DOWNLOAD -> client.drain(
                            request = backend.downloadRequest(chunkBytes, nonce),
                            chunkSize = engine.packetSizeBytes,
                            onBytes = { transferredBytes.addAndGet(it.toLong()) },
                            shouldStop = { stopRequested.get() },
                        )
                        else -> client.pump(
                            request = backend.uploadRequest(chunkBytes, nonce),
                            payload = payload,
                            onBytes = { transferredBytes.addAndGet(it.toLong()) },
                            shouldStop = { stopRequested.get() },
                        )
                    }
                    ownBytes += moved
                    if (moved == 0L) break
                }
            } catch (failure: HttpFailure) {
                failures.add(failure)
            } finally {
                openConnections.decrementAndGet()
            }
        }
    }

    private companion object {
        const val WORKER_DRAIN_TIMEOUT_MILLIS = 1_500L
    }
}

/** Cache-busting token, so no hop in the path can answer a transfer request from cache. */
internal object Nonce {
    private val random = java.util.concurrent.atomic.AtomicLong(System.nanoTime())

    fun next(): String = java.lang.Long.toHexString(random.incrementAndGet() * 0x9E3779B97F4A7C15uL.toLong())
}
