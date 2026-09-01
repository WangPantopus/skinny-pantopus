@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "MagicNumber",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "FunctionNaming",
    "LongParameterList",
    "ModifierMissing",
)

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.FocusInteraction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.RequirementsCardBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.RequirementsRow
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Test tag applied to the verify-landlord wizard root. */
const val VERIFY_LANDLORD_SCREEN_TAG: String = "verifyLandlordWizard"

@Composable
fun VerifyLandlordWizardScreen(
    onDismiss: () -> Unit,
    onOpenPostcardVerification: (String) -> Unit,
    viewModel: VerifyLandlordWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            is VerifyLandlordOutboundEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onDismiss()
            }
            is VerifyLandlordOutboundEvent.OpenPostcardVerification -> {
                viewModel.acknowledgeEvent()
                onOpenPostcardVerification(event.homeId)
            }
            null -> Unit
        }
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag(VERIFY_LANDLORD_SCREEN_TAG),
    ) {
        when (state.currentStep) {
            VerifyLandlordStep.Start -> StartStep(content = state.startContent)
            VerifyLandlordStep.Details -> DetailsStep(state = state, viewModel = viewModel)
            VerifyLandlordStep.Sent ->
                state.approvalResult?.let { result ->
                    SentStep(
                        result = result,
                        errorMessage =
                            (state.submitState as? VerifyLandlordSubmitState.Error)?.message,
                    )
                }
        }
    }
}

// MARK: - A12.5 Start

@Composable
internal fun StartStep(content: VerifyLandlordStartContent = VerifyLandlordSampleData.canonical) {
    HomeChip(label = content.homeChip.label)
    if (content.isFastTrack && content.existingLandlord != null) {
        FastTrackNotice(landlord = content.existingLandlord)
    }
    HeadlineBlock(
        text = if (content.isFastTrack) "Join as a verified tenant" else "Confirm who you rent from",
    )
    SubcopyBlock(
        text =
            if (content.isFastTrack) {
                "Shorter process — we just need to confirm you're really on the lease for " +
                    "Apt 3B. No email to your landlord required."
            } else {
                "Verifying your landlord links this rental to a real owner so you can send " +
                    "rent, raise maintenance tickets, and resolve disputes inside Pantopus. " +
                    "We'll ask them to confirm by email — they don't need an account."
            },
    )
    RequirementsCardBlock(rows = requirementRows(content.isFastTrack))
    WhyWeAskRow()
}

private fun requirementRows(fastTrack: Boolean): List<RequirementsRow> =
    if (fastTrack) {
        listOf(
            RequirementsRow(
                id = "lease-page",
                icon = PantopusIcon.Check,
                title = "A signed lease — just one page",
                subcopy =
                    "Any page showing your name and unit number. We only need it to match " +
                        "you to the existing rental.",
            ),
            RequirementsRow(
                id = "move-in",
                icon = PantopusIcon.Check,
                title = "Confirm your move-in date",
                subcopy = "We'll prefill what your landlord already submitted — you just confirm.",
            ),
            RequirementsRow(
                id = "time-fast",
                icon = PantopusIcon.Check,
                title = "About a minute",
                subcopy = "No email to the landlord this time — they've already verified.",
            ),
        )
    } else {
        listOf(
            RequirementsRow(
                id = "lease",
                icon = PantopusIcon.Check,
                title = "A signed lease agreement",
                subcopy =
                    "PDF, photo, or scan. Current term only — older leases are fine if still active.",
            ),
            RequirementsRow(
                id = "contact",
                icon = PantopusIcon.Check,
                title = "Landlord contact info",
                subcopy = "Their name, email, and phone. We send a one-time confirmation link to them.",
            ),
            RequirementsRow(
                id = "time",
                icon = PantopusIcon.Check,
                title = "A few minutes",
                subcopy = "Most verifications take 3–4 min on your side. Landlord confirms in their inbox.",
            ),
        )
    }

@Composable
private fun HomeChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag("verifyLandlordHomeChip"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.home,
        )
        Text(
            text = label.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.home,
        )
    }
}

@Composable
private fun FastTrackNotice(landlord: VerifyLandlordExistingLandlord) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("verifyLandlordFastTrackNotice"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.BadgeCheck,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Landlord already verified for this building",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.success,
                )
                Text(
                    text =
                        "${landlord.otherTenantsCount} other tenants in this building have " +
                            "completed verification with the same landlord, so we can fast-track yours.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
        ExistingLandlordChip(landlord = landlord)
    }
}

