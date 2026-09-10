@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
    "ComplexMethod",
    "CyclomaticComplexMethod",
)
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.review_claims

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.AdminClaimEvidenceDto
import app.pantopus.android.data.api.models.admin.AdminClaimHomeDto
import app.pantopus.android.data.api.models.admin.AdminClaimRecordDto
import app.pantopus.android.data.api.models.admin.AdminClaimReviewAction
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.Locale

/**
 * Test tag on the Review Claim Detail screen. Mirrors iOS
 * `accessibilityIdentifier("reviewClaimDetail")`.
 */
const val REVIEW_CLAIM_DETAIL_TAG = "reviewClaimDetail"

private const val TOAST_DURATION_MS = 2_000L
private val REVIEWABLE_STATES =
    setOf(
        "submitted",
        "pending_review",
        "needs_more_info",
        "pending_challenge_window",
        "disputed",
    )

private enum class TrustChipTone { Success, Warn, Neutral }

private data class TrustChipModel(
    val icon: PantopusIcon,
    val label: String,
    val tone: TrustChipTone,
)

private data class ClaimantCardModel(
    val name: String,
    val email: String?,
    val pendingLabel: String?,
    val gradient: app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair,
    val shareValue: String,
    val shareDescriptor: String,
    val trustChips: List<TrustChipModel>,
)

/**
 * P1.1 — admin claim detail. ContentDetailShell with Home / Claimant /
 * Claimant / Evidence / Statement sections, an Accept / Challenge / Reject
 * verdict footer when reviewable, and reject + challenge composer sheets.
 */
@Composable
fun ReviewClaimDetailScreen(
    onBack: () -> Unit,
    viewModel: ReviewClaimDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val reviewingAction by viewModel.reviewingAction.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val selectedReasons by viewModel.selectedReasons.collectAsStateWithLifecycle()
    val challengeQuestion by viewModel.challengeQuestion.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var showRejectSheet by rememberSaveable { mutableStateOf(false) }
    var rejectNote by rememberSaveable { mutableStateOf("") }
    var showChallengeSheet by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_DURATION_MS)
            viewModel.dismissToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(REVIEW_CLAIM_DETAIL_TAG)) {
        when (val current = state) {
            ReviewClaimDetailUiState.Loading -> LoadingShell(onBack)
            is ReviewClaimDetailUiState.Error ->
                ErrorShell(message = current.message, onBack = onBack, onRetry = { viewModel.load() })
            is ReviewClaimDetailUiState.Loaded ->
                LoadedShell(
                    detail = current.detail,
                    reviewingAction = reviewingAction,
                    onBack = onBack,
                    onAccept = {
                        scope.launch { viewModel.review(AdminClaimReviewAction.Approve) }
                    },
                    onReject = { showRejectSheet = true },
                    onChallenge = { showChallengeSheet = true },
                )
        }

        toast?.let {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (it.isError) PantopusColors.error else PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(
                    text = it.text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }

    if (showRejectSheet) {
        NoteCaptureSheet(
            title = "Reject claim",
            body = "Optionally include a reason to save with this review.",
            placeholder = "e.g. The deed doesn't match the address.",
            primaryTitle = "Reject claim",
            primaryDestructive = true,
            note = rejectNote,
            onNoteChange = { rejectNote = it },
            isSubmitting = reviewingAction == AdminClaimReviewAction.Reject,
            onPrimary = {
                scope.launch {
                    val ok =
                        viewModel.review(
                            AdminClaimReviewAction.Reject,
                            note = rejectNote.takeIf { it.isNotBlank() },
                        )
                    if (ok) {
                        showRejectSheet = false
                        rejectNote = ""
                    }
                }
            },
            onDismiss = {
                showRejectSheet = false
                rejectNote = ""
            },
        )
    }

    if (showChallengeSheet) {
        ChallengeComposerSheet(
            claimantFirstName = claimantFirstName(state),
            question = challengeQuestion,
            selectedReasons = selectedReasons,
            isSubmitting = reviewingAction == AdminClaimReviewAction.Challenge,
            canSend = viewModel.canSendChallenge(),
            onQuestionChange = viewModel::setChallengeQuestion,
            onToggleReason = viewModel::toggleReason,
            onSend = {
                scope.launch {
                    val ok = viewModel.submitChallenge()
                    if (ok) showChallengeSheet = false
                }
            },
            onDismiss = {
                showChallengeSheet = false
                viewModel.resetChallengeComposer()
            },
        )
    }
}

private fun claimantFirstName(state: ReviewClaimDetailUiState): String {
    val detail = (state as? ReviewClaimDetailUiState.Loaded)?.detail ?: return "the claimant"
    val name = detail.claimant?.name ?: detail.claimant?.username ?: return "the claimant"
    return name.trim().split(" ").firstOrNull()?.takeIf { it.isNotEmpty() } ?: "the claimant"
}

// MARK: - Shells

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Review claim",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 280.dp, height = 96.dp, cornerRadius = Radii.xl)
            }
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 360.dp, height = 96.dp, cornerRadius = Radii.xl)
                Shimmer(width = 360.dp, height = 160.dp, cornerRadius = Radii.xl)
                Shimmer(width = 360.dp, height = 200.dp, cornerRadius = Radii.xl)
            }
        },
    )
}

