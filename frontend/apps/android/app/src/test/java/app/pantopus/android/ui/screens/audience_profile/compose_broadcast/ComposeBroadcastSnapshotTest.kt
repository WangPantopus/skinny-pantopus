@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.audience_profile.compose_broadcast

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A.7 (A22.2) — Paparazzi snapshots for the Compose Broadcast surface.
 * Four frames mirror the iOS snapshot slugs: populated (drafted broadcast
 * + media + recents), empty (first-broadcast prompt), scheduled (pinned
 * send time), and sending (mid-submit overlay).
 */
class ComposeBroadcastSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2600,
                    softButtons = false,
                ),
        )

    @Test
    fun compose_broadcast_populated() {
        paparazzi.snapshot {
            Frame { ComposeBroadcastScaffold(uiState = ComposeBroadcastSampleData.populated()) }
        }
    }

    @Test
    fun compose_broadcast_empty() {
        paparazzi.snapshot {
            Frame { ComposeBroadcastScaffold(uiState = ComposeBroadcastSampleData.empty()) }
        }
    }

    @Test
    fun compose_broadcast_scheduled() {
        paparazzi.snapshot {
            Frame { ComposeBroadcastScaffold(uiState = ComposeBroadcastSampleData.scheduled()) }
        }
    }

    @Test
    fun compose_broadcast_sending() {
        paparazzi.snapshot {
            Frame { ComposeBroadcastScaffold(uiState = ComposeBroadcastSampleData.sending()) }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
