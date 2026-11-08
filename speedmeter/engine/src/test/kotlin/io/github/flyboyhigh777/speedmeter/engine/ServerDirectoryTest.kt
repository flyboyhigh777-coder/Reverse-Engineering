package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerDirectoryTest {

    @Test
    fun `the built-in server needs no network lookup`() {
        assertEquals(listOf(ServerDirectory.CLOUDFLARE), ServerDirectory.BUILT_IN)
        assertEquals(BackendKind.CLOUDFLARE, ServerDirectory.CLOUDFLARE.backend)
    }

    @Test
    fun `a custom librespeed url keeps its path and loses a trailing slash`() {
        val server = ServerDirectory.libreSpeed("https://speed.example.test/backend/", "Home NAS")

        assertEquals("https://speed.example.test/backend", server.url)
        assertEquals("Home NAS", server.name)
        assertEquals(BackendKind.LIBRESPEED, server.backend)
    }

    @Test
    fun `a librespeed list is parsed and protocol-relative hosts become https`() = runBlocking {
        val body = """
            [
              {"name":"Alpha","server":"//alpha.example.test/backend/","sponsorName":"Alpha Ltd"},
              {"name":"Beta","server":"https://beta.example.test/backend"},
              {"name":"Broken"}
            ]
        """.trimIndent()

        FakeJsonServer(body).use { json ->
            val directory = ServerDirectory(HttpClient(2_000, 5_000, "test"))
            val servers = directory.fetchLibreSpeedList(json.url)

            // The entry with no server URL is dropped rather than guessed at.
            assertEquals(2, servers.size)
            assertEquals("https://alpha.example.test/backend", servers[0].url)
            assertEquals("Alpha Ltd", servers[0].sponsor)
            assertEquals("https://beta.example.test/backend", servers[1].url)
            assertTrue(servers.all { it.backend == BackendKind.LIBRESPEED })
        }
    }
}

/** Serves one fixed JSON body. */
private class FakeJsonServer(body: String) : AutoCloseable {
    private val server = com.sun.net.httpserver.HttpServer.create(
        java.net.InetSocketAddress("127.0.0.1", 0),
        4,
    )
    val url: String get() = "http://127.0.0.1:${server.address.port}/list"

    init {
        val bytes = body.toByteArray()
        server.createContext("/list") { exchange ->
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
            exchange.close()
        }
        server.start()
    }

    override fun close() = server.stop(0)
}
