package io.github.flyboyhigh777.speedmeter.engine

/**
 * Early-stop decision for a transfer stage.
 *
 * A stage keeps running until throughput settles: once the responsive and smoothed averages agree
 * within [StableStopConfig.stopDelta] for [StableStopConfig.stopCount] samples in a row, more data
 * would not change the answer, so the stage ends. This is what keeps a fast link from spending the
 * full duration - and the full data allowance - restating a number it already knows.
 *
 * Not thread safe: one instance belongs to one stage sampler.
 */
class StableStop(private val config: StableStopConfig) {

    private var consecutiveStableSamples = 0

    var isStable: Boolean = false
        private set

    /** Feeds one sample. Returns true once the stage may stop. */
    fun accept(sample: ThroughputSample): Boolean {
        if (!config.enabled) return false

        val fast = sample.fastAverageBitsPerSecond
        val slow = sample.slowAverageBitsPerSecond
        if (fast.isNaN() || slow.isNaN() || slow <= 0.0) {
            consecutiveStableSamples = 0
            return false
        }

        val relativeDelta = kotlin.math.abs(fast - slow) / slow
        if (relativeDelta <= config.stopDelta) {
            consecutiveStableSamples++
        } else {
            consecutiveStableSamples = 0
        }

        isStable = consecutiveStableSamples >= config.stopCount
        return isStable
    }

    fun reset() {
        consecutiveStableSamples = 0
        isStable = false
    }
}
