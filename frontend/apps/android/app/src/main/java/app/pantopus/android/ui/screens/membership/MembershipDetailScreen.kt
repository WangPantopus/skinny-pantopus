@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.membership

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PersonaCard
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun MembershipDetailScreen(
    onBack: () -> Unit = {},
    onShare: () -> Unit = {},
    onOpenPersona: () -> Unit = {},
    onUpdatePayment: () -> Unit = {},
    onCancel: () -> Unit = {},
    onOpenInbox: (String) -> Unit = {},
    viewModel: MembershipDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()
    val isCancelling by viewModel.isCancelling.collectAsStateWithLifecycle()
    val isTierPickerOpen by viewModel.isTierPickerOpen.collectAsStateWithLifecycle()
    val tierOptions by viewModel.tierOptions.collectAsStateWithLifecycle()
    val isChangingTier by viewModel.isChangingTier.collectAsStateWithLifecycle()
    val tierChangeConfirmation by viewModel.tierChangeConfirmation.collectAsStateWithLifecycle()
    val isRefundSheetOpen by viewModel.isRefundSheetOpen.collectAsStateWithLifecycle()
    val isRequestingRefund by viewModel.isRequestingRefund.collectAsStateWithLifecycle()
    val refundConfirmation by viewModel.refundConfirmation.collectAsStateWithLifecycle()
    val refundError by viewModel.refundError.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("membershipDetail"),
    ) {
        TopBar(onBack = onBack, onShare = onShare)
        when (val current = state) {
            is MembershipDetailUiState.Loading -> LoadingFrame()
            is MembershipDetailUiState.Error ->
                ErrorFrame(message = current.message, onRetry = viewModel::load)
            is MembershipDetailUiState.Populated ->
                MembershipLoadedContent(
                    content = current.content,
                    slaMissed = false,
                    onOpenPersona = onOpenPersona,
                    onChangeTier = viewModel::presentTierPicker,
                    onUpdatePayment = onUpdatePayment,
                    onCancel = { viewModel.cancel(onCancelled = onCancel) },
                    onRequestRefund = viewModel::presentRefundSheet,
                    onOpenInbox = onOpenInbox,
                    onDismissSla = viewModel::dismissSlaAlert,
                    isCancelling = isCancelling,
                    actionError = actionError,
                    tierChangeConfirmation = tierChangeConfirmation,
                    refundConfirmation = refundConfirmation,
                )
            is MembershipDetailUiState.SlaMissed ->
                MembershipLoadedContent(
                    content = current.content,
                    slaMissed = true,
                    onOpenPersona = onOpenPersona,
                    onChangeTier = viewModel::presentTierPicker,
                    onUpdatePayment = onUpdatePayment,
                    onCancel = { viewModel.cancel(onCancelled = onCancel) },
                    onRequestRefund = viewModel::presentRefundSheet,
                    onOpenInbox = onOpenInbox,
                    onDismissSla = viewModel::dismissSlaAlert,
                    isCancelling = isCancelling,
                    actionError = actionError,
                    tierChangeConfirmation = tierChangeConfirmation,
                    refundConfirmation = refundConfirmation,
                )
        }
    }

    if (isTierPickerOpen) {
        TierPickerSheet(
            options = tierOptions,
            isChanging = isChangingTier,
            error = actionError,
            onPick = viewModel::changeTier,
            onDismiss = viewModel::dismissTierPicker,
        )
    }
    if (isRefundSheetOpen) {
        RefundRequestSheet(
            isSubmitting = isRequestingRefund,
            error = refundError,
            onSubmit = viewModel::requestRefund,
            onDismiss = viewModel::dismissRefundSheet,
        )
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(
    onBack: () -> Unit,
    onShare: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("membershipDetailBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Membership",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onShare)
                        .testTag("membershipDetailShareButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Share,
                    contentDescription = "Share membership",
                    size = Radii.xl2,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// MARK: - States

@Composable
internal fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("membershipDetailLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Shimmer(width = 360.dp, height = 64.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 184.dp, cornerRadius = Radii.xl)
        Shimmer(width = 360.dp, height = 176.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 50.dp, cornerRadius = Radii.lg)
    }
}

@Composable
internal fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("membershipDetailError"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "Couldn't load membership",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s4))
        PrimaryButton(
            title = "Try again",
            onClick = onRetry,
            modifier = Modifier.testTag("membershipDetailRetry"),
        )
    }
}

