package io.github.flyboyhigh777.speedmeter.engine

/**
 * Reduces a set of round-trip samples to a [LatencyStats].
 *
 * Which single number represents a set of probes is a real choice, not a detail: the minimum
 * reports the link's floor, the median resists one bad probe, and the average folds in congestion.
 * The caller picks via [LatencyRanking], and every input figure is kept alongside the chosen one so
 * a caller that wanted a different reduction is not left guessing.
 */
object LatencyCalculator {

    /**
     * @param samplesMillis successful round trips, in the order they were measured.
     * @param lostCount probes that timed out or errored.
     */
    fun summarize(
        samplesMillis: List<Double>,
        ranking: LatencyRanking,
        lostCount: Int = 0,
    ): LatencyStats {
        val valid = samplesMillis.filter { it.isFinite() && it >= 0.0 }
        if (valid.isEmpty()) {
            return LatencyStats.EMPTY.copy(sampleCount = 0, lostCount = lostCount)
        }

        val sorted = valid.sorted()
        val average = valid.average()
        val representative = when (ranking) {
            LatencyRanking.MINIMUM -> sorted.first()
            LatencyRanking.AVERAGE -> average
            LatencyRanking.MEDIAN -> median(sorted)
            LatencyRanking.AVERAGE_OF_MEDIAN_HALF -> averageOfLowerHalf(sorted)
        }

        return LatencyStats(
            latencyMillis = representative,
            minMillis = sorted.first(),
            maxMillis = sorted.last(),
            averageMillis = average,
            jitterMillis = jitter(valid),
            sampleCount = valid.size,
            lostCount = lostCount,
        )
    }

    /**
     * Mean absolute difference between consecutive probes - how much the latency moves, which is
     * what a user feels on a call, rather than how far it sits from the mean.
     */
    fun jitter(samplesMillis: List<Double>): Double {
        if (samplesMillis.size < 2) return 0.0
        var total = 0.0
        for (index in 1 until samplesMillis.size) {
            total += kotlin.math.abs(samplesMillis[index] - samplesMillis[index - 1])
        }
        return total / (samplesMillis.size - 1)
    }

    private fun median(sorted: List<Double>): Double {
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 1) sorted[middle] else (sorted[middle - 1] + sorted[middle]) / 2.0
    }

    /** Average of the faster half of the probes, discarding the slow tail. */
    private fun averageOfLowerHalf(sorted: List<Double>): Double {
        val count = ((sorted.size + 1) / 2).coerceAtLeast(1)
        return sorted.take(count).average()
    }
}
