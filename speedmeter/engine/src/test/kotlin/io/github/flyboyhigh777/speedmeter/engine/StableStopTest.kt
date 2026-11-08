package io.github.flyboyhigh777.speedmeter.engine

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StableStopTest {

    private fun sample(fast: Double, slow: Double) = ThroughputSample(
        elapsedMillis = 0,
        deltaBytes = 0,
        totalBytes = 0,
        bitsPerSecond = fast,
        fastAverageBitsPerSecond = fast,
        slowAverageBitsPerSecond = slow,
        connections = 1,
    )

    @Test
    fun `stops once the two averages agree for the required number of samples`() {
        val stop = StableStop(StableStopConfig(stopDelta = 0.05, stopCount = 3))

        assertFalse(stop.accept(sample(100.0, 100.0)))
        assertFalse(stop.accept(sample(102.0, 100.0)))
        assertTrue(stop.accept(sample(101.0, 100.0)))
        assertTrue(stop.isStable)
    }

    @Test
    fun `a single unstable sample restarts the count`() {
        val stop = StableStop(StableStopConfig(stopDelta = 0.05, stopCount = 3))

        stop.accept(sample(100.0, 100.0))
        stop.accept(sample(100.0, 100.0))
        assertFalse("a 40% jump is not stable", stop.accept(sample(140.0, 100.0)))
        assertFalse(stop.accept(sample(100.0, 100.0)))
        assertFalse(stop.accept(sample(100.0, 100.0)))
        assertTrue(stop.accept(sample(100.0, 100.0)))
    }

    @Test
    fun `never stops while disabled`() {
        val stop = StableStop(StableStopConfig(enabled = false, stopCount = 1))

        repeat(20) { assertFalse(stop.accept(sample(100.0, 100.0))) }
        assertFalse(stop.isStable)
    }

    @Test
    fun `a sample with no measured throughput cannot make the stage look stable`() {
        val stop = StableStop(StableStopConfig(stopDelta = 0.05, stopCount = 1))

        assertFalse(stop.accept(sample(Double.NaN, Double.NaN)))
        assertFalse(stop.accept(sample(0.0, 0.0)))
    }
}
