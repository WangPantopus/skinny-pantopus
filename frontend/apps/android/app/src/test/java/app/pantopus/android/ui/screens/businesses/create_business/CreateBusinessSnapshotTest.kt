@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.businesses.create_business.steps.PickCategorySearchStep
import app.pantopus.android.ui.screens.businesses.create_business.steps.PickCategoryStep
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardIdentity
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/** A12.10 Paparazzi snapshots for frame 1 (populated) + frame 2 (search). */
class CreateBusinessSnapshotTest {
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
    fun create_business_frame1_populated() {
        val state =
            CreateBusinessUiState(
                currentStep = CreateBusinessStep.PickCategory,
                selectedCategory = BusinessCategory.Home,
                searchText = "",
            )
        paparazzi.snapshot {
            Frame {
                PickCategoryStep(
                    state = state,
                    onSearchTextChanged = {},
                    onPickCategory = {},
                )
            }
        }
    }

    @Test
    fun create_business_frame2_search() {
        val state =
            CreateBusinessUiState(
                currentStep = CreateBusinessStep.PickCategory,
                selectedCategory = null,
                searchText = "tutor",
            )
        paparazzi.snapshot {
            Frame {
                PickCategorySearchStep(
                    state = state,
                    onSearchTextChanged = {},
                    onPickHit = {},
                    onSubmitCustom = {},
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
                WizardShell(
                    model = SnapshotWizardModel,
                    identity = WizardIdentity.Business,
                    content = content,
                )
            }
        }
    }
}

private object SnapshotWizardModel : WizardModel {
    override val chrome: WizardChrome =
        WizardChrome(
            title = "Create business",
            progressLabel = WizardProgressLabel.StepOf(1, 4),
            progressFraction = 1f / 4f,
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
