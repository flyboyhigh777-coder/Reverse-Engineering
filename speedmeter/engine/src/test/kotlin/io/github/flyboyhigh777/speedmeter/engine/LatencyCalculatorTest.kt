package io.github.flyboyhigh777.speedmeter.engine

import org.junit.Assert.assertEquals
import org.junit.Test

class LatencyCalculatorTest {

    private val samples = listOf(20.0, 24.0, 22.0, 60.0, 21.0)

    @Test
    fun `each ranking reduces the same samples differently`() {
        assertEquals(20.0, rank(LatencyRanking.MINIMUM), 0.001)
        assertEquals(29.4, rank(LatencyRanking.AVERAGE), 0.001)
        assertEquals(22.0, rank(LatencyRanking.MEDIAN), 0.001)
        // Faster half of 5 samples is 20, 21, 22.
        assertEquals(21.0, rank(LatencyRanking.AVERAGE_OF_MEDIAN_HALF), 0.001)
    }

    @Test
    fun `every input figure is reported alongside the chosen one`() {
        val stats = LatencyCalculator.summarize(samples, LatencyRanking.MINIMUM)

        assertEquals(20.0, stats.minMillis, 0.001)
        assertEquals(60.0, stats.maxMillis, 0.001)
        assertEquals(29.4, stats.averageMillis, 0.001)
        assertEquals(5, stats.sampleCount)
    }

    @Test
    fun `jitter is the mean absolute difference between consecutive probes`() {
        // |24-20| + |22-24| + |60-22| + |21-60| = 4 + 2 + 38 + 39 = 83, over 4 gaps.
        assertEquals(20.75, LatencyCalculator.jitter(samples), 0.001)
    }

    @Test
    fun `jitter of a single probe is zero rather than undefined`() {
        assertEquals(0.0, LatencyCalculator.jitter(listOf(12.0)), 0.001)
        assertEquals(0.0, LatencyCalculator.jitter(emptyList()), 0.001)
    }

    @Test
    fun `loss is the share of attempted probes that never returned`() {
        val stats = LatencyCalculator.summarize(listOf(10.0, 12.0, 14.0), LatencyRanking.MINIMUM, lostCount = 1)

        assertEquals(3, stats.sampleCount)
        assertEquals(1, stats.lostCount)
        assertEquals(25.0, stats.lossPercent, 0.001)
    }

    @Test
    fun `a set with no successful probe reports no latency instead of zero`() {
        val stats = LatencyCalculator.summarize(emptyList(), LatencyRanking.MINIMUM, lostCount = 5)

        assertEquals(0, stats.sampleCount)
        assertEquals(5, stats.lostCount)
        assertEquals(100.0, stats.lossPercent, 0.001)
        assertEquals(true, stats.latencyMillis.isNaN())
    }

    @Test
    fun `negative and non-finite samples are discarded`() {
        val stats = LatencyCalculator.summarize(
            listOf(10.0, -1.0, Double.NaN, Double.POSITIVE_INFINITY, 20.0),
            LatencyRanking.AVERAGE,
        )

        assertEquals(2, stats.sampleCount)
        assertEquals(15.0, stats.latencyMillis, 0.001)
    }

    private fun rank(ranking: LatencyRanking) =
        LatencyCalculator.summarize(samples, ranking).latencyMillis
}
