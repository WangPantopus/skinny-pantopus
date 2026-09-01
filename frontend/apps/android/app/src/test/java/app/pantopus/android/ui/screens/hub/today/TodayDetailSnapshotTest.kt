@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.hub.today

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
 * Paparazzi baselines for the two A10.3 Today detail frames:
 * populated mild weather and hard-freeze alert.
 */
class TodayDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    @Test
    fun today_detail_populated() {
        paparazzi.snapshot {
            Frame {
                TodayDetailScreenContent(
                    state = TodayDetailUiState.Populated(TodaySampleData.populated),
                    onBack = {},
                    onShare = {},
                    onManage = {},
                    onRetry = {},
                )
            }
        }
    }

    @Test
    fun today_detail_alert() {
        paparazzi.snapshot {
            Frame {
                TodayDetailScreenContent(
                    state = TodayDetailUiState.Alert(TodaySampleData.alert),
                    onBack = {},
                    onShare = {},
                    onManage = {},
                    onRetry = {},
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
