@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.add_home

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryRow
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.screens.status.StatusWaitingBody
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/** Test tag applied to the AddHome screen container. */
const val ADD_HOME_SCREEN_TAG = "addHomeWizard"

/**
 * Concrete Add-Home wizard composable. The view model survives config
 * changes via Hilt's `SavedStateHandle`, so the wizard restores after
 * process death (acceptance criterion #5).
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun AddHomeWizardScreen(
    onDismiss: () -> Unit,
    onOpenHomes: () -> Unit,
    viewModel: AddHomeWizardViewModel = hiltViewModel(),
    onOpenClaimOwnership: (String) -> Unit = {},
    onOpenWaitingRoom: (String) -> Unit = {},
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    ObserveHomeCreationLifecycle(viewModel)

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            AddHomeOutboundEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onDismiss()
            }
            AddHomeOutboundEvent.OpenHomes -> {
                viewModel.acknowledgeEvent()
                onOpenHomes()
            }
            is AddHomeOutboundEvent.OpenClaimOwnership -> {
                viewModel.acknowledgeEvent()
                onOpenClaimOwnership(event.homeId)
            }
            is AddHomeOutboundEvent.OpenWaitingRoom -> {
                viewModel.acknowledgeEvent()
                onOpenWaitingRoom(event.homeId)
            }
            null -> Unit
        }
    }

    LaunchedEffect(Unit) {
        viewModel.resumeCreation()
        // Fire the initial step view; subsequent transitions emit
        // their own ScreenAddHomeWizardStepViewed events from the VM.
        val current = state.form.currentStep
        current.stepNumber?.let { number ->
            Analytics.track(
                AnalyticsEvent.ScreenAddHomeWizardStepViewed(
                    stepNumber = number,
                    stepName = current.name,
                ),
            )
        }
    }

    WizardShell(
        model = viewModel,
        handleSystemBack = true,
        chrome = viewModel.chromeFor(state),
        scrollResetKey = state.form.currentStep to (state.errorMessage != null),
        modifier = Modifier.testTag(ADD_HOME_SCREEN_TAG).semantics { testTagsAsResourceId = true },
    ) {
        AddressEntryError(state, viewModel)
        if (state.showsCreationRecovery) {
            HomeCreationRecoveryContent(state, viewModel)
        } else {
            when (state.form.currentStep) {
                AddHomeStep.Address -> AddressStep(state, viewModel)
                AddHomeStep.Confirm ->
                    ConfirmStep(
                        state = state,
                        onApplyGeocodedZip = viewModel::applyGeocodedZip,
                        detailsSection = { AddHomeDetailsSection(state = state, vm = viewModel) },
                    )
                AddHomeStep.Role -> RoleStep(state, viewModel)
                AddHomeStep.Review -> ReviewStep(state)
                AddHomeStep.Success -> SuccessStep()
            }
        }
    }

    if (state.showsClaimedModal) {
        AddressClaimedModal(
            showsConfirmAddressSheet = state.showsConfirmAddressSheet,
            addressLabel = state.claimedAddressLabel,
            onDismiss = viewModel::dismissClaimedModal,
            onThisIsCorrect = viewModel::showConfirmAddressStep,
            onConfirmAddress = viewModel::confirmClaimedAddress,
        )
    }

    // A12.2 Setup — the Wi-Fi QR scanner takes the whole screen so the
    // viewfinder matches RN's full-screen `QrScannerModal`.
    if (state.scannerTargetItemId != null) {
        WifiQrScannerDialog(
            onScanned = viewModel::applyScannedWifi,
            onClose = viewModel::closeWifiQrScanner,
        )
    }
}

@Composable
private fun ObserveHomeCreationLifecycle(viewModel: AddHomeWizardViewModel) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, viewModel) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_PAUSE || event == Lifecycle.Event.ON_STOP) {
                    viewModel.suspendCreation()
                    viewModel.suspendAddressEntry()
                } else if (event == Lifecycle.Event.ON_RESUME) {
                    viewModel.resumeCreation()
                }
            }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            viewModel.suspendCreation()
            viewModel.suspendAddressEntry()
        }
    }
}

@Composable
private fun AddressEntryError(
    state: AddHomeUiState,
    viewModel: AddHomeWizardViewModel,
) {
    state.errorMessage?.let {
        ErrorBanner(it)
        if (state.form.currentStep == AddHomeStep.Confirm) {
            TextButton(onClick = viewModel::retryCheckAddress, enabled = !state.isCheckingAddress && state.isSessionCurrent) {
                Text("Try again")
            }
            TextButton(onClick = viewModel::onLeading) { Text("Edit address") }
        }
    }
}

// MARK: - Address-already-claimed modal (RN AddressClaimedModal)

/**
 * Two-page confirm dialog shown when `POST /api/homes/check-address`
 * returns `HOME_FOUND_CLAIMED`. Copy mirrors RN's `ADDRESS_CHECK`
 * constants (`src/constants/ownershipCopy.ts:176-183`).
 */
