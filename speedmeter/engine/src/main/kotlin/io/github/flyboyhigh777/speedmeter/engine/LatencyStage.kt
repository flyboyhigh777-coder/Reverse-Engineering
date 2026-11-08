package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.SpeedtestBackend
import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Idle latency and jitter: a train of small probes over an otherwise quiet link.
 *
 * Probes are spaced out rather than pipelined, because back-to-back probes queue behind each other
 * and would report the engine's own send rate instead of the path's round trip.
 */
internal class LatencyStage(
    private val backend: SpeedtestBackend,
    private val client: HttpClient,
    private val config: LatencyConfig,
) {
    suspend fun run(onProgress: suspend (completed: Int, total: Int, lastMillis: Double?) -> Unit): LatencyStats {
        val samples = ArrayList<Double>(config.pingCount)
        var lost = 0

        for (index in 0 until config.pingCount) {
            val millis = withContext(Dispatchers.IO) {
                runCatching { client.timeRequest(backend.latencyRequest(Nonce.next())) }.getOrNull()
            }
            if (millis == null) lost++ else samples.add(millis)
            onProgress(index + 1, config.pingCount, millis)
            if (index < config.pingCount - 1) delay(config.intervalMillis)
        }

        return LatencyCalculator.summarize(samples, config.ranking, lost)
    }
}
