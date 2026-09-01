@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.claim_ownership

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.homes.claim_ownership.components.ClaimDocumentTypePicker
import app.pantopus.android.ui.screens.homes.claim_ownership.components.ClaimHomeChip
import app.pantopus.android.ui.screens.homes.claim_ownership.components.ClaimStatement
import app.pantopus.android.ui.screens.homes.claim_ownership.components.UploadSlot
import app.pantopus.android.ui.screens.homes.claim_ownership.components.UploadSlotFile
import app.pantopus.android.ui.screens.homes.claim_ownership.components.UploadSlotState
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.RequirementsCardBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.RequirementsRow
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.screens.status.StatusWaitingBody
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag applied to the Claim Ownership wizard root. */
const val CLAIM_OWNERSHIP_SCREEN_TAG: String = "claimOwnershipWizard"

/**
 * Concrete claim-ownership wizard composable. The view model survives
 * config changes via Hilt's `SavedStateHandle`.
 */
@Composable
fun ClaimOwnershipWizardScreen(
    onDismiss: () -> Unit,
    onOpenClaimsList: () -> Unit,
    viewModel: ClaimOwnershipWizardViewModel = hiltViewModel(),
    onOpenFindHome: () -> Unit = {},
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        when (pendingEvent) {
            ClaimOwnershipOutboundEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onDismiss()
            }
            ClaimOwnershipOutboundEvent.OpenClaimsList -> {
                viewModel.acknowledgeEvent()
                onOpenClaimsList()
            }
            ClaimOwnershipOutboundEvent.OpenFindHome -> {
                viewModel.acknowledgeEvent()
                onOpenFindHome()
            }
            null -> Unit
        }
    }

    LaunchedEffect(Unit) {
        Analytics.track(
            AnalyticsEvent.ScreenClaimOwnershipStepViewed(state.currentStep.name),
        )
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag(CLAIM_OWNERSHIP_SCREEN_TAG),
    ) {
        when (state.currentStep) {
            ClaimOwnershipStep.Start ->
                StartStep(
                    content = state.startContent,
                    showsAskVerifiedOwner = state.showsAskVerifiedOwner,
                    selectedMethod = state.selectedStartMethod,
                    onSelectMethod = viewModel::selectStartMethod,
                )
            ClaimOwnershipStep.Upload -> UploadStep(state, viewModel)
            ClaimOwnershipStep.Success -> SuccessStep(outcomeNote = state.submissionOutcomeNote)
        }
    }

    state.askRequestConfirmation?.let { message ->
        ClaimAlertDialog(
            title = "Request sent",
            message = message,
            confirmLabel = "OK",
            onConfirm = viewModel::acknowledgeAskConfirmation,
            onDismiss = viewModel::acknowledgeAskConfirmation,
            testTag = "claimOwnershipAskRequestSent",
        )
    }
    state.askRequestError?.let { message ->
        ClaimAlertDialog(
            title = "Could not send request",
            message = message,
            confirmLabel = "OK",
            onConfirm = viewModel::acknowledgeAskError,
            onDismiss = viewModel::acknowledgeAskError,
            testTag = "claimOwnershipAskRequestError",
        )
    }
    state.blockedByOtherClaimPrompt?.let { message ->
        ClaimAlertDialog(
            title = "Unable to submit",
            message = message,
            confirmLabel = "Search homes",
            onConfirm = viewModel::openFindHomeFromBlockedClaim,
            dismissLabel = "OK",
            onDismiss = viewModel::dismissBlockedByOtherClaim,
            testTag = "claimOwnershipBlockedByOtherClaim",
        )
    }
    // Backend `routing_classification` acknowledgement — single
    // "Continue" action, matching RN's blocking alert
    // (`claim-owner/evidence.tsx:223-241`).
    state.routingWarning?.let { warning ->
        ClaimAlertDialog(
            title = warning.title,
            message = warning.message,
            confirmLabel = "Continue",
            onConfirm = viewModel::acknowledgeRoutingWarning,
            onDismiss = viewModel::acknowledgeRoutingWarning,
            testTag = "claimOwnershipRoutingWarning",
        )
    }
}