@Composable
private fun ExistingLandlordChip(landlord: VerifyLandlordExistingLandlord) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("verifyLandlordExistingLandlord"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Building2,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = landlord.name,
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = "${landlord.verifiedAt} · ${landlord.contactName}",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        VerifiedPill()
    }
}

@Composable
private fun VerifiedPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successBg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Check,
            contentDescription = null,
            size = 9.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "VERIFIED",
            style = PantopusTextStyle.overline,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun WhyWeAskRow() {
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
                    .testTag("verifyLandlordWhyWeAsk")
                    .semantics {
                        contentDescription =
                            if (expanded) {
                                "Hide why we verify your landlord"
                            } else {
                                "Show why we verify your landlord"
                            }
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Why verify your landlord?",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary700,
                )
                Text(
                    text = "Verified rentals get safer payouts and dispute support.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.primary600,
            )
        }
        if (expanded) {
            Text(
                text =
                    "Linking a verified landlord lets us route maintenance tickets to the right " +
                        "person, escrow rent so deposits stay safe, and step in if a dispute " +
                        "needs a neutral reviewer.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .padding(start = Spacing.s10)
                        .testTag("verifyLandlordWhyWeAskDetail"),
            )
        }
    }
}

// MARK: - A12.6 Details

@Composable
internal fun DetailsStep(
    state: VerifyLandlordUiState,
    viewModel: VerifyLandlordWizardViewModel,
) {
    HeadlineBlock("Landlord & lease details")
    SubcopyBlock("We'll email this person a one-time link to confirm the rental.")

    state.errors?.takeIf { !it.isEmpty }?.let { ErrorSummaryBanner(it) }

    BusinessInfoCard(form = state.form, errors = state.errors, viewModel = viewModel)
    LeaseUploadCard(form = state.form, errors = state.errors, viewModel = viewModel)
    PropertyManagerCard(form = state.form, errors = state.errors, viewModel = viewModel)
    TenancyCard(form = state.form, errors = state.errors, viewModel = viewModel)

    EncryptionFootnote()

    if (state.errors?.takeIf { !it.isEmpty } != null) {
        StickyAttentionHint(count = state.errors.count)
    }
}

@Composable
private fun BusinessInfoCard(
    form: VerifyLandlordForm,
    errors: VerifyLandlordValidationErrors?,
    viewModel: VerifyLandlordWizardViewModel,
) {
    VerifyCard {
        SectionHeader(
            overline = "Business info",
            title = "Who owns this rental?",
            trailing = { BusinessBadge() },
        )
        VerifyField(
            label = "Owner or business name",
            value = form.ownerName,
            placeholder = "Elm Street Holdings LLC",
            icon = PantopusIcon.Building2,
            error = errors?.ownerName,
            onChange = viewModel::setOwnerName,
        )
        VerifyField(
            label = "Owner contact name",
            value = form.contactName,
            placeholder = "Mira Patel",
            icon = PantopusIcon.User,
            error = errors?.contactName,
            onChange = viewModel::setContactName,
        )
        VerifyField(
            label = "Email",
            value = form.email,
            placeholder = "mira@elmstholdings.com",
            icon = PantopusIcon.Mail,
            keyboard = KeyboardType.Email,
            hint = "We'll send a confirmation link here.",
            error = errors?.email,
            onChange = viewModel::setEmail,
        )
        VerifyField(
            label = "Phone",
            value = form.phone,
            placeholder = "(555) 123-4567",
            icon = PantopusIcon.Phone,
            keyboard = KeyboardType.Phone,
            optional = true,
            onChange = viewModel::setPhone,
        )
    }
}

@Composable
private fun LeaseUploadCard(
    form: VerifyLandlordForm,
    errors: VerifyLandlordValidationErrors?,
    viewModel: VerifyLandlordWizardViewModel,
) {
    VerifyCard {
        SectionHeader(
            overline = "Lease or deed",
            title = "Attach proof of the rental",
            subtitle =
                "One document is enough — the lease you signed, or a deed showing the owner above.",
        )
        if (form.lease == null) {
            LeaseEmpty {
                viewModel.setLease(VerifyLandlordSampleData.populatedForm.lease)
            }
        } else {
            LeaseDone(
                lease = form.lease,
                registeredUnit = form.registeredUnit,
                hasError = errors?.lease != null,
                onRemove = { viewModel.setLease(null) },
            )
        }
    }
}