@Composable
internal fun AddressClaimedModal(
    showsConfirmAddressSheet: Boolean,
    addressLabel: String,
    onDismiss: () -> Unit,
    onThisIsCorrect: () -> Unit,
    onConfirmAddress: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s5)
                    .testTag("addHomeAddressClaimedModal"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (showsConfirmAddressSheet) {
                Text(
                    text = "Confirm this is your address",
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "You entered:",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = addressLabel,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurfaceSunken)
                            .padding(Spacing.s3)
                            .testTag("addHomeClaimedAddressLabel"),
                )
                ModalPrimaryButton("Confirm address", "addHomeClaimedConfirmAddress", onConfirmAddress)
                ModalSecondaryButton("Edit", "addHomeClaimedEditAddress", onDismiss)
            } else {
                Box(
                    modifier =
                        Modifier
                            .size(Spacing.s12)
                            .clip(CircleShape)
                            .background(PantopusColors.personalBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ShieldCheck,
                        contentDescription = null,
                        size = Spacing.s6,
                        tint = PantopusColors.primary600,
                    )
                }
                Text(
                    text = "This home already has verified members",
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "To protect privacy, you’ll need verification to join this home.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                )
                ModalPrimaryButton("This address is correct", "addHomeClaimedCorrect", onThisIsCorrect)
                ModalSecondaryButton("Change address", "addHomeClaimedChangeAddress", onDismiss)
            }
        }
    }
}

@Composable
private fun ModalPrimaryButton(
    label: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = Spacing.s12)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary600)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appTextInverse)
    }
}

@Composable
private fun ModalSecondaryButton(
    label: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = Spacing.s12)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
    }
}

// MARK: - Step 1

