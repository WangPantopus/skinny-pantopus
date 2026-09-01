@file:Suppress("LongMethod", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mailbox.v2.MailboxCategoryPayload
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.BookletBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CertifiedBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CommunityBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CouponBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.GenericMailBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.GenericMailBodyContent
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.GigBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.MemoryBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.PackageBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedConfirmGate
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedTermsSheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Hub → MailboxList → MailboxItemDetail screen. The ViewModel reads the
 * mail id via the nav-backstack [androidx.lifecycle.SavedStateHandle].
 *
 * NOT ROUTED (M5 parity sweep): `RootTabScreen.kt` renders
 * `MailDetailScreen` for `MAILBOX_ITEM_DETAIL`, so nothing reaches this
 * composable at runtime. It is kept because its shell + category bodies are
 * still the reference for the A17 variant work and it carries its own unit /
 * snapshot coverage; the A17.1 per-category ACTIONS row was added to the
 * screen that actually renders (`mail_detail/variants/GenericMailDetailLayout.kt`)
 * rather than by routing this one. Delete both this file and
 * `MailboxItemDetailViewModel` together if the shell is ever retired.
 */
@Suppress("CyclomaticComplexMethod")
@Composable
fun MailboxItemDetailScreen(
    onBack: () -> Unit,
    onOpenSenderProfile: ((String) -> Unit)? = null,
    viewModel: MailboxItemDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val ctaFlags by viewModel.ctaFlags.collectAsStateWithLifecycle()
    val ackChecked by viewModel.certifiedAckChecked.collectAsStateWithLifecycle()
    var termsSheetUrl by remember { mutableStateOf<String?>(null) }
    var showsConfirmGate by remember { mutableStateOf(false) }
    var didAutoPresentConfirmGate by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(ctaFlags.errorToast) {
        if (ctaFlags.errorToast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        when (val s = state) {
            MailboxItemDetailUiState.Loading -> LoadingLayout(onBack = onBack)
            is MailboxItemDetailUiState.Error ->
                ErrorLayout(message = s.message, onRetry = { viewModel.refresh() })
            is MailboxItemDetailUiState.Loaded -> {
                val content = s.content
                val certifiedPayload = content.payload as? MailboxCategoryPayload.Certified
                val shouldAutoShowConfirmGate =
                    certifiedPayload != null &&
                        content.isUnread &&
                        !content.isArchived &&
                        !certifiedPayload.detail.isAcknowledged &&
                        content.ctaEnabled &&
                        !ctaFlags.primaryCompleted
                LaunchedEffect(shouldAutoShowConfirmGate) {
                    if (shouldAutoShowConfirmGate && !didAutoPresentConfirmGate) {
                        didAutoPresentConfirmGate = true
                        showsConfirmGate = true
                    }
                }
                val showTerms = {
                    val payload = content.payload
                    if (payload is MailboxCategoryPayload.Certified && !payload.detail.termsUrl.isNullOrEmpty()) {
                        termsSheetUrl = payload.detail.termsUrl
                    } else {
                        viewModel.performGhostAction()
                    }
                }
                val primaryAction = {
                    if (certifiedPayload != null && !ackChecked && !certifiedPayload.detail.isAcknowledged) {
                        showsConfirmGate = true
                    } else {
                        viewModel.performPrimaryAction()
                    }
                }
                MailboxItemDetailShell(
                    category = content.category,
                    trust = content.trust,
                    sender = content.sender,
                    aiElf = content.aiElf,
                    keyFacts = content.keyFacts,
                    timeline = if (content.category == MailItemCategory.Package) emptyList() else content.timeline,
                    cta = ctaContent(content, ctaFlags),
                    onBack = onBack,
                    onAIChip = { kind ->
                        // AI suggestion chips are shortcuts for the bottom CTAs.
                        when (kind) {
                            MailboxItemDetailAIChipKind.Primary ->
                                primaryAction()
                            MailboxItemDetailAIChipKind.Secondary ->
                                if (content.category == MailItemCategory.Certified) {
                                    showTerms()
                                } else {
                                    viewModel.performGhostAction()
                                }
                        }
                    },
                    onPrimary = primaryAction,
                    onGhost = {
                        if (content.category == MailItemCategory.Certified) {
                            showTerms()
                        } else {
                            viewModel.performGhostAction()
                        }
                    },
                    onSenderAvatarTap = onOpenSenderProfile,
                ) {
                    CategoryBody(
                        content = content,
                        ctaFlags = ctaFlags,
                        onViewTerms = showTerms,
                        onAcceptGig = { viewModel.acceptGigBid() },
                        onReceiveAtDoor = { viewModel.performPrimaryAction() },
                    )
                }
                if (showsConfirmGate && certifiedPayload != null) {
                    CertifiedConfirmGate(
                        senderName = content.sender.displayName,
                        referenceNumber = certifiedPayload.detail.referenceNumber,
                        deadlineLabel = formatCertifiedDeadline(certifiedPayload.detail.acknowledgeBy),
                        isSigning = ctaFlags.primaryLoading,
                        onReviewFirst = { showsConfirmGate = false },
                        onSign = {
                            viewModel.setCertifiedAckChecked(true)
                            showsConfirmGate = false
                            viewModel.performPrimaryAction()
                        },
                    )
                }
            }
        }
        ctaFlags.errorToast?.let { toast ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.error)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(toast, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
            }
        }
    }

    termsSheetUrl?.let { url ->
        CertifiedTermsSheet(
            termsUrl = url,
            onDismiss = { termsSheetUrl = null },
        )
    }
}

private fun ctaContent(
    content: MailboxItemDetailContent,
    flags: MailboxCTAFlags,
): MailboxCTAShelfContent? =
    when (content.category) {
        MailItemCategory.Package ->
            null
        MailItemCategory.Coupon ->
            MailboxCTAShelfContent(
                primaryTitle =
                    if (flags.primaryCompleted) "Added to wallet" else "Add to wallet",
                ghostTitle = "Save for later",
                primaryLoading = flags.primaryLoading,
                ghostLoading = flags.ghostLoading,
                primaryEnabled = content.ctaEnabled && !flags.primaryCompleted,
            )
        MailItemCategory.Booklet ->
            MailboxCTAShelfContent(
                primaryTitle = "Save to library",
                ghostTitle = null,
                primaryLoading = flags.primaryLoading,
                ghostLoading = false,
                primaryEnabled = content.ctaEnabled,
            )
        MailItemCategory.Certified ->
            MailboxCTAShelfContent(
                primaryTitle =
                    if (flags.primaryCompleted) "Signed" else "Sign for delivery",
                ghostTitle = "View terms",
                primaryLoading = flags.primaryLoading,
                ghostLoading = flags.ghostLoading,
                primaryEnabled =
                    content.ctaEnabled && !flags.primaryCompleted,
            )
        MailItemCategory.Memory -> {
            val saved = (content.payload as? MailboxCategoryPayload.Memory)?.detail?.isSaved ?: false
            MailboxCTAShelfContent(
                primaryTitle = if (saved) "Saved to Vault" else "Save to Vault",
                ghostTitle = "Share",
                primaryLoading = flags.primaryLoading,
                ghostLoading = flags.ghostLoading,
                primaryEnabled = !saved,
            )
        }
        else -> null
    }

@Composable
private fun CategoryBody(
    content: MailboxItemDetailContent,
    ctaFlags: MailboxCTAFlags,
    onViewTerms: () -> Unit,
    onAcceptGig: () -> Unit,
    onReceiveAtDoor: () -> Unit,
) {
    // Category first, payload second — mirrors iOS `categoryBody(for:)`. Every
    // branch that can't render its bespoke body (package enrichment missing, a
    // payload that failed to decode) falls through to the generic readable
    // body, so no known category ever renders an empty surface. Split across
    // two dispatchers purely to keep each under detekt's complexity ceiling.
    val payload = content.payload
    when (content.category) {
        MailItemCategory.Package ->
            if (content.packageInfo != null) {
                PackageBody(
                    content = content.packageInfo,
                    isReceiveEnabled = content.ctaEnabled && !ctaFlags.primaryCompleted,
                    isReceiveLoading = ctaFlags.primaryLoading,
                    isReceived = ctaFlags.primaryCompleted,
                    onReceiveAtDoor = onReceiveAtDoor,
                )
            } else {
                GenericCategoryBody(content)
            }
        MailItemCategory.Coupon ->
            if (payload is MailboxCategoryPayload.Coupon) {
                CouponBody(coupon = payload.detail)
            } else {
                GenericCategoryBody(content)
            }
        MailItemCategory.Booklet ->
            if (payload is MailboxCategoryPayload.Booklet) {
                BookletBody(booklet = payload.detail)
            } else {
                GenericCategoryBody(content)
            }
        MailItemCategory.Certified ->
            if (payload is MailboxCategoryPayload.Certified) {
                CertifiedBody(certified = payload.detail, onViewTerms = onViewTerms)
            } else {
                GenericCategoryBody(content)
            }
        else -> SocialCategoryBody(content = content, onAcceptGig = onAcceptGig)
    }
}

/**
 * Second half of the [CategoryBody] dispatch: the person-authored categories
 * (community / gig / memory) plus the generic fallback for every other case.
 */
@Composable
private fun SocialCategoryBody(
    content: MailboxItemDetailContent,
    onAcceptGig: () -> Unit,
) {
    val payload = content.payload
    when (content.category) {
        MailItemCategory.Community ->
            if (payload is MailboxCategoryPayload.Community) {
                CommunityBody(
                    community = payload.detail,
                    authorName = content.sender.displayName,
                    authorInitials = content.sender.initials,
                )
            } else {
                GenericCategoryBody(content)
            }
        MailItemCategory.Gig ->
            if (payload is MailboxCategoryPayload.Gig) {
                GigBody(gig = payload.detail, onAccept = onAcceptGig)
            } else {
                GenericCategoryBody(content)
            }
        MailItemCategory.Memory ->
            if (payload is MailboxCategoryPayload.Memory) {
                MemoryBody(memory = payload.detail, isSaved = payload.detail.isSaved)
            } else {
                GenericCategoryBody(content)
            }
        else -> GenericCategoryBody(content)
    }
}

/**
 * Generic readable body for any category without a bespoke layout, or whose
 * bespoke payload is missing. Falls back to the category explainer so no known
 * category ever renders an empty surface. Mirrors iOS `genericBody(for:)`.
 */
@Composable
private fun GenericCategoryBody(content: MailboxItemDetailContent) {
    GenericMailBody(
        content = content.genericBody ?: GenericMailBodyContent(category = content.category),
    )
}

private fun formatCertifiedDeadline(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val instant =
        runCatching { Instant.parse(iso) }
            .getOrNull()
            ?: runCatching {
                LocalDate.parse(iso).atStartOfDay(ZoneId.systemDefault()).toInstant()
            }.getOrNull()
            ?: return iso
    return DateTimeFormatter
        .ofPattern("EEE MMM d, yyyy", Locale.US)
        .withZone(ZoneId.systemDefault())
        .format(instant)
}

@Composable
private fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appBorder))
        Column(
            modifier = Modifier.padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 120.dp, height = 22.dp, cornerRadius = Radii.pill)
            Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.md)
            Shimmer(width = 320.dp, height = 120.dp, cornerRadius = Radii.lg)
            Shimmer(width = 320.dp, height = 180.dp, cornerRadius = Radii.lg)
        }
        PrimaryButton(title = "Back", onClick = onBack, modifier = Modifier.padding(Spacing.s4))
    }
}

@Composable
private fun ErrorLayout(
    message: String,
    onRetry: () -> Unit,
) {
    EmptyState(
        icon = PantopusIcon.AlertCircle,
        headline = "Couldn't load this item",
        subcopy = message,
        ctaTitle = "Try again",
        onCta = onRetry,
    )
}