@Composable
private fun ErrorShell(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Review claim",
        onBack = onBack,
        header = {},
        body = {
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load this claim",
                subcopy = message,
                ctaTitle = "Try again",
                onCta = onRetry,
            )
        },
    )
}

@Composable
private fun LoadedShell(
    detail: AdminClaimDetailResponse,
    reviewingAction: AdminClaimReviewAction?,
    onBack: () -> Unit,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onChallenge: () -> Unit,
) {
    val isReviewable = detail.claim.state in REVIEWABLE_STATES && !detail.claim.requiresDisputeReview
    ContentDetailShell(
        title = "Review claim",
        onBack = onBack,
        header = {
            HomeCard(
                home = detail.home,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .testTag("reviewClaimDetail_home"),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                OverlineSection(title = "Claimant") {
                    ClaimantCard(
                        model = claimantModel(detail, reviewable = isReviewable),
                        modifier = Modifier.testTag("reviewClaimDetail_claimant"),
                    )
                }
                OverlineSection(title = evidenceOverline(detail.evidence.size)) {
                    EvidenceContent(
                        evidence = detail.evidence,
                        modifier = Modifier.testTag("reviewClaimDetail_evidence"),
                    )
                }
                statementFor(detail.claim)?.let { statement ->
                    OverlineSection(title = "Review note") {
                        StatementBlock(
                            statement = statement,
                            attribution = null,
                            modifier = Modifier.testTag("reviewClaimDetail_statement"),
                        )
                    }
                }
                if (detail.claim.requiresDisputeReview) {
                    Text("This disputed claim needs the dedicated dispute review flow.", color = PantopusColors.appTextSecondary)
                } else if (!isReviewable) {
                    TerminalStateBanner(
                        state = detail.claim.state,
                        modifier = Modifier.testTag("reviewClaimDetail_terminal"),
                    )
                }
            }
        },
        cta = {
            if (isReviewable) {
                VerdictBar(
                    reviewingAction = reviewingAction,
                    onAccept = onAccept,
                    onChallenge = onChallenge,
                    onReject = onReject,
                )
            }
        },
    )
}

private fun evidenceOverline(count: Int): String = "Evidence · $count ${if (count == 1) "item" else "items"}"

// MARK: - Section header

@Composable
private fun OverlineSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = title.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        content()
    }
}

// MARK: - Home card

