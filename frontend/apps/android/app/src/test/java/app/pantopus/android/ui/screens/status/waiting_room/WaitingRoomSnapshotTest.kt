@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

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
 * Paparazzi snapshots for the A18.4 waiting room. Mirrors
 * [app.pantopus.android.ui.screens.status.StatusWaitingSnapshotTest]: both
 * design frames are pinned — the active wait and the "more info requested ·
 * review paused" secondary state.
 */
class WaitingRoomSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun waiting_room_active() {
        paparazzi.snapshot {
            Frame {
                WaitingRoomScreen(content = WaitingRoomContent.active())
            }
        }
    }

    @Test
    fun waiting_room_more_info() {
        paparazzi.snapshot {
            Frame {
                WaitingRoomScreen(content = WaitingRoomContent.moreInfoRequested())
            }
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
