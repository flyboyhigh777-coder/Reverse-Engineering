package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.backend.CloudflareBackend
import io.github.flyboyhigh777.speedmeter.engine.backend.LibreSpeedBackend
import io.github.flyboyhigh777.speedmeter.engine.backend.SpeedtestBackend
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendTest {

    private val libreServer = ServerDirectory.libreSpeed("https://example.test/backend")
    private val cloudflare = ServerDirectory.CLOUDFLARE

    @Test
    fun `backend is chosen from the server's declared kind`() {
        assertTrue(SpeedtestBackend.create(libreServer) is LibreSpeedBackend)
        assertTrue(SpeedtestBackend.create(cloudflare) is CloudflareBackend)
    }

    @Test
    fun `librespeed download size is expressed in whole mebibytes and capped`() {
        val backend = LibreSpeedBackend(libreServer)

        assertTrue(backend.downloadRequest(1024 * 1024, "a").url.contains("ckSize=1"))
        assertTrue(backend.downloadRequest(10 * 1024 * 1024, "a").url.contains("ckSize=10"))
        // A request far above the server-side cap is clamped, not sent through as-is.
        assertTrue(backend.downloadRequest(8L * 1024 * 1024 * 1024, "a").url.contains("ckSize=1024"))
        // A sub-mebibyte request still asks for something.
        assertTrue(backend.downloadRequest(1, "a").url.contains("ckSize=1"))
    }

    @Test
    fun `librespeed upload posts a sized body to the discard endpoint`() {
        val request = LibreSpeedBackend(libreServer).uploadRequest(1_000_000, "nonce")

        assertEquals("POST", request.method)
        assertEquals(1_000_000L, request.bodyBytes)
        assertTrue(request.url.startsWith("https://example.test/backend/empty.php?"))
    }

    @Test
    fun `every request carries a cache-busting token`() {
        val backend = LibreSpeedBackend(libreServer)

        assertTrue(backend.latencyRequest("tok").url.contains("r=tok"))
        assertTrue(backend.downloadRequest(1, "tok").url.contains("r=tok"))
        assertTrue(backend.uploadRequest(1, "tok").url.contains("r=tok"))
    }

    @Test
    fun `cloudflare endpoints carry the requested byte count`() {
        val backend = CloudflareBackend(cloudflare)

        assertEquals(
            "https://speed.cloudflare.com/__down?bytes=1048576&r=tok",
            backend.downloadRequest(1_048_576, "tok").url,
        )
        assertEquals("POST", backend.uploadRequest(10, "tok").method)
        assertTrue(backend.latencyRequest("tok").url.contains("bytes=0"))
    }

    @Test
    fun `librespeed metadata prefers structured fields over the display string`() {
        val metadata = LibreSpeedBackend(libreServer)
            .parseMetadata(FakeLibreSpeedServer.DEFAULT_ISP_JSON)

        assertEquals("203.0.113.7", metadata.ipAddress)
        assertEquals("Example Telecom", metadata.isp)
        assertEquals("Springfield", metadata.city)
        assertEquals("US", metadata.country)
        assertEquals("AS64496", metadata.asn)
    }

    @Test
    fun `librespeed metadata falls back to the display string when structured fields are absent`() {
        val metadata = LibreSpeedBackend(libreServer).parseMetadata(
            """{"processedString":"198.51.100.4 - Other ISP, Town, FR (3 km)"}"""
        )

        assertEquals("198.51.100.4", metadata.ipAddress)
        assertEquals("Other ISP", metadata.isp)
        assertNull(metadata.city)
    }

    @Test
    fun `a metadata body that is not json yields the raw text as the address, not a crash`() {
        val metadata = LibreSpeedBackend(libreServer).parseMetadata("192.0.2.1\n")

        assertEquals("192.0.2.1", metadata.ipAddress)
        assertNull(metadata.isp)
    }

    @Test
    fun `cloudflare clamps a download request to what the endpoint accepts`() {
        val backend = CloudflareBackend(cloudflare)

        // Measured against the live endpoint: 99,999,999 is served, 100,000,000 is refused with a
        // 403, so anything at or above the limit must be clamped before it is sent.
        assertTrue(
            backend.downloadRequest(500_000_000, "tok").url
                .contains("bytes=${CloudflareBackend.MAX_DOWNLOAD_REQUEST_BYTES}"),
        )
        assertTrue(backend.downloadRequest(1, "tok").url.contains("bytes=1"))
        assertTrue(backend.downloadChunkBytes < CloudflareBackend.MAX_DOWNLOAD_REQUEST_BYTES)
    }

    @Test
    fun `cloudflare metadata maps the edge payload`() {
        val metadata = CloudflareBackend(cloudflare).parseMetadata(
            """{"clientIp":"192.0.2.9","asOrganization":"Example AS","asn":64497,""" +
                """"city":"Berlin","country":"DE","colo":"FRA"}"""
        )

        assertEquals("192.0.2.9", metadata.ipAddress)
        assertEquals("Example AS", metadata.isp)
        assertEquals("AS64497", metadata.asn)
        assertEquals("Berlin", metadata.city)
    }

    @Test
    fun `urls with an existing query keep it`() {
        val server = ServerDirectory.libreSpeed("https://example.test/backend?token=abc")
        val url = LibreSpeedBackend(server).latencyRequest("tok").url

        assertTrue(url, url.contains("token=abc"))
        assertTrue(url, url.contains("r=tok"))
    }
}