@Composable
private fun PropertyManagerCard(
    form: VerifyLandlordForm,
    errors: VerifyLandlordValidationErrors?,
    viewModel: VerifyLandlordWizardViewModel,
) {
    VerifyCard {
        SectionHeader(
            overline = "Property manager",
            title = "If different from the owner",
        )
        PMToggleRow(isOn = form.pmEnabled, onToggle = viewModel::setPMEnabled)
        if (form.pmEnabled) {
            VerifyField(
                label = "PM contact name",
                value = form.pmName,
                placeholder = "Daniel Ortega",
                icon = PantopusIcon.User,
                error = errors?.pmName,
                onChange = viewModel::setPMName,
            )
            VerifyField(
                label = "PM email",
                value = form.pmEmail,
                placeholder = "dortega@anchorpm.co",
                icon = PantopusIcon.Mail,
                keyboard = KeyboardType.Email,
                error = errors?.pmEmail,
                onChange = viewModel::setPMEmail,
            )
            VerifyField(
                label = "PM phone",
                value = form.pmPhone,
                placeholder = "(555) 123-4567",
                icon = PantopusIcon.Phone,
                keyboard = KeyboardType.Phone,
                optional = true,
                onChange = viewModel::setPMPhone,
            )
        }
    }
}

/**
 * A12.6 "Your tenancy" — the two fields the backend actually persists
 * on `POST /api/v1/tenant/request-approval` (`start_at` + `message`).
 */
@Composable
private fun TenancyCard(
    form: VerifyLandlordForm,
    errors: VerifyLandlordValidationErrors?,
    viewModel: VerifyLandlordWizardViewModel,
) {
    VerifyCard {
        SectionHeader(
            overline = "Your tenancy",
            title = "When did you move in?",
            subtitle = "Optional, but it helps your landlord process the request faster.",
        )
        VerifyField(
            label = "Move-in date",
            value = form.moveInDate,
            placeholder = "YYYY-MM-DD",
            icon = PantopusIcon.Calendar,
            keyboard = KeyboardType.Number,
            optional = true,
            hint = "When did you move in, or plan to?",
            error = errors?.moveInDate,
            onChange = viewModel::setMoveInDate,
        )
        MessageField(
            value = form.messageToLandlord,
            onChange = viewModel::setMessageToLandlord,
        )
    }
}

/** Multiline note forwarded to the landlord as the request `message`. */
@Composable
private fun MessageField(
    value: String,
    onChange: (String) -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val isFocused by interaction.collectIsFocusedAsState()
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Message to landlord",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
            )
            Text(
                text = "· optional",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = false,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            interactionSource = interaction,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = if (isFocused) 1.5.dp else 1.dp,
                        color = if (isFocused) PantopusColors.primary600 else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(Spacing.s2)
                    .testTag("verifyLandlordMessageField"),
            decorationBox = { inner ->
                Box(modifier = Modifier.fillMaxWidth()) {
                    if (value.isEmpty()) {
                        Text(
                            text = "Hi, I'm a new tenant at…",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                }
            },
        )
        Text(
            text = "${value.length}/${VerifyLandlordForm.MESSAGE_MAX_LENGTH}",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("verifyLandlordMessageCount"),
        )
    }
}

// MARK: - A12.6 Sent (terminal)

/**
 * Terminal frame — the tenant approval request landed. Mirrors RN's
 * `verify-landlord/index.tsx` "pending approval" state; every value is
 * taken from the `HomeLease` row the backend returned.
 *
 * There is no `GET /api/v1/tenant/home/:id/status` route in
 * `backend/routes/landlordTenant.js`, so this screen deliberately does
 * not poll — it renders what the submit answered with and offers the
 * mailed-code path as the alternative.
 */
