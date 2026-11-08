package io.github.flyboyhigh777.speedmeter.engine

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

/**
 * A LibreSpeed-compatible server used by the engine tests.
 *
 * Loopback has no meaningful bandwidth limit, so a test that ran against an unthrottled server
 * would only measure how fast this JVM can copy bytes. [bytesPerSecond] imposes a known ceiling
 * shared by all connections, which is what makes the measured figure something to assert against.
 */
class FakeLibreSpeedServer(
    private val bytesPerSecond: Long? = null,
    private val failDownloadWithStatus: Int? = null,
    private val failIpWithStatus: Int? = null,
    private val ispJson: String = DEFAULT_ISP_JSON,
) : AutoCloseable {

    private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 64)
    private val limiter = bytesPerSecond?.let { RateLimiter(it) }
    private val payload = ByteArray(CHUNK) { (it * 31 % 251).toByte() }

    val downloadBytesServed = AtomicLong(0)
    val uploadBytesReceived = AtomicLong(0)
    val latencyRequests = AtomicLong(0)

    val baseUrl: String get() = "http://127.0.0.1:${server.address.port}/backend"

    init {
        server.executor = Executors.newCachedThreadPool()
        server.createContext("/backend/garbage.php", ::handleGarbage)
        server.createContext("/backend/empty.php", ::handleEmpty)
        server.createContext("/backend/getIP.php", ::handleIp)
        server.start()
    }

    fun server(): TestServer = ServerDirectory.libreSpeed(baseUrl, "Fake LibreSpeed")

    private fun handleGarbage(exchange: HttpExchange) {
        failDownloadWithStatus?.let { status ->
            exchange.sendResponseHeaders(status, -1)
            exchange.close()
            return
        }

        val sizeMib = queryValue(exchange, "ckSize")?.toLongOrNull()?.coerceIn(1L, 1024L) ?: 4L
        val total = sizeMib * 1024L * 1024L
        exchange.responseHeaders.add("Content-Type", "application/octet-stream")
        exchange.sendResponseHeaders(200, total)
        try {
            exchange.responseBody.use { body ->
                var sent = 0L
                while (sent < total) {
                    val size = minOf(CHUNK.toLong(), total - sent).toInt()
                    limiter?.acquire(size.toLong())
                    body.write(payload, 0, size)
                    sent += size
                    downloadBytesServed.addAndGet(size.toLong())
                }
            }
        } catch (_: Exception) {
            // The client closes the connection as soon as its stage stops; that is expected.
        } finally {
            exchange.close()
        }
    }

    private fun handleEmpty(exchange: HttpExchange) {
        try {
            if (exchange.requestMethod.equals("POST", ignoreCase = true)) {
                val buffer = ByteArray(CHUNK)
                exchange.requestBody.use { stream ->
                    while (true) {
                        val read = stream.read(buffer)
                        if (read < 0) break
                        limiter?.acquire(read.toLong())
                        uploadBytesReceived.addAndGet(read.toLong())
                    }
                }
            } else {
                latencyRequests.incrementAndGet()
            }
            exchange.responseHeaders.add("Content-Type", "text/plain")
            exchange.sendResponseHeaders(200, -1)
        } catch (_: Exception) {
            // Client aborted mid-upload when its stage stopped.
        } finally {
            exchange.close()
        }
    }

    private fun handleIp(exchange: HttpExchange) {
        failIpWithStatus?.let { status ->
            // Cloudflare's /meta answers 403 to non-browser clients from some networks, so a
            // refused metadata endpoint is a real case, not a hypothetical one.
            val body = "{}".toByteArray()
            exchange.sendResponseHeaders(status, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
            exchange.close()
            return
        }

        val bytes = ispJson.toByteArray()
        exchange.responseHeaders.add("Content-Type", "application/json")
        exchange.sendResponseHeaders(200, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
        exchange.close()
    }

    private fun queryValue(exchange: HttpExchange, key: String): String? =
        exchange.requestURI.query
            ?.split('&')
            ?.map { it.split('=', limit = 2) }
            ?.firstOrNull { it.firstOrNull() == key }
            ?.getOrNull(1)

    override fun close() {
        server.stop(0)
    }

    /** Token bucket shared by every connection, so the cap is on the server as a whole. */
    private class RateLimiter(private val bytesPerSecond: Long) {
        private val lock = Object()
        private var availableAtNanos = System.nanoTime()

        fun acquire(bytes: Long) {
            val waitNanos: Long
            synchronized(lock) {
                val now = System.nanoTime()
                if (availableAtNanos < now) availableAtNanos = now
                val costNanos = bytes * 1_000_000_000L / bytesPerSecond
                availableAtNanos += costNanos
                waitNanos = availableAtNanos - now
            }
            if (waitNanos > 0) {
                val millis = waitNanos / 1_000_000L
                val nanos = (waitNanos % 1_000_000L).toInt()
                Thread.sleep(millis, nanos)
            }
        }
    }

    companion object {
        private const val CHUNK = 64 * 1024

        const val DEFAULT_ISP_JSON =
            """{"processedString":"203.0.113.7 - Example Telecom, Springfield, US (12.30 km)",""" +
                """"query":"203.0.113.7","rawIspInfo":{"isp":"Example Telecom",""" +
                """"org":"Example Telecom","city":"Springfield","country":"US","as":"AS64496"}}"""
    }
}
