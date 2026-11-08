package io.github.flyboyhigh777.speedmeter.data

import android.content.Context
import io.github.flyboyhigh777.speedmeter.engine.TestResult
import java.io.File
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * One stored result.
 *
 * This is a flat record of its own rather than the engine's [TestResult]: history has to survive
 * app updates that change the engine's model, and a stored row should not break because a config
 * field was added. Unknown fields are tolerated and missing ones default, so an older file still
 * loads.
 */
@Serializable
data class HistoryEntry(
    val startedAtEpochMillis: Long,
    val downloadMbps: Double,
    val uploadMbps: Double,
    val pingMillis: Double,
    val jitterMillis: Double,
    val lossPercent: Double,
    val loadedLatencyMillis: Double? = null,
    val serverLabel: String = "",
    val serverUrl: String = "",
    val isp: String = "",
    val ipAddress: String = "",
    val connectionType: String = "",
    val totalBytes: Long = 0,
) {
    companion object {
        fun from(result: TestResult, connectionType: String): HistoryEntry = HistoryEntry(
            startedAtEpochMillis = result.startedAtEpochMillis,
            downloadMbps = result.downloadMbps,
            uploadMbps = result.uploadMbps,
            pingMillis = result.idleLatency.latencyMillis,
            jitterMillis = result.idleLatency.jitterMillis,
            lossPercent = result.idleLatency.lossPercent,
            loadedLatencyMillis = result.download?.loadedLatency?.latencyMillis,
            serverLabel = result.server?.label.orEmpty(),
            serverUrl = result.server?.url.orEmpty(),
            isp = result.metadata.isp.orEmpty(),
            ipAddress = result.metadata.ipAddress.orEmpty(),
            connectionType = connectionType,
            totalBytes = result.totalBytes,
        )
    }
}

/**
 * Stores results in a single JSON file.
 *
 * A file rather than a database: the data is a short list written once per test and read whole, so
 * a schema and a migration framework would cost more than they would buy. A corrupt or
 * partly-written file is reported as empty history rather than crashing the app on launch, and the
 * write goes through a temporary file so an interrupted save cannot destroy the previous list.
 */
class HistoryRepository(context: Context) {

    private val file = File(context.filesDir, FILE_NAME)
    private val temporaryFile = File(context.filesDir, "$FILE_NAME.tmp")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _entries = MutableStateFlow<List<HistoryEntry>>(emptyList())
    val entries: StateFlow<List<HistoryEntry>> = _entries.asStateFlow()

    /** Loads the stored list. Returns the number of entries read. */
    suspend fun load(): Int = withContext(Dispatchers.IO) {
        val loaded = readFile()
        _entries.value = loaded
        loaded.size
    }

    suspend fun add(entry: HistoryEntry) = withContext(Dispatchers.IO) {
        val updated = (listOf(entry) + readFile()).take(MAX_ENTRIES)
        writeFile(updated)
        _entries.value = updated
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        file.delete()
        temporaryFile.delete()
        _entries.value = emptyList()
    }

    private fun readFile(): List<HistoryEntry> {
        if (!file.exists()) return emptyList()
        return try {
            json.decodeFromString<List<HistoryEntry>>(file.readText())
        } catch (_: Exception) {
            // Unreadable history is a lost convenience, not a reason to fail to start. The file is
            // left in place so it can still be recovered by hand.
            emptyList()
        }
    }

    private fun writeFile(entries: List<HistoryEntry>) {
        try {
            temporaryFile.writeText(json.encodeToString(entries))
            if (!temporaryFile.renameTo(file)) {
                // A rename across the same directory should not fail; if it does, fall back to a
                // direct write rather than silently dropping the newest result.
                file.writeText(temporaryFile.readText())
                temporaryFile.delete()
            }
        } catch (_: IOException) {
            // Storage is full or unavailable. The in-memory list still shows this session's runs.
        }
    }

    private companion object {
        const val FILE_NAME = "history.json"

        /** Keeps the file small enough to read whole on the main-thread-free IO dispatcher. */
        const val MAX_ENTRIES = 500
    }
}
