package io.github.flyboyhigh777.speedmeter

import io.github.flyboyhigh777.speedmeter.ui.GaugeScale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GaugeScaleTest {

    @Test
    fun `the dial starts at zero and ends at the top stop`() {
        assertEquals(0.0, GaugeScale.fractionOf(0.0), 1e-9)
        assertEquals(1.0, GaugeScale.fractionOf(1_000.0), 1e-9)
    }

    @Test
    fun `each stop lands on an evenly spaced tick`() {
        GaugeScale.stops.forEachIndexed { index, value ->
            assertEquals(
                "stop $value should sit on tick $index",
                GaugeScale.fractionOfStop(index),
                GaugeScale.fractionOf(value),
                1e-9,
            )
        }
    }

    @Test
    fun `the scale is monotonic`() {
        val samples = listOf(0.0, 0.5, 1.0, 3.0, 5.0, 8.0, 12.0, 40.0, 90.0, 180.0, 400.0, 900.0, 1_500.0)
        val fractions = samples.map { GaugeScale.fractionOf(it) }

        assertTrue(fractions.zipWithNext().all { (a, b) -> b >= a })
    }

    @Test
    fun `slow links get a usable share of the dial`() {
        // On a linear 0..1000 dial a 10 Mbps link would sit at 1% of the sweep. The compressed
        // scale has to give it visibly more than that.
        assertTrue(GaugeScale.fractionOf(10.0) > 0.25)
        assertTrue(GaugeScale.fractionOf(1.0) > 0.08)
    }

    @Test
    fun `a reading above the top stop pins to the end instead of running off the dial`() {
        assertEquals(1.0, GaugeScale.fractionOf(5_000.0), 1e-9)
    }

    @Test
    fun `a non-finite or negative reading reads as zero`() {
        assertEquals(0.0, GaugeScale.fractionOf(Double.NaN), 1e-9)
        assertEquals(0.0, GaugeScale.fractionOf(-5.0), 1e-9)
        assertEquals(0.0, GaugeScale.fractionOf(Double.POSITIVE_INFINITY), 1e-9)
    }

    @Test
    fun `tick labels are whole numbers`() {
        assertEquals("0", GaugeScale.labelOfStop(0))
        assertEquals("1", GaugeScale.labelOfStop(1))
        assertEquals("1000", GaugeScale.labelOfStop(GaugeScale.stops.lastIndex))
    }

    @Test
    fun `interpolation inside a segment is linear`() {
        // 7.5 Mbps is halfway between the 5 and 10 stops, so it sits halfway between their ticks.
        val lower = GaugeScale.fractionOfStop(GaugeScale.stops.indexOf(5.0))
        val upper = GaugeScale.fractionOfStop(GaugeScale.stops.indexOf(10.0))

        assertEquals((lower + upper) / 2.0, GaugeScale.fractionOf(7.5), 1e-9)
    }
}