@Composable
private fun HomeCard(
    home: AdminClaimHomeDto?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val headline =
                home?.name?.takeIf { it.isNotEmpty() }
                    ?: home?.address?.takeIf { it.isNotEmpty() }
                    ?: "Unknown home"
            Text(
                text = headline,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val extras =
                listOfNotNull(
                    home?.address?.takeIf { it.isNotEmpty() },
                    home?.city?.takeIf { it.isNotEmpty() },
                    home?.state?.takeIf { it.isNotEmpty() },
                    home?.zipcode?.takeIf { it.isNotEmpty() },
                )
            if (extras.isNotEmpty()) {
                Text(
                    text = extras.joinToString(", "),
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

// MARK: - Claimant card

private fun claimantModel(
    detail: AdminClaimDetailResponse,
    reviewable: Boolean,
): ClaimantCardModel {
    val claimant = detail.claimant
    val name = claimant?.name ?: claimant?.username ?: "Unknown claimant"
    return ClaimantCardModel(
        name = name,
        email = claimant?.email,
        pendingLabel = if (reviewable) pendingLabel(detail.claim) else null,
        gradient = AdminClaimAvatarGradient.gradient(claimant?.id ?: name),
        shareValue = "—",
        shareDescriptor =
            when (detail.claim.claimType) {
                "resident" -> "residency claim"
                "admin" -> "admin claim"
                else -> "ownership share"
            },
        trustChips =
            if (detail.claim.identityStatus == "verified") {
                listOf(TrustChipModel(PantopusIcon.BadgeCheck, "Identity confirmed", TrustChipTone.Success))
            } else {
                listOf(TrustChipModel(PantopusIcon.ShieldAlert, "Identity not confirmed", TrustChipTone.Warn))
            },
    )
}

private fun pendingLabel(claim: AdminClaimRecordDto): String {
    val created = runCatching { Instant.parse(claim.createdAt) }.getOrNull() ?: return "Pending"
    val days = ((Instant.now().epochSecond - created.epochSecond).coerceAtLeast(0) / 86_400L)
    return "Pending ${days}d"
}

@Composable
private fun ClaimantCard(
    model: ClaimantCardModel,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl))
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            AvatarTile(name = model.name, gradient = model.gradient)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = model.name,
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    model.pendingLabel?.let { PendingChip(it) }
                }
                model.email?.takeIf { it.isNotEmpty() }?.let { email ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.AtSign,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Text(
                            text = email,
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }

        ClaimSummaryTile(value = model.shareValue, descriptor = model.shareDescriptor)

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            model.trustChips.forEach { TrustChip(model = it) }
        }
    }
}

@Composable
private fun PendingChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.warmAmberBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xs))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 9.dp,
            tint = PantopusColors.warmAmber,
        )
        Text(
            text = label.uppercase(),
            style = PantopusTextStyle.caption,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warmAmber,
            maxLines = 1,
        )
    }
}

