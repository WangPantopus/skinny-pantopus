@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.legal

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.businesses.payments.ActionToast
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Business Legal root container. */
const val BUSINESS_LEGAL_TAG = "businessLegal.screen"

/** MIME filter for the evidence picker — documents and photos of them. */
private val EVIDENCE_MIME_TYPES = arrayOf("application/pdf", "image/*", "text/plain")

/**
 * A10.7 owner surface — "Legal & verification". Verification tier card +
 * evidence ledger + self-attestation + document upload, then the private
 * (legal / finance) record form behind a "private to the owner" notice.
 * Mirrors RN `LegalTab.tsx` and iOS `BusinessLegalView`.
 */
@Composable
fun BusinessLegalScreen(
    onBack: () -> Unit,
    viewModel: BusinessLegalViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.action.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val legalName by viewModel.legalName.collectAsStateWithLifecycle()
    val taxIdLast4 by viewModel.taxIdLast4.collectAsStateWithLifecycle()
    val supportEmail by viewModel.supportEmail.collectAsStateWithLifecycle()
    val addressConfirmed by viewModel.addressConfirmed.collectAsStateWithLifecycle()

    val context = LocalContext.current
    var pendingEvidenceType by remember { mutableStateOf<BusinessEvidenceType?>(null) }
    var showAttestConfirm by remember { mutableStateOf(false) }

    val picker =
        rememberLauncherForActivityResult(contract = ActivityResultContracts.OpenDocument()) { uri: Uri? ->
            val type = pendingEvidenceType
            pendingEvidenceType = null
            if (uri == null || type == null) return@rememberLauncherForActivityResult
            val resolver = context.contentResolver
            val mime = resolver.getType(uri) ?: "application/octet-stream"
            var filename = uri.lastPathSegment?.substringAfterLast('/') ?: "document"
            resolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIdx >= 0) filename = cursor.getString(nameIdx)
                }
            }
            val bytes =
                resolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: return@rememberLauncherForActivityResult
            viewModel.uploadEvidence(
                type = type,
                file = PickedEvidenceFile(filename = filename, mimeType = mime, bytes = bytes),
            )
        }

    LaunchedEffect(Unit) { viewModel.load() }

    // Don't let legal PII outlive the screen.
    DisposableEffect(Unit) {
        onDispose { viewModel.clearSensitive() }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(BUSINESS_LEGAL_TAG)) {
        Column(Modifier.fillMaxSize()) {
            ContentDetailTopBar(title = "Legal & verification", onBack = onBack)
            OfflineBannerHost(isOffline = !online) {
                when (val current = state) {
                    BusinessLegalUiState.Loading -> LegalLoading()
                    is BusinessLegalUiState.Loaded ->
                        LegalLoaded(
                            content = current.content,
                            action = action,
                            legalName = legalName,
                            taxIdLast4 = taxIdLast4,
                            supportEmail = supportEmail,
                            addressConfirmed = addressConfirmed,
                            onLegalNameChange = viewModel::setLegalName,
                            onTaxIdChange = viewModel::setTaxIdLast4,
                            onSupportEmailChange = viewModel::setSupportEmail,
                            onAddressConfirmedChange = viewModel::setAddressConfirmed,
                            onSave = viewModel::savePrivateRecord,
                            onAttest = { showAttestConfirm = true },
                            onPickEvidence = { type ->
                                pendingEvidenceType = type
                                picker.launch(EVIDENCE_MIME_TYPES)
                            },
                        )
                    is BusinessLegalUiState.Error ->
                        EmptyState(
                            icon = PantopusIcon.AlertCircle,
                            headline = "Couldn't load legal info",
                            subcopy = current.message,
                            ctaTitle = "Try again",
                            onCta = viewModel::refresh,
                            tint = PantopusColors.businessBg,
                            accent = PantopusColors.business,
                            modifier = Modifier.testTag("businessLegal.error"),
                        )
                }
            }
        }

        when (val current = action) {
            is BusinessLegalAction.Succeeded ->
                ActionToast(
                    message = current.message,
                    background = PantopusColors.success,
                    onDismiss = viewModel::clearAction,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            is BusinessLegalAction.Failed ->
                ActionToast(
                    message = current.message,
                    background = PantopusColors.error,
                    onDismiss = viewModel::clearAction,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            else -> Unit
        }
    }

    if (showAttestConfirm) {
        AlertDialog(
            onDismissRequest = { showAttestConfirm = false },
            title = { Text("Attest to your legal details?") },
            text = {
                Text(
                    "You're confirming that \"$legalName\" is this business's registered legal name " +
                        "and that its address on Pantopus is correct. This is recorded against your account.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showAttestConfirm = false
                        viewModel.selfAttest()
                    },
                    modifier = Modifier.testTag("businessLegal_attestConfirm"),
                ) {
                    Text("Attest", color = PantopusColors.business)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAttestConfirm = false }) { Text("Cancel") }
            },
        )
    }
}