@Composable
private fun AddressStep(
    state: AddHomeUiState,
    vm: AddHomeWizardViewModel,
) {
    val context = LocalContext.current
    val locationPermission =
        if (LocalActivityResultRegistryOwner.current != null) {
            rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
                if (grants.values.any { it }) vm.useCurrentLocation() else vm.locationPermissionDenied()
            }
        } else {
            null
        }
    HeadlineBlock("Where do you live?")
    SubcopyBlock("Enter your address. We'll check the address before you choose how to join or set up your Home.")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        AddHomeSearchField(query = state.homeSearchQuery, onQueryChange = vm::updateSearchQuery, onClear = vm::clearSearchQuery)
        if (state.isFindingAddress) CircularProgressIndicator(modifier = Modifier.semantics { contentDescription = "Finding your address" })
        state.addressSearchError?.let {
            Text(it, style = PantopusTextStyle.small)
            if (state.homeSearchQuery.isNotBlank()) TextButton(onClick = vm::retryAddressSearch) { Text("Try search again") }
            if (state.canOpenLocationSettings) {
                TextButton(onClick = {
                    context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
                }) { Text("Open app settings") }
            }
        }
        state.searchResults.forEach { suggestion ->
            TextButton(onClick = { vm.selectSearchResult(suggestion) }, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(suggestion.primaryText, style = PantopusTextStyle.body)
                    Text(suggestion.secondaryText ?: suggestion.label, style = PantopusTextStyle.small)
                }
            }
        }
        UseCurrentLocationPill(onClick = {
            if (!state.isFindingAddress && state.isSessionCurrent) {
                val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
                if (fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED) {
                    vm.useCurrentLocation()
                } else {
                    locationPermission?.launch(
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                    )
                        ?: vm.locationPermissionDenied()
                }
            }
        })
        ManualAddressButton(onClick = vm::addManuallyTapped)
        if (state.isManualEntry) {
            ManualAddressField("Street address", state.form.address.street) { vm.updateField(AddressField.Street, it) }
            ManualAddressField("Unit or apartment (optional)", state.form.address.unit) { vm.updateField(AddressField.Unit, it) }
            ManualAddressField("City", state.form.address.city) { vm.updateField(AddressField.City, it) }
            ManualAddressField("State", state.form.address.state) { vm.updateField(AddressField.State, it) }
            ManualAddressField("ZIP code", state.form.address.zipCode) { vm.updateField(AddressField.Zip, it) }
        }
    }
}

@Composable
private fun ManualAddressField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
    )
}

// MARK: - Step 2

@Composable
private fun ConfirmStep(
    state: AddHomeUiState,
    onApplyGeocodedZip: () -> Unit,
    /**
     * A12.2 Details block, supplied by the live screen. The Paparazzi
     * geocode-confirmation preview omits it so its golden frames keep
     * locking the address-confirmation geometry on its own.
     */
    detailsSection: (@Composable () -> Unit)? = null,
) {
    HeadlineBlock("Confirm the property")
    SubcopyBlock(
        "Review the address and Home details. Property information may be unavailable.",
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        state.zipMismatch?.let { mismatch ->
            ZipMismatchBanner(mismatch = mismatch, onApply = onApplyGeocodedZip)
        } ?: run {
            if (state.isGeocodeResolved) {
                state.geocodedAddress?.let { GeocodeConfirmationBlock(it) }
            }
        }
        AddressConfirmationFields(state)
        state.addressCheck?.takeIf { state.isGeocodeResolved }?.let { check ->
            AddressVerdictRow(check)
        }
        // A12.2 Details — nickname / type / beds / baths / sizes / year /
        // description, pre-filled from public records. Hidden on the
        // join-an-existing-home path, which RN skips too
        // (`useHomeForm.ts:619-623, :700-705`).
        if (detailsSection != null && !state.isClaimingExistingHome && state.isGeocodeResolved) {
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            detailsSection()
        }
    }
}

// MARK: - Step 3

@Composable
private fun RoleStep(
    state: AddHomeUiState,
    vm: AddHomeWizardViewModel,
) {
    HeadlineBlock("What's your role?")
    SubcopyBlock("This determines what verification we'll ask for next.")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        AddHomeRole.entries.forEach { role ->
            RoleRow(
                role = role,
                isSelected = state.form.role == role,
                onTap = { vm.selectRole(role) },
            )
        }
        // A12.2 Setup — RN's Setup step is role picker + "Networks &
        // codes" in one screen (`SetupStep.tsx:33-174`), and the block is
        // hidden when joining an existing home (`SetupStep.tsx:66`).
        if (state.showsAccessSetup) {
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            AddHomeAccessSetupSection(state = state, vm = vm)
        }
    }
}

// MARK: - Step 4