@Composable
private fun ClaimAlertDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    testTag: String,
    dismissLabel: String? = null,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag(testTag),
        title = { Text(text = title, style = PantopusTextStyle.h3, color = PantopusColors.appText) },
        text = { Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(text = confirmLabel, style = PantopusTextStyle.body, color = PantopusColors.primary600)
            }
        },
        dismissButton =
            dismissLabel?.let {
                {
                    TextButton(onClick = onDismiss) {
                        Text(text = it, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
                    }
                }
            },
    )
}

// MARK: - Step 1

@Composable
internal fun StartStep(
    content: ClaimOwnershipStartContent = ClaimOwnershipSampleData.canonicalStart,
    showsAskVerifiedOwner: Boolean = false,
    selectedMethod: ClaimStartMethod = ClaimStartMethod.VerifyOwnership,
    onSelectMethod: (ClaimStartMethod) -> Unit = {},
) {
    ClaimHomeChip(label = content.homeLabel)
    content.contestedClaim?.let { ContestedClaimNotice(it) }
    HeadlineBlock(if (content.isContested) "File a competing claim" else "Let's verify you own this home")
    SubcopyBlock(
        if (content.isContested) {
            "Same process, but the reviewer compares both submissions side-by-side. Bring your strongest documents."
        } else {
            "Claiming ownership lets you invite residents, receive mail, post packages, and run the household's " +
                "command center. Verification is a one-time step."
        },
    )
    if (showsAskVerifiedOwner) {
        ClaimMethodPicker(selected = selectedMethod, onSelect = onSelectMethod)
    }
    if (selectedMethod == ClaimStartMethod.VerifyOwnership) {
        RequirementsCardBlock(
            rows = requirementsRows(content.isContested),
        )
        WhyWeAskSection()
    }
}

/**
 * A12.3 method picker. Rendered only when the home already has a
 * verified owner and the viewer is not a member, so a non-member can
 * ask the owners to add them instead of filing an ownership claim.
 */
@Composable
private fun ClaimMethodPicker(
    selected: ClaimStartMethod,
    onSelect: (ClaimStartMethod) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("claimOwnershipMethodPicker"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Verification method",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        ClaimMethodRow(
            selected = selected == ClaimStartMethod.VerifyOwnership,
            icon = PantopusIcon.FileText,
            label = "Upload ownership document",
            subcopy = "Deed, tax bill, or closing disclosure.",
            testTag = "claimOwnershipMethod.verifyOwnership",
            onClick = { onSelect(ClaimStartMethod.VerifyOwnership) },
        )
        ClaimMethodRow(
            selected = selected == ClaimStartMethod.AskVerifiedOwner,
            icon = PantopusIcon.Users,
            label = "Ask a verified owner to add me",
            subcopy =
                "Sends a notification to verified owner(s). They can add you from Members " +
                    "with the role you need.",
            testTag = "claimOwnershipMethod.askVerifiedOwner",
            onClick = { onSelect(ClaimStartMethod.AskVerifiedOwner) },
        )
    }
}