// MARK: - Loaded

@Composable
internal fun MembershipLoadedContent(
    content: MembershipDetailContent,
    slaMissed: Boolean,
    onOpenPersona: () -> Unit = {},
    onChangeTier: () -> Unit = {},
    onUpdatePayment: () -> Unit = {},
    onCancel: () -> Unit = {},
    onRequestRefund: () -> Unit = {},
    onOpenInbox: (String) -> Unit = {},
    onDismissSla: () -> Unit = {},
    isCancelling: Boolean = false,
    actionError: String? = null,
    tierChangeConfirmation: String? = null,
    refundConfirmation: String? = null,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("membershipDetailContent"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        content.slaAlert?.let { alert ->
            SlaBanner(alert = alert, onRequestRefund = onRequestRefund, onDismiss = onDismissSla)
        }
        LabeledSection(title = "You support") {
            PersonaCard(
                name = content.persona.name,
                initials = content.persona.initials,
                subtitle = content.persona.subtitle,
                pillar = content.persona.pillar,
                pillarLabel = content.persona.pillarLabel,
                verified = content.persona.verified,
                testTag = "membershipDetailPersona",
                onClick = onOpenPersona,
            )
        }
        LabeledSection(title = "Your membership") {
            TierCard(content = content, slaMissed = slaMissed, onUpdatePayment = onUpdatePayment)
        }
        LabeledSection(title = "What you get") {
            BenefitsCard(benefits = content.benefits)
        }
        LabeledSection(title = "Messages") {
            InboxCard(content = content, onOpenInbox = onOpenInbox)
        }
        if (content.hasScheduledTierChange) {
            ScheduledChangeBanner()
        }
        tierChangeConfirmation?.let {
            InlineNotice(text = it, testTagValue = "membershipDetailTierChangeConfirmation")
        }
        refundConfirmation?.let {
            InlineNotice(text = it, testTagValue = "membershipDetailRefundConfirmation")
        }
        if (!content.isTerminal) {
            ChangeTierButton(onClick = onChangeTier)
            CancelBlock(onCancel = onCancel, isCancelling = isCancelling, actionError = actionError)
        }
        RequestRefundLink(onClick = onRequestRefund)
        PolicyFootnote(text = content.policyFootnote)
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

// MARK: - Inbox card (RN "Open inbox" + quota footnote)

@Composable
private fun InboxCard(
    content: MembershipDetailContent,
    onOpenInbox: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3)
                .testTag("membershipDetailInboxCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Inbox",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "DM the creator. Each new thread uses one of your monthly message credits.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600)
                    .clickable(enabled = content.personaId.isNotEmpty()) { onOpenInbox(content.personaId) }
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("membershipDetailOpenInbox"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MessageSquare,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Open inbox",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = content.inbox.footnote,
            fontSize = 10.5.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.testTag("membershipDetailInboxQuota"),
        )
    }
}

@Composable
private fun ScheduledChangeBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.md))
                .background(PantopusColors.infoBg)
                .padding(Spacing.s3)
                .testTag("membershipDetailScheduledChange"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarClock,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.primary700,
        )
        Text(
            text = "A tier change is scheduled — it takes effect at the end of this period.",
            fontSize = 12.sp,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun InlineNotice(
    text: String,
    testTagValue: String,
) {
    Text(
        text = text,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.success,
        modifier = Modifier.fillMaxWidth().testTag(testTagValue),
    )
}

@Composable
private fun RequestRefundLink(onClick: () -> Unit) {
    Text(
        text = "Reply window missed? Request a refund",
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.appTextSecondary,
        textDecoration = TextDecoration.Underline,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3)
                .testTag("membershipDetailRequestRefund"),
    )
}

// MARK: - Change-tier picker

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TierPickerSheet(
    options: List<MembershipTierOption>,
    isChanging: Boolean,
    error: String?,
    onPick: (MembershipTierOption) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("membershipTierPicker"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(bottom = Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Change tier",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "Upgrades start right away. Downgrades take effect at the end of this period.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            error?.let {
                Text(
                    text = it,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("membershipTierPickerError"),
                )
            }
            if (options.isEmpty()) {
                Text(
                    text = "This creator publishes a single tier right now.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("membershipTierPickerEmpty"),
                )
            } else {
                options.forEach { option ->
                    TierOptionRow(option = option, isChanging = isChanging, onPick = onPick)
                }
            }
            Text(
                text = "Cancel",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onDismiss)
                        .padding(vertical = Spacing.s3)
                        .testTag("membershipTierPickerDismiss"),
            )
        }
    }
}

