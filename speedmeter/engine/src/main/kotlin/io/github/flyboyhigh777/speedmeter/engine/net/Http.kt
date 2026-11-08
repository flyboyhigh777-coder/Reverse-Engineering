package io.github.flyboyhigh777.speedmeter.engine.net

import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

/** One HTTP call the engine should make. Backends describe their endpoints with these. */
data class HttpRequest(
    val url: String,
    val method: String = "GET",
    val headers: Map<String, String> = emptyMap(),
    /** Body length for an upload request. Zero means no request body. */
    val bodyBytes: Long = 0L,
)

/** Raised for any transport or protocol problem, with the request that produced it. */
class HttpFailure(
    val request: HttpRequest,
    val statusCode: Int?,
    message: String,
    cause: Throwable? = null,
) : IOException(buildMessage(request, statusCode, message), cause) {
    private companion object {
        fun buildMessage(request: HttpRequest, statusCode: Int?, message: String): String {
            val status = statusCode?.let { " (HTTP $it)" } ?: ""
            return "${request.method} ${request.url}$status: $message"
        }
    }
}

/**
 * Minimal HTTP client built on [HttpURLConnection].
 *
 * The engine deliberately avoids an HTTP library here. A speed test needs exact control over when
 * bytes hit the socket and over buffer sizes, and it must not get connection pooling, transparent
 * retries or response buffering it did not ask for - any of which would silently corrupt a
 * measurement.
 */
class HttpClient(
    private val connectTimeoutMillis: Int,
    private val readTimeoutMillis: Int,
    private val userAgent: String,
) {

    fun open(request: HttpRequest): HttpURLConnection {
        val connection = try {
            URL(request.url).openConnection() as HttpURLConnection
        } catch (error: Exception) {
            throw HttpFailure(request, null, "could not open connection", error)
        }

        connection.connectTimeout = connectTimeoutMillis
        connection.readTimeout = readTimeoutMillis
        connection.requestMethod = request.method
        connection.instanceFollowRedirects = true
        connection.useCaches = false
        connection.setRequestProperty("User-Agent", userAgent)
        connection.setRequestProperty("Cache-Control", "no-cache, no-store")
        connection.setRequestProperty("Pragma", "no-cache")
        connection.setRequestProperty("Accept-Encoding", "identity")
        request.headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }

        if (request.bodyBytes > 0L) {
            connection.doOutput = true
            connection.setFixedLengthStreamingMode(request.bodyBytes)
            if (connection.getRequestProperty("Content-Type") == null) {
                connection.setRequestProperty("Content-Type", "application/octet-stream")
            }
        }
        return connection
    }

    /** Reads a response fully as text. For small control endpoints only. */
    fun readText(request: HttpRequest, maxBytes: Int = 64 * 1024): String {
        val connection = open(request)
        try {
            val status = connection.responseCode
            if (status !in 200..299) {
                throw HttpFailure(request, status, "unexpected status")
            }
            val stream: InputStream = connection.inputStream
            val buffer = ByteArray(8 * 1024)
            val output = java.io.ByteArrayOutputStream()
            while (output.size() < maxBytes) {
                val read = stream.read(buffer)
                if (read < 0) break
                output.write(buffer, 0, read)
            }
            return output.toString("UTF-8")
        } catch (error: HttpFailure) {
            throw error
        } catch (error: Exception) {
            throw HttpFailure(request, null, "read failed", error)
        } finally {
            connection.disconnect()
        }
    }

    /**
     * Issues [request] and discards the response body, reporting progress through [onBytes].
     *
     * Returns the number of body bytes read. Stops early when [shouldStop] turns true, so a stage
     * that has already settled does not have to drain the rest of the response.
     */
    fun drain(
        request: HttpRequest,
        chunkSize: Int,
        onBytes: (Int) -> Unit,
        shouldStop: () -> Boolean,
    ): Long {
        val connection = open(request)
        var total = 0L
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw HttpFailure(request, status, "unexpected status")
            val stream = connection.inputStream
            val buffer = ByteArray(chunkSize)
            while (!shouldStop()) {
                val read = stream.read(buffer)
                if (read < 0) break
                total += read
                onBytes(read)
            }
            return total
        } catch (error: HttpFailure) {
            throw error
        } catch (error: Exception) {
            if (shouldStop()) return total
            throw HttpFailure(request, null, "download failed after $total bytes", error)
        } finally {
            connection.disconnect()
        }
    }

    /**
     * Issues [request] with a generated body of [HttpRequest.bodyBytes] bytes taken from [payload],
     * reporting progress through [onBytes]. Returns the number of bytes handed to the socket.
     *
     * The count is bytes written by this process, not bytes acknowledged by the peer; see
     * docs/REVERSE_ENGINEERING.md on client-side versus server-side measurement.
     */
    fun pump(
        request: HttpRequest,
        payload: ByteArray,
        onBytes: (Int) -> Unit,
        shouldStop: () -> Boolean,
    ): Long {
        require(request.bodyBytes > 0L) { "pump() needs a request body length" }
        val connection = open(request)
        var total = 0L
        try {
            val output: OutputStream = connection.outputStream
            while (total < request.bodyBytes && !shouldStop()) {
                val remaining = request.bodyBytes - total
                val size = minOf(payload.size.toLong(), remaining).toInt()
                output.write(payload, 0, size)
                total += size
                onBytes(size)
            }
            output.flush()
            if (!shouldStop()) {
                // Draining the response is what confirms the peer accepted the body.
                val status = connection.responseCode
                if (status !in 200..299) throw HttpFailure(request, status, "unexpected status")
                connection.inputStream.use { it.readBytes() }
            }
            return total
        } catch (error: HttpFailure) {
            throw error
        } catch (error: Exception) {
            if (shouldStop()) return total
            throw HttpFailure(request, null, "upload failed after $total bytes", error)
        } finally {
            connection.disconnect()
        }
    }

    /** Round-trip time of [request] in milliseconds, measured to the first response byte. */
    fun timeRequest(request: HttpRequest): Double {
        val connection = open(request)
        try {
            val startNanos = System.nanoTime()
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            stream?.use {
                val buffer = ByteArray(1024)
                @Suppress("ControlFlowWithEmptyBody")
                while (it.read(buffer) >= 0) { /* drain: the body is tiny by construction */ }
            }
            val elapsedNanos = System.nanoTime() - startNanos
            if (status !in 200..299) throw HttpFailure(request, status, "unexpected status")
            return elapsedNanos / 1_000_000.0
        } catch (error: HttpFailure) {
            throw error
        } catch (error: Exception) {
            throw HttpFailure(request, null, "probe failed", error)
        } finally {
            connection.disconnect()
        }
    }
}
