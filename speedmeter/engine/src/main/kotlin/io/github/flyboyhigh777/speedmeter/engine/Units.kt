package io.github.flyboyhigh777.speedmeter.engine

/** Throughput and size helpers. The engine works in bits per second internally. */
object Units {
    const val BITS_PER_BYTE = 8.0
    const val KILO = 1_000.0
    const val MEGA = 1_000_000.0
    const val GIGA = 1_000_000_000.0

    fun bytesPerSecondToBitsPerSecond(bytesPerSecond: Double): Double = bytesPerSecond * BITS_PER_BYTE

    fun bitsPerSecondToMbps(bitsPerSecond: Double): Double = bitsPerSecond / MEGA

    fun mbpsToBitsPerSecond(mbps: Double): Double = mbps * MEGA

    /**
     * Formats a throughput the way a speed meter reads it: more precision at low speeds,
     * fewer digits once the number gets large enough that decimals are noise.
     */
    fun formatMbps(mbps: Double): String = when {
        mbps.isNaN() -> "--"
        mbps < 10.0 -> trimZeros(String.format(java.util.Locale.ROOT, "%.2f", mbps))
        mbps < 100.0 -> trimZeros(String.format(java.util.Locale.ROOT, "%.1f", mbps))
        else -> String.format(java.util.Locale.ROOT, "%.0f", mbps)
    }

    fun formatMillis(ms: Double): String = when {
        ms.isNaN() -> "--"
        ms < 10.0 -> String.format(java.util.Locale.ROOT, "%.2f", ms)
        ms < 100.0 -> String.format(java.util.Locale.ROOT, "%.1f", ms)
        else -> String.format(java.util.Locale.ROOT, "%.0f", ms)
    }

    fun formatBytes(bytes: Long): String {
        val units = listOf("B", "KB", "MB", "GB")
        var value = bytes.toDouble()
        var index = 0
        while (value >= 1024.0 && index < units.lastIndex) {
            value /= 1024.0
            index++
        }
        return trimZeros(String.format(java.util.Locale.ROOT, "%.2f", value)) + " " + units[index]
    }

    private fun trimZeros(text: String): String =
        if (!text.contains('.')) text else text.trimEnd('0').trimEnd('.')
}
