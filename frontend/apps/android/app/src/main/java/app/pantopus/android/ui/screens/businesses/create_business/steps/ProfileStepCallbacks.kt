@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessLogoPick

/**
 * Editing callbacks for [ProfileStep] (Create Business step 3 — location,
 * hours + logo). Bundled so the step and its sections keep flat parameter
 * lists; every entry maps 1:1 onto a `CreateBusinessWizardViewModel` method.
 */
data class ProfileStepCallbacks(
    val onAddressChange: (String) -> Unit,
    val onCityChange: (String) -> Unit,
    val onStateChange: (String) -> Unit,
    val onZipChange: (String) -> Unit,
    val onSkipLocation: () -> Unit,
    val onUnskipLocation: () -> Unit,
    val onSkipHours: () -> Unit,
    val onUnskipHours: () -> Unit,
    val onToggleDayClosed: (Int) -> Unit,
    val onLogoPicked: (CreateBusinessLogoPick) -> Unit,
    val onClearLogo: () -> Unit,
    val onSkipLogo: () -> Unit,
    val onUnskipLogo: () -> Unit,
)
