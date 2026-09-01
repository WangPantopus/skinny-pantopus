@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_day

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
 * A13.16 — Paparazzi snapshots for the My Mail Day editor. Two frames
 * mirror the design source: mid-afternoon populated (8-piece stack
 * with a 5-second undo on the latest reviewed row) and the "nothing
 * new today" empty hero (illustration + Scan CTA + yesterday recap +
 * setup nudges).
 */
class MailDaySnapshotTest {
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
    fun mail_day_populated() {
        paparazzi.snapshot {
            Frame {
                MailDayPopulatedFrame(content = MailDaySampleData.populated)
            }
        }
    }

    @Test
    fun mail_day_empty() {
        paparazzi.snapshot {
            Frame {
                MailDayEmptyFrame(content = MailDaySampleData.empty)
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
            ) {
                content()
            }
        }
    }
}
