package io.github.flyboyhigh777.speedmeter.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.github.flyboyhigh777.speedmeter.R
import io.github.flyboyhigh777.speedmeter.data.MeasurementProfile
import io.github.flyboyhigh777.speedmeter.data.ServerMode
import io.github.flyboyhigh777.speedmeter.data.SpeedMeterSettings
import io.github.flyboyhigh777.speedmeter.isValidHttpUrl

@Composable
fun SettingsScreen(
    settings: SpeedMeterSettings,
    onServerMode: (ServerMode) -> Unit,
    onCustomUrl: (String) -> Unit,
    onOpenServerPicker: () -> Unit,
    onProfile: (MeasurementProfile) -> Unit,
    onStableStop: (Boolean) -> Unit,
    onConnectionScaling: (Boolean) -> Unit,
    onLoadedLatency: (Boolean) -> Unit,
    onUploadFirst: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 12.dp),
    ) {
        SectionCard(title = stringResource(R.string.settings_server_title)) {
            Column(modifier = Modifier.selectableGroup()) {
                ServerModeRow(
                    selected = settings.serverMode == ServerMode.NEAREST_EDGE,
                    title = stringResource(R.string.settings_server_builtin),
                    summary = stringResource(R.string.settings_server_builtin_summary),
                    onClick = { onServerMode(ServerMode.NEAREST_EDGE) },
                )
                ServerModeRow(
                    selected = settings.serverMode == ServerMode.PUBLIC_LIST,
                    title = stringResource(R.string.settings_server_public_list),
                    summary = settings.selectedListServerName.ifBlank {
                        stringResource(R.string.settings_server_public_list_summary)
                    },
                    onClick = onOpenServerPicker,
                )
                ServerModeRow(
                    selected = settings.serverMode == ServerMode.CUSTOM,
                    title = stringResource(R.string.settings_server_custom),
                    summary = stringResource(R.string.settings_server_custom_summary),
                    onClick = { onServerMode(ServerMode.CUSTOM) },
                )
            }

            if (settings.serverMode == ServerMode.CUSTOM) {
                CustomServerField(
                    initial = settings.customServerUrl,
                    onCommit = onCustomUrl,
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        SectionCard(title = stringResource(R.string.settings_measurement_title)) {
            Text(
                text = stringResource(R.string.settings_profile),
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileChip(MeasurementProfile.LOW_DATA, R.string.settings_profile_low_data, settings, onProfile)
                ProfileChip(MeasurementProfile.STANDARD, R.string.settings_profile_standard, settings, onProfile)
                ProfileChip(MeasurementProfile.THOROUGH, R.string.settings_profile_thorough, settings, onProfile)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.settings_duration) + ": " +
                    stringResource(R.string.settings_duration_value, settings.profile.durationSeconds.toInt()) +
                    " · " + stringResource(R.string.settings_connections) + ": " +
                    settings.profile.connections,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(12.dp))
            SwitchRow(
                title = stringResource(R.string.settings_stable_stop),
                summary = stringResource(R.string.settings_stable_stop_summary),
                checked = settings.stableStopEnabled,
                onCheckedChange = onStableStop,
            )
            SwitchRow(
                title = stringResource(R.string.settings_scaling),
                summary = stringResource(R.string.settings_scaling_summary),
                checked = settings.connectionScalingEnabled,
                onCheckedChange = onConnectionScaling,
            )
            SwitchRow(
                title = stringResource(R.string.settings_loaded_latency),
                summary = stringResource(R.string.settings_loaded_latency_summary),
                checked = settings.loadedLatencyEnabled,
                onCheckedChange = onLoadedLatency,
            )
            SwitchRow(
                title = stringResource(R.string.settings_upload_first),
                summary = null,
                checked = settings.uploadFirst,
                onCheckedChange = onUploadFirst,
            )
        }

        Spacer(Modifier.height(16.dp))

        SectionCard(title = stringResource(R.string.settings_about_title)) {
            Text(
                text = stringResource(R.string.settings_about_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.settings_version, BuildInfo.VERSION_NAME),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun ServerModeRow(
    selected: Boolean,
    title: String,
    summary: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(
                summary,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun CustomServerField(initial: String, onCommit: (String) -> Unit) {
    var text by remember(initial) { mutableStateOf(initial) }
    val invalid = text.isNotBlank() && !text.isValidHttpUrl()

    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        isError = invalid,
        placeholder = { Text(stringResource(R.string.settings_custom_url_hint)) },
        supportingText = if (invalid) {
            { Text(stringResource(R.string.settings_custom_url_invalid)) }
        } else {
            null
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
    )
    Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
        TextButton(
            onClick = { onCommit(text) },
            enabled = text.isValidHttpUrl(),
        ) { Text("OK") }
    }
}

@Composable
private fun ProfileChip(
    profile: MeasurementProfile,
    labelRes: Int,
    settings: SpeedMeterSettings,
    onProfile: (MeasurementProfile) -> Unit,
) {
    FilterChip(
        selected = settings.profile == profile,
        onClick = { onProfile(profile) },
        label = { Text(stringResource(labelRes)) },
    )
}

@Composable
private fun SwitchRow(
    title: String,
    summary: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            if (summary != null) {
                Text(
                    summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

/**
 * Version string shown in About.
 *
 * Declared here rather than read from BuildConfig because the app module turns BuildConfig
 * generation off; one constant is cheaper than a generated class for a single value.
 */
private object BuildInfo {
    const val VERSION_NAME = "1.0.0"
}
