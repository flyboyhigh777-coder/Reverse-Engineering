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
 * - `__down?bytes=N` streams N bytes.
 * - `__up` accepts and discards a body.
 * - `meta` reports the client's address, network and the edge that served it.
 */
class CloudflareBackend(override val server: TestServer) : SpeedtestBackend {

    override val downloadChunkBytes: Long = 300L * 1_000_000L
    override val uploadChunkBytes: Long = 40L * 1_000_000L

    override fun latencyRequest(nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, DOWN_PATH).withQuery("bytes" to "0", "r" to nonce),
    )

    override fun downloadRequest(bytes: Long, nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, DOWN_PATH)
            .withQuery("bytes" to bytes.coerceAtLeast(1L).toString(), "r" to nonce),
    )

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

    private companion object {
        const val DOWN_PATH = "__down"
        const val UP_PATH = "__up"
        const val META_PATH = "meta"

        val JSON = Json { ignoreUnknownKeys = true; isLenient = true }
    }
}
