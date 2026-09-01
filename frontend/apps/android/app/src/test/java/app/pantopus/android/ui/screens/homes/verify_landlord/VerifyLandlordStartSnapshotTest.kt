@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A12.5 Paparazzi snapshots for the verify-landlord Start step —
 * canonical and fast-track variants.
 */
class VerifyLandlordStartSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun verify_landlord_start_canonical() {
        paparazzi.snapshot {
            Frame {
                StartStep(content = VerifyLandlordSampleData.canonical)
            }
        }
    }

    @Test
    fun verify_landlord_start_fast_track() {
        paparazzi.snapshot {
            Frame {
                StartStep(content = VerifyLandlordSampleData.fastTrack)
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
                WizardShell(model = SnapshotStartChrome, content = content)
            }
        }
    }
}

private object SnapshotStartChrome : WizardModel {
    override val chrome: WizardChrome =
        WizardChrome(
            title = "Verify landlord",
            progressLabel = WizardProgressLabel.StepOf(1, 3),
            progressFraction = 1f / 3f,
            leading = WizardLeadingControl.Close,
            primaryCtaLabel = "Start verification",
            primaryCtaEnabled = true,
            dirty = false,
            showsProgressBar = true,
        )

    override fun onLeading() = Unit

    override fun onDiscard() = Unit

    override fun onPrimary() = Unit
}
