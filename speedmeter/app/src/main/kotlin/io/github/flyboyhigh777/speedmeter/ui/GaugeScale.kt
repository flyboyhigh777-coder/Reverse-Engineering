package io.github.flyboyhigh777.speedmeter.ui

/**
 * Maps a throughput to a position on the dial.
 *
 * A linear dial is useless across the range a speed test has to cover: on a scale that reaches a
 * gigabit, every mobile connection sits in the first few degrees. The scale is therefore piecewise
 * linear over a fixed set of stops, which gives slow links most of the dial while still leaving
 * room for a fast one - the same trick a car's speedometer plays with its lower gears.
 */
object GaugeScale {

    /** Dial stops, in Mbit/s. Equal arc length is given to each gap between consecutive stops. */
    val stops: List<Double> = listOf(0.0, 1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1_000.0)

    /** Position of [mbps] on the dial as a fraction in 0..1. */
    fun fractionOf(mbps: Double): Double {
        if (!mbps.isFinite() || mbps <= 0.0) return 0.0
        val segments = stops.size - 1
        if (mbps >= stops.last()) return 1.0

        val upperIndex = stops.indexOfFirst { it > mbps }
        val lowerIndex = upperIndex - 1
        val lower = stops[lowerIndex]
        val upper = stops[upperIndex]
        val withinSegment = (mbps - lower) / (upper - lower)
        return (lowerIndex + withinSegment) / segments
    }

    /** Fraction of the dial at which the tick for [stopIndex] sits. */
    fun fractionOfStop(stopIndex: Int): Double {
        require(stopIndex in stops.indices) { "stop index $stopIndex out of range" }
        return stopIndex.toDouble() / (stops.size - 1)
    }

    /** Tick label, dropping the decimal point that whole numbers do not need. */
    fun labelOfStop(stopIndex: Int): String {
        val value = stops[stopIndex]
        return if (value < 1.0) "0" else value.toInt().toString()
    }
}
