package io.github.flyboyhigh777.speedmeter.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import io.github.flyboyhigh777.speedmeter.engine.ConnectionScalingConfig
import io.github.flyboyhigh777.speedmeter.engine.EngineConfig
import io.github.flyboyhigh777.speedmeter.engine.LoadedLatencyConfig
import io.github.flyboyhigh777.speedmeter.engine.StableStopConfig
import io.github.flyboyhigh777.speedmeter.engine.SuiteConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Which server the test should use. */
enum class ServerMode { NEAREST_EDGE, PUBLIC_LIST, CUSTOM }

/** How hard the test should work the link. */
enum class MeasurementProfile(val durationSeconds: Double, val connections: Int) {
    LOW_DATA(durationSeconds = 7.0, connections = 2),
    STANDARD(durationSeconds = 12.0, connections = 4),
    THOROUGH(durationSeconds = 20.0, connections = 8),
}

/** Everything the user can change, and the only place defaults are stated. */
data class SpeedMeterSettings(
    val serverMode: ServerMode = ServerMode.NEAREST_EDGE,
    val customServerUrl: String = "",
    /** Server chosen from the public list, remembered between runs. */
    val selectedListServerUrl: String = "",
    val selectedListServerName: String = "",
    val profile: MeasurementProfile = MeasurementProfile.STANDARD,
    val stableStopEnabled: Boolean = true,
    val connectionScalingEnabled: Boolean = true,
    val loadedLatencyEnabled: Boolean = true,
    val uploadFirst: Boolean = false,
) {
    /**
     * Builds the engine configuration these settings describe.
     *
     * The profile sets duration and starting connections together, because a short run with many
     * connections and a long one with few measure different things and neither is "the" default.
     */
    fun toSuiteConfig(): SuiteConfig {
        val base = SuiteConfig()
        return base.copy(
            engine = EngineConfig(
                threadCount = profile.connections,
                testDurationSeconds = profile.durationSeconds,
                minTestDurationSeconds = (profile.durationSeconds / 3.0).coerceAtMost(5.0),
                uploadFirst = uploadFirst,
            ),
            stableStop = StableStopConfig(enabled = stableStopEnabled),
            connectionScaling = ConnectionScalingConfig(
                enabled = connectionScalingEnabled,
                maxConnections = (profile.connections * 4).coerceAtMost(32),
            ),
            loadedLatency = LoadedLatencyConfig(enabled = loadedLatencyEnabled),
        )
    }
}

private val Context.settingsStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

/** Reads and writes [SpeedMeterSettings]. */
class SettingsRepository(private val context: Context) {

    val settings: Flow<SpeedMeterSettings> = context.settingsStore.data.map { preferences ->
        SpeedMeterSettings(
            serverMode = preferences[Keys.SERVER_MODE]
                ?.let { name -> ServerMode.entries.firstOrNull { it.name == name } }
                ?: ServerMode.NEAREST_EDGE,
            customServerUrl = preferences[Keys.CUSTOM_URL].orEmpty(),
            selectedListServerUrl = preferences[Keys.LIST_URL].orEmpty(),
            selectedListServerName = preferences[Keys.LIST_NAME].orEmpty(),
            profile = preferences[Keys.PROFILE]
                ?.let { name -> MeasurementProfile.entries.firstOrNull { it.name == name } }
                ?: MeasurementProfile.STANDARD,
            stableStopEnabled = preferences[Keys.STABLE_STOP] ?: true,
            connectionScalingEnabled = preferences[Keys.SCALING] ?: true,
            loadedLatencyEnabled = preferences[Keys.LOADED_LATENCY] ?: true,
            uploadFirst = preferences[Keys.UPLOAD_FIRST] ?: false,
        )
    }

    suspend fun setServerMode(mode: ServerMode) = edit { it[Keys.SERVER_MODE] = mode.name }

    suspend fun setCustomServerUrl(url: String) = edit { it[Keys.CUSTOM_URL] = url.trim() }

    suspend fun setSelectedListServer(url: String, name: String) = edit {
        it[Keys.LIST_URL] = url
        it[Keys.LIST_NAME] = name
        it[Keys.SERVER_MODE] = ServerMode.PUBLIC_LIST.name
    }

    suspend fun setProfile(profile: MeasurementProfile) = edit { it[Keys.PROFILE] = profile.name }

    suspend fun setStableStop(enabled: Boolean) = edit { it[Keys.STABLE_STOP] = enabled }

    suspend fun setConnectionScaling(enabled: Boolean) = edit { it[Keys.SCALING] = enabled }

    suspend fun setLoadedLatency(enabled: Boolean) = edit { it[Keys.LOADED_LATENCY] = enabled }

    suspend fun setUploadFirst(enabled: Boolean) = edit { it[Keys.UPLOAD_FIRST] = enabled }

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.settingsStore.edit(block)
    }

    private object Keys {
        val SERVER_MODE = stringPreferencesKey("server_mode")
        val CUSTOM_URL = stringPreferencesKey("custom_server_url")
        val LIST_URL = stringPreferencesKey("list_server_url")
        val LIST_NAME = stringPreferencesKey("list_server_name")
        val PROFILE = stringPreferencesKey("profile")
        val STABLE_STOP = booleanPreferencesKey("stable_stop")
        val SCALING = booleanPreferencesKey("connection_scaling")
        val LOADED_LATENCY = booleanPreferencesKey("loaded_latency")
        val UPLOAD_FIRST = booleanPreferencesKey("upload_first")
    }
}
