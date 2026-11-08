package io.github.flyboyhigh777.speedmeter.engine.backend

import io.github.flyboyhigh777.speedmeter.engine.ClientMetadata
import io.github.flyboyhigh777.speedmeter.engine.TestServer
import io.github.flyboyhigh777.speedmeter.engine.net.HttpRequest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Cloudflare's public speed endpoints, which answer from whichever edge location is nearest the
 * client. That makes them a sane default: no server list to download and no server to pick before
 * a first test can run.
 *
 * - `__down?bytes=N` streams N bytes, for N below [MAX_DOWNLOAD_REQUEST_BYTES].
 * - `__up` accepts and discards a body, with no size limit observed.
 * - `meta` reports the client's address, network and the edge that served it. It answers 403 to
 *   non-browser clients from some networks, which costs a run its ISP label and nothing else.
 */
class CloudflareBackend(override val server: TestServer) : SpeedtestBackend {

    // Comfortably under the endpoint's limit, and large enough that re-issuing the request is a
    // negligible share of a stage even on a fast link.
    override val downloadChunkBytes: Long = 90L * 1_000_000L
    override val uploadChunkBytes: Long = 40L * 1_000_000L

    override fun latencyRequest(nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, DOWN_PATH).withQuery("bytes" to "0", "r" to nonce),
    )

    override fun downloadRequest(bytes: Long, nonce: String): HttpRequest {
        // The endpoint refuses a request at or above the limit with a 403, so the size is clamped
        // here rather than left to fail mid-stage: this backend owns what its server will accept.
        val size = bytes.coerceIn(1L, MAX_DOWNLOAD_REQUEST_BYTES)
        return HttpRequest(
            url = joinUrl(server.url, DOWN_PATH).withQuery("bytes" to size.toString(), "r" to nonce),
        )
    }

    override fun uploadRequest(bytes: Long, nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, UP_PATH).withQuery("r" to nonce),
        method = "POST",
        headers = mapOf("Content-Type" to "application/octet-stream"),
        bodyBytes = bytes,
    )

    override fun metadataRequest(nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, META_PATH).withQuery("r" to nonce),
    )

    override fun parseMetadata(body: String): ClientMetadata {
        val payload = runCatching { JSON.decodeFromString<MetaPayload>(body) }.getOrNull()
            ?: return ClientMetadata()
        return ClientMetadata(
            ipAddress = payload.clientIp?.takeIf { it.isNotBlank() },
            isp = payload.asOrganization?.takeIf { it.isNotBlank() },
            city = payload.city?.takeIf { it.isNotBlank() },
            country = payload.country?.takeIf { it.isNotBlank() },
            asn = payload.asn?.takeIf { it != 0 }?.let { "AS$it" },
        )
    }

    @Serializable
    private data class MetaPayload(
        @SerialName("clientIp") val clientIp: String? = null,
        @SerialName("asOrganization") val asOrganization: String? = null,
        @SerialName("asn") val asn: Int? = null,
        @SerialName("city") val city: String? = null,
        @SerialName("country") val country: String? = null,
        @SerialName("colo") val colo: String? = null,
    )

    companion object {
        /**
         * Largest accepted `bytes` value, measured against the live endpoint: 99,999,999 returns
         * 200 and 100,000,000 returns 403.
         */
        const val MAX_DOWNLOAD_REQUEST_BYTES = 99_999_999L

        const val DOWN_PATH = "__down"
        const val UP_PATH = "__up"
        const val META_PATH = "meta"

        val JSON = Json { ignoreUnknownKeys = true; isLenient = true }
    }
}
