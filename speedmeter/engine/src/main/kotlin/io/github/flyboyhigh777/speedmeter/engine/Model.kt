package io.github.flyboyhigh777.speedmeter.engine

/** A single throughput sample taken by the stage sampler. */
data class ThroughputSample(
    /** Milliseconds since the stage started. */
    val elapsedMillis: Long,
    /** Bytes transferred since the previous sample. */
    val deltaBytes: Long,
    /** Bytes transferred since the stage started. */
    val totalBytes: Long,
    /** Instantaneous rate for this sample. */
    val bitsPerSecond: Double,
    /** Responsive moving average at this sample. */
    val fastAverageBitsPerSecond: Double,
    /** Smoothed moving average at this sample. */
    val slowAverageBitsPerSecond: Double,
    /** Connections open when the sample was taken. */
    val connections: Int,
)

/** Summary of a latency probe set. */
data class LatencyStats(
    /** Representative latency per the configured [LatencyRanking]. */
    val latencyMillis: Double,
    val minMillis: Double,
    val maxMillis: Double,
    val averageMillis: Double,
    /** Mean absolute difference between consecutive probes. */
    val jitterMillis: Double,
    val sampleCount: Int,
    val lostCount: Int,
) {
    /** Share of probes that never came back, in percent. */
    val lossPercent: Double
        get() {
            val attempted = sampleCount + lostCount
            return if (attempted == 0) 0.0 else lostCount * 100.0 / attempted
        }

    companion object {
        val EMPTY = LatencyStats(Double.NaN, Double.NaN, Double.NaN, Double.NaN, Double.NaN, 0, 0)
    }
}

/** Result of one transfer stage. */
data class TransferResult(
    val stage: StageType,
    /** Aggregate rate over the measured window, excluding the warm-up. */
    val bitsPerSecond: Double,
    /** Highest smoothed rate seen during the stage. */
    val peakBitsPerSecond: Double,
    val totalBytes: Long,
    val elapsedMillis: Long,
    /** Connections open at the end of the stage. */
    val connections: Int,
    /** Latency measured while the link was saturated, when enabled. */
    val loadedLatency: LatencyStats?,
    /** True when the stage ended because throughput settled rather than on the duration cap. */
    val stoppedEarly: Boolean,
) {
    val megabitsPerSecond: Double get() = Units.bitsPerSecondToMbps(bitsPerSecond)
}

/** A server the engine can test against. */
data class TestServer(
    val id: String,
    val name: String,
    val sponsor: String,
    val location: String,
    val country: String,
    /** Base URL of the backend endpoints. */
    val url: String,
    val backend: BackendKind,
    val distanceKm: Double? = null,
) {
    val label: String get() = if (sponsor.isBlank()) name else "$sponsor - $location"
}

/** Which wire protocol a server speaks. */
enum class BackendKind { LIBRESPEED, CLOUDFLARE }

/** Client-side network identity reported by the backend. */
data class ClientMetadata(
    val ipAddress: String? = null,
    val isp: String? = null,
    val city: String? = null,
    val country: String? = null,
    val asn: String? = null,
)

/** Everything one completed run produced. */
data class TestResult(
    val startedAtEpochMillis: Long,
    val server: TestServer?,
    val metadata: ClientMetadata,
    val idleLatency: LatencyStats,
    val download: TransferResult?,
    val upload: TransferResult?,
    val config: SuiteConfig,
) {
    val downloadMbps: Double get() = download?.megabitsPerSecond ?: Double.NaN
    val uploadMbps: Double get() = upload?.megabitsPerSecond ?: Double.NaN
    val totalBytes: Long get() = (download?.totalBytes ?: 0L) + (upload?.totalBytes ?: 0L)
}

/** Why a run ended without a result. */
sealed interface TestFailure {
    val message: String

    data class NoServerAvailable(override val message: String) : TestFailure
    data class MetadataFailed(override val message: String) : TestFailure
    data class LatencyFailed(override val message: String) : TestFailure
    data class TransferFailed(val stage: StageType, override val message: String) : TestFailure
    data class Cancelled(override val message: String = "Test cancelled") : TestFailure
}

/** Progress and lifecycle events emitted while a run is in flight. */
sealed interface TestEvent {
    data class StageStarted(val stage: StageType) : TestEvent

    data class ServerSelectionProgress(
        val server: TestServer,
        val latency: LatencyStats?,
        val probed: Int,
        val total: Int,
    ) : TestEvent

    data class ServerSelected(val server: TestServer, val latency: LatencyStats) : TestEvent

    data class MetadataReady(val metadata: ClientMetadata) : TestEvent

    data class LatencyProgress(val completed: Int, val total: Int, val lastMillis: Double?) : TestEvent

    data class LatencyReady(val stats: LatencyStats) : TestEvent

    /** Live transfer progress. [progress] runs 0..1 over the stage's expected duration. */
    data class TransferProgress(
        val stage: StageType,
        val sample: ThroughputSample,
        val progress: Double,
    ) : TestEvent

    data class TransferReady(val result: TransferResult) : TestEvent

    data class Completed(val result: TestResult) : TestEvent

    data class Failed(val failure: TestFailure) : TestEvent
}