@Composable
private fun ReviewStep(state: AddHomeUiState) {
    HeadlineBlock("Review and submit")
    SubcopyBlock("Make sure everything below looks right before submitting.")
    val composedAddress =
        buildString {
            append(state.form.address.street)
            if (state.form.address.unit
                    .isNotEmpty()
            ) {
                append(", ${state.form.address.unit}")
            }
            append(", ${state.form.address.city}")
            append(", ${state.form.address.state} ${state.form.address.zipCode}")
        }
    // Address / role, plus everything the Details and Setup
    // blocks collected — the review step previously showed only the first
    // three, so nothing the user typed on those blocks was verifiable
    // before submit.
    val rows =
        buildList {
            add(ReviewSummaryRow("Address", composedAddress))
            add(ReviewSummaryRow("Role", state.form.role?.label ?: "—"))
            if (state.isClaimingExistingHome) return@buildList
            val details = state.form.details
            if (details.nickname.isNotBlank()) {
                add(ReviewSummaryRow("Nickname", details.nickname.trim()))
            }
            add(ReviewSummaryRow("Home type", details.homeType.label))
            val size =
                listOfNotNull(
                    details.bedrooms.takeIf { it.isNotEmpty() }?.let { "$it bd" },
                    details.bathrooms.takeIf { it.isNotEmpty() }?.let { "$it ba" },
                ).joinToString(" · ")
            if (size.isNotEmpty()) add(ReviewSummaryRow("Size", size))
            if (details.sqFt.isNotEmpty()) {
                add(ReviewSummaryRow("Home size", "${details.sqFt} sq ft"))
            }
            if (details.lotSqFt.isNotEmpty()) {
                add(ReviewSummaryRow("Lot size", "${details.lotSqFt} sq ft"))
            }
            if (details.yearBuilt.isNotEmpty()) {
                add(ReviewSummaryRow("Year built", details.yearBuilt))
            }
            val secretCount = state.accessItems.count { it.isComplete }
            if (secretCount > 0) {
                add(
                    ReviewSummaryRow(
                        "Networks & codes",
                        if (secretCount == 1) "1 entry" else "$secretCount entries",
                    ),
                )
            }
        }
    ReviewSummaryBlock(rows = rows)
    if (!state.isClaimingExistingHome) SubcopyBlock("Saving starts your private Home setup. Residency and ownership require verification.")
}

@Composable
private fun AddressConfirmationFields(state: AddHomeUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        ConfirmationField(
            label = "Street address",
            value = state.form.address.street,
            fieldState = if (state.isGeocodeResolved) ConfirmationFieldState.Success else ConfirmationFieldState.Default,
            testTag = "addHome_confirmStreet",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ConfirmationField(
                label = "Apt / Unit",
                value = state.form.address.unit,
                optional = true,
                modifier = Modifier.weight(0.4f),
                testTag = "addHome_confirmUnit",
            )
            ConfirmationField(
                label = "City",
                value = state.form.address.city,
                modifier = Modifier.weight(0.6f),
                testTag = "addHome_confirmCity",
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ConfirmationField(
                label = "State",
                value = state.form.address.state,
                modifier = Modifier.weight(0.4f),
                testTag = "addHome_confirmState",
            )
            ConfirmationField(
                label = "ZIP",
                value = state.form.address.zipCode,
                fieldState =
                    when {
                        state.zipMismatch != null -> ConfirmationFieldState.Error
                        state.isGeocodeResolved -> ConfirmationFieldState.Success
                        else -> ConfirmationFieldState.Default
                    },
                helperText = state.zipMismatch?.let(::zipFieldErrorText),
                modifier = Modifier.weight(0.6f),
                testTag = "addHome_confirmZip",
            )
        }
    }
}

private enum class ConfirmationFieldState { Default, Success, Error }

