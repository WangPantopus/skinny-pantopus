@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.businesses.create_business.steps.ConfirmStep
import app.pantopus.android.ui.screens.businesses.create_business.steps.LegalInfoStep
import app.pantopus.android.ui.screens.businesses.create_business.steps.PickCategorySearchStep
import app.pantopus.android.ui.screens.businesses.create_business.steps.PickCategoryStep
import app.pantopus.android.ui.screens.businesses.create_business.steps.ProfileStep
import app.pantopus.android.ui.screens.businesses.create_business.steps.ProfileStepCallbacks
import app.pantopus.android.ui.screens.shared.wizard.WizardIdentity
import app.pantopus.android.ui.screens.shared.wizard.WizardShell

/** Test tag applied to the Create Business wizard root. */
const val CREATE_BUSINESS_SCREEN_TAG: String = "createBusinessWizard"

/**
 * A12.10 Create Business wizard composable. Wraps [WizardShell] with
 * the four create-business steps and threads [WizardIdentity.Business]
 * through so the progress rail and the primary CTA render in violet.
 */
@Composable
fun CreateBusinessWizardScreen(
    onDismiss: () -> Unit,
    onOpenBusiness: (String) -> Unit,
    viewModel: CreateBusinessWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            CreateBusinessOutboundEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onDismiss()
            }
            is CreateBusinessOutboundEvent.OpenBusinessDashboard -> {
                viewModel.acknowledgeEvent()
                onOpenBusiness(event.businessId)
            }
            null -> Unit
        }
    }

    LaunchedEffect(Unit) {
        Analytics.track(
            AnalyticsEvent.ScreenCreateBusinessStepViewed(
                stepNumber = state.currentStep.stepNumber,
                stepName = state.currentStep.name.lowercase(),
            ),
        )
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag(CREATE_BUSINESS_SCREEN_TAG),
        identity = WizardIdentity.Business,
    ) {
        when (state.currentStep) {
            CreateBusinessStep.PickCategory -> {
                if (state.isSearchActive) {
                    PickCategorySearchStep(
                        state = state,
                        onSearchTextChanged = viewModel::setSearchText,
                        onPickHit = viewModel::selectSearchHit,
                        onSubmitCustom = viewModel::submitCustomCategory,
                    )
                } else {
                    PickCategoryStep(
                        state = state,
                        onSearchTextChanged = viewModel::setSearchText,
                        onPickCategory = viewModel::selectCategory,
                    )
                }
            }
            CreateBusinessStep.LegalInfo ->
                LegalInfoStep(
                    state = state,
                    onNameChange = viewModel::setBusinessName,
                    onUsernameChange = viewModel::setUsername,
                    onEmailChange = viewModel::setEmail,
                    onDescriptionChange = viewModel::setDescription,
                )
            CreateBusinessStep.Profile ->
                ProfileStep(
                    state = state,
                    callbacks =
                        ProfileStepCallbacks(
                            onAddressChange = viewModel::setAddress,
                            onCityChange = viewModel::setCity,
                            onStateChange = viewModel::setState,
                            onZipChange = viewModel::setZip,
                            onSkipLocation = viewModel::skipLocation,
                            onUnskipLocation = viewModel::unskipLocation,
                            onSkipHours = viewModel::skipHours,
                            onUnskipHours = viewModel::unskipHours,
                            onToggleDayClosed = viewModel::toggleDayClosed,
                            onLogoPicked = viewModel::setLogoPick,
                            onClearLogo = viewModel::clearLogoPick,
                            onSkipLogo = viewModel::skipLogo,
                            onUnskipLogo = viewModel::unskipLogo,
                        ),
                )
            CreateBusinessStep.Confirm -> ConfirmStep(state = state)
        }
    }
}
