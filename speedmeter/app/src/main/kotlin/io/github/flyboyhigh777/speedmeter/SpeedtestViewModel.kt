package io.github.flyboyhigh777.speedmeter

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.flyboyhigh777.speedmeter.data.ConnectionType
import io.github.flyboyhigh777.speedmeter.data.HistoryEntry
import io.github.flyboyhigh777.speedmeter.data.HistoryRepository
import io.github.flyboyhigh777.speedmeter.data.MeasurementProfile
import io.github.flyboyhigh777.speedmeter.data.NetworkStatusProvider
import io.github.flyboyhigh777.speedmeter.data.ServerMode
import io.github.flyboyhigh777.speedmeter.data.SettingsRepository
import io.github.flyboyhigh777.speedmeter.data.SpeedMeterSettings
import io.github.flyboyhigh777.speedmeter.engine.ClientMetadata
import io.github.flyboyhigh777.speedmeter.engine.LatencyStats
import io.github.flyboyhigh777.speedmeter.engine.ServerDirectory
import io.github.flyboyhigh777.speedmeter.engine.SpeedtestEngine
import io.github.flyboyhigh777.speedmeter.engine.StageType
import io.github.flyboyhigh777.speedmeter.engine.TestEvent
import io.github.flyboyhigh777.speedmeter.engine.TestFailure
import io.github.flyboyhigh777.speedmeter.engine.TestServer
import io.github.flyboyhigh777.speedmeter.engine.TransferResult
import io.github.flyboyhigh777.speedmeter.engine.Units
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch

/** What the test screen is doing right now. */
enum class Phase { IDLE, SELECTING, METADATA, LATENCY, DOWNLOAD, UPLOAD, DONE, FAILED }

/** Everything the test screen draws. */
data class TestUiState(
    val phase: Phase = Phase.IDLE,
    /** Live reading for the gauge, in Mbit/s. */
    val liveMbps: Double = 0.0,
    val peakMbps: Double = 0.0,
    /** Stage progress in 0..1, for the ring under the gauge. */
    val progress: Double = 0.0,
    val idleLatency: LatencyStats? = null,
    val download: TransferResult? = null,
    val upload: TransferResult? = null,
    val metadata: ClientMetadata = ClientMetadata(),
    val server: TestServer? = null,
    val serverLatencyMillis: Double? = null,
    val connection: ConnectionType = ConnectionType.OTHER,
    val openConnections: Int = 0,
    val transferredBytes: Long = 0,
    val error: String? = null,
) {
    val isRunning: Boolean
        get() = phase != Phase.IDLE && phase != Phase.DONE && phase != Phase.FAILED

    /** Download Mbit/s once measured, otherwise the live reading during the download stage. */
    val downloadMbps: Double
        get() = download?.megabitsPerSecond
            ?: if (phase == Phase.DOWNLOAD) liveMbps else Double.NaN

    val uploadMbps: Double
        get() = upload?.megabitsPerSecond
            ?: if (phase == Phase.UPLOAD) liveMbps else Double.NaN
}

/** State of the public server list screen. */
sealed interface ServerListState {
    data object Idle : ServerListState
    data object Loading : ServerListState
    data class Loaded(val servers: List<TestServer>) : ServerListState
    data class Failed(val message: String) : ServerListState
}

/**
 * Drives one test run and owns the screen state.
 *
 * The run is a single job so that stopping is a cancellation rather than a flag the engine has to
 * check: a cancelled run leaves no half-finished result behind and writes nothing to history.
 */
class SpeedtestViewModel(application: Application) : AndroidViewModel(application) {

    private val settingsRepository = SettingsRepository(application)
    private val networkStatus = NetworkStatusProvider(application)
    val history = HistoryRepository(application)

    private val _uiState = MutableStateFlow(TestUiState())
    val uiState: StateFlow<TestUiState> = _uiState.asStateFlow()

    private val _serverList = MutableStateFlow<ServerListState>(ServerListState.Idle)
    val serverList: StateFlow<ServerListState> = _serverList.asStateFlow()