@Composable
private fun ConfirmationField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    optional: Boolean = false,
    fieldState: ConfirmationFieldState = ConfirmationFieldState.Default,
    helperText: String? = null,
    testTag: String,
) {
    val borderColor =
        when (fieldState) {
            ConfirmationFieldState.Success -> PantopusColors.success
            ConfirmationFieldState.Error -> PantopusColors.error
            ConfirmationFieldState.Default -> PantopusColors.appBorder
        }
    val containerColor =
        if (fieldState == ConfirmationFieldState.Success) {
            PantopusColors.successBg
        } else {
            PantopusColors.appSurface
        }
    Column(
        modifier =
            modifier.semantics {
                contentDescription =
                    buildString {
                        append(label)
                        if (optional) append(", optional")
                        append(", ")
                        append(value.ifBlank { "blank" })
                        helperText?.let { append(", error: $it") }
                    }
            },
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            if (optional) {
                Text(
                    text = "Optional",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(containerColor)
                    .border(1.dp, borderColor, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3)
                    .testTag(testTag),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = value,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            when (fieldState) {
                ConfirmationFieldState.Success ->
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.success,
                    )
                ConfirmationFieldState.Error ->
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.error,
                    )
                ConfirmationFieldState.Default -> Unit
            }
        }
        helperText?.let {
            Text(
                text = it,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

private fun zipFieldErrorText(mismatch: AddHomeZipMismatch): String {
    val city = mismatch.city.ifBlank { "this street" }
    return "ZIP doesn't match $city for this street."
}

/**
 * Snapshot preview for the A12.2 geocode confirmation step. Renders the
 * real wizard shell with inert callbacks so Paparazzi can lock the sticky
 * CTA enabled/disabled states without standing up Hilt.
 */
@Composable
internal fun AddHomeWizardConfirmPreview(
    state: AddHomeUiState,
    modifier: Modifier = Modifier,
) {
    WizardShell(
        model = AddHomePreviewWizardModel(state),
        modifier = modifier,
    ) {
        ConfirmStep(
            state = state,
            onApplyGeocodedZip = {},
        )
    }
}

private class AddHomePreviewWizardModel(
    private val state: AddHomeUiState,
) : WizardModel {
    override val chrome: WizardChrome
        get() =
            WizardChrome(
                title = "Add home",
                progressLabel = WizardProgressLabel.StepOf(current = 2, total = AddHomeStep.PROGRESS_TOTAL),
                progressFraction = 2f / AddHomeStep.PROGRESS_TOTAL,
                leading = WizardLeadingControl.Back,
                primaryCtaLabel = "Continue",
                primaryCtaEnabled = !state.isCheckingAddress && state.errorMessage == null && state.zipMismatch == null,
                secondaryCta = null,
                isSubmitting = false,
                dirty = true,
                showsProgressBar = true,
            )

    override fun onLeading() = Unit

    override fun onDiscard() = Unit

    override fun onPrimary() = Unit
}

// MARK: - Step 5

@Composable
private fun SuccessStep() {
    // Reuse the T3.6 Status / Waiting body. The headline + subcopy
    // are the Add-Home variants of the success frame; everything
    // else (illustration, action cards, explainer bullets) is shared.
    StatusWaitingBody(
        content =
            StatusWaitingContent.claimSubmitted().copy(
                headline = "Home added",
                subcopy = "We'll email you when verification completes.",
            ),
    )
}

// MARK: - Helpers

@Composable
private fun ZipMismatchBanner(
    mismatch: AddHomeZipMismatch,
    onApply: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(
                    width = 1.dp,
                    color = PantopusColors.warning.copy(alpha = 0.3f),
                    shape = RoundedCornerShape(Radii.lg),
                )
                .padding(Spacing.s3)
                .testTag("addHome_zipMismatchBanner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.warning),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertTriangle,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = "Confirm the ZIP code",
                    style = PantopusTextStyle.body,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.warning,
                )
                Text(
                    text = zipMismatchMessage(mismatch),
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.warning,
                )
            }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(
                            width = 1.dp,
                            color = PantopusColors.warning,
                            shape = RoundedCornerShape(Radii.md),
                        )
                        .clickable(role = Role.Button, onClick = onApply)
                        .padding(horizontal = Spacing.s3)
                        .testTag("addHome_zipApply")
                        .semantics {
                            contentDescription = "Apply ZIP correction to ${mismatch.correctedZip}"
                        },
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    text = "${mismatch.street}, ${mismatch.city} ${mismatch.state} ${mismatch.correctedZip}",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "Apply",
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.warning,
                )
            }
        }
    }
}

