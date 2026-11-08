package io.github.flyboyhigh777.speedmeter.engine

/**
 * Ranking applied to a set of latency samples to produce one representative value.
 *
 * Mirrors the ranking choices observed in the reference implementation's server-selection and
 * latency stages (see docs/REVERSE_ENGINEERING.md).
 */
enum class LatencyRanking { MINIMUM, AVERAGE, MEDIAN, AVERAGE_OF_MEDIAN_HALF }

/** Which side of the connection produced the authoritative byte count for a transfer stage. */
enum class MeasureMethod { CLIENT, SERVER }

/**
 * Stop condition for a transfer stage: the stage ends early once throughput has settled,
 * instead of always burning the full [EngineConfig.testDurationSeconds].
 *
 * Two exponential moving averages are tracked over the per-sample throughput. When the relative
 * gap between the fast and slow average stays under [stopDelta] for [stopCount] consecutive
 * samples, the stage is considered stable. [minTestDurationSeconds] always wins over an early stop.
 */
data class StableStopConfig(
    val enabled: Boolean = true,
    /** Number of samples in the responsive average. */
    val fastEmaPeriod: Int = 4,
    /** Number of samples in the smoothed average. */
    val slowEmaPeriod: Int = 12,
    /** Maximum relative difference between the two averages that still counts as "stable". */
    val stopDelta: Double = 0.07,
    /** Consecutive stable samples required before the stage stops. */
    val stopCount: Int = 6,
    /** When true the stage reports the windowed mean, otherwise the slow average. */
    val averageUsedForStop: Boolean = true,
) {
    init {
        require(fastEmaPeriod in 1..slowEmaPeriod) { "fastEmaPeriod must be >= 1 and <= slowEmaPeriod" }
        require(stopDelta > 0.0) { "stopDelta must be positive" }
        require(stopCount >= 1) { "stopCount must be >= 1" }
    }
}

/**
 * Adds connections while a transfer stage is still gaining throughput, which is what lets a
 * single test saturate both a slow mobile link and a multi-gigabit one.
 */
data class ConnectionScalingConfig(
    val enabled: Boolean = true,
    /** Relative throughput gain between checks that justifies opening another connection. */
    val factor: Double = 0.12,
    val maxConnections: Int = 16,
    /** How long to wait between scaling decisions. */
    val checkIntervalMillis: Long = 600,
) {
    init {
        require(maxConnections >= 1) { "maxConnections must be >= 1" }
        require(factor > 0.0) { "factor must be positive" }
    }
}

/** Unloaded latency / jitter measurement. */
data class LatencyConfig(
    val pingCount: Int = 10,
    val ranking: LatencyRanking = LatencyRanking.MINIMUM,
    val timeoutMillis: Int = 3_000,
    /** Pause between probes, so a probe train does not itself congest the link. */
    val intervalMillis: Long = 60,
) {
    init { require(pingCount >= 1) { "pingCount must be >= 1" } }
}

/**
 * Latency measured *while* a transfer stage saturates the link - the "responsiveness" or
 * bufferbloat figure. Probes are sent in bursts so each burst costs little bandwidth.
 */
data class LoadedLatencyConfig(
    val enabled: Boolean = true,
    val minBurstCount: Int = 3,
    val maxBurstCount: Int = 8,
    val minDelayMillis: Long = 150,
    val maxDelayMillis: Long = 400,
    val timeoutMillis: Int = 4_000,
)

/** Server selection: probe a handful of candidates and keep the fastest. */
data class ServerSelectionConfig(
    /** How many candidates to probe. */
    val serverCount: Int = 5,
    /** How many candidates to probe at the same time. */
    val maxConcurrency: Int = 4,
    val pingCount: Int = 3,
    val ranking: LatencyRanking = LatencyRanking.MINIMUM,
    val timeoutMillis: Int = 2_000,
) {
    init {
        require(serverCount >= 1) { "serverCount must be >= 1" }
        require(maxConcurrency >= 1) { "maxConcurrency must be >= 1" }
    }
}

/**
 * Transport-level knobs shared by the download and upload stages.
 *
 * Defaults are deliberately conservative: a mobile data cap is easier to respect than to refund.
 */
data class EngineConfig(
    /** Connections opened at the start of a transfer stage. */
    val threadCount: Int = 4,
    val testDurationSeconds: Double = 12.0,
    val minTestDurationSeconds: Double = 4.0,
    /** Hard byte ceiling per transfer stage across all connections. 0 means unlimited. */
    val downloadMaxBytes: Long = 1_500_000_000,
    val uploadMaxBytes: Long = 800_000_000,
    /** Hard byte ceiling for a single connection. 0 means unlimited. */
    val downloadMaxBytesPerConnection: Long = 0,
    val uploadMaxBytesPerConnection: Long = 0,
    /** Read/write chunk size. */
    val packetSizeBytes: Int = 64 * 1024,
    val connectTimeoutMillis: Int = 8_000,
    val networkTimeoutMillis: Int = 15_000,
    /** Run the upload stage before the download stage. */
    val uploadFirst: Boolean = false,
    /** Progress sample rate. */
    val updatesPerSecond: Int = 10,
    /**
     * Opening window excluded from the final aggregate, covering TCP slow start and TLS setup.
     * The reference implementation calls the equivalent step a "primer" stage.
     */
    val warmupSeconds: Double = 1.0,
    val measureMethod: MeasureMethod = MeasureMethod.CLIENT,
) {
    init {
        require(threadCount >= 1) { "threadCount must be >= 1" }
        require(testDurationSeconds > 0) { "testDurationSeconds must be positive" }
        require(minTestDurationSeconds in 0.0..testDurationSeconds) {
            "minTestDurationSeconds must be between 0 and testDurationSeconds"
        }
        require(packetSizeBytes > 0) { "packetSizeBytes must be positive" }
        require(updatesPerSecond in 1..100) { "updatesPerSecond must be between 1 and 100" }
    }

    val sampleIntervalMillis: Long get() = (1_000L / updatesPerSecond).coerceAtLeast(1L)
}

/** Full configuration of one test run. */
data class SuiteConfig(
    val engine: EngineConfig = EngineConfig(),
    val latency: LatencyConfig = LatencyConfig(),
    val loadedLatency: LoadedLatencyConfig = LoadedLatencyConfig(),
    val stableStop: StableStopConfig = StableStopConfig(),
    val connectionScaling: ConnectionScalingConfig = ConnectionScalingConfig(),
    val serverSelection: ServerSelectionConfig = ServerSelectionConfig(),
    /** Stages to run, in order. Transfer stage order is still governed by [EngineConfig.uploadFirst]. */
    val stages: List<StageType> = listOf(
        StageType.METADATA,
        StageType.SERVER_SELECTION,
        StageType.LATENCY,
        StageType.DOWNLOAD,
        StageType.UPLOAD,
    ),
) {
    companion object {
        /** Lower data use and a shorter run, for metered connections. */
        fun lowData(): SuiteConfig = SuiteConfig(
            engine = EngineConfig(
                threadCount = 2,
                testDurationSeconds = 7.0,
                minTestDurationSeconds = 3.0,
                downloadMaxBytes = 120_000_000,
                uploadMaxBytes = 60_000_000,
            ),
            connectionScaling = ConnectionScalingConfig(enabled = true, maxConnections = 6),
        )
    }
}

/** Stages a run can be composed of. Named after the stages found in the reference engine. */
enum class StageType { METADATA, SERVER_SELECTION, LATENCY, DOWNLOAD, UPLOAD }