    val settings: StateFlow<SpeedMeterSettings> = settingsRepository.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, SpeedMeterSettings())

    private var runJob: Job? = null

    init {
        _uiState.value = _uiState.value.copy(connection = networkStatus.current())
        viewModelScope.launch { history.load() }
    }

    fun start() {
        if (runJob?.isActive == true) return

        _uiState.value = TestUiState(
            phase = Phase.SELECTING,
            connection = networkStatus.current(),
        )

        runJob = viewModelScope.launch {
            val current = settingsRepository.settings.first()
            val candidates = candidatesFor(current)
            if (candidates.isEmpty()) {
                _uiState.value = _uiState.value.copy(
                    phase = Phase.FAILED,
                    error = getApplication<Application>().getString(R.string.error_no_server),
                )
                return@launch
            }

            val engine = SpeedtestEngine(current.toSuiteConfig())
            engine.run(candidates).collect { event -> reduce(event) }
        }
    }

    fun stop() {
        runJob?.cancel()
        runJob = null
        _uiState.value = _uiState.value.copy(phase = Phase.IDLE, liveMbps = 0.0, progress = 0.0)
    }

    fun reset() {
        stop()
        _uiState.value = TestUiState(connection = networkStatus.current())
    }

    /** Loads the public LibreSpeed list, keeping the built-in edge at the top of the result. */
    fun loadServerList() {
        if (_serverList.value is ServerListState.Loading) return
        _serverList.value = ServerListState.Loading
        viewModelScope.launch {
            val engine = SpeedtestEngine()
            val result = runCatching {
                engine.serverDirectory.fetchLibreSpeedList(ServerDirectory.LIBRESPEED_PUBLIC_LIST)
            }
            _serverList.value = result.fold(
                onSuccess = { servers -> ServerListState.Loaded(ServerDirectory.BUILT_IN + servers) },
                onFailure = { error -> ServerListState.Failed(error.message ?: error.toString()) },
            )
        }
    }

    fun selectServerFromList(server: TestServer) {
        viewModelScope.launch {
            if (server.backend == ServerDirectory.CLOUDFLARE.backend) {
                settingsRepository.setServerMode(ServerMode.NEAREST_EDGE)
            } else {
                settingsRepository.setSelectedListServer(server.url, server.label)
            }
        }
    }

    fun setServerMode(mode: ServerMode) = viewModelScope.launch {
        settingsRepository.setServerMode(mode)
    }

    fun setCustomServerUrl(url: String) = viewModelScope.launch {
        settingsRepository.setCustomServerUrl(url)
    }

    fun setProfile(profile: MeasurementProfile) = viewModelScope.launch {
        settingsRepository.setProfile(profile)
    }

    fun setStableStop(enabled: Boolean) = viewModelScope.launch {
        settingsRepository.setStableStop(enabled)
    }

    fun setConnectionScaling(enabled: Boolean) = viewModelScope.launch {
        settingsRepository.setConnectionScaling(enabled)
    }

    fun setLoadedLatency(enabled: Boolean) = viewModelScope.launch {
        settingsRepository.setLoadedLatency(enabled)
    }

    fun setUploadFirst(enabled: Boolean) = viewModelScope.launch {
        settingsRepository.setUploadFirst(enabled)
    }

    fun clearHistory() = viewModelScope.launch { history.clear() }

    /** Human-readable summary of the finished run, for the share sheet. */
    fun shareText(): String? {
        val state = _uiState.value
        if (state.phase != Phase.DONE) return null
        val lines = buildList {
            add("SpeedMeter")
            add("Download: ${Units.formatMbps(state.downloadMbps)} Mbps")
            add("Upload: ${Units.formatMbps(state.uploadMbps)} Mbps")
            state.idleLatency?.let {
                add("Ping: ${Units.formatMillis(it.latencyMillis)} ms")
                add("Jitter: ${Units.formatMillis(it.jitterMillis)} ms")
            }
            state.download?.loadedLatency?.let {
                add("Loaded latency: ${Units.formatMillis(it.latencyMillis)} ms")
            }
            state.server?.let { add("Server: ${it.label}") }
            state.metadata.isp?.let { add("Provider: $it") }
            add("Data used: ${Units.formatBytes(state.transferredBytes)}")
        }
        return lines.joinToString("\n")
    }

    private suspend fun candidatesFor(current: SpeedMeterSettings): List<TestServer> =
        when (current.serverMode) {
            ServerMode.NEAREST_EDGE -> ServerDirectory.BUILT_IN
            ServerMode.CUSTOM -> current.customServerUrl
                .takeIf { it.isValidHttpUrl() }
                ?.let { listOf(ServerDirectory.libreSpeed(it)) }
                ?: ServerDirectory.BUILT_IN
            ServerMode.PUBLIC_LIST -> current.selectedListServerUrl
                .takeIf { it.isValidHttpUrl() }
                ?.let {
                    listOf(
                        ServerDirectory.libreSpeed(
                            it,
                            current.selectedListServerName.ifBlank { it },
                        )
                    )
                }
                ?: ServerDirectory.BUILT_IN
        }

    private fun reduce(event: TestEvent) {
        val state = _uiState.value
        _uiState.value = when (event) {
            is TestEvent.StageStarted -> state.copy(
                phase = when (event.stage) {
                    StageType.SERVER_SELECTION -> Phase.SELECTING
                    StageType.METADATA -> Phase.METADATA
                    StageType.LATENCY -> Phase.LATENCY
                    StageType.DOWNLOAD -> Phase.DOWNLOAD
                    StageType.UPLOAD -> Phase.UPLOAD
                },
                // Each transfer stage starts its own gauge sweep; carrying the previous stage's
                // reading over would show an upload figure before a single byte was sent.
                liveMbps = 0.0,
                peakMbps = 0.0,
                progress = 0.0,
            )

            is TestEvent.ServerSelectionProgress -> state

            is TestEvent.ServerSelected -> state.copy(
                server = event.server,
                serverLatencyMillis = event.latency.latencyMillis,
            )

            is TestEvent.MetadataReady -> state.copy(metadata = event.metadata)

            is TestEvent.LatencyProgress -> state.copy(
                progress = event.completed.toDouble() / event.total,
            )

            is TestEvent.LatencyReady -> state.copy(idleLatency = event.stats, progress = 1.0)

            is TestEvent.TransferProgress -> state.copy(
                liveMbps = Units.bitsPerSecondToMbps(event.sample.fastAverageBitsPerSecond),
                peakMbps = Units.bitsPerSecondToMbps(
                    maxOf(event.sample.slowAverageBitsPerSecond, 0.0)
                ).coerceAtLeast(state.peakMbps),
                progress = event.progress,
                openConnections = event.sample.connections,
                transferredBytes = (state.download?.totalBytes ?: 0L) + event.sample.totalBytes,
            )

            is TestEvent.TransferReady -> when (event.result.stage) {
                StageType.DOWNLOAD -> state.copy(download = event.result, liveMbps = event.result.megabitsPerSecond)
                else -> state.copy(upload = event.result, liveMbps = event.result.megabitsPerSecond)
            }

            is TestEvent.Completed -> {
                val result = event.result
                viewModelScope.launch {
                    history.add(HistoryEntry.from(result, state.connection.name))
                }
                state.copy(
                    phase = Phase.DONE,
                    server = result.server ?: state.server,
                    metadata = result.metadata,
                    idleLatency = result.idleLatency,
                    download = result.download,
                    upload = result.upload,
                    transferredBytes = result.totalBytes,
                    progress = 1.0,
                )
            }

            is TestEvent.Failed -> state.copy(
                phase = Phase.FAILED,
                error = when (val failure = event.failure) {
                    is TestFailure.NoServerAvailable ->
                        getApplication<Application>().getString(R.string.error_no_server)
                    else -> failure.message
                },
            )
        }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(
                modelClass: Class<T>,
                extras: androidx.lifecycle.viewmodel.CreationExtras,
            ): T {
                val application = extras[androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]
                    ?: error("Application is required to create SpeedtestViewModel")
                return SpeedtestViewModel(application) as T
            }
        }
    }
}

/** True for an absolute http(s) URL; anything else would be a silent misconfiguration. */
fun String.isValidHttpUrl(): Boolean {
    val trimmed = trim()
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false
    return runCatching { java.net.URL(trimmed).host?.isNotBlank() == true }.getOrDefault(false)
}