@Composable
private fun ClaimSummaryTile(
    value: String,
    descriptor: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.KeyRound,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.primary600,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = "Claiming",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = value,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                    color = PantopusColors.primary700,
                )
                Text(
                    text = descriptor,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun TrustChip(model: TrustChipModel) {
    val foreground =
        when (model.tone) {
            TrustChipTone.Success -> PantopusColors.success
            TrustChipTone.Warn -> PantopusColors.warmAmber
            TrustChipTone.Neutral -> PantopusColors.appTextSecondary
        }
    val background =
        when (model.tone) {
            TrustChipTone.Success -> PantopusColors.successLight
            TrustChipTone.Warn -> PantopusColors.warmAmberBg
            TrustChipTone.Neutral -> PantopusColors.appSurfaceSunken
        }
    val border =
        when (model.tone) {
            TrustChipTone.Success -> PantopusColors.success.copy(alpha = 0.35f)
            TrustChipTone.Warn -> PantopusColors.warningLight
            TrustChipTone.Neutral -> PantopusColors.appBorder
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .border(1.dp, border, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = model.icon,
            contentDescription = null,
            size = 11.dp,
            tint = foreground,
        )
        Text(
            text = model.label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = foreground,
            maxLines = 1,
        )
    }
}

@Composable
private fun AvatarTile(
    name: String,
    gradient: app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair,
) {
    Box(
        modifier =
            Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(
                    Brush.linearGradient(colors = listOf(gradient.start, gradient.end)),
                ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials(name),
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

private fun initials(name: String): String {
    val parts = name.trim().split(" ").take(2)
    return parts.joinToString("") { word -> word.firstOrNull()?.uppercase().orEmpty() }
}

// MARK: - Evidence strip

@Composable
private fun EvidenceContent(
    evidence: List<AdminClaimEvidenceDto>,
    modifier: Modifier = Modifier,
) {
    if (evidence.isEmpty()) {
        Row(
            modifier =
                modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.warningBg)
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.warning,
            )
            Text(
                text = "No documents uploaded yet",
                style = PantopusTextStyle.small,
                color = PantopusColors.warning,
            )
        }
        return
    }
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        evidence.forEach { item ->
            Column(
                modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurfaceMuted).padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(AdminClaimEvidenceLabel.display(item.evidenceType), fontWeight = FontWeight.SemiBold)
                Text(evidenceMeta(item), color = PantopusColors.appTextSecondary)
            }
        }
        Text("Evidence metadata is shown here. Legacy documents require a private re-upload.", color = PantopusColors.appTextSecondary)
    }
}

private fun evidenceMeta(item: AdminClaimEvidenceDto): String {
    val parts = mutableListOf<String>()
    parts.add(
        when {
            item.eligibleForReview == true -> "Eligible verified evidence"
            item.availabilityCode == "CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED" -> "Private re-upload required"
            else -> "Not verified for approval"
        },
    )
    item.fileSize?.takeIf { it > 0 }?.let { parts.add(sizeLabel(it)) }
    return parts.joinToString(" · ")
}

private fun sizeLabel(bytes: Int): String =
    if (bytes >= 1_048_576) {
        String.format(Locale.US, "%.1f MB", bytes.toDouble() / 1_048_576.0)
    } else {
        "${maxOf(1, bytes / 1024)} KB"
    }

// MARK: - Statement block

private fun statementFor(claim: AdminClaimRecordDto): String? {
    val note = claim.reviewNote?.trim()
    return note?.takeIf { it.isNotEmpty() }
}