@Composable
private fun TierOptionRow(
    option: MembershipTierOption,
    isChanging: Boolean,
    onPick: (MembershipTierOption) -> Unit,
) {
    val isUpgrade = option.direction == MembershipTierDirection.Upgrade
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .clickable(enabled = !isChanging) { onPick(option) }
                .padding(Spacing.s3)
                .semantics {
                    contentDescription =
                        "${option.direction.label} to ${option.name}, ${option.priceLabel}. " +
                        option.direction.timingNote
                }.testTag("membershipTierOption_${option.rank}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = option.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = option.priceLabel, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            Text(
                text = option.direction.timingNote,
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            PantopusIconImage(
                icon = if (isUpgrade) PantopusIcon.TrendingUp else PantopusIcon.TrendingDown,
                contentDescription = null,
                size = 15.dp,
                tint = if (isUpgrade) PantopusColors.success else PantopusColors.warning,
            )
            Text(
                text = option.direction.label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (isUpgrade) PantopusColors.success else PantopusColors.warning,
            )
        }
    }
}

// MARK: - Refund request

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RefundRequestSheet(
    isSubmitting: Boolean,
    error: String?,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("membershipRefundSheet"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(bottom = Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Text(
                text = "Request a refund",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text =
                    "If the creator missed the reply window they committed to, the unused " +
                        "portion of this period is refunded to your card and your membership is " +
                        "cancelled at the end of the period — you keep access until then.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.infoBg)
                        .padding(Spacing.s3)
                        .testTag("membershipDetailRefundReason"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.Top,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Info,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.primary700,
                )
                Text(
                    text = "Reason: the creator missed their reply-policy window.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary700,
                )
            }
            error?.let {
                Text(
                    text = it,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("membershipDetailRefundError"),
                )
            }
            PrimaryButton(
                title = "Request refund",
                onClick = onSubmit,
                isLoading = isSubmitting,
                isEnabled = !isSubmitting,
                modifier = Modifier.fillMaxWidth().testTag("membershipDetailRefundSubmit"),
            )
            Text(
                text = "Not now",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onDismiss)
                        .padding(vertical = Spacing.s3)
                        .testTag("membershipDetailRefundDismiss"),
            )
        }
    }
}

@Composable
private fun LabeledSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = title.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.7.sp,
            modifier = Modifier.semantics { heading() },
        )
        content()
    }
}

// MARK: - SLA banner

@Composable
private fun SlaBanner(
    alert: MembershipSLAAlert,
    onRequestRefund: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("membershipDetailSLABanner"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.Top) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.warning),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.AlertTriangle,
                    contentDescription = null,
                    size = 17.dp,
                    strokeWidth = 2.3f,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = alert.title,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.warning,
                )
                Text(
                    text = alert.message,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.error)
                        .clickable(onClick = onRequestRefund)
                        .testTag("membershipDetailRefundButton")
                        .semantics { contentDescription = alert.refundCtaLabel },
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.HandCoins,
                        contentDescription = null,
                        size = 13.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextInverse,
                    )
                    Text(
                        text = alert.refundCtaLabel,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .border(1.dp, PantopusColors.warning, RoundedCornerShape(Radii.md))
                        .clickable(onClick = onDismiss)
                        .testTag("membershipDetailSnoozeButton")
                        .semantics { contentDescription = alert.dismissCtaLabel },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = alert.dismissCtaLabel,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.warning,
                )
            }
        }
    }
}

// MARK: - Tier card

