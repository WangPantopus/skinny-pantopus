@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * P2.0 — Paparazzi baselines for `WizardShell` across all four
 * [WizardIdentity] cases. Locks the identity-tinted progress rail +
 * primary CTA behaviour added by the identity refactor.
 */
class WizardShellIdentitySnapshotTest {
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
    fun wizard_shell_identity_personal() {
        paparazzi.snapshot {
            IdentityFrame(identity = WizardIdentity.Personal)
        }
    }

    @Test
    fun wizard_shell_identity_home() {
        paparazzi.snapshot {
            IdentityFrame(identity = WizardIdentity.Home)
        }
    }

    @Test
    fun wizard_shell_identity_business() {
        paparazzi.snapshot {
            IdentityFrame(identity = WizardIdentity.Business)
        }
    }

    @Test
    fun wizard_shell_identity_warm() {
        paparazzi.snapshot {
            IdentityFrame(identity = WizardIdentity.Warm)
        }
    }

    @Composable
    private fun IdentityFrame(identity: WizardIdentity) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                WizardShell(model = IdentitySnapshotModel, identity = identity) {
                    Text(text = "Step content", color = PantopusColors.appText)
                }
            }
        }
    }
}

private object IdentitySnapshotModel : WizardModel {
    override val chrome: WizardChrome =
        WizardChrome(
            title = "Identity wizard",
            progressLabel = WizardProgressLabel.StepOf(2, 4),
            progressFraction = 0.5f,
            leading = WizardLeadingControl.Close,
            primaryCtaLabel = "Continue",
            primaryCtaEnabled = true,
            dirty = false,
            showsProgressBar = true,
        )

    override fun onLeading() = Unit

    override fun onDiscard() = Unit

    override fun onPrimary() = Unit
}