@Composable
internal fun SentStep(
    result: VerifyLandlordApprovalResult,
    errorMessage: String? = null,
) {
    val tint =
        when (result.kind) {
            VerifyLandlordApprovalResult.Kind.AlreadyActive -> PantopusColors.success
            else -> PantopusColors.primary600
        }
    val discBg =
        when (result.kind) {
            VerifyLandlordApprovalResult.Kind.AlreadyActive -> PantopusColors.successBg
            else -> PantopusColors.primary50
        }
    val icon =
        when (result.kind) {
            VerifyLandlordApprovalResult.Kind.AlreadyActive -> PantopusIcon.ShieldCheck
            else -> PantopusIcon.Clock
        }
    val pillLabel =
        when (result.kind) {
            VerifyLandlordApprovalResult.Kind.AlreadyActive -> "Verified Tenant"
            else -> "Pending Approval"
        }

    Column(
        modifier = Modifier.fillMaxWidth().testTag("verifyLandlordSentStep"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(discBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 32.dp,
                tint = tint,
            )
        }
        Text(
            text = result.headline,
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
        )
        Text(
            text = result.body,
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(discBg)
                    .padding(horizontal = Spacing.s3, vertical = 6.dp)
                    .testTag("verifyLandlordSentStatusPill"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = tint)
            Text(
                text = pillLabel,
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = tint,
            )
        }
        SentDetailCard(result = result)
        if (errorMessage != null) {
            Text(
                text = errorMessage,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
                modifier = Modifier.testTag("verifyLandlordSentError"),
            )
        }
        Text(
            text = "Your landlord will be notified and can approve or deny your request.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun SentDetailCard(result: VerifyLandlordApprovalResult) {
    val submitted = formatSentDate(result.submittedAt)
    val start = formatSentDate(result.requestedStartAt)
    val message = result.message?.takeIf { it.isNotBlank() }
    if (submitted == null && start == null && message == null) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("verifyLandlordSentDetails"),
    ) {
        if (submitted != null) SentDetailRow(label = "Submitted", value = submitted)
        if (start != null) SentDetailRow(label = "Requested start", value = start)
        if (message != null) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Your message",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = message,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun SentDetailRow(
    label: String,
    value: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = value,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
    }
}

/** ISO-8601 -> "Mar 4, 2026". Null when absent or unparsable. */
internal fun formatSentDate(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return runCatching {
        DateTimeFormatter
            .ofPattern("MMM d, yyyy", Locale.US)
            .withZone(ZoneId.systemDefault())
            .format(Instant.parse(iso))
    }.getOrNull()
}

// MARK: - Atoms

@Composable
private fun VerifyCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        content()
    }
}

@Composable
private fun SectionHeader(
    overline: String,
    title: String,
    subtitle: String? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Bottom,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = overline.uppercase(),
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = title,
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        if (trailing != null) trailing()
    }
}

@Composable
private fun BusinessBadge() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.businessBg)
                .padding(horizontal = 7.dp, vertical = 3.dp)
                .testTag("verifyLandlordBusinessBadge"),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Building2,
            contentDescription = null,
            size = 9.dp,
            tint = PantopusColors.business,
        )
        Text(
            text = "BUSINESS",
            style = PantopusTextStyle.overline,
            color = PantopusColors.business,
        )
    }
}

@Composable
private fun VerifyField(
    label: String,
    value: String,
    placeholder: String,
    icon: PantopusIcon,
    onChange: (String) -> Unit,
    keyboard: KeyboardType = KeyboardType.Text,
    optional: Boolean = false,
    hint: String? = null,
    error: String? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val isFocused by interaction.collectIsFocusedAsState()
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = label,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextStrong,
                )
                if (optional) {
                    Text(
                        text = "· optional",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
            if (error != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = 10.dp,
                        tint = PantopusColors.error,
                    )
                    Text(
                        text = error,
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.error,
                    )
                }
            }
        }
        val borderColor =
            when {
                error != null -> PantopusColors.error
                isFocused -> PantopusColors.primary600
                else -> PantopusColors.appBorder
            }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = if (isFocused || error != null) 1.5.dp else 1.dp,
                        color = borderColor,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(horizontal = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextSecondary,
            )
            BasicTextField(
                value = value,
                onValueChange = onChange,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = keyboard),
                textStyle =
                    PantopusTextStyle.body.copy(
                        color = PantopusColors.appText,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                interactionSource = interaction,
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("verifyLandlordField_$label"),
                decorationBox = { inner ->
                    Box(modifier = Modifier.fillMaxWidth()) {
                        if (value.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = PantopusTextStyle.body,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                        inner()
                    }
                },
            )
        }
        if (hint != null && error == null) {
            Text(
                text = hint,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PMToggleRow(
    isOn: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Property manager handles this rental",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "Add a PM if someone other than the owner collects rent or handles maintenance.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = isOn,
            onCheckedChange = onToggle,
            modifier = Modifier.testTag("verifyLandlordPMToggle"),
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appSurface,
                    checkedTrackColor = PantopusColors.primary600,
                    uncheckedThumbColor = PantopusColors.appSurface,
                    uncheckedTrackColor = PantopusColors.appBorderStrong,
                ),
        )
    }
}