private fun zipMismatchMessage(mismatch: AddHomeZipMismatch): String =
    "ZIP ${mismatch.enteredZip} is in ${mismatch.city.ifBlank { "this area" }}, " +
        "but ${mismatch.street} is in the ${mismatch.correctedZip} ZIP."

@Composable
private fun GeocodeConfirmationBlock(address: AddHomeGeocodedAddress) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        GeocodeMapStrip(address)
        AddressRecognizedRow(address)
    }
}

@Composable
private fun GeocodeMapStrip(address: AddHomeGeocodedAddress) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(88.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .testTag("addHome_geocodeMap"),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val streetColor = PantopusColors.appSurface
            drawLine(
                color = streetColor,
                start = Offset(0f, size.height * 0.25f),
                end = Offset(size.width, size.height * 0.25f),
                strokeWidth = 6.dp.toPx(),
            )
            drawLine(
                color = streetColor,
                start = Offset(0f, size.height * 0.64f),
                end = Offset(size.width, size.height * 0.64f),
                strokeWidth = 4.dp.toPx(),
            )
            drawLine(
                color = streetColor,
                start = Offset(size.width * 0.25f, 0f),
                end = Offset(size.width * 0.25f, size.height),
                strokeWidth = 5.dp.toPx(),
            )
            drawLine(
                color = streetColor,
                start = Offset(size.width * 0.68f, 0f),
                end = Offset(size.width * 0.68f, size.height),
                strokeWidth = 3.dp.toPx(),
            )
            val blockColor = PantopusColors.appBorderStrong.copy(alpha = 0.55f)
            drawRoundRect(
                color = blockColor,
                topLeft = Offset(size.width * 0.30f, size.height * 0.32f),
                size = Size(size.width * 0.13f, size.height * 0.25f),
                cornerRadius = CornerRadius(Radii.xs.toPx(), Radii.xs.toPx()),
            )
            drawRoundRect(
                color = blockColor,
                topLeft = Offset(size.width * 0.46f, size.height * 0.32f),
                size = Size(size.width * 0.19f, size.height * 0.25f),
                cornerRadius = CornerRadius(Radii.xs.toPx(), Radii.xs.toPx()),
            )
            drawRoundRect(
                color = blockColor,
                topLeft = Offset(size.width * 0.10f, size.height * 0.70f),
                size = Size(size.width * 0.17f, size.height * 0.22f),
                cornerRadius = CornerRadius(Radii.xs.toPx(), Radii.xs.toPx()),
            )
            drawRoundRect(
                color = blockColor,
                topLeft = Offset(size.width * 0.70f, size.height * 0.70f),
                size = Size(size.width * 0.16f, size.height * 0.22f),
                cornerRadius = CornerRadius(Radii.xs.toPx(), Radii.xs.toPx()),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextInverse,
            )
        }
        coordinateLabel(address)?.let { label ->
            Text(
                text = label,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .padding(Spacing.s2)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.appSurface.copy(alpha = 0.94f))
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            )
        }
    }
}

@Composable
private fun AddressRecognizedRow(address: AddHomeGeocodedAddress) {
    val location = addressLocationCopy(address)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.successBg)
                .border(
                    width = 1.dp,
                    color = PantopusColors.successLight,
                    shape = RoundedCornerShape(Radii.md),
                )
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("addHome_addressRecognized")
                .semantics(mergeDescendants = true) {
                    contentDescription = "Address recognized. Looks like $location."
                },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = "Address recognized. Looks like $location.",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.success,
            modifier = Modifier.weight(1f),
        )
    }
}

private fun coordinateLabel(address: AddHomeGeocodedAddress): String? {
    val latitude = address.latitude ?: return null
    val longitude = address.longitude ?: return null
    return "${formatLatitude(latitude)}, ${formatLongitude(longitude)}"
}

