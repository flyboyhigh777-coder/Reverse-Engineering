package io.github.flyboyhigh777.speedmeter

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.flyboyhigh777.speedmeter.ui.screen.HistoryScreen
import io.github.flyboyhigh777.speedmeter.ui.screen.ServerPickerScreen
import io.github.flyboyhigh777.speedmeter.ui.screen.SettingsScreen
import io.github.flyboyhigh777.speedmeter.ui.screen.TestScreen
import io.github.flyboyhigh777.speedmeter.ui.theme.SpeedMeterTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            SpeedMeterTheme { SpeedMeterApp() }
        }
    }
}

private enum class Destination(val labelRes: Int, val icon: ImageVector) {
    TEST(R.string.tab_test, Icons.Filled.Speed),
    HISTORY(R.string.tab_history, Icons.Filled.History),
    SETTINGS(R.string.tab_settings, Icons.Filled.Settings),
}

@Composable
private fun SpeedMeterApp() {
    val viewModel: SpeedtestViewModel = viewModel(factory = SpeedtestViewModel.Factory)
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val history by viewModel.history.entries.collectAsStateWithLifecycle()
    val serverList by viewModel.serverList.collectAsStateWithLifecycle()

    var destination by rememberSaveable { mutableStateOf(Destination.TEST) }
    var showServerPicker by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val shareSubject = stringResource(R.string.share_subject)

    if (showServerPicker) {
        ServerPickerScreen(
            state = serverList,
            selectedUrl = settings.selectedListServerUrl,
            onLoad = viewModel::loadServerList,
            onSelect = { server ->
                viewModel.selectServerFromList(server)
                showServerPicker = false
            },
            onBack = { showServerPicker = false },
        )
        return
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                Destination.entries.forEach { entry ->
                    NavigationBarItem(
                        selected = destination == entry,
                        onClick = { destination = entry },
                        icon = { Icon(entry.icon, contentDescription = null) },
                        label = { Text(stringResource(entry.labelRes)) },
                    )
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (destination) {
                Destination.TEST -> TestScreen(
                    state = uiState,
                    onStart = viewModel::start,
                    onStop = viewModel::stop,
                    onReset = viewModel::reset,
                    onChangeServer = { showServerPicker = true },
                    onShare = {
                        viewModel.shareText()?.let { text ->
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, shareSubject)
                                putExtra(Intent.EXTRA_TEXT, text)
                            }
                            context.startActivity(Intent.createChooser(intent, shareSubject))
                        }
                    },
                )

                Destination.HISTORY -> HistoryScreen(
                    entries = history,
                    onClear = viewModel::clearHistory,
                )

                Destination.SETTINGS -> SettingsScreen(
                    settings = settings,
                    onServerMode = viewModel::setServerMode,
                    onCustomUrl = viewModel::setCustomServerUrl,
                    onOpenServerPicker = { showServerPicker = true },
                    onProfile = viewModel::setProfile,
                    onStableStop = viewModel::setStableStop,
                    onConnectionScaling = viewModel::setConnectionScaling,
                    onLoadedLatency = viewModel::setLoadedLatency,
                    onUploadFirst = viewModel::setUploadFirst,
                )
            }
        }
    }
}