@Composable
private fun ClaimMethodRow(
    selected: Boolean,
    icon: PantopusIcon,
    label: String,
    subcopy: String,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.lg),
                ).clickable(role = Role.RadioButton, onClick = onClick)
                .padding(Spacing.s3)
                .testTag(testTag)
                .semantics { contentDescription = "$label. $subcopy" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (selected) PantopusColors.personalBg else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = Radii.xl2,
                tint = if (selected) PantopusColors.primary600 else PantopusColors.appTextSecondary,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = label,
                style = PantopusTextStyle.body,
                color = if (selected) PantopusColors.primary600 else PantopusColors.appText,
            )
            Text(text = subcopy, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .border(
                        2.dp,
                        if (selected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        CircleShape,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
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
}

private fun requirementsRows(isContested: Boolean): List<RequirementsRow> =
    if (isContested) {
        listOf(
            RequirementsRow(
                id = "strongest-doc",
                icon = PantopusIcon.Zap,
                title = "Strongest property record or deed",
                subcopy = "A deed or county property record gets prioritized in contested reviews.",
                emphasized = true,
            ),
            RequirementsRow(
                id = "id",
                icon = PantopusIcon.Check,
                title = "Government-issued ID",
                subcopy = "Driver's license, state ID, or passport.",
            ),
            RequirementsRow(
                id = "utility-bill",
                icon = PantopusIcon.Check,
                title = "Utility bill for this address",
                subcopy = "A recent bill helps match your name to 412 Elm St.",
            ),
        )
    } else {
        listOf(
            RequirementsRow(
                id = "id",
                icon = PantopusIcon.Check,
                title = "Government-issued ID",
                subcopy = "Driver's license, state ID, or passport.",
            ),
            RequirementsRow(
                id = "utility-bill",
                icon = PantopusIcon.Check,
                title = "Utility bill",
                subcopy = "A recent bill showing your name and this address.",
            ),
            RequirementsRow(
                id = "property-record",
                icon = PantopusIcon.Check,
                title = "Property record or deed",
                subcopy = "Deed, tax record, or mortgage statement.",
            ),
        )
    }

@Composable
private fun ContestedClaimNotice(claim: ClaimOwnershipContestedClaim) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("claimOwnershipContestedNotice"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.warning),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = claim.title,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.warning,
                )
                Text(
                    text = claim.body,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
        ClaimantChip(claim)
    }
}

@Composable
private fun ClaimantChip(claim: ClaimOwnershipContestedClaim) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("claimOwnershipExistingClaimant"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = claim.claimantInitials,
                style = PantopusTextStyle.caption,
                color = PantopusColors.business,
            )
        }
        Text(
            text = "${claim.claimantName} · ${claim.filedLabel} · ${claim.statusLabel}",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun WhyWeAskSection() {
    var expanded by rememberSaveable { mutableStateOf(false) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .testTag("claimOwnershipWhyWeAsk")
                    .semantics {
                        contentDescription = if (expanded) "Hide why we ask" else "Show why we ask"
                        role = Role.Button
                    }.clickable { expanded = !expanded },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ShieldCheck,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.primary600,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Why we ask",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.primary700,
                )
                Text(
                    text = "Address proof keeps Pantopus real-people only.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.primary600,
            )
        }
        if (expanded) {
            Text(
                text =
                    "A reviewer checks that your ID and address documents match this home, then compares " +
                        "ownership records. Your files stay private and are only used for verification.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .padding(start = Spacing.s10)
                        .testTag("claimOwnershipWhyWeAskDetail"),
            )
        }
    }
}

// MARK: - Step 2

@Composable
private fun UploadStep(
    state: ClaimOwnershipUiState,
    vm: ClaimOwnershipWizardViewModel,
) {
    val context = LocalContext.current
    var pickerSlot by remember { mutableStateOf<ClaimEvidenceSlot?>(null) }
    val picker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocument(),
        ) { uri: Uri? ->
            val slot = pickerSlot ?: return@rememberLauncherForActivityResult
            pickerSlot = null
            if (uri == null) return@rememberLauncherForActivityResult
            val resolver = context.contentResolver
            val mime = resolver.getType(uri) ?: "application/octet-stream"
            val name = uri.lastPathSegment?.substringAfterLast('/') ?: "evidence"
            val bytes =
                resolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: return@rememberLauncherForActivityResult
            vm.picked(slot, ClaimPickedFile(filename = name, mimeType = mime, bytes = bytes))
        }

    UploadStepContent(
        homeLabel = state.startContent.homeLabel,
        slots =
            state.activeSlots.map { slot ->
                // A chooser slot takes the label of the document kind the
                // user picked, so the tile reads "Utility Bill" rather
                // than a generic "Proof of residency".
                val pickedLabel =
                    slot.documentOptions.firstOrNull { it.id == state.selectedDocumentType }?.label
                ClaimUploadSlotModel(
                    id = slot.name,
                    label = pickedLabel ?: slot.title,
                    required = true,
                    hint = slot.acceptHint,
                    state =
                        (state.slots[slot] ?: ClaimSlotState.Empty)
                            .toUploadState(state.addressMatches[slot], state.startContent.homeLabel),
                )
            },
        note = state.note,
        onNoteChange = vm::setNote,
        verificationType = state.verificationType,
        documentOptions = state.documentOptions,
        selectedDocumentType = state.selectedDocumentType,
        submitError = state.submitError,
        onPick = { id ->
            val slot = ClaimEvidenceSlot.entries.firstOrNull { it.name == id } ?: return@UploadStepContent
            pickerSlot = slot
            picker.launch(arrayOf("image/*", "application/pdf"))
        },
        onRemove = { id ->
            val slot = ClaimEvidenceSlot.entries.firstOrNull { it.name == id } ?: return@UploadStepContent
            vm.remove(slot)
        },
        onSelectDocumentType = vm::selectDocumentType,
    )
}

