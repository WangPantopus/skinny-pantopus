@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_ownership

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

/** A12.3 Paparazzi snapshots for Claim Ownership start and contested frames. */
class ClaimOwnershipStartSnapshotTest {
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
    fun claim_ownership_start_canonical() {
        paparazzi.snapshot {
            Frame {
                StartStep(content = ClaimOwnershipSampleData.canonicalStart)
            }
        }
    }

    @Test
    fun claim_ownership_start_contested() {
        paparazzi.snapshot {
            Frame {
                StartStep(content = ClaimOwnershipSampleData.contestedStart)
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
                WizardShell(model = SnapshotWizardModel, content = content)
            }
        }
    }
}

private object SnapshotWizardModel : WizardModel {
    override val chrome: WizardChrome =
        WizardChrome(
            title = "Claim ownership",
            progressLabel = WizardProgressLabel.StepOf(1, 3),
            progressFraction = 1f / 3f,
            leading = WizardLeadingControl.Close,
            primaryCtaLabel = "Start claim",
            primaryCtaEnabled = true,
            dirty = false,
            showsProgressBar = true,
        )

    override fun onLeading() = Unit

    override fun onDiscard() = Unit

    override fun onPrimary() = Unit
}
