@file:Suppress("PackageNaming", "FunctionNaming")

package app.pantopus.android.ui.screens.mailbox.earn

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
 * Paparazzi baselines for the two A10.11 Earn frames: populated (active
 * earner) and empty (new earner — no hero, gated rows, add-payout nudge).
 * Mirrors the iOS `earn-{populated,empty}-ios.png` baseline tripwire pair.
 */
class EarnSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    @Test
    fun earn_populated() {
        paparazzi.snapshot {
            Frame {
                EarnScreenContent(
                    state = EarnUiState.Populated(EarnSampleData.populated),
                )
            }
        }
    }

    @Test
    fun earn_empty() {
        paparazzi.snapshot {
            Frame {
                EarnScreenContent(
                    state = EarnUiState.Empty(EarnSampleData.waysToEarn),
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
