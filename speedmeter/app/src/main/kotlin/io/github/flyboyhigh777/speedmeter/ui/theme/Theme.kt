package io.github.flyboyhigh777.speedmeter.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * The app's own palette: a deep navy surface with a mint accent for download and a violet accent
 * for upload, so the two figures stay distinguishable at a glance and in a screenshot.
 */
object SpeedMeterColors {
    val Ink = Color(0xFF070B14)
    val InkElevated = Color(0xFF0E1524)
    val InkCard = Color(0xFF141D30)
    val Outline = Color(0xFF26324A)

    val Mint = Color(0xFF19E39B)
    val MintDim = Color(0xFF0F7D56)
    val Violet = Color(0xFF8B7CFF)
    val VioletDim = Color(0xFF4A3FA0)
    val Amber = Color(0xFFFFC24B)
    val Rose = Color(0xFFFF6B81)

    val TextPrimary = Color(0xFFE8F0FF)
    val TextSecondary = Color(0xFF93A1BF)
    val TextMuted = Color(0xFF64739A)

    val LightSurface = Color(0xFFF6F8FD)
    val LightCard = Color(0xFFFFFFFF)
    val LightOutline = Color(0xFFD5DEEE)
    val LightTextPrimary = Color(0xFF101828)
    val LightTextSecondary = Color(0xFF4A5673)
}

private val DarkScheme = darkColorScheme(
    primary = SpeedMeterColors.Mint,
    onPrimary = SpeedMeterColors.Ink,
    primaryContainer = SpeedMeterColors.MintDim,
    secondary = SpeedMeterColors.Violet,
    onSecondary = SpeedMeterColors.Ink,
    secondaryContainer = SpeedMeterColors.VioletDim,
    background = SpeedMeterColors.Ink,
    onBackground = SpeedMeterColors.TextPrimary,
    surface = SpeedMeterColors.InkElevated,
    onSurface = SpeedMeterColors.TextPrimary,
    surfaceVariant = SpeedMeterColors.InkCard,
    onSurfaceVariant = SpeedMeterColors.TextSecondary,
    outline = SpeedMeterColors.Outline,
    outlineVariant = SpeedMeterColors.Outline,
    error = SpeedMeterColors.Rose,
    onError = SpeedMeterColors.Ink,
)

private val LightScheme = lightColorScheme(
    primary = SpeedMeterColors.MintDim,
    onPrimary = Color.White,
    primaryContainer = SpeedMeterColors.Mint,
    secondary = SpeedMeterColors.VioletDim,
    onSecondary = Color.White,
    background = SpeedMeterColors.LightSurface,
    onBackground = SpeedMeterColors.LightTextPrimary,
    surface = SpeedMeterColors.LightCard,
    onSurface = SpeedMeterColors.LightTextPrimary,
    surfaceVariant = SpeedMeterColors.LightSurface,
    onSurfaceVariant = SpeedMeterColors.LightTextSecondary,
    outline = SpeedMeterColors.LightOutline,
    error = SpeedMeterColors.Rose,
)

/**
 * Tabular figures matter here: a readout that re-centres every time a digit changes reads as
 * jitter in the UI rather than in the network.
 */
private val SpeedMeterTypography = Typography().let { base ->
    base.copy(
        displayLarge = base.displayLarge.copy(
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Light,
            fontSize = 72.sp,
            letterSpacing = (-2).sp,
        ),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.SemiBold),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp),
        labelSmall = TextStyle(
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            letterSpacing = 1.2.sp,
        ),
    )
}

@Composable
fun SpeedMeterTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkScheme else LightScheme,
        typography = SpeedMeterTypography,
        content = content,
    )
}
