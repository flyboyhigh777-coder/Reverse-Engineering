package io.github.flyboyhigh777.speedmeter.engine

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * End-to-end runs of the engine against a LibreSpeed-compatible server whose throughput is capped
 * at a known rate, so the figures the engine reports can be checked rather than merely observed.
 */
class SpeedtestEngineTest {

    private fun config(
        durationSeconds: Double = 4.0,
        minDurationSeconds: Double = 2.0,
        threads: Int = 4,
        scaling: Boolean = false,
        stableStop: Boolean = false,
        loadedLatency: Boolean = false,
        pings: Int = 4,
    ) = SuiteConfig(
        engine = EngineConfig(
            threadCount = threads,
            testDurationSeconds = durationSeconds,
            minTestDurationSeconds = minDurationSeconds,
            warmupSeconds = 1.0,
            packetSizeBytes = 32 * 1024,
            connectTimeoutMillis = 4_000,
            networkTimeoutMillis = 10_000,
            updatesPerSecond = 20,
        ),
        latency = LatencyConfig(pingCount = pings, intervalMillis = 10),
        loadedLatency = LoadedLatencyConfig(enabled = loadedLatency, minDelayMillis = 50, maxDelayMillis = 120),
        stableStop = StableStopConfig(enabled = stableStop, stopCount = 4, stopDelta = 0.05),
        connectionScaling = ConnectionScalingConfig(enabled = scaling, maxConnections = 8),
    )

    @Test
    fun `a full run reports a download rate matching the server's cap`() = runBlocking {
        val cappedBytesPerSecond = 12_000_000L // 96 Mbit/s

        FakeLibreSpeedServer(bytesPerSecond = cappedBytesPerSecond).use { server ->
            val events = SpeedtestEngine(config()).run(listOf(server.server())).toList()

            val completed = events.filterIsInstance<TestEvent.Completed>().singleOrNull()
            assertNotNull("run did not complete: ${events.failureMessages()}", completed)
            val result = completed!!.result

            val expectedMbps = Units.bitsPerSecondToMbps(
                Units.bytesPerSecondToBitsPerSecond(cappedBytesPerSecond.toDouble())
            )
            assertTrue(
                "download ${result.downloadMbps} Mbps should be near $expectedMbps Mbps",
                result.downloadMbps in (expectedMbps * 0.6)..(expectedMbps * 1.15),
            )
            assertTrue(
                "upload ${result.uploadMbps} Mbps should be near $expectedMbps Mbps",
                result.uploadMbps in (expectedMbps * 0.6)..(expectedMbps * 1.4),
            )
            assertTrue("download moved no bytes", result.download!!.totalBytes > 0)
            assertTrue("upload moved no bytes", result.upload!!.totalBytes > 0)
        }
    }

