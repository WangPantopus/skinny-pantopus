@file:Suppress("PackageNaming", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet

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
 * Paparazzi baselines for the two A10.10 Wallet frames: populated
 * (happy path) and payout-on-hold (bank verification expired). Mirrors
 * the iOS `wallet-{populated,hold}-ios.png` baseline tripwire pair.
 */
class WalletSnapshotTest {
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
    fun wallet_populated() {
        paparazzi.snapshot {
            Frame {
                WalletScreenContent(
                    state = WalletUiState.Populated(WalletSampleData.populated),
                    onBack = {},
                    onOpenHistory = {},
                    onWithdraw = {},
                    onManagePayout = {},
                    onReverifyPayout = {},
                    onOpenTaxDocs = {},
                    onSeeAllActivity = {},
                    onRetry = {},
                )
            }
        }
    }

    @Test
    fun wallet_hold() {
        paparazzi.snapshot {
            Frame {
                WalletScreenContent(
                    state = WalletUiState.Hold(WalletSampleData.onHold),
                    onBack = {},
                    onOpenHistory = {},
                    onWithdraw = {},
                    onManagePayout = {},
                    onReverifyPayout = {},
                    onOpenTaxDocs = {},
                    onSeeAllActivity = {},
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
