package io.github.flyboyhigh777.speedmeter.engine

import io.github.flyboyhigh777.speedmeter.engine.net.HttpClient
import io.github.flyboyhigh777.speedmeter.engine.net.HttpRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Where the candidate servers come from.
 *
 * Cloudflare's anycast endpoint is the built-in default because it needs no list and no selection
 * step: the nearest edge answers wherever the device is. A LibreSpeed list - the public one or a
 * self-hosted one - can be layered on top for users who want to choose, or to test against their
 * own hardware.
 */
class ServerDirectory(private val client: HttpClient) {

    /**
     * Fetches a LibreSpeed-format server list.
     *
     * Entries that carry no usable server URL are dropped rather than guessed at; a list that is
     * partly malformed still yields the servers that did parse.
     */
    suspend fun fetchLibreSpeedList(listUrl: String): List<TestServer> = withContext(Dispatchers.IO) {
        val body = client.readText(HttpRequest(url = listUrl), maxBytes = 512 * 1024)
        val entries = JSON.decodeFromString<List<LibreSpeedEntry>>(body)
        entries.mapIndexedNotNull { index, entry -> entry.toServer(index) }
    }

    @Serializable
    private data class LibreSpeedEntry(
        val name: String? = null,
        val server: String? = null,
        val sponsorName: String? = null,
        @SerialName("dlURL") val downloadPath: String? = null,
    ) {
        fun toServer(index: Int): TestServer? {
            val base = server?.trim()?.takeIf { it.isNotEmpty() } ?: return null
            // List entries use a protocol-relative host ("//host/backend"); HTTPS is the only
            // sensible completion, and a plaintext fallback would silently weaken the test.
            val url = when {
                base.startsWith("//") -> "https:$base"
                base.startsWith("http://") || base.startsWith("https://") -> base
                else -> "https://$base"
            }
            val label = name?.trim().orEmpty()
            return TestServer(
                id = "librespeed-$index-${label.hashCode()}",
                name = label.ifEmpty { url },
                sponsor = sponsorName?.trim().orEmpty(),
                location = label,
                country = "",
                url = url.trimEnd('/'),
                backend = BackendKind.LIBRESPEED,
            )
        }
    }

    companion object {
        /** Public LibreSpeed server list. */
        const val LIBRESPEED_PUBLIC_LIST = "https://librespeed.org/backend-servers/servers.php"

        /** Anycast endpoint served by whichever edge is closest to the device. */
        val CLOUDFLARE: TestServer = TestServer(
            id = "cloudflare-anycast",
            name = "Cloudflare (nearest edge)",
            sponsor = "Cloudflare",
            location = "Anycast",
            country = "",
            url = "https://speed.cloudflare.com",
            backend = BackendKind.CLOUDFLARE,
        )

        /** Servers available with no network lookup at all. */
        val BUILT_IN: List<TestServer> = listOf(CLOUDFLARE)

        /** Builds a server for a self-hosted LibreSpeed backend. */
        fun libreSpeed(url: String, label: String = url): TestServer = TestServer(
            id = "custom-${url.hashCode()}",
            name = label,
            sponsor = "",
            location = label,
            country = "",
            url = url.trimEnd('/'),
            backend = BackendKind.LIBRESPEED,
        )

        private val JSON = Json { ignoreUnknownKeys = true; isLenient = true }
    }
}