private fun formatLatitude(value: Double): String =
    String.format(Locale.US, "%.4f°%s", kotlin.math.abs(value), if (value >= 0) "N" else "S")

private fun formatLongitude(value: Double): String =
    String.format(Locale.US, "%.4f°%s", kotlin.math.abs(value), if (value >= 0) "E" else "W")

private fun addressLocationCopy(address: AddHomeGeocodedAddress): String {
    val base =
        listOf(address.city, address.state)
            .filter { it.isNotBlank() }
            .joinToString(", ")
    return when {
        address.isMultiUnit && base.isNotEmpty() -> "$base - multi-unit"
        address.isMultiUnit -> "a multi-unit home"
        base.isNotEmpty() -> base
        else -> "a home"
    }
}

@Composable
private fun AddHomeSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (query.isEmpty()) 1.dp else 2.dp,
                    color = if (query.isEmpty()) PantopusColors.appBorder else PantopusColors.primary600,
                    shape = RoundedCornerShape(Radii.lg),
                ).padding(horizontal = Spacing.s3)
                .testTag("addHomeSearchField")
                .semantics {
                    contentDescription = "Search by address or nearby"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 18.dp,
            tint = if (query.isEmpty()) PantopusColors.primary600 else PantopusColors.appTextSecondary,
        )
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier = Modifier.weight(1f).testTag("addHomeSearchInput"),
            decorationBox = { inner ->
                if (query.isEmpty()) {
                    Text(
                        text = "Search by address or nearby…",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.primary600,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                inner()
            },
        )
        if (query.isNotEmpty()) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(role = Role.Button, onClick = onClear)
                        .testTag("addHome_clearSearch")
                        .semantics { contentDescription = "Clear search" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun UseCurrentLocationPill(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.pill))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("addHome_useCurrentLocation")
                .semantics { contentDescription = "Use current location" },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.primary700,
        )
        Text(
            text = "Use current location",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
}

@Composable
private fun ManualAddressButton(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(vertical = Spacing.s1)
                .testTag("addHome_addAddressManually"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Add address manually",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun AddressVerdictRow(check: app.pantopus.android.data.api.models.homes.CheckAddressResponse) {
    val verdict =
        if (check.exists) {
            Verdict(
                icon = PantopusIcon.AlertCircle,
                color = PantopusColors.warning,
                headline = "Already on Pantopus",
                subcopy = "This address has a Home. Your role determines how to request access.",
            )
        } else {
            Verdict(
                icon = PantopusIcon.CheckCircle,
                color = PantopusColors.success,
                headline = "Ready for Home setup",
                subcopy = "Continue to choose your role. This address check does not verify residency or ownership.",
            )
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceMuted)
                .padding(Spacing.s3)
                .semantics(mergeDescendants = true) {
                    contentDescription = "${verdict.headline}. ${verdict.subcopy}"
                },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = verdict.icon, contentDescription = null, size = Radii.xl2, tint = verdict.color)
        Column(modifier = Modifier.weight(1f)) {
            Text(text = verdict.headline, style = PantopusTextStyle.body, color = PantopusColors.appText)
            Text(
                text = verdict.subcopy,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

private data class Verdict(
    val icon: PantopusIcon,
    val color: androidx.compose.ui.graphics.Color,
    val headline: String,
    val subcopy: String,
)

@Composable
private fun RoleRow(
    role: AddHomeRole,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onTap, role = Role.RadioButton)
                .padding(Spacing.s3)
                .testTag("addHome_role_${role.name.lowercase()}")
                .semantics { contentDescription = role.label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RadioCircle(isSelected = isSelected)
        Text(text = role.label, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}

@Composable
private fun RadioCircle(isSelected: Boolean) {
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(width = 2.dp, color = borderColor, shape = CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("addHomeErrorBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
        )
    }
}