/** One slot's display descriptor, assembled from the view model (or from
 * sample fixtures in snapshot tests). */
internal data class ClaimUploadSlotModel(
    val id: String,
    val label: String,
    val required: Boolean,
    val hint: String,
    val state: UploadSlotState,
)

/**
 * The Evidence step body as a pure function of its state. [UploadStep] builds
 * this from the view model; Paparazzi snapshots render it from fixtures.
 */
@Composable
internal fun UploadStepContent(
    homeLabel: String,
    slots: List<ClaimUploadSlotModel>,
    note: String,
    onNoteChange: (String) -> Unit,
    submitError: String?,
    onPick: (String) -> Unit,
    onRemove: (String) -> Unit,
    verificationType: ClaimVerificationType = ClaimVerificationType.Owner,
    documentOptions: List<ClaimDocumentOption> = emptyList(),
    selectedDocumentType: String? = null,
    onSelectDocumentType: (String) -> Unit = {},
) {
    val attached = slots.count { it.state.isAttached }
    val isResidency = verificationType == ClaimVerificationType.Residency
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        ClaimHomeChip(label = homeLabel)
        HeadlineBlock(if (isResidency) "Verify you live here" else "Upload your evidence")
        SubcopyBlock(
            if (isResidency) {
                "Upload a document that proves you live at $homeLabel. " +
                    "Your access will be limited until verified."
            } else {
                "Two documents help us verify you own $homeLabel. We auto-check the address against your account."
            },
        )
        // Copy lifted from RN's info banner (`evidence.tsx:283-289`).
        InfoBanner(
            if (isResidency) {
                "For residency verification, please upload a lease agreement, utility bill " +
                    "(electric, gas, water, internet), or similar document showing your name at this address."
            } else {
                "For ownership verification, please upload a deed, closing disclosure, or property " +
                    "tax statement. Utility bills and leases can only be used for residency verification."
            },
        )
        if (documentOptions.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Text(
                    text = "1. Select document type",
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextSecondary,
                )
                ClaimDocumentTypePicker(
                    options = documentOptions,
                    selected = selectedDocumentType,
                    onSelect = onSelectDocumentType,
                )
            }
        }
        if (documentOptions.isEmpty() || selectedDocumentType != null) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                val heading =
                    if (documentOptions.isEmpty()) "Documents" else "2. Upload your document"
                Text(
                    // Multi-slot variants (owner: ID + ownership proof)
                    // keep the attached-count readout; the single-slot
                    // residency variant matches RN's plain heading.
                    text =
                        if (slots.size > 1) {
                            "$heading · $attached of ${slots.size} attached"
                        } else {
                            heading
                        },
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextSecondary,
                )
                slots.forEach { slot ->
                    UploadSlot(
                        id = slot.id,
                        label = slot.label,
                        hint = slot.hint,
                        state = slot.state,
                        required = slot.required,
                        onPick = { onPick(slot.id) },
                        onRemove = { onRemove(slot.id) },
                    )
                }
            }
        }
        ClaimStatement(
            value = note,
            onValueChange = onNoteChange,
            placeholder = ClaimUploadCopy.STATEMENT_PLACEHOLDER,
        )
        submitError?.let { ErrorBanner(it) }
        EncryptionFooter()
    }
}