@Composable
private fun TierCard(
    content: MembershipDetailContent,
    slaMissed: Boolean,
    onUpdatePayment: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("membershipDetailTierCard"),
    ) {
        TierStrip(content)
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        TierInfoRow(
            icon = PantopusIcon.CalendarClock,
            iconBackground = PantopusColors.primary50,
            iconForeground = PantopusColors.primary600,
            label = "Next renewal",
            value = content.renewalLabel,
            valueColor = if (slaMissed) PantopusColors.warning else PantopusColors.appText,
            rowTestTag = "membershipDetailRenewalRow",
        )
        Box(
            modifier =
                Modifier
                    .padding(start = Spacing.s4)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
        TierInfoRow(
            icon = PantopusIcon.Wallet,
            iconBackground = PantopusColors.appSurfaceSunken,
            iconForeground = PantopusColors.appTextStrong,
            label = "Payment",
            value = content.paymentLabel,
            valueColor = PantopusColors.appText,
            trailingLabel = "Update",
            onClick = onUpdatePayment,
            rowTestTag = "membershipDetailPaymentRow",
        )
    }
}

@Composable
private fun TierStrip(content: MembershipDetailContent) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(content.tier.bgColor)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics {
                    contentDescription =
                        "Your tier ${content.tier.displayName}, " +
                        "${content.tier.ladderRank} of ${MembershipTier.ladderTotal}, " +
                        "${content.priceLabel} per ${content.periodLabel}"
                },
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "YOUR TIER",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextSecondary,
                letterSpacing = 0.6.sp,
            )
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = content.tier.displayName,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = content.tier.fgColor,
                )
                LadderPill(content.tier)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = content.priceLabel,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appText,
            )
            Text(
                text = "/ ${content.periodLabel}",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun LadderPill(tier: MembershipTier) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Crown,
            contentDescription = null,
            size = 10.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "${tier.ladderRank} of ${MembershipTier.ladderTotal}",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.3.sp,
        )
    }
}

@Composable
private fun TierInfoRow(
    icon: PantopusIcon,
    iconBackground: Color,
    iconForeground: Color,
    label: String,
    value: String,
    valueColor: Color,
    rowTestTag: String,
    trailingLabel: String? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag(rowTestTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(iconBackground),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2f,
                tint = iconForeground,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(text = label, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = valueColor)
        }
        if (trailingLabel != null) {
            Text(
                text = trailingLabel,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

// MARK: - Benefits

@Composable
private fun BenefitsCard(benefits: List<MembershipBenefit>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("membershipDetailBenefits"),
    ) {
        benefits.forEachIndexed { index, benefit ->
            BenefitRow(benefit)
            if (index < benefits.lastIndex) {
                Box(
                    modifier =
                        Modifier
                            .padding(start = 50.dp)
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(PantopusColors.appBorderSubtle),
                )
            }
        }
    }
}

@Composable
private fun BenefitRow(benefit: MembershipBenefit) {
    val description =
        buildString {
            append(benefit.label)
            append(". ")
            append(benefit.meta)
            benefit.slaBadge?.let {
                append(". ")
                append(it)
            }
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("membershipDetailBenefit_${benefit.id}")
                .semantics(mergeDescendants = true) { contentDescription = description },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.success,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = benefit.icon,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = benefit.label,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                benefit.slaBadge?.let { StatusChip(text = it, variant = StatusChipVariant.Success) }
            }
            Text(text = benefit.meta, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

// MARK: - Change tier + cancel

@Composable
private fun ChangeTierButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .testTag("membershipDetailChangeTier")
                .semantics { contentDescription = "Change tier" },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowDownUp,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Change tier",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun CancelBlock(
    onCancel: () -> Unit,
    isCancelling: Boolean = false,
    actionError: String? = null,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Single-tap cancel by Pantopus policy — no confirm dialog, no
        // retention questions, no last-second offers. Posts the no-charge
        // cancel route, then hands off to the host on success.
        Row(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clickable(enabled = !isCancelling, onClick = onCancel)
                    .testTag("membershipDetailCancel")
                    .semantics { contentDescription = "Cancel membership" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.error,
            )
            Text(
                text = if (isCancelling) "Cancelling…" else "Cancel membership",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
            )
        }
        if (actionError != null) {
            Text(
                text = actionError,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.error,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("membershipDetailCancelError"),
            )
        }
        Text(
            text = "Single-tap cancel. No retention questions, no last-second offers.",
            fontSize = 10.5.sp,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 260.dp),
        )
        Text(
            text = "— Pantopus policy",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun PolicyFootnote(text: String) {
    Text(
        text = text,
        fontSize = 10.5.sp,
        color = PantopusColors.appTextMuted,
        textAlign = TextAlign.Center,
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("membershipDetailPolicyFootnote"),
    )
}
