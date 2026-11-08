package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.SpeedtestBackend
import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

/** A candidate server and how it answered. */
data class ServerProbe(val server: TestServer, val latency: LatencyStats?)

/**
 * Picks the server to test against by probing candidates and keeping the one with the lowest
 * latency.
 *
 * Candidates are probed concurrently but under a permit limit: probing all of them at once would
 * have them contend for the same uplink and measure the contention rather than the servers. A
 * candidate that fails to answer is kept in the returned list with a null latency, so the caller
 * can tell "slow" apart from "unreachable".
 */
class ServerSelector(
    private val client: HttpClient,
    private val config: ServerSelectionConfig,
) {
    suspend fun probe(
        candidates: List<TestServer>,
        onProbed: suspend (ServerProbe, probed: Int, total: Int) -> Unit = { _, _, _ -> },
    ): List<ServerProbe> {
        if (candidates.isEmpty()) return emptyList()

        val shortlist = candidates.take(config.serverCount)
        val permits = Semaphore(config.maxConcurrency)
        val probed = java.util.concurrent.atomic.AtomicInteger(0)

        val probes = coroutineScope {
            shortlist.map { server ->
                async(Dispatchers.IO) {
                    val latency = permits.withPermit { probeOne(server) }
                    val probe = ServerProbe(server, latency)
                    onProbed(probe, probed.incrementAndGet(), shortlist.size)
                    probe
                }
            }.map { it.await() }
        }

        return probes.sortedWith(
            compareBy(nullsLast<Double>()) { probe -> probe.latency?.latencyMillis }
        )
    }

    /** The fastest reachable candidate, or null when none answered. */
    suspend fun select(candidates: List<TestServer>): ServerProbe? =
        probe(candidates).firstOrNull { it.latency != null }

    private suspend fun probeOne(server: TestServer): LatencyStats? = withContext(Dispatchers.IO) {
        val backend = SpeedtestBackend.create(server)
        val samples = ArrayList<Double>(config.pingCount)
        var lost = 0
        repeat(config.pingCount) {
            val millis = runCatching { client.timeRequest(backend.latencyRequest(Nonce.next())) }.getOrNull()
            if (millis == null) lost++ else samples.add(millis)
        }
        if (samples.isEmpty()) null else LatencyCalculator.summarize(samples, config.ranking, lost)
    }
}
