@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.membership

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
 * Paparazzi snapshots for A10.8 Membership detail. The two frames mirror
 * the design source: happy-path Silver tier and refund-eligible SLA missed.
 */
class MembershipDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1800,
                    softButtons = false,
                ),
        )

    @Test
    fun membership_detail_populated() {
        paparazzi.snapshot {
            Frame {
                MembershipLoadedContent(
                    content = MembershipSampleData.populated,
                    slaMissed = false,
                )
            }
        }
    }

    @Test
    fun membership_detail_sla_missed() {
        paparazzi.snapshot {
            Frame {
                MembershipLoadedContent(
                    content = MembershipSampleData.slaMissed,
                    slaMissed = true,
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
            ) {
                content()
            }
        }
    }
}