@Composable
private fun StatementBlock(
    statement: String,
    attribution: String?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(start = 18.dp, end = Spacing.s4, top = 14.dp, bottom = 14.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = statement,
            fontSize = 13.5.sp,
            lineHeight = 20.sp,
            fontStyle = FontStyle.Italic,
            color = PantopusColors.appText,
        )
        attribution?.let {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusIconImage(
                    icon = PantopusIcon.FileSignature,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text = it.uppercase(),
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

// MARK: - Terminal-state banner

@Composable
private fun TerminalStateBanner(
    state: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = Radii.xl2,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = terminalCopy(state),
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun terminalCopy(state: String): String =
    when (state) {
        "approved" -> "This claim has been approved. No further action."
        "rejected" -> "This claim has been rejected. No further action."
        else -> "This claim is in state \"$state\" and isn't reviewable from here."
    }

// MARK: - Verdict bar

@Composable
private fun VerdictBar(
    reviewingAction: AdminClaimReviewAction?,
    onAccept: () -> Unit,
    onChallenge: () -> Unit,
    onReject: () -> Unit,
) {
    val disabled = reviewingAction != null
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        FooterPrimaryButton(
            label = if (reviewingAction == AdminClaimReviewAction.Approve) "Accepting…" else "Accept claim",
            icon = PantopusIcon.CheckCircle,
            background = PantopusColors.success,
            foreground = PantopusColors.appTextInverse,
            isSubmitting = reviewingAction == AdminClaimReviewAction.Approve,
            enabled = !disabled,
            onClick = onAccept,
            modifier = Modifier.testTag("reviewClaimDetail_accept"),
            accessibilityLabel = "Accept claim",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            FooterSecondaryButton(
                label = "Request info",
                icon = PantopusIcon.MessageCircle,
                tintFg = PantopusColors.warmAmber,
                tintBg = PantopusColors.warningBg,
                borderColor = PantopusColors.warningLight,
                enabled = !disabled,
                onClick = onChallenge,
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("reviewClaimDetail_challenge"),
                accessibilityLabel = "Challenge claim",
            )
            FooterSecondaryButton(
                label = "Reject",
                icon = PantopusIcon.CircleSlash,
                tintFg = PantopusColors.error,
                tintBg = PantopusColors.appSurface,
                borderColor = PantopusColors.errorLight,
                enabled = !disabled,
                onClick = onReject,
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("reviewClaimDetail_reject"),
                accessibilityLabel = "Reject claim",
            )
        }
    }
}

@Composable
private fun FooterPrimaryButton(
    label: String,
    icon: PantopusIcon,
    background: Color,
    foreground: Color,
    isSubmitting: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .shadow(8.dp, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(background)
                .conditionalClickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .semantics { contentDescription = accessibilityLabel },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Spacer(Modifier.weight(1f))
        if (isSubmitting) {
            CircularProgressIndicator(
                color = foreground,
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
            )
        } else {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 18.dp,
                tint = foreground,
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = foreground,
        )
        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun FooterSecondaryButton(
    label: String,
    icon: PantopusIcon,
    tintFg: Color,
    tintBg: Color,
    borderColor: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.xl))
                .background(tintBg)
                .border(1.dp, borderColor, RoundedCornerShape(Radii.xl))
                .conditionalClickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .semantics { contentDescription = accessibilityLabel },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Spacer(Modifier.weight(1f))
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Radii.xl,
            tint = tintFg,
        )
        Text(
            text = label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = tintFg,
        )
        Spacer(Modifier.weight(1f))
    }
}

// MARK: - Challenge composer sheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChallengeComposerSheet(
    claimantFirstName: String,
    question: String,
    selectedReasons: Set<ChallengeReason>,
    isSubmitting: Boolean,
    canSend: Boolean,
    onQuestionChange: (String) -> Unit,
    onToggleReason: (ChallengeReason) -> Unit,
    onSend: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val maxHeight = (LocalConfiguration.current.screenHeightDp * 0.78f).dp
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        scrimColor = PantopusColors.appText.copy(alpha = 0.45f),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = maxHeight)
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(PantopusColors.warningBg)
                            .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(9.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MessageCircle,
                        contentDescription = null,
                        size = 17.dp,
                        tint = PantopusColors.warmAmber,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        text = "Request more information",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        text = "Save questions for this claim review.",
                        fontSize = 11.5.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    FieldLabel("Reasons (pick any)", required = false)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        ChallengeReason.entries.forEach { reason ->
                            ReasonChip(
                                label = reason.label,
                                selected = selectedReasons.contains(reason),
                                onClick = { onToggleReason(reason) },
                                modifier = Modifier.testTag("reviewClaimDetail_reason_${reason.name}"),
                            )
                        }
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    FieldLabel("Your questions for $claimantFirstName", required = true)
                    QuestionEditor(
                        value = question,
                        onValueChange = { onQuestionChange(it.take(600)) },
                        placeholder = "Ask for the document, context, or call you need before deciding.",
                    )
                    Text(
                        text = "${question.length} / 600",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = FontFamily.Monospace,
                        color = PantopusColors.appTextMuted,
                        modifier = Modifier.align(Alignment.End),
                    )
                }

                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurfaceMuted)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                            .padding(horizontal = Spacing.s3, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    VisibilityRow(icon = PantopusIcon.Eye, text = "Saved with the claim review")
                    VisibilityRow(icon = PantopusIcon.Clock, text = "The claim stays under review")
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SheetSecondaryButton(
                    label = "Back",
                    enabled = !isSubmitting,
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                )
                SheetPrimaryButton(
                    label = if (isSubmitting) "Saving…" else "Save request",
                    icon = PantopusIcon.Send,
                    isSubmitting = isSubmitting,
                    enabled = canSend && !isSubmitting,
                    onClick = onSend,
                    modifier =
                        Modifier
                            .weight(1.35f)
                            .testTag("reviewClaimDetail_sendChallenge"),
                )
            }
        }
    }
}

