package io.github.flyboyhigh777.speedmeter.engine.backend

import io.github.flyboyhigh777.speedmeter.engine.ClientMetadata
import io.github.flyboyhigh777.speedmeter.engine.TestServer
import io.github.flyboyhigh777.speedmeter.engine.net.HttpRequest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The LibreSpeed server protocol (github.com/librespeed/speedtest), an openly specified and
 * self-hostable backend.
 *
 * - `garbage.php?ckSize=<MiB>` streams incompressible data.
 * - `empty.php` answers an empty 200, serving both as the latency probe and the upload sink.
 * - `getIP.php?isp=true` reports the client's address and ISP.
 */
class LibreSpeedBackend(override val server: TestServer) : SpeedtestBackend {

    override val downloadChunkBytes: Long = MAX_CHUNK_MIB * BYTES_PER_MIB
    override val uploadChunkBytes: Long = 32L * BYTES_PER_MIB

    override fun latencyRequest(nonce: String): HttpRequest =
        HttpRequest(url = joinUrl(server.url, EMPTY_PATH).withQuery("r" to nonce))

    override fun downloadRequest(bytes: Long, nonce: String): HttpRequest {
        // garbage.php sizes its response in whole MiB and caps the value server-side.
        val mib = ((bytes + BYTES_PER_MIB - 1) / BYTES_PER_MIB).coerceIn(1L, MAX_CHUNK_MIB)
        return HttpRequest(
            url = joinUrl(server.url, GARBAGE_PATH).withQuery("ckSize" to mib.toString(), "r" to nonce),
        )
    }

    override fun uploadRequest(bytes: Long, nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, EMPTY_PATH).withQuery("r" to nonce),
        method = "POST",
        headers = mapOf("Content-Type" to "application/octet-stream"),
        bodyBytes = bytes,
    )

    override fun metadataRequest(nonce: String): HttpRequest = HttpRequest(
        url = joinUrl(server.url, IP_PATH).withQuery("isp" to "true", "r" to nonce),
    )

    override fun parseMetadata(body: String): ClientMetadata {
        val payload = runCatching { JSON.decodeFromString<IpPayload>(body) }.getOrNull()
            ?: return ClientMetadata(ipAddress = body.trim().takeIf { it.isNotEmpty() })

        val raw = payload.rawIspInfo
        // processedString looks like "1.2.3.4 - Example ISP, City, Country (12.3 km)"; the structured
        // fields are preferred and it is only mined for what they do not carry.
        val address = payload.clientIp?.takeIf { it.isNotBlank() }
            ?: payload.processedString?.substringBefore(" - ")?.trim()?.takeIf { it.isNotBlank() }
        val isp = raw?.org?.takeIf { it.isNotBlank() }
            ?: raw?.isp?.takeIf { it.isNotBlank() }
            ?: payload.processedString
                ?.substringAfter(" - ", "")
                ?.substringBefore(",")
                ?.trim()
                ?.takeIf { it.isNotBlank() }

        return ClientMetadata(
            ipAddress = address,
            isp = isp,
            city = raw?.city?.takeIf { it.isNotBlank() },
            country = raw?.country?.takeIf { it.isNotBlank() },
            asn = raw?.asn?.takeIf { it.isNotBlank() },
        )
    }

    @Serializable
    private data class IpPayload(
        @SerialName("processedString") val processedString: String? = null,
        @SerialName("query") val clientIp: String? = null,
        @SerialName("rawIspInfo") val rawIspInfo: RawIspInfo? = null,
    )

    @Serializable
    private data class RawIspInfo(
        val isp: String? = null,
        val org: String? = null,
        val city: String? = null,
        val country: String? = null,
        @SerialName("as") val asn: String? = null,
    )

    private companion object {
        const val GARBAGE_PATH = "garbage.php"
        const val EMPTY_PATH = "empty.php"
        const val IP_PATH = "getIP.php"
        const val BYTES_PER_MIB = 1024L * 1024L

        /** garbage.php refuses larger values. */
        const val MAX_CHUNK_MIB = 1024L

        val JSON = Json { ignoreUnknownKeys = true; isLenient = true }
    }
}
