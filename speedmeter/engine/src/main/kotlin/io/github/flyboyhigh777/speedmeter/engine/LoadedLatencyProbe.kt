package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.SpeedtestBackend
import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.delay

/**
 * Measures latency while a transfer stage saturates the link - the figure that exposes bufferbloat,
 * and the one a video call actually cares about.
 *
 * Probes go out in small bursts separated by a pause, so the measurement costs a negligible share
 * of the bandwidth it is measuring under.
 */
internal class LoadedLatencyProbe(
    private val backend: SpeedtestBackend,
    private val client: HttpClient,
    private val config: LoadedLatencyConfig,
) {
    private val samples = CopyOnWriteArrayList<Double>()
    private val lost = AtomicInteger(0)
    private val random = java.util.Random()

    suspend fun run(shouldStop: () -> Boolean) {
        if (!config.enabled) return
        val burstRange = config.minBurstCount..config.maxBurstCount.coerceAtLeast(config.minBurstCount)

        while (!shouldStop()) {
            val burst = burstRange.random(kotlin.random.Random)
            repeat(burst) {
                if (shouldStop()) return
                try {
                    samples.add(client.timeRequest(backend.latencyRequest(Nonce.next())))
                } catch (_: Exception) {
                    lost.incrementAndGet()
                }
            }
            val span = (config.maxDelayMillis - config.minDelayMillis).coerceAtLeast(0L)
            val pause = config.minDelayMillis + if (span == 0L) 0L else random.nextInt(span.toInt()).toLong()
            delay(pause)
        }
    }

    /** Null when no probe came back, which is a different fact from "latency was zero". */
    fun result(ranking: LatencyRanking): LatencyStats? {
        if (samples.isEmpty()) return null
        return LatencyCalculator.summarize(samples.toList(), ranking, lost.get())
    }
}
