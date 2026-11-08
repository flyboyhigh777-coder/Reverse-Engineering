package io.github.flyboyhigh777.speedmeter.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.flyboyhigh777.speedmeter.Phase
import io.github.flyboyhigh777.speedmeter.R
import io.github.flyboyhigh777.speedmeter.TestUiState
import io.github.flyboyhigh777.speedmeter.data.ConnectionType
import io.github.flyboyhigh777.speedmeter.engine.Units
import io.github.flyboyhigh777.speedmeter.ui.component.SpeedGauge
import io.github.flyboyhigh777.speedmeter.ui.theme.SpeedMeterColors

@Composable
fun TestScreen(
    state: TestUiState,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onReset: () -> Unit,
    onChangeServer: () -> Unit,
    onShare: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = when (state.phase) {
        Phase.UPLOAD -> SpeedMeterColors.Violet
        Phase.FAILED -> MaterialTheme.colorScheme.error
        else -> SpeedMeterColors.Mint
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(12.dp))
        ConnectionBanner(state = state, onChangeServer = onChangeServer)
        Spacer(Modifier.height(8.dp))

        SpeedGauge(
            valueMbps = state.liveMbps,
            peakMbps = state.peakMbps,
            accent = accent,
            modifier = Modifier.fillMaxWidth(0.92f),
        ) {
            GaugeReadout(state = state, accent = accent)
        }

        AnimatedVisibility(visible = state.isRunning) {
            LinearProgressIndicator(
                progress = { state.progress.toFloat().coerceIn(0f, 1f) },
                color = accent,
                trackColor = MaterialTheme.colorScheme.outline,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .padding(top = 4.dp),
            )
        }

        Spacer(Modifier.height(16.dp))
        ActionButton(state = state, accent = accent, onStart = onStart, onStop = onStop, onReset = onReset)

        Spacer(Modifier.height(20.dp))
        ResultRow(state = state)

        state.error?.let { message ->
            Spacer(Modifier.height(16.dp))
            ErrorCard(message = message, onRetry = onStart)
        }

        if (state.phase == Phase.DONE) {
            Spacer(Modifier.height(12.dp))
            DetailCard(state = state)
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onShare) {
                Icon(Icons.Filled.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.action_share))
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun GaugeReadout(state: TestUiState, accent: Color) {
    val label = when (state.phase) {
        Phase.IDLE -> stringResource(R.string.phase_idle)
        Phase.SELECTING -> stringResource(R.string.phase_selecting)
        Phase.METADATA -> stringResource(R.string.phase_metadata)
        Phase.LATENCY -> stringResource(R.string.phase_latency)
        Phase.DOWNLOAD -> stringResource(R.string.phase_download)
        Phase.UPLOAD -> stringResource(R.string.phase_upload)
        Phase.DONE -> stringResource(R.string.phase_done)
        Phase.FAILED -> stringResource(R.string.error_title)
    }

    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(4.dp))

    val shown = when (state.phase) {
        Phase.DOWNLOAD, Phase.UPLOAD -> state.liveMbps
        Phase.DONE -> state.download?.megabitsPerSecond ?: Double.NaN
        else -> Double.NaN
    }
    Text(
        text = if (shown.isFinite() && shown > 0.0) Units.formatMbps(shown) else "--",
        style = MaterialTheme.typography.displayLarge,
        color = accent,
        textAlign = TextAlign.Center,
    )
    Text(
        text = stringResource(R.string.unit_mbps),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun ActionButton(
    state: TestUiState,
    accent: Color,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onReset: () -> Unit,
) {
    when {
        state.isRunning -> OutlinedButton(
            onClick = onStop,
            modifier = Modifier.size(96.dp),
            shape = CircleShape,
        ) {
            Text(stringResource(R.string.action_stop), style = MaterialTheme.typography.labelLarge)
        }

        state.phase == Phase.DONE || state.phase == Phase.FAILED -> Button(
            onClick = { onReset(); onStart() },
            modifier = Modifier.size(96.dp),
            shape = CircleShape,
            colors = ButtonDefaults.buttonColors(containerColor = accent),
        ) {
            Text(stringResource(R.string.action_again), style = MaterialTheme.typography.labelLarge)
        }

        else -> Button(
            onClick = onStart,
            modifier = Modifier.size(112.dp),
            shape = CircleShape,
            colors = ButtonDefaults.buttonColors(containerColor = accent),
        ) {
            Text(stringResource(R.string.action_go), style = MaterialTheme.typography.headlineMedium)
        }
    }
}

@Composable
private fun ResultRow(state: TestUiState) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        MetricTile(
            label = stringResource(R.string.metric_ping),
            value = state.idleLatency?.latencyMillis?.let { Units.formatMillis(it) } ?: "--",
            unit = stringResource(R.string.unit_ms),
            accent = SpeedMeterColors.Amber,
            icon = null,
        )
        MetricTile(
            label = stringResource(R.string.metric_download),
            value = state.download?.megabitsPerSecond?.let { Units.formatMbps(it) } ?: "--",
            unit = stringResource(R.string.unit_mbps),
            accent = SpeedMeterColors.Mint,
            icon = Icons.Filled.ArrowDownward,
        )
        MetricTile(
            label = stringResource(R.string.metric_upload),
            value = state.upload?.megabitsPerSecond?.let { Units.formatMbps(it) } ?: "--",
            unit = stringResource(R.string.unit_mbps),
            accent = SpeedMeterColors.Violet,
            icon = Icons.Filled.ArrowUpward,
        )
    }
}