@Composable
private fun FieldLabel(
    text: String,
    required: Boolean,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = text,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        if (required) {
            Text(
                text = "*",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun ReasonChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val foreground = if (selected) PantopusColors.warmAmber else PantopusColors.appTextStrong
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.warningBg else PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (selected) PantopusColors.warningLight else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.pill),
                )
                .conditionalClickable(enabled = true, onClick = onClick)
                .padding(horizontal = 11.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (selected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.warmAmber,
            )
        }
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            color = foreground,
        )
    }
}

@Composable
private fun QuestionEditor(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 104.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(10.dp)
                .testTag("reviewClaimDetail_challengeQuestion"),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle =
                TextStyle(
                    color = PantopusColors.appText,
                    fontSize = 13.5.sp,
                ),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        fontSize = 13.5.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                inner()
            },
        )
    }
}

@Composable
private fun VisibilityRow(
    icon: PantopusIcon,
    text: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = text,
            fontSize = 11.5.sp,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun SheetSecondaryButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .conditionalClickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun SheetPrimaryButton(
    label: String,
    icon: PantopusIcon,
    isSubmitting: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 46.dp)
                .shadow(if (enabled) 8.dp else 0.dp, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) PantopusColors.warmAmber else PantopusColors.appBorderStrong)
                .conditionalClickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (isSubmitting) {
            CircularProgressIndicator(
                color = PantopusColors.appTextInverse,
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
            )
        } else {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Spacer(Modifier.width(7.dp))
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextInverse,
        )
    }
}

// MARK: - Note capture sheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteCaptureSheet(
    title: String,
    body: String,
    placeholder: String,
    primaryTitle: String,
    primaryDestructive: Boolean,
    note: String,
    onNoteChange: (String) -> Unit,
    isSubmitting: Boolean,
    onPrimary: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .conditionalClickable(enabled = true, onClick = onDismiss)
                            .semantics { contentDescription = "Close" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
            Text(
                text = body,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 120.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appBg)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s2)
                        .testTag("reviewClaimDetail_noteEditor"),
            ) {
                BasicTextField(
                    value = note,
                    onValueChange = onNoteChange,
                    textStyle =
                        TextStyle(
                            color = PantopusColors.appText,
                            fontSize = 14.sp,
                        ),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner ->
                        if (note.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                        inner()
                    },
                )
            }
            val primaryBg = if (primaryDestructive) PantopusColors.error else PantopusColors.primary600
            FooterPrimaryButton(
                label = if (isSubmitting) "Sending…" else primaryTitle,
                icon = PantopusIcon.ArrowRight,
                background = primaryBg,
                foreground = PantopusColors.appTextInverse,
                isSubmitting = isSubmitting,
                enabled = !isSubmitting,
                onClick = onPrimary,
                modifier = Modifier.testTag("reviewClaimDetail_notePrimary"),
                accessibilityLabel = primaryTitle,
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .conditionalClickable(enabled = !isSubmitting, onClick = onDismiss)
                        .semantics { contentDescription = "Cancel" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Cancel",
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
            // Ensure the bottom edge of the sheet clears the gesture area.
            Spacer(Modifier.height(Spacing.s4))
        }
    }
}

// Small wrapper that no-ops the click when `enabled = false`, keeping the
// per-button geometry call sites tidy and matching the disabled affordance
// the design wants while a review action is in-flight.
private fun Modifier.conditionalClickable(
    enabled: Boolean,
    onClick: () -> Unit,
): Modifier = if (enabled) this.clickable(onClick = onClick) else this
