package io.github.flyboyhigh777.speedmeter.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ThroughputCalculatorTest {

    @Test
    fun `instantaneous rate converts bytes per sample window into bits per second`() {
        val calculator = ThroughputCalculator(fastEmaPeriod = 2, slowEmaPeriod = 4)
        calculator.start(0L)

        // 125_000 bytes in 100 ms is 1_250_000 B/s, i.e. 10 Mbit/s.
        val sample = calculator.sample(totalBytes = 125_000, timestampNanos = 100_000_000L, connections = 1)

        assertEquals(10_000_000.0, sample!!.bitsPerSecond, 1.0)
        assertEquals(100L, sample.elapsedMillis)
        assertEquals(125_000L, sample.deltaBytes)
    }

    @Test
    fun `a sample taken with no elapsed time is rejected rather than reported as infinite`() {
        val calculator = ThroughputCalculator(fastEmaPeriod = 2, slowEmaPeriod = 4)
        calculator.start(0L)
        calculator.sample(1_000, 1_000_000L, 1)

        assertNull(calculator.sample(2_000, 1_000_000L, 1))
    }

    @Test
    fun `fast average tracks a step change sooner than the slow average`() {
        val calculator = ThroughputCalculator(fastEmaPeriod = 2, slowEmaPeriod = 20)
        calculator.start(0L)

        // Ten samples at 1 Mbit/s, then ten at 10 Mbit/s.
        var bytes = 0L
        repeat(10) { index ->
            bytes += 12_500
            calculator.sample(bytes, (index + 1) * 100_000_000L, 1)
        }
        repeat(10) { index ->
            bytes += 125_000
            calculator.sample(bytes, (10 + index + 1) * 100_000_000L, 1)
        }

        assertTrue(
            "fast=${calculator.fastAverageBitsPerSecond} slow=${calculator.slowAverageBitsPerSecond}",
            calculator.fastAverageBitsPerSecond > calculator.slowAverageBitsPerSecond,
        )
        assertEquals(10_000_000.0, calculator.fastAverageBitsPerSecond, 500_000.0)
    }

    @Test
    fun `aggregate over the window equals total bytes over total time`() {
        val calculator = ThroughputCalculator(fastEmaPeriod = 2, slowEmaPeriod = 4)
        calculator.start(0L)

        var bytes = 0L
        repeat(20) { index ->
            bytes += 125_000 // 1.25e5 bytes per 100 ms == 10 Mbit/s
            calculator.sample(bytes, (index + 1) * 100_000_000L, 1)
        }

        assertEquals(10_000_000.0, calculator.aggregateBitsPerSecond(0L), 10_000.0)
    }

    @Test
    fun `aggregate excludes the warm-up window so slow start does not drag the figure down`() {
        val calculator = ThroughputCalculator(fastEmaPeriod = 2, slowEmaPeriod = 4)
        calculator.start(0L)

        var bytes = 0L
        // First second ramps at 1 Mbit/s, the next two run at 20 Mbit/s.
        repeat(10) { index ->
            bytes += 12_500
            calculator.sample(bytes, (index + 1) * 100_000_000L, 1)
        }
        repeat(20) { index ->
            bytes += 250_000
            calculator.sample(bytes, (10 + index + 1) * 100_000_000L, 1)
        }

        val withWarmup = calculator.aggregateBitsPerSecond(0L)
        val withoutWarmup = calculator.aggregateBitsPerSecond(1_000L)

        assertEquals(20_000_000.0, withoutWarmup, 100_000.0)
        assertTrue("$withWarmup should be below $withoutWarmup", withWarmup < withoutWarmup)
    }

    @Test
    fun `peak records the highest smoothed rate seen`() {
        val calculator = ThroughputCalculator(fastEmaPeriod = 1, slowEmaPeriod = 1)
        calculator.start(0L)

        calculator.sample(125_000, 100_000_000L, 1)
        calculator.sample(125_000 + 1_250_000, 200_000_000L, 1)
        calculator.sample(125_000 + 1_250_000 + 125_000, 300_000_000L, 1)

        assertEquals(100_000_000.0, calculator.peakBitsPerSecond, 1_000.0)
    }
}