// ─── Loading ──────────────────────────────────────────────────────────

@Composable
private fun LegalLoading() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("businessLegal.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(width = 320.dp, height = 210.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(width = 320.dp, height = 260.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
    }
}

// ─── Loaded ───────────────────────────────────────────────────────────

@Composable
private fun LegalLoaded(
    content: BusinessLegalContent,
    action: BusinessLegalAction,
    legalName: String,
    taxIdLast4: String,
    supportEmail: String,
    addressConfirmed: Boolean,
    onLegalNameChange: (String) -> Unit,
    onTaxIdChange: (String) -> Unit,
    onSupportEmailChange: (String) -> Unit,
    onAddressConfirmedChange: (Boolean) -> Unit,
    onSave: () -> Unit,
    onAttest: () -> Unit,
    onPickEvidence: (BusinessEvidenceType) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("businessLegal.loaded"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PrivacyNotice()
        VerificationCard(
            content = content,
            action = action,
            legalName = legalName,
            addressConfirmed = addressConfirmed,
            onAddressConfirmedChange = onAddressConfirmedChange,
            onAttest = onAttest,
            onPickEvidence = onPickEvidence,
        )
        content.nonprofit?.let { nonprofit ->
            NonprofitCard(
                einApproved = nonprofit.einApproved,
                einPending = nonprofit.einPending,
                canUpload = content.canUploadEvidence,
                onPickEvidence = onPickEvidence,
            )
        }
        if (content.privateAccessDenied) {
            DeniedCard()
        } else {
            PrivateRecordCard(
                hasPrivateRecord = content.hasPrivateRecord,
                isSaving = action is BusinessLegalAction.Saving,
                legalName = legalName,
                taxIdLast4 = taxIdLast4,
                supportEmail = supportEmail,
                onLegalNameChange = onLegalNameChange,
                onTaxIdChange = onTaxIdChange,
                onSupportEmailChange = onSupportEmailChange,
                onSave = onSave,
            )
        }
    }
}

@Composable
private fun PrivacyNotice() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .padding(Spacing.s3)
                .testTag("businessLegal.privacyNotice"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.warning,
        )
        Text(
            text = "This information is private and only visible to the business owner.",
            color = PantopusColors.appTextStrong,
            fontSize = 12.5.sp,
        )
    }
}

// ─── Verification card ────────────────────────────────────────────────

