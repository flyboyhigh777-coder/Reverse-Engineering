package io.github.flyboyhigh777.speedmeter.engine

/**
 * Turns a running byte counter into throughput samples.
 *
 * Each call to [sample] takes the current cumulative byte count and the monotonic timestamp it was
 * read at, and derives the instantaneous rate plus two exponential moving averages: a responsive
 * one for the live readout and a smoothed one for the stop decision. Keeping both is what lets the
 * displayed number react quickly while the stop condition stays immune to single-sample spikes.
 *
 * Not thread safe: one instance belongs to one stage sampler.
 */
class ThroughputCalculator(
    private val fastEmaPeriod: Int,
    private val slowEmaPeriod: Int,
) {
    init {
        require(fastEmaPeriod >= 1) { "fastEmaPeriod must be >= 1" }
        require(slowEmaPeriod >= 1) { "slowEmaPeriod must be >= 1" }
    }

    private val fastAlpha = 2.0 / (fastEmaPeriod + 1.0)
    private val slowAlpha = 2.0 / (slowEmaPeriod + 1.0)

    private var lastTotalBytes = 0L
    private var lastTimestampNanos = Long.MIN_VALUE
    private var startTimestampNanos = Long.MIN_VALUE

    var fastAverageBitsPerSecond: Double = Double.NaN
        private set
    var slowAverageBitsPerSecond: Double = Double.NaN
        private set
    var peakBitsPerSecond: Double = 0.0
        private set

    private val samples = ArrayList<ThroughputSample>()

    /** Samples taken so far, oldest first. */
    val recordedSamples: List<ThroughputSample> get() = samples

    fun start(timestampNanos: Long) {
        startTimestampNanos = timestampNanos
        lastTimestampNanos = timestampNanos
        lastTotalBytes = 0L
    }

    /**
     * Records a sample. Returns null when less than a nanosecond of wall time has passed, which
     * would make the derived rate meaningless.
     */
    fun sample(totalBytes: Long, timestampNanos: Long, connections: Int): ThroughputSample? {
        check(startTimestampNanos != Long.MIN_VALUE) { "start() must be called before sample()" }
        val deltaNanos = timestampNanos - lastTimestampNanos
        if (deltaNanos <= 0L) return null

        val deltaBytes = (totalBytes - lastTotalBytes).coerceAtLeast(0L)
        val seconds = deltaNanos / 1_000_000_000.0
        val bitsPerSecond = Units.bytesPerSecondToBitsPerSecond(deltaBytes / seconds)

        fastAverageBitsPerSecond = blend(fastAverageBitsPerSecond, bitsPerSecond, fastAlpha)
        slowAverageBitsPerSecond = blend(slowAverageBitsPerSecond, bitsPerSecond, slowAlpha)
        if (slowAverageBitsPerSecond > peakBitsPerSecond) peakBitsPerSecond = slowAverageBitsPerSecond

        lastTotalBytes = totalBytes
        lastTimestampNanos = timestampNanos

        val sample = ThroughputSample(
            elapsedMillis = (timestampNanos - startTimestampNanos) / 1_000_000L,
            deltaBytes = deltaBytes,
            totalBytes = totalBytes,
            bitsPerSecond = bitsPerSecond,
            fastAverageBitsPerSecond = fastAverageBitsPerSecond,
            slowAverageBitsPerSecond = slowAverageBitsPerSecond,
            connections = connections,
        )
        samples.add(sample)
        return sample
    }

    /**
     * Aggregate rate over the samples taken at or after [fromElapsedMillis].
     *
     * This is the figure a run reports: total bytes over total time for the measured window, which
     * is insensitive to how the window happens to be chopped into samples. The warm-up window is
     * excluded by the caller so TCP slow start does not drag the number down.
     */
    fun aggregateBitsPerSecond(fromElapsedMillis: Long): Double {
        // Strictly greater: a sample stamped exactly at the cutoff covers the span *ending* there,
        // so its bytes belong to the excluded window.
        val startIndex = samples.indexOfFirst { it.elapsedMillis > fromElapsedMillis }
        if (startIndex < 0) return Double.NaN

        var bytes = 0L
        for (index in startIndex until samples.size) bytes += samples[index].deltaBytes

        // Each sample's deltaBytes covers the span since the previous sample, so the window starts
        // at the previous sample's timestamp rather than at the first included sample's.
        val windowStartMillis = if (startIndex == 0) 0L else samples[startIndex - 1].elapsedMillis
        val spanMillis = samples.last().elapsedMillis - windowStartMillis
        if (spanMillis <= 0L) return Double.NaN

        return Units.bytesPerSecondToBitsPerSecond(bytes / (spanMillis / 1_000.0))
    }

    private fun blend(current: Double, next: Double, alpha: Double): Double =
        if (current.isNaN()) next else current + alpha * (next - current)
}