// MARK: - Lease upload variants

@Composable
private fun LeaseEmpty(onAttach: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .clickable(onClick = onAttach)
                .border(
                    width = 1.5.dp,
                    color = PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.lg),
                ).padding(Spacing.s4)
                .testTag("verifyLandlordAttachLease"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Upload,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Attach lease or deed",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = "PDF, JPG, or PNG · up to 10 MB",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun LeaseDone(
    lease: VerifyLandlordLeaseFile,
    registeredUnit: String,
    hasError: Boolean,
    onRemove: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.dp,
                    color = if (hasError) PantopusColors.warningLight else PantopusColors.successLight,
                    shape = RoundedCornerShape(Radii.lg),
                ).padding(Spacing.s3)
                .testTag("verifyLandlordLeaseDone"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PDFThumb()
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = lease.filename,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
                Text(
                    text = "${lease.sizeLabel} · ${lease.pageCount} pages · Uploaded just now",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(26.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onRemove)
                        .testTag("verifyLandlordRemoveLease"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Trash2,
                    contentDescription = "Remove lease",
                    size = 13.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        ParseStatusRow(lease = lease, registeredUnit = registeredUnit, hasError = hasError)
    }
}

@Composable
private fun PDFThumb() {
    Box(
        modifier =
            Modifier
                .width(36.dp)
                .height(44.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(PantopusColors.errorBg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "PDF",
            style = PantopusTextStyle.overline,
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun ParseStatusRow(
    lease: VerifyLandlordLeaseFile,
    registeredUnit: String,
    hasError: Boolean,
) {
    val fg = if (hasError) PantopusColors.warning else PantopusColors.success
    val bg = if (hasError) PantopusColors.warningBg else PantopusColors.successBg
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(bg)
                .padding(horizontal = 9.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(fg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (hasError) PantopusIcon.AlertTriangle else PantopusIcon.Check,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        val statusBody =
            if (hasError) {
                val detected = lease.detectedUnit ?: "Unknown"
                "Unit doesn't match. Detected \"$detected\" — your home is registered as " +
                    "\"$registeredUnit\". Re-upload the correct lease or update your home."
            } else {
                val owner = lease.detectedOwner ?: "M. Patel"
                val unit = lease.detectedUnit ?: registeredUnit
                "Lease parsed. Owner \"$owner\" and unit \"$unit\" detected."
            }
        Text(
            text = statusBody,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Medium),
            color = fg,
            modifier = Modifier.weight(1f),
        )
    }
}

// MARK: - Summary banner + attention hint

@Composable
private fun ErrorSummaryBanner(errors: VerifyLandlordValidationErrors) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("verifyLandlordErrorSummary"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.error),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            val noun = if (errors.count == 1) "thing" else "things"
            Text(
                text = "Fix ${errors.count} $noun to submit",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.error,
            )
            Text(
                text = errors.compactSummary,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun StickyAttentionHint(count: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2)
                .testTag("verifyLandlordAttentionHint"),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = "  $count field${if (count == 1) "" else "s"} need attention",
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun EncryptionFootnote() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text =
                "Confirmation email goes only to the landlord. Your name and unit will be shown.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Focus state helper

@Composable
private fun MutableInteractionSource.collectIsFocusedAsState(): State<Boolean> {
    val focused = remember { mutableStateOf(false) }
    LaunchedEffect(this) {
        val active = mutableSetOf<FocusInteraction.Focus>()
        interactions.collect { interaction ->
            when (interaction) {
                is FocusInteraction.Focus -> active.add(interaction)
                is FocusInteraction.Unfocus -> active.remove(interaction.focus)
            }
            focused.value = active.isNotEmpty()
        }
    }
    return focused
}
