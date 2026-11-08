package io.github.flyboyhigh777.speedmeter.ui.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.flyboyhigh777.speedmeter.ui.GaugeScale
import kotlin.math.cos
import kotlin.math.sin

/** Where the dial begins and how far it sweeps, in degrees clockwise from three o'clock. */
private const val START_ANGLE = 135f
private const val SWEEP_ANGLE = 270f

/**
 * The dial.
 *
 * [valueMbps] is the live reading and drives the needle; [peakMbps] leaves a mark at the highest
 * reading of the stage so a brief peak stays visible after the needle falls back.
 */
@Composable
fun SpeedGauge(
    valueMbps: Double,
    peakMbps: Double,
    accent: Color,
    modifier: Modifier = Modifier,
    trackColor: Color = MaterialTheme.colorScheme.outline,
    labelColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    strokeWidth: Dp = 10.dp,
    content: @Composable () -> Unit = {},
) {
    val targetFraction = GaugeScale.fractionOf(valueMbps).toFloat()
    // The needle is animated rather than snapped: a sample-to-sample jump reads as instability in
    // the link when it is really just the sample rate.
    val animatedFraction by animateFloatAsState(
        targetValue = targetFraction,
        animationSpec = tween(durationMillis = 180),
        label = "gauge-needle",
    )
    val peakFraction = GaugeScale.fractionOf(peakMbps).toFloat()
    val measurer = rememberTextMeasurer()
    val tickStyle = remember(labelColor) {
        TextStyle(color = labelColor, fontSize = 10.sp, textAlign = TextAlign.Center)
    }

    Box(modifier = modifier.aspectRatio(1f), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxWidth().aspectRatio(1f)) {
            val stroke = strokeWidth.toPx()
            val labelInset = stroke * 2.6f
            val diameter = size.minDimension - labelInset * 2f
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            val arcSize = Size(diameter, diameter)
            val center = Offset(size.width / 2f, size.height / 2f)
            val radius = diameter / 2f

            drawArc(
                color = trackColor,
                startAngle = START_ANGLE,
                sweepAngle = SWEEP_ANGLE,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )

            if (animatedFraction > 0f) {
                drawArc(
                    brush = Brush.sweepGradient(
                        listOf(accent.copy(alpha = 0.35f), accent, accent),
                        center = center,
                    ),
                    startAngle = START_ANGLE,
                    sweepAngle = SWEEP_ANGLE * animatedFraction,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }

            if (peakFraction > animatedFraction) {
                drawPeakMark(center, radius, stroke, peakFraction, accent)
            }

            drawTicks(center, radius, stroke, trackColor, measurer, tickStyle)
            drawNeedle(center, radius, stroke, animatedFraction, accent)
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 32.dp),
        ) { content() }
    }
}

private fun DrawScope.drawTicks(
    center: Offset,
    radius: Float,
    stroke: Float,
    tickColor: Color,
    measurer: TextMeasurer,
    style: TextStyle,
) {
    GaugeScale.stops.indices.forEach { index ->
        val fraction = GaugeScale.fractionOfStop(index).toFloat()
        val angle = START_ANGLE + SWEEP_ANGLE * fraction
        val radians = Math.toRadians(angle.toDouble())
        val cosine = cos(radians).toFloat()
        val sine = sin(radians).toFloat()

        val innerRadius = radius - stroke * 0.8f
        val outerRadius = radius + stroke * 0.1f
        drawLine(
            color = tickColor,
            start = Offset(center.x + cosine * innerRadius, center.y + sine * innerRadius),
            end = Offset(center.x + cosine * outerRadius, center.y + sine * outerRadius),
            strokeWidth = stroke * 0.18f,
            cap = StrokeCap.Round,
        )

        val labelRadius = radius + stroke * 1.5f
        val layout = measurer.measure(GaugeScale.labelOfStop(index), style)
        drawText(
            textLayoutResult = layout,
            topLeft = Offset(
                center.x + cosine * labelRadius - layout.size.width / 2f,
                center.y + sine * labelRadius - layout.size.height / 2f,
            ),
        )
    }
}

private fun DrawScope.drawNeedle(
    center: Offset,
    radius: Float,
    stroke: Float,
    fraction: Float,
    accent: Color,
) {
    val angle = START_ANGLE + SWEEP_ANGLE * fraction
    rotate(degrees = angle, pivot = center) {
        drawLine(
            color = accent,
            start = Offset(center.x + radius * 0.14f, center.y),
            end = Offset(center.x + radius - stroke * 0.9f, center.y),
            strokeWidth = stroke * 0.42f,
            cap = StrokeCap.Round,
        )
    }
    drawCircle(color = accent, radius = stroke * 0.55f, center = center)
    drawCircle(color = Color.Black.copy(alpha = 0.6f), radius = stroke * 0.22f, center = center)
}

private fun DrawScope.drawPeakMark(
    center: Offset,
    radius: Float,
    stroke: Float,
    fraction: Float,
    accent: Color,
) {
    val angle = START_ANGLE + SWEEP_ANGLE * fraction
    val radians = Math.toRadians(angle.toDouble())
    val cosine = cos(radians).toFloat()
    val sine = sin(radians).toFloat()
    drawLine(
        color = accent.copy(alpha = 0.55f),
        start = Offset(center.x + cosine * (radius - stroke * 0.7f), center.y + sine * (radius - stroke * 0.7f)),
        end = Offset(center.x + cosine * (radius + stroke * 0.3f), center.y + sine * (radius + stroke * 0.3f)),
        strokeWidth = stroke * 0.3f,
        cap = StrokeCap.Round,
    )
}

/** Small inline bar used in the result rows. */
@Composable
fun ThinMeter(fraction: Float, accent: Color, modifier: Modifier = Modifier) {
    val track = MaterialTheme.colorScheme.outline
    Box(modifier = modifier) {
        Canvas(modifier = Modifier.fillMaxWidth()) {
            val height = size.height
            drawLine(
                color = track,
                start = Offset(0f, height / 2f),
                end = Offset(size.width, height / 2f),
                strokeWidth = height,
                cap = StrokeCap.Round,
            )
            if (fraction > 0f) {
                drawLine(
                    color = accent,
                    start = Offset(0f, height / 2f),
                    end = Offset(size.width * fraction.coerceIn(0f, 1f), height / 2f),
                    strokeWidth = height,
                    cap = StrokeCap.Round,
                )
            }
        }
    }
}