@Composable
private fun InfoBanner(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3)
                .testTag("claimOwnership_infoBanner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.primary600,
        )
        Text(
            text = text,
            color = PantopusColors.primary700,
            fontSize = 12.5.sp,
            modifier = Modifier.weight(1f),
        )
    }
}

// MARK: - Step 3

@Composable
private fun SuccessStep(outcomeNote: String? = null) {
    // Route through the shared T3.6 Status / Waiting body so the
    // claim-submitted state shares its hero, timeline, action cards,
    // and explainer bullets with every other "submitted" surface.
    StatusWaitingBody(content = StatusWaitingContent.claimSubmitted())
    // Extra line describing what the submission actually did — a
    // parallel claim, or a challenge that opened against the current
    // verified household. Derived from the backend's
    // `routing_classification` (RN passes the same signal into its
    // `submitted` screen as `?parallel=1` / `?challenge=1`).
    outcomeNote?.let { note ->
        Text(
            text = note,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.s3)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceMuted)
                    .padding(Spacing.s3)
                    .testTag("claimOwnershipOutcomeNote"),
        )
    }
}

// MARK: - Helpers

private fun ClaimSlotState.toUploadState(
    verdict: ClaimAddressMatch?,
    homeLabel: String,
): UploadSlotState =
    when (this) {
        ClaimSlotState.Empty -> UploadSlotState.Empty
        is ClaimSlotState.Uploading -> UploadSlotState.Uploading(file.toDisplay(), fraction)
        is ClaimSlotState.Picked -> file.toDisplay().withVerdict(verdict ?: file.fallbackMatch(homeLabel))
        is ClaimSlotState.Uploaded -> file.toDisplay().withVerdict(verdict ?: file.fallbackMatch(homeLabel))
        is ClaimSlotState.Failed -> file.toDisplay().withVerdict(verdict ?: file.fallbackMatch(homeLabel))
    }

private fun ClaimPickedFile.fallbackMatch(homeLabel: String): ClaimAddressMatch =
    ClaimOwnershipSampleData.addressMatch(filename = filename, homeLabel = homeLabel)

private fun UploadSlotFile.withVerdict(verdict: ClaimAddressMatch): UploadSlotState =
    when (verdict) {
        is ClaimAddressMatch.Matches -> UploadSlotState.Done(this, verdict.detail)
        is ClaimAddressMatch.Differs -> UploadSlotState.Warn(this, verdict.detail)
    }

private fun ClaimPickedFile.toDisplay(): UploadSlotFile =
    UploadSlotFile(
        name = filename,
        sizeLabel = formatClaimFileSize(sizeBytes),
        pageCount = null,
        kind =
            if (mimeType == "application/pdf" || filename.lowercase().endsWith(".pdf")) {
                UploadSlotFile.Kind.Pdf
            } else {
                UploadSlotFile.Kind.Image
            },
    )

/** Human-readable file size, e.g. "1.4 MB" / "820 KB". */
@Suppress("MagicNumber")
internal fun formatClaimFileSize(bytes: Long): String {
    val mb = bytes.toDouble() / 1_048_576.0
    if (mb >= 1) return "%.1f MB".format(mb)
    val kb = bytes.toDouble() / 1_024.0
    return "%.0f KB".format(kb)
}

@Composable
private fun EncryptionFooter() {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("claimOwnership_encryptionFooter"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = ClaimUploadCopy.ENCRYPTION_FOOTER,
            color = PantopusColors.appTextSecondary,
            fontSize = 11.5.sp,
            modifier = Modifier.weight(1f),
        )
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
                .testTag("claimOwnership_errorBanner")
                .semantics { contentDescription = message },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.error,
        )
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.error)
    }
}
