@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.stamps

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
 * A17.11 — Paparazzi snapshots for the Stamps (postage wallet) screen.
 * Two frames mirror the design source: the populated wallet (book hero +
 * sheet + wallet rail + usage history + Elf strip + issuer + buy dock)
 * and the empty "No stamps yet" frame (previewed starter book + offer).
 */
class StampsSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2800,
                    softButtons = false,
                ),
        )

    @Test
    fun stamps_populated() {
        paparazzi.snapshot {
            Frame { StampsPopulatedFrame(content = StampsSampleData.populated) }
        }
    }

    @Test
    fun stamps_empty() {
        paparazzi.snapshot {
            Frame { StampsEmptyFrame(content = StampsSampleData.empty) }
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
            ) {
                content()
            }
        }
    }
}