    @Test
    fun `stages run in order and each reports its own result`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 20_000_000L).use { server ->
            val events = SpeedtestEngine(config()).run(listOf(server.server())).toList()

            val stages = events.filterIsInstance<TestEvent.StageStarted>().map { it.stage }
            assertEquals(
                listOf(StageType.METADATA, StageType.LATENCY, StageType.DOWNLOAD, StageType.UPLOAD),
                stages,
            )

            val transfers = events.filterIsInstance<TestEvent.TransferReady>().map { it.result.stage }
            assertEquals(listOf(StageType.DOWNLOAD, StageType.UPLOAD), transfers)
            assertTrue(events.any { it is TestEvent.LatencyReady })
            assertTrue(events.any { it is TestEvent.MetadataReady })
        }
    }

    @Test
    fun `uploadFirst swaps the transfer stages`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 20_000_000L).use { server ->
            val suite = config().let { it.copy(engine = it.engine.copy(uploadFirst = true)) }
            val events = SpeedtestEngine(suite).run(listOf(server.server())).toList()

            val transfers = events.filterIsInstance<TestEvent.TransferReady>().map { it.result.stage }
            assertEquals(listOf(StageType.UPLOAD, StageType.DOWNLOAD), transfers)
        }
    }

    @Test
    fun `metadata from the server reaches the result`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 20_000_000L).use { server ->
            val events = SpeedtestEngine(config()).run(listOf(server.server())).toList()
            val result = events.filterIsInstance<TestEvent.Completed>().single().result

            assertEquals("203.0.113.7", result.metadata.ipAddress)
            assertEquals("Example Telecom", result.metadata.isp)
        }
    }

    @Test
    fun `idle latency and jitter are measured and the probes actually reach the server`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 20_000_000L).use { server ->
            val events = SpeedtestEngine(config(pings = 6)).run(listOf(server.server())).toList()
            val stats = events.filterIsInstance<TestEvent.LatencyReady>().single().stats

            assertEquals(6, stats.sampleCount)
            assertEquals(0, stats.lostCount)
            assertTrue("latency ${stats.latencyMillis} should be finite", stats.latencyMillis.isFinite())
            assertTrue("jitter ${stats.jitterMillis} should be finite", stats.jitterMillis.isFinite())
            assertTrue(server.latencyRequests.get() >= 6)
        }
    }

    @Test
    fun `loaded latency is measured while the link is saturated`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 8_000_000L).use { server ->
            val events = SpeedtestEngine(config(loadedLatency = true)).run(listOf(server.server())).toList()
            val download = events.filterIsInstance<TestEvent.TransferReady>()
                .single { it.result.stage == StageType.DOWNLOAD }
                .result

            val loaded = download.loadedLatency
            assertNotNull("no loaded latency recorded", loaded)
            assertTrue(loaded!!.sampleCount > 0)
            assertTrue("loaded latency should be finite", loaded.latencyMillis.isFinite())
        }
    }

    @Test
    fun `progress events arrive during a transfer with a monotonic byte total`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 10_000_000L).use { server ->
            val events = SpeedtestEngine(config()).run(listOf(server.server())).toList()
            val progress = events.filterIsInstance<TestEvent.TransferProgress>()
                .filter { it.stage == StageType.DOWNLOAD }

            assertTrue("expected several progress samples, got ${progress.size}", progress.size >= 5)
            assertTrue(progress.map { it.sample.totalBytes }.zipWithNext().all { (a, b) -> b >= a })
            assertTrue(progress.all { it.progress in 0.0..1.0 })
        }
    }

    @Test
    fun `a stable link stops the stage before the duration cap`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 10_000_000L).use { server ->
            val suite = config(durationSeconds = 25.0, minDurationSeconds = 1.0, stableStop = true)
            val events = SpeedtestEngine(suite).run(listOf(server.server())).toList()

            val download = events.filterIsInstance<TestEvent.TransferReady>()
                .single { it.result.stage == StageType.DOWNLOAD }
                .result

            assertTrue("stage should have stopped early", download.stoppedEarly)
            assertTrue(
                "stage ran ${download.elapsedMillis}ms, expected well under the 25s cap",
                download.elapsedMillis < 20_000,
            )
        }
    }

    @Test
    fun `connection scaling opens more connections than it started with`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 40_000_000L).use { server ->
            val suite = config(durationSeconds = 5.0, threads = 1, scaling = true)
            val events = SpeedtestEngine(suite).run(listOf(server.server())).toList()

            val peakConnections = events.filterIsInstance<TestEvent.TransferProgress>()
                .maxOfOrNull { it.sample.connections } ?: 0

            assertTrue("peak connections was $peakConnections", peakConnections > 1)
        }
    }

    @Test
    fun `the byte allowance caps a stage`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 50_000_000L).use { server ->
            val suite = config(durationSeconds = 30.0, minDurationSeconds = 0.0).let {
                it.copy(engine = it.engine.copy(downloadMaxBytes = 20_000_000, uploadMaxBytes = 10_000_000))
            }
            val events = SpeedtestEngine(suite).run(listOf(server.server())).toList()
            val download = events.filterIsInstance<TestEvent.TransferReady>()
                .single { it.result.stage == StageType.DOWNLOAD }
                .result

            // The cap is checked between samples, so a little overshoot is expected; an unbounded
            // run at 50 MB/s for 30 s would move ~1.5 GB.
            assertTrue(
                "moved ${download.totalBytes} bytes against a 20 MB allowance",
                download.totalBytes < 60_000_000,
            )
        }
    }

    @Test
    fun `a failing download endpoint fails the run with the stage that broke`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 10_000_000L, failDownloadWithStatus = 500).use { server ->
            val events = SpeedtestEngine(config()).run(listOf(server.server())).toList()

            val failure = events.filterIsInstance<TestEvent.Failed>().single().failure
            assertTrue("unexpected failure: $failure", failure is TestFailure.TransferFailed)
            assertEquals(StageType.DOWNLOAD, (failure as TestFailure.TransferFailed).stage)
            assertTrue(events.none { it is TestEvent.Completed })
        }
    }

    @Test
    fun `an unreachable server fails selection instead of reporting zeroes`() = runBlocking {
        val unreachable = ServerDirectory.libreSpeed("http://127.0.0.1:1/backend", "closed port")
        val second = ServerDirectory.libreSpeed("http://127.0.0.1:2/backend", "also closed")

        val events = SpeedtestEngine(config()).run(listOf(unreachable, second)).toList()
        val failure = events.filterIsInstance<TestEvent.Failed>().single().failure

        assertTrue("unexpected failure: $failure", failure is TestFailure.NoServerAvailable)
    }

    @Test
    fun `no candidate servers fails immediately`() = runBlocking {
        val events = SpeedtestEngine(config()).run(emptyList()).toList()

        assertEquals(1, events.size)
        assertTrue(events.single() is TestEvent.Failed)
    }

    @Test
    fun `selection picks the server that answers and reports its latency`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 20_000_000L).use { reachable ->
            val dead = ServerDirectory.libreSpeed("http://127.0.0.1:1/backend", "closed port")
            val events = SpeedtestEngine(config()).run(listOf(dead, reachable.server())).toList()

            val selected = events.filterIsInstance<TestEvent.ServerSelected>().single()
            assertEquals(reachable.baseUrl, selected.server.url)
            assertTrue(selected.latency.latencyMillis.isFinite())

            val probes = events.filterIsInstance<TestEvent.ServerSelectionProgress>()
            assertEquals(2, probes.size)
            // The unreachable candidate is reported with no latency rather than omitted.
            assertTrue(probes.any { it.latency == null })
        }
    }

    @Test
    fun `a refused metadata endpoint costs the run a label, not the measurement`() = runBlocking {
        FakeLibreSpeedServer(bytesPerSecond = 15_000_000L, failIpWithStatus = 403).use { server ->
            val events = SpeedtestEngine(config()).run(listOf(server.server())).toList()

            val completed = events.filterIsInstance<TestEvent.Completed>().singleOrNull()
            assertNotNull("metadata failure must not fail the run: ${events.failureMessages()}", completed)
            val result = completed!!.result

            // No address and no ISP, but the figures are still there.
            assertNull(result.metadata.ipAddress)
            assertNull(result.metadata.isp)
            assertTrue(result.downloadMbps > 0.0)
            assertTrue(result.idleLatency.sampleCount > 0)
        }
    }

    @Test
    fun `the reported connection count is the peak used, not what is left when the stage ends`() =
        runBlocking {
            FakeLibreSpeedServer(bytesPerSecond = 20_000_000L).use { server ->
                val events = SpeedtestEngine(config(threads = 4)).run(listOf(server.server())).toList()

                val download = events.filterIsInstance<TestEvent.TransferReady>()
                    .single { it.result.stage == StageType.DOWNLOAD }
                    .result
                val peakSeen = events.filterIsInstance<TestEvent.TransferProgress>()
                    .filter { it.stage == StageType.DOWNLOAD }
                    .maxOf { it.sample.connections }

                // Workers have already exited by the time the result is built, so a count read from
                // the live gauge would read as 1 here however many connections the stage opened.
                assertEquals(4, download.connections)
                assertEquals(peakSeen, download.connections)
            }
        }

    private fun List<TestEvent>.failureMessages(): String =
        filterIsInstance<TestEvent.Failed>().joinToString { it.failure.message }
}
