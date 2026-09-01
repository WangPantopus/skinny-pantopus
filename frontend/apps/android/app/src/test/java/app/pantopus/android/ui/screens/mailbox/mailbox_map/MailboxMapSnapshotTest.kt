@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

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
 * A11.4 — Paparazzi baselines for the Mailbox map design frames:
 * POPULATED (40% rail) and SELECTED (230dp context strip + detail panel).
 */
class MailboxMapSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1700,
                    softButtons = false,
                ),
        )

    @Test
    fun mailbox_map_populated() {
        paparazzi.snapshot {
            Frame {
                MailboxMapStaticPreview(
                    state = MailboxMapUiState.Populated(MailboxMapSampleData.spots),
                    todayWeekday = 4,
                )
            }
        }
    }

    @Test
    fun mailbox_map_selected() {
        paparazzi.snapshot {
            Frame {
                MailboxMapStaticPreview(
                    state =
                        MailboxMapUiState.Selected(
                            spot = MailboxMapSampleData.spots.first(),
                            spots = MailboxMapSampleData.spots,
                        ),
                    todayWeekday = 4,
                )
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
