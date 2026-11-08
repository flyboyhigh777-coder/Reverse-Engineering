package io.github.flyboyhigh777.speedmeter.engine.backend

import io.github.flyboyhigh777.speedmeter.engine.BackendKind
import io.github.flyboyhigh777.speedmeter.engine.ClientMetadata
import io.github.flyboyhigh777.speedmeter.engine.TestServer
import io.github.flyboyhigh777.speedmeter.engine.net.HttpRequest

/**
 * Describes one server's wire protocol: which URLs to hit for a latency probe, a bulk download, a
 * bulk upload and the client's own network identity.
 *
 * The engine owns the transport and the measurement; a backend owns nothing but the endpoints. That
 * split is what lets a new server protocol be added without touching a line of measurement code.
 */
interface SpeedtestBackend {
    val server: TestServer

    /** A request whose response is small enough that its round trip is the latency. */
    fun latencyRequest(nonce: String): HttpRequest

    /** A request that returns about [bytes] bytes of incompressible data. */
    fun downloadRequest(bytes: Long, nonce: String): HttpRequest

    /** A request that accepts a body of [bytes] bytes and discards it. */
    fun uploadRequest(bytes: Long, nonce: String): HttpRequest

    /** Endpoint reporting the client's public address and ISP, when the backend offers one. */
    fun metadataRequest(nonce: String): HttpRequest?

    /** Parses the body returned by [metadataRequest]. */
    fun parseMetadata(body: String): ClientMetadata

    /**
     * Bytes to ask for per download request. A stage re-issues the request when a response runs
     * out, so this trades request overhead against how long a stop decision takes to act.
     */
    val downloadChunkBytes: Long

    /** Bytes to send per upload request. */
    val uploadChunkBytes: Long

    companion object {
        fun create(server: TestServer): SpeedtestBackend = when (server.backend) {
            BackendKind.LIBRESPEED -> LibreSpeedBackend(server)
            BackendKind.CLOUDFLARE -> CloudflareBackend(server)
        }
    }
}

/** Appends a query parameter, picking the right separator for the URL as it stands. */
internal fun String.withQuery(vararg pairs: Pair<String, String>): String {
    if (pairs.isEmpty()) return this
    val query = pairs.joinToString("&") { (key, value) ->
        "${urlEncode(key)}=${urlEncode(value)}"
    }
    val separator = when {
        !contains('?') -> "?"
        endsWith('?') || endsWith('&') -> ""
        else -> "&"
    }
    return this + separator + query
}

private fun urlEncode(value: String): String =
    java.net.URLEncoder.encode(value, "UTF-8")

/** Joins a base URL and a path without doubling or dropping the separator. */
internal fun joinUrl(base: String, path: String): String {
    val trimmedBase = base.trimEnd('/')
    val trimmedPath = path.trimStart('/')
    return "$trimmedBase/$trimmedPath"
}