@Composable
private fun VerificationCard(
    content: BusinessLegalContent,
    action: BusinessLegalAction,
    legalName: String,
    addressConfirmed: Boolean,
    onAddressConfirmedChange: (Boolean) -> Unit,
    onAttest: () -> Unit,
    onPickEvidence: (BusinessEvidenceType) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(14.dp)
                .testTag("businessLegal.verificationCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = tierIcon(content.tier),
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2f,
                tint = tierAccent(content.tier),
            )
            Text(
                text = "Verification",
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            Text(
                text = content.tier.label,
                color = tierAccent(content.tier),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(tierBackground(content.tier))
                        .padding(horizontal = Spacing.s2, vertical = 3.dp)
                        .testTag("businessLegal.tierPill"),
            )
        }

        Text(text = content.tier.blurb, color = PantopusColors.appTextSecondary, fontSize = 12.5.sp)

        content.verifiedDateLabel?.let { verified ->
            Text(text = "Verified $verified", color = PantopusColors.appTextMuted, fontSize = 11.5.sp)
        }

        if (content.evidence.isNotEmpty()) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appBg)
                        .testTag("businessLegal.evidenceLedger"),
            ) {
                content.evidence.forEachIndexed { index, row ->
                    EvidenceRow(row)
                    if (index < content.evidence.lastIndex) {
                        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
                    }
                }
            }
        }

        if (content.canSelfAttest) {
            PantopusCheckbox(
                isChecked = addressConfirmed,
                onCheckedChange = onAddressConfirmedChange,
                label = "I confirm this business's registered address on Pantopus is correct.",
                modifier = Modifier.testTag("businessLegal.addressConfirm"),
            )
            PrimaryButton(
                title = "Attest to legal details",
                onClick = onAttest,
                isLoading = action is BusinessLegalAction.Attesting,
                isEnabled = addressConfirmed && legalName.trim().isNotEmpty(),
                modifier = Modifier.fillMaxWidth().testTag("businessLegal.selfAttest"),
            )
        } else {
            content.selfAttestBlockedReason?.let { reason ->
                Text(
                    text = reason,
                    color = PantopusColors.warning,
                    fontSize = 12.sp,
                    modifier = Modifier.testTag("businessLegal.attestBlocked"),
                )
            }
        }

        if (content.canUploadEvidence) {
            UploadEvidenceMenu(
                isUploading = action is BusinessLegalAction.Uploading,
                onPickEvidence = onPickEvidence,
            )
        } else {
            Text(
                text = "A document is already in review, or this business is fully verified.",
                color = PantopusColors.appTextMuted,
                fontSize = 12.sp,
                modifier = Modifier.testTag("businessLegal.uploadBlocked"),
            )
        }
    }
}

@Composable
private fun EvidenceRow(row: BusinessEvidenceRow) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "${row.title}, ${row.status}" }
                .testTag("businessLegal.evidence.${row.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FileText,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = row.title,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            row.dateLabel?.let { date ->
                Text(text = date, color = PantopusColors.appTextMuted, fontSize = 11.sp)
            }
        }
        Text(
            text = row.status.replaceFirstChar { it.uppercase() },
            color = evidenceAccent(row.status),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(evidenceBackground(row.status))
                    .padding(horizontal = Spacing.s2, vertical = 2.dp),
        )
    }
}

@Composable
private fun UploadEvidenceMenu(
    isUploading: Boolean,
    onPickEvidence: (BusinessEvidenceType) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.businessBg)
                    .clickable(enabled = !isUploading) { expanded = true }
                    .padding(vertical = Spacing.s3)
                    .testTag("businessLegal.uploadEvidence"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.PlusCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.business,
            )
            Text(
                text = if (isUploading) "Uploading…" else "Upload verification document",
                color = PantopusColors.business,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = Spacing.s1),
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            BusinessEvidenceType.entries.forEach { type ->
                DropdownMenuItem(
                    text = { Text(type.label) },
                    onClick = {
                        expanded = false
                        onPickEvidence(type)
                    },
                    modifier = Modifier.testTag("businessLegal.upload.${type.raw}"),
                )
            }
        }
    }
}

// ─── Nonprofit card ───────────────────────────────────────────────────

