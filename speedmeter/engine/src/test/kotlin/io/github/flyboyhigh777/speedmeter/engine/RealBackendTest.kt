package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.CloudflareBackend
import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Runs the engine against the real public backends.
 *
 * Opt-in: these tests need the internet and their figures depend on whoever runs them, so they are
 * skipped unless `SPEEDMETER_REAL_NETWORK=1` is set. They are not a substitute for the
 * fake-server suite - those assert *what* the engine measures against a known rate, while these
 * only assert that the real endpoints still speak the protocol this engine implements.
 *
 * ```
 * SPEEDMETER_REAL_NETWORK=1 gradle :engine:test --tests '*RealBackendTest*'
 * ```
 */
class RealBackendTest {

    private fun requireOptIn() {
        assumeTrue(
            "set SPEEDMETER_REAL_NETWORK=1 to run the real-network checks",
            System.getenv("SPEEDMETER_REAL_NETWORK") == "1",
        )
    }

    private val shortRun = SuiteConfig(
        engine = EngineConfig(
            threadCount = 4,
            testDurationSeconds = 6.0,
            minTestDurationSeconds = 2.0,
            downloadMaxBytes = 200_000_000,
            uploadMaxBytes = 60_000_000,
            updatesPerSecond = 10,
        ),
        latency = LatencyConfig(pingCount = 6),
        loadedLatency = LoadedLatencyConfig(enabled = true),
    )

    @Test
    fun `cloudflare download endpoint returns exactly the requested byte count`() {
        requireOptIn()
        val client = HttpClient(8_000, 15_000, SpeedtestEngine.DEFAULT_USER_AGENT)
        val backend = CloudflareBackend(ServerDirectory.CLOUDFLARE)

        val requested = 1_000_000L
        val received = client.drain(
            request = backend.downloadRequest(requested, Nonce.next()),
            chunkSize = 64 * 1024,
            onBytes = {},
            shouldStop = { false },
        )

        assertTrue("asked for $requested bytes, got $received", received == requested)
    }

    @Test
    fun `a full run against cloudflare produces plausible figures`() = runBlocking {
        requireOptIn()
        val events = SpeedtestEngine(shortRun).run(ServerDirectory.BUILT_IN).toList()

        val failures = events.filterIsInstance<TestEvent.Failed>()
        val completed = events.filterIsInstance<TestEvent.Completed>().singleOrNull()
        assertNotNull(
            "run did not complete: " + failures.joinToString { it.failure.message },
            completed,
        )
        val result = completed!!.result

        println(
            """
            |--- real Cloudflare run ---
            |download        ${Units.formatMbps(result.downloadMbps)} Mbps
            |upload          ${Units.formatMbps(result.uploadMbps)} Mbps
            |idle latency    ${Units.formatMillis(result.idleLatency.latencyMillis)} ms
            |jitter          ${Units.formatMillis(result.idleLatency.jitterMillis)} ms
            |loaded latency  ${result.download?.loadedLatency?.latencyMillis?.let { Units.formatMillis(it) } ?: "--"} ms
            |connections     ${result.download?.connections} down / ${result.upload?.connections} up
            |stopped early   ${result.download?.stoppedEarly} down / ${result.upload?.stoppedEarly} up
            |data used       ${Units.formatBytes(result.totalBytes)}
            |ip / isp        ${result.metadata.ipAddress ?: "--"} / ${result.metadata.isp ?: "--"}
            """.trimMargin()
        )

        assertTrue("download was ${result.downloadMbps} Mbps", result.downloadMbps > 0.5)
        assertTrue("upload was ${result.uploadMbps} Mbps", result.uploadMbps > 0.1)
        assertTrue("latency was not measured", result.idleLatency.sampleCount > 0)
        assertTrue(result.idleLatency.latencyMillis.isFinite())
        assertTrue("no bytes moved", result.totalBytes > 1_000_000)
    }

    @Test
    fun `the public librespeed list still parses into usable servers`() = runBlocking {
        requireOptIn()
        val client = HttpClient(8_000, 15_000, SpeedtestEngine.DEFAULT_USER_AGENT)
        val servers = ServerDirectory(client).fetchLibreSpeedList(ServerDirectory.LIBRESPEED_PUBLIC_LIST)

        println("--- librespeed list: ${servers.size} servers, first: ${servers.firstOrNull()?.url}")

        assertTrue("list came back empty", servers.isNotEmpty())
        assertTrue(
            "every entry needs an absolute https url",
            servers.all { it.url.startsWith("https://") },
        )
        assertTrue(servers.all { it.backend == BackendKind.LIBRESPEED })
    }
}