@Composable
private fun MetricTile(
    label: String,
    value: String,
    unit: String,
    accent: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector?,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
            }
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(text = value, style = MaterialTheme.typography.headlineSmall, color = accent)
        Text(
            text = unit,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ConnectionBanner(state: TestUiState, onChangeServer: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = state.metadata.isp ?: stringResource(connectionLabel(state.connection)),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = listOfNotNull(
                        state.server?.label,
                        state.metadata.ipAddress,
                    ).joinToString(" · ").ifEmpty { stringResource(R.string.phase_idle) },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = onChangeServer, enabled = !state.isRunning) {
                Icon(Icons.Filled.Dns, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.label_change_server))
            }
        }
    }
}

@Composable
private fun DetailCard(state: TestUiState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            state.idleLatency?.let { latency ->
                DetailLine(stringResource(R.string.metric_jitter), "${Units.formatMillis(latency.jitterMillis)} ms")
                DetailLine(
                    stringResource(R.string.metric_loss),
                    String.format(java.util.Locale.ROOT, "%.1f %%", latency.lossPercent),
                )
            }
            state.download?.loadedLatency?.let { loaded ->
                DetailLine(
                    stringResource(R.string.metric_loaded_latency),
                    "${Units.formatMillis(loaded.latencyMillis)} ms",
                )
            }
            DetailLine(stringResource(R.string.label_connections), state.openConnections.toString())
            DetailLine(stringResource(R.string.label_data_used), Units.formatBytes(state.transferredBytes))
            state.metadata.ipAddress?.let { DetailLine(stringResource(R.string.label_ip), it) }
            state.server?.let { DetailLine(stringResource(R.string.label_server), it.label) }
            DetailLine(
                stringResource(R.string.label_connection),
                stringResource(connectionLabel(state.connection)),
            )
            if (state.download?.stoppedEarly == true) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = stringResource(R.string.label_stopped_early),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ErrorCard(message: String, onRetry: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f),
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.error_title),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.height(4.dp))
            Text(text = message, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onRetry) { Text(stringResource(R.string.action_retry)) }
        }
    }
}

private fun connectionLabel(type: ConnectionType): Int = when (type) {
    ConnectionType.WIFI -> R.string.connection_wifi
    ConnectionType.CELLULAR -> R.string.connection_cellular
    ConnectionType.ETHERNET -> R.string.connection_ethernet
    ConnectionType.VPN -> R.string.connection_vpn
    ConnectionType.OTHER -> R.string.connection_other
    ConnectionType.OFFLINE -> R.string.connection_offline
}