@Composable
private fun NonprofitCard(
    einApproved: Boolean,
    einPending: Boolean,
    canUpload: Boolean,
    onPickEvidence: (BusinessEvidenceType) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(14.dp)
                .testTag("businessLegal.nonprofitCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.BadgeCheck,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
            Text(
                text = "Nonprofit verification",
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.semantics { heading() },
            )
        }
        when {
            einApproved ->
                Text(
                    text = "501(c)(3) status verified — your platform fee is 0%.",
                    color = PantopusColors.success,
                    fontSize = 12.5.sp,
                )
            einPending ->
                Text(
                    text = "Pending admin review — your EIN / tax-exempt documentation is being checked.",
                    color = PantopusColors.warning,
                    fontSize = 12.5.sp,
                )
            else -> {
                Text(
                    text =
                        "Upload your IRS determination letter or EIN verification to confirm " +
                            "501(c)(3) status and unlock a 0% platform fee.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                )
                if (canUpload) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        NonprofitUploadButton(
                            title = "EIN letter",
                            type = BusinessEvidenceType.EinVerification,
                            onPickEvidence = onPickEvidence,
                            modifier = Modifier.weight(1f),
                        )
                        NonprofitUploadButton(
                            title = "501(c)(3) letter",
                            type = BusinessEvidenceType.TaxExemptLetter,
                            onPickEvidence = onPickEvidence,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NonprofitUploadButton(
    title: String,
    type: BusinessEvidenceType,
    onPickEvidence: (BusinessEvidenceType) -> Unit,
    modifier: Modifier = Modifier,
) {
    Text(
        text = title,
        color = PantopusColors.appTextInverse,
        fontSize = 12.5.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.business)
                .clickable { onPickEvidence(type) }
                .padding(vertical = Spacing.s3)
                .testTag("businessLegal.nonprofitUpload.${type.raw}"),
    )
}

// ─── Private record ───────────────────────────────────────────────────

@Composable
private fun PrivateRecordCard(
    hasPrivateRecord: Boolean,
    isSaving: Boolean,
    legalName: String,
    taxIdLast4: String,
    supportEmail: String,
    onLegalNameChange: (String) -> Unit,
    onTaxIdChange: (String) -> Unit,
    onSupportEmailChange: (String) -> Unit,
    onSave: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(14.dp)
                .testTag("businessLegal.privateCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "LEGAL & FINANCE",
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            modifier = Modifier.semantics { heading() },
        )
        PantopusTextField(
            label = "Legal business name",
            value = legalName,
            onValueChange = onLegalNameChange,
            placeholder = "Registered business name",
            fieldTestTag = "businessLegal.legalName",
        )
        PantopusTextField(
            label = "Tax ID (last 4 digits)",
            value = taxIdLast4,
            onValueChange = onTaxIdChange,
            placeholder = "1234",
            keyboardType = KeyboardType.Number,
            fieldTestTag = "businessLegal.taxIdLast4",
        )
        Text(
            text = "Pantopus only ever stores the last four digits. Never enter a full EIN or SSN.",
            color = PantopusColors.appTextMuted,
            fontSize = 11.5.sp,
        )
        PantopusTextField(
            label = "Support email",
            value = supportEmail,
            onValueChange = onSupportEmailChange,
            placeholder = "support@yourbusiness.com",
            keyboardType = KeyboardType.Email,
            fieldTestTag = "businessLegal.supportEmail",
        )
        PrimaryButton(
            title = if (hasPrivateRecord) "Update" else "Save",
            onClick = onSave,
            isLoading = isSaving,
            modifier = Modifier.fillMaxWidth().testTag("businessLegal.save"),
        )
    }
}

@Composable
private fun DeniedCard() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(14.dp)
                .testTag("businessLegal.privateDenied"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldAlert,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextMuted,
        )
        Column {
            Text(
                text = "Legal details are owner-only",
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Ask the business owner to update the legal name, tax ID or support email.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
            )
        }
    }
}

// ─── Tokens ───────────────────────────────────────────────────────────

private fun tierIcon(tier: BusinessVerificationTier): PantopusIcon =
    when (tier) {
        BusinessVerificationTier.Unverified -> PantopusIcon.ShieldAlert
        BusinessVerificationTier.SelfAttested -> PantopusIcon.Shield
        BusinessVerificationTier.DocumentVerified,
        BusinessVerificationTier.GovernmentVerified,
        -> PantopusIcon.ShieldCheck
    }

private fun tierAccent(tier: BusinessVerificationTier): Color =
    when (tier) {
        BusinessVerificationTier.Unverified -> PantopusColors.appTextSecondary
        BusinessVerificationTier.SelfAttested -> PantopusColors.info
        BusinessVerificationTier.DocumentVerified,
        BusinessVerificationTier.GovernmentVerified,
        -> PantopusColors.success
    }

private fun tierBackground(tier: BusinessVerificationTier): Color =
    when (tier) {
        BusinessVerificationTier.Unverified -> PantopusColors.appBorderSubtle
        BusinessVerificationTier.SelfAttested -> PantopusColors.infoBg
        BusinessVerificationTier.DocumentVerified,
        BusinessVerificationTier.GovernmentVerified,
        -> PantopusColors.successBg
    }

private fun evidenceAccent(status: String): Color =
    when (status) {
        "approved" -> PantopusColors.success
        "rejected" -> PantopusColors.error
        else -> PantopusColors.warning
    }

private fun evidenceBackground(status: String): Color =
    when (status) {
        "approved" -> PantopusColors.successBg
        "rejected" -> PantopusColors.errorBg
        else -> PantopusColors.warningBg
    }
