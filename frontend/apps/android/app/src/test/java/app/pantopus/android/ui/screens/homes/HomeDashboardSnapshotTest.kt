@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes

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

/** Paparazzi snapshots for A10.1 / A10.2 Home Dashboard states. */
class HomeDashboardSnapshotTest {
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
    fun home_dashboard_populated() {
        paparazzi.snapshot {
            Frame {
                HomeDashboardScreenContent(
                    state = HomeDashboardUiState.Loaded(HomeDashboardSampleData.populatedContent),
                )
            }
        }
    }

    @Test
    fun home_dashboard_empty() {
        paparazzi.snapshot {
            Frame {
                HomeDashboardScreenContent(
                    state = HomeDashboardUiState.Empty(HomeDashboardSampleData.brandNew),
                )
            }
        }
    }

    @Test
    fun home_dashboard_needs_attention() {
        paparazzi.snapshot {
            Frame {
                HomeDashboardScreenContent(
                    state = HomeDashboardUiState.NeedsAttention(HomeDashboardSampleData.needsAttentionContent),
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
