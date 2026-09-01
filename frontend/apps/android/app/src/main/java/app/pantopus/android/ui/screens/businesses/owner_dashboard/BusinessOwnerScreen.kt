@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
    "ComplexMethod",
)

package app.pantopus.android.ui.screens.businesses.owner_dashboard

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BizStatusBadge
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.MapPreview
import app.pantopus.android.ui.components.RatingDistribution
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.business_profile.BusinessGalleryItem
import app.pantopus.android.ui.screens.business_profile.BusinessGalleryTint
import app.pantopus.android.ui.screens.business_profile.BusinessOpenState
import app.pantopus.android.ui.screens.business_profile.BusinessProfileContent
import app.pantopus.android.ui.screens.business_profile.BusinessProfileLoadedFrame
import app.pantopus.android.ui.screens.business_profile.BusinessServiceArea
import app.pantopus.android.ui.screens.business_profile.BusinessServiceRow
import app.pantopus.android.ui.screens.business_profile.components.CategoryRow
import app.pantopus.android.ui.screens.business_profile.components.EmptyBlock
import app.pantopus.android.ui.screens.business_profile.components.HoursTable
import app.pantopus.android.ui.screens.businesses.catalog.BusinessCatalogScreen
import app.pantopus.android.ui.screens.businesses.inbox.BusinessInboxScreen
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.FoundingOfferBanner
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.InsightTiles
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.OwnerComposeFab
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.OwnerHeaderBanner
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.OwnerLiveBar
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.OwnerNavRow
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.OwnerTopBar
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.PreviewBar
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.ProfileStrengthCard
import app.pantopus.android.ui.screens.businesses.owner_dashboard.components.ReviewReplyComposer
import app.pantopus.android.ui.screens.compose.pulse.PulseComposeScreen
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * A10.7 — the single-business owner dashboard, the owner-facing twin of
 * A10.6. Two in-screen frames toggled instantly:
 *   · OWNER / EDIT — owner chrome, insight tiles, a profile-strength card,
 *     edit-affordance sections opening Edit Business Page (A13.10), a
 *     per-review reply composer, and a "Preview · Edit page" dock.
 *   · PREVIEW AS NEIGHBOR — the EXACT A10.6 public render
 *     ([BusinessProfileLoadedFrame], B3.1) under a dark [PreviewBar]; no
 *     owner affordances leak through.
 *
 * Owner ↔ preview is an in-screen, instant toggle. Business violet
 * throughout; loading uses shimmer skeletons. Mirrors iOS
 * `BusinessOwnerView.swift`.
 */
@Composable
fun BusinessOwnerScreen(
    onBack: () -> Unit,
    onEditPage: () -> Unit = {},
    onOpenInsights: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenTeam: () -> Unit = {},
    /** C4 — opens the custom Pages CMS (block builder + revision history). */
    onOpenPages: () -> Unit = {},
    /** C3 — owner money + legal surfaces. */
    onOpenPayments: () -> Unit = {},
    onOpenInvoices: () -> Unit = {},
    onOpenLegal: () -> Unit = {},
    /** Business-inbox row taps — opens a chat room (`roomId`, counterpart
     *  name, counterpart handle) or a matched neighborhood post. */
    onOpenChatRoom: (String, String, String) -> Unit = { _, _, _ -> },
    onOpenPost: (String) -> Unit = {},
    viewModel: BusinessOwnerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var mode by remember { mutableStateOf(OwnerViewMode.Owner) }

    /** C2 — bumped per composer open so each post starts from a blank draft. */
    var composeSession by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) { viewModel.load() }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("businessOwner"),
    ) {
        when (val current = state) {
            BusinessOwnerUiState.Loading -> OwnerLoadingLayout(onBack = onBack)
            BusinessOwnerUiState.NotFound ->
                OwnerMessageLayout(
                    icon = PantopusIcon.Building2,
                    headline = "Business not found",
                    subcopy = "This business may have moved or unpublished its page.",
                    onBack = onBack,
                    onRetry = viewModel::refresh,
                )
            is BusinessOwnerUiState.Error ->
                OwnerMessageLayout(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load your business",
                    subcopy = current.message,
                    onBack = onBack,
                    onRetry = viewModel::refresh,
                )
            is BusinessOwnerUiState.Loaded ->
                Crossfade(targetState = mode, animationSpec = tween(180), label = "ownerMode") { m ->
                    when (m) {
                        OwnerViewMode.Owner ->
                            OwnerEditFrame(
                                content = current.content,
                                onBack = onBack,
                                onEditPage = onEditPage,
                                onOpenInsights = onOpenInsights,
                                onOpenSettings = onOpenSettings,
                                onOpenTeam = onOpenTeam,
                                onOpenPages = onOpenPages,
                                onOpenPayments = onOpenPayments,
                                onOpenInvoices = onOpenInvoices,
                                onOpenLegal = onOpenLegal,
                                onPreview = { mode = OwnerViewMode.Preview },
                                onManageCatalog = { mode = OwnerViewMode.Catalog },
                                onOpenInbox = { mode = OwnerViewMode.Inbox },
                                onComposePost = {
                                    composeSession += 1
                                    mode = OwnerViewMode.Compose
                                },
                                onSubmitReply = { id, text -> viewModel.submitReply(id, text) },
                                onClaimFounding = viewModel::claimFoundingOffer,
                                onDismissFounding = viewModel::dismissFoundingBanner,
                            )
                        OwnerViewMode.Preview ->
                            OwnerPreviewFrame(
                                content = current.content.publicProfile,
                                onExit = { mode = OwnerViewMode.Owner },
                            )
                        OwnerViewMode.Catalog ->
                            BusinessCatalogScreen(
                                onBack = {
                                    mode = OwnerViewMode.Owner
                                    viewModel.refresh()
                                },
                            )
                        OwnerViewMode.Inbox ->
                            BusinessInboxScreen(
                                onBack = { mode = OwnerViewMode.Owner },
                                onOpenRoom = onOpenChatRoom,
                                onOpenPost = onOpenPost,
                            )
                        OwnerViewMode.Compose ->
                            // C2 — reuse the shared Pulse composer, pointed at
                            // `POST /api/businesses/:businessId/posts`.
                            PulseComposeScreen(
                                onBack = { mode = OwnerViewMode.Owner },
                                // A fresh key per open so the composer starts
                                // blank instead of reusing the last draft.
                                viewModel = hiltViewModel(key = "businessPost-$composeSession"),
                                onPosted = {
                                    mode = OwnerViewMode.Owner
                                    viewModel.refresh()
                                },
                                businessAuthorId = current.content.businessId,
                            )
                    }
                }
        }

        // Founding-claim confirmation / error copy. RN raises an `Alert`;
        // native uses the same transient toast idiom as the rest of the app.
        OwnerToastOverlay(message = toast, onDismiss = viewModel::consumeToast)
    }
}

@Composable
private fun BoxScope.OwnerToastOverlay(
    message: String?,
    onDismiss: () -> Unit,
) {
    if (message == null) return
    LaunchedEffect(message) {
        delay(3_000)
        onDismiss()
    }
    Box(
        modifier =
            Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 140.dp, start = Spacing.s4, end = Spacing.s4)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("businessOwner.toast"),
    ) {
        Text(
            text = message,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextInverse,
        )
    }
}

/** Which frame the owner dashboard is showing. */
enum class OwnerViewMode {
    Owner,
    Preview,

    /** C2 — the catalog manager (services / products CRUD + reorder). */
    Catalog,

    /** C2 — "Post as this business" (role-gated). */
    Compose,

    /** The business-side inbox — rooms addressed to the business identity
     *  plus neighborhood posts matched to it. */
    Inbox,
}

// MARK: - Owner / edit frame

@Composable
internal fun OwnerEditFrame(
    content: BusinessOwnerContent,
    onBack: () -> Unit,
    onEditPage: () -> Unit,
    onOpenInsights: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenTeam: () -> Unit,
    onPreview: () -> Unit,
    onSubmitReply: (String, String) -> Unit,
    /** C4 — opens the custom Pages CMS. */
    onOpenPages: () -> Unit = {},
    /** C3 — owner money + legal surfaces. */
    onOpenPayments: () -> Unit = {},
    onOpenInvoices: () -> Unit = {},
    onOpenLegal: () -> Unit = {},
    /** C2 — opens the catalog manager frame ("Manage" / "Add a service"). */
    onManageCatalog: () -> Unit = {},
    /** Opens the business inbox frame (Messages + Mentions). */
    onOpenInbox: () -> Unit = {},
    /** C2 — opens the "Post as this business" composer. */
    onComposePost: () -> Unit = {},
    /** Founding-business offer banner actions. */
    onClaimFounding: () -> Unit = {},
    onDismissFounding: () -> Unit = {},
) {
    val profile = content.publicProfile
    Box(modifier = Modifier.fillMaxSize().testTag("businessOwner.edit")) {
        Column(modifier = Modifier.fillMaxSize()) {
            OwnerTopBar(onBack = onBack, onOpenInsights = onOpenInsights, onOpenSettings = onOpenSettings)
            OwnerLiveBar(isLive = content.isLive, editedMeta = content.editedMeta, onPreview = onPreview)
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
            ) {
                OwnerHeaderBanner(
                    name = profile.header.displayName,
                    handle = profile.header.handle?.let { "@$it" } ?: "",
                    locality = profile.header.locality ?: "",
                    logoIcon = profile.header.logoIcon,
                    status = bannerStatus(profile.status),
                    onEdit = onEditPage,
                )
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4)
                            .padding(bottom = 130.dp),
                ) {
                    OwnerSections(
                        content = content,
                        profile = profile,
                        onEditPage = onEditPage,
                        onOpenInsights = onOpenInsights,
                        onOpenTeam = onOpenTeam,
                        onOpenPages = onOpenPages,
                        onOpenPayments = onOpenPayments,
                        onOpenInvoices = onOpenInvoices,
                        onOpenLegal = onOpenLegal,
                        onManageCatalog = onManageCatalog,
                        onOpenInbox = onOpenInbox,
                        onSubmitReply = onSubmitReply,
                        onClaimFounding = onClaimFounding,
                        onDismissFounding = onDismissFounding,
                    )
                }
            }
        }
        // C2 — "Post as this business". RN floats the same FAB above its
        // dock, gated on `access.role_base`.
        if (content.canPostAsBusiness) {
            OwnerComposeFab(
                onClick = onComposePost,
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .navigationBarsPadding()
                        .padding(end = Spacing.s4, bottom = 88.dp),
            )
        }
        OwnerDock(
            onPreview = onPreview,
            onEditPage = onEditPage,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding(),
        )
    }
}

private fun bannerStatus(status: BusinessOpenState?): BizStatusBadge? =
    status?.let {
        if (it.isOpen) BizStatusBadge.open(it.chipLabel) else BizStatusBadge.closed(it.chipLabel)
    }

@Composable
private fun OwnerSections(
    content: BusinessOwnerContent,
    profile: BusinessProfileContent,
    onEditPage: () -> Unit,
    onOpenInsights: () -> Unit,
    onOpenTeam: () -> Unit,
    /** C4 — opens the custom Pages CMS. */
    onOpenPages: () -> Unit,
    onOpenPayments: () -> Unit,
    onOpenInvoices: () -> Unit,
    onOpenLegal: () -> Unit,
    onManageCatalog: () -> Unit,
    onOpenInbox: () -> Unit,
    onSubmitReply: (String, String) -> Unit,
    onClaimFounding: () -> Unit,
    onDismissFounding: () -> Unit,
) {
    content.foundingOffer?.let { offer ->
        FoundingOfferBanner(
            offer = offer,
            onClaim = onClaimFounding,
            onDismiss = onDismissFounding,
            modifier = Modifier.padding(top = 14.dp),
        )
    }
    InsightTiles(
        insights = content.insights,
        onOpenInsights = onOpenInsights,
        modifier = Modifier.padding(top = 14.dp),
    )
    ProfileStrengthCard(
        strength = content.profileStrength,
        onAddStep = { onEditPage() },
        modifier = Modifier.padding(top = Spacing.s3),
    )

    OwnerSectionHeader(title = "Categories", actionLabel = "Edit", actionIcon = PantopusIcon.Pencil, onAction = onEditPage)
    CategoryRow(categories = profile.categories)

    OwnerSectionHeader(title = "About", actionLabel = "Edit", actionIcon = PantopusIcon.Pencil, onAction = onEditPage)
    if (!profile.about.isNullOrEmpty()) {
        Text(
            text = profile.about,
            color = PantopusColors.appTextStrong,
            fontSize = 13.5.sp,
            letterSpacing = (-0.05).sp,
        )
    } else {
        EmptyBlock(
            icon = PantopusIcon.FileText,
            title = "Add a description",
            body = "Tell neighbors what makes your business worth hiring.",
            ctaLabel = "Add",
            ctaIcon = PantopusIcon.Plus,
            onCta = onEditPage,
        )
    }

    OwnerSectionHeader(title = "Hours", actionLabel = "Edit", actionIcon = PantopusIcon.Pencil, onAction = onEditPage)
    val status = profile.status
    if (status != null && profile.hours.isNotEmpty()) {
        HoursTable(status = status, rows = profile.hours)
    } else {
        EmptyBlock(
            icon = PantopusIcon.Clock,
            title = "Set your hours",
            body = "Add opening hours so neighbors know when you're available.",
            ctaLabel = "Add",
            ctaIcon = PantopusIcon.Plus,
            onCta = onEditPage,
        )
    }

    OwnerSectionHeader(title = "Service area", actionLabel = "Edit", actionIcon = PantopusIcon.Pencil, onAction = onEditPage)
    val area = profile.serviceArea
    if (area != null) {
        OwnerServiceAreaCard(area = area)
    } else {
        EmptyBlock(
            icon = PantopusIcon.MapPin,
            title = "Add a service area",
            body = "Show neighbors where you work.",
            ctaLabel = "Add",
            ctaIcon = PantopusIcon.Plus,
            onCta = onEditPage,
        )
    }

    OwnerSectionHeader(
        title = "Services",
        actionLabel = "Manage",
        actionIcon = PantopusIcon.SlidersHorizontal,
        onAction = onManageCatalog,
    )
    ManageServicesList(services = profile.services, onManage = onManageCatalog)

    OwnerSectionHeader(title = "Photos")
    ManageGalleryRail(gallery = profile.gallery, onAdd = onEditPage, onEditTile = onEditPage)

    OwnerSectionHeader(title = "Team", actionLabel = "Manage", actionIcon = PantopusIcon.Users, onAction = onOpenTeam)
    TeamSummaryRow(onOpen = onOpenTeam)

    // C4 — custom Pages CMS (block builder + revision history).
    OwnerSectionHeader(
        title = "Pages",
        actionLabel = "Manage",
        actionIcon = PantopusIcon.FileText,
        onAction = onOpenPages,
    )
    OwnerNavRow(
        icon = PantopusIcon.FileText,
        title = "Custom pages",
        subtitle = "Build menus, about pages and more with content blocks",
        testTagValue = "businessOwner.pagesRow",
        onOpen = onOpenPages,
    )

    OwnerSectionHeader(
        title = "Inbox",
        actionLabel = "Open",
        actionIcon = PantopusIcon.Inbox,
        onAction = onOpenInbox,
    )
    OwnerNavRow(
        icon = PantopusIcon.Inbox,
        title = "Messages & mentions",
        subtitle = "Conversations with this business and posts that mention it",
        testTagValue = "businessOwner.inboxRow",
        onOpen = onOpenInbox,
    )

    OwnerSectionHeader(title = "Money & legal")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        OwnerNavRow(
            icon = PantopusIcon.CreditCard,
            title = "Payments",
            subtitle = "Connect Stripe so this business can get paid",
            testTagValue = "businessOwner.paymentsRow",
            onOpen = onOpenPayments,
        )
        OwnerNavRow(
            icon = PantopusIcon.ReceiptText,
            title = "Invoices",
            subtitle = "Bill a customer and track what's been paid",
            testTagValue = "businessOwner.invoicesRow",
            onOpen = onOpenInvoices,
        )
        OwnerNavRow(
            icon = PantopusIcon.ShieldCheck,
            title = "Legal & verification",
            subtitle = "Legal name, tax ID and verification documents",
            testTagValue = "businessOwner.legalRow",
            onOpen = onOpenLegal,
        )
    }

    OwnerSectionHeader(title = "Reviews", actionLabel = content.reviewsToReplyLabel, actionIcon = PantopusIcon.MessageSquare)
    val summary = profile.reviewSummary
    if (summary != null && summary.count > 0) {
        RatingDistribution(
            average = summary.average,
            count = summary.count,
            distribution = summary.distribution.map { it.toFloat() },
        )
    }
    content.reviews.forEach { review ->
        ReviewReplyComposer(
            review = review,
            businessName = shortBusinessName(profile.header.displayName),
            onSubmit = { text -> onSubmitReply(review.id, text) },
            modifier = Modifier.padding(top = Spacing.s2),
        )
    }
}

/** "Marlow & Co. Cleaning" → "Marlow & Co." for the reply byline. */
private fun shortBusinessName(displayName: String): String = displayName.substringBefore(" Cleaning")

// MARK: - Preview-as-neighbor frame

/**
 * The exact A10.6 public render (B3.1) under a dark preview bar. The Column's
 * [androidx.compose.foundation.layout.statusBarsPadding] (applied below)
 * consumes the status-bar inset so the reused frame's own
 * `statusBarsPadding` collapses and its banner starts right under the bar.
 */
@Composable
internal fun OwnerPreviewFrame(
    content: BusinessProfileContent,
    onExit: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .statusBarsPadding()
                .testTag("businessOwner.preview"),
    ) {
        PreviewBar(onExit = onExit)
        BusinessProfileLoadedFrame(
            content = content,
            isSaved = false,
            onBack = onExit,
            onShare = {},
            onMore = {},
            onToggleSavedPlace = {},
            onContact = {},
            onBook = {},
            onCall = {},
        )
    }
}

// MARK: - Section header

@Composable
private fun OwnerSectionHeader(
    title: String,
    actionLabel: String? = null,
    actionIcon: PantopusIcon? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            modifier = Modifier.semantics { heading() },
        )
        Box(modifier = Modifier.weight(1f))
        if (actionLabel != null) {
            val rowModifier =
                if (onAction != null) {
                    Modifier.clickable(onClick = onAction).testTag("businessOwner.section.$title.action")
                } else {
                    Modifier
                }
            Row(
                modifier = rowModifier,
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                actionIcon?.let {
                    PantopusIconImage(
                        icon = it,
                        contentDescription = null,
                        size = 12.dp,
                        strokeWidth = 2.2f,
                        tint = PantopusColors.business,
                    )
                }
                Text(text = actionLabel, color = PantopusColors.business, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// MARK: - Manage services

@Composable
private fun ManageServicesList(
    services: List<BusinessServiceRow>,
    onManage: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .testTag("businessOwner.manageServices"),
    ) {
        services.forEachIndexed { index, service ->
            ManageServiceRow(service = service, onClick = onManage)
            if (index < services.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(start = 14.dp))
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onManage)
                    .padding(vertical = 11.dp)
                    .testTag("businessOwner.addService"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.business,
            )
            Text(
                text = "Add a service",
                color = PantopusColors.business,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = Spacing.s1),
            )
        }
    }
}

@Composable
private fun ManageServiceRow(
    service: BusinessServiceRow,
    onClick: () -> Unit,
) {
    val subtitle = listOfNotNull(service.detail, service.priceLabel).joinToString(" · ")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics { contentDescription = "${service.name}, $subtitle" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = service.icon,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = service.name,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(text = subtitle, color = PantopusColors.appTextSecondary, fontSize = 11.sp, maxLines = 1)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

// MARK: - Manage gallery

@Composable
private fun ManageGalleryRail(
    gallery: List<BusinessGalleryItem>,
    onAdd: () -> Unit,
    onEditTile: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("businessOwner.manageGallery"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        AddPhotoTile(onAdd = onAdd)
        gallery.forEach { item ->
            GalleryEditTile(item = item, onEditTile = onEditTile)
        }
    }
}

@Composable
private fun AddPhotoTile(onAdd: () -> Unit) {
    val shape = RoundedCornerShape(Radii.lg)
    val dashColor = PantopusColors.business
    Box(
        modifier =
            Modifier
                .size(width = 92.dp, height = 92.dp)
                .clip(shape)
                .background(PantopusColors.businessBg)
                .drawBehind {
                    val radius = Radii.lg.toPx()
                    drawRoundRect(
                        color = dashColor,
                        cornerRadius = CornerRadius(radius, radius),
                        style =
                            Stroke(
                                width = 1.5.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()), 0f),
                            ),
                    )
                }
                .clickable(onClick = onAdd)
                .semantics { contentDescription = "Add photo" }
                .testTag("businessOwner.addPhoto"),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.business,
            )
            Text(text = "Add", color = PantopusColors.business, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun GalleryEditTile(
    item: BusinessGalleryItem,
    onEditTile: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(width = 116.dp, height = 92.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(galleryTint(item.tint))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        contentAlignment = Alignment.Center,
    ) {
        if (item.moreCount != null) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                Text(text = "+${item.moreCount}", color = PantopusColors.appTextInverse, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        } else {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = 24.dp,
                strokeWidth = 1.6f,
                tint = PantopusColors.appTextInverse.copy(alpha = 0.92f),
            )
            item.label?.let { label ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomStart) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.45f))))
                                .padding(horizontal = Spacing.s2, vertical = 6.dp),
                    ) {
                        Text(
                            text = label,
                            color = PantopusColors.appTextInverse,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                        )
                    }
                }
            }
            Box(modifier = Modifier.fillMaxSize().padding(6.dp), contentAlignment = Alignment.TopEnd) {
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appText.copy(alpha = 0.55f))
                            .clickable(onClick = onEditTile)
                            .semantics { contentDescription = "Edit photo" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Pencil,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

private fun galleryTint(tint: BusinessGalleryTint): Color =
    when (tint) {
        BusinessGalleryTint.Primary -> PantopusColors.business
        BusinessGalleryTint.Success -> PantopusColors.success
        BusinessGalleryTint.Slate -> PantopusColors.slate
        BusinessGalleryTint.Deep -> PantopusColors.businessDark
    }

// MARK: - Team summary row

/** B2C — entry-point card on the owner dashboard that opens the Team &
 *  roles management screen. */
@Composable
private fun TeamSummaryRow(onOpen: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("businessOwner.teamRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Users,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Team & roles",
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = "Invite teammates and manage what each role can do",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
            )
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

// MARK: - Service area card (owner)

@Composable
private fun OwnerServiceAreaCard(area: BusinessServiceArea) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface),
    ) {
        MapPreview(
            identity = IdentityPillar.Business,
            serviceAreaRadius = if (area.hasCoordinates) 56.dp else null,
            pinGlyph = PantopusIcon.Building2,
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = area.title,
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.1).sp,
                )
                if (!area.detail.isNullOrEmpty()) {
                    Text(text = area.detail, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                }
                if (!area.serviceArea.isNullOrEmpty()) {
                    Row(
                        modifier = Modifier.padding(top = Spacing.s1),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Navigation,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.success,
                        )
                        Text(text = area.serviceArea, color = PantopusColors.success, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

// MARK: - Owner dock (Preview · Edit page)

@Composable
private fun OwnerDock(
    onPreview: () -> Unit,
    onEditPage: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        HorizontalDivider(color = PantopusColors.appBorder)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(top = 10.dp, bottom = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            DockButton(
                label = "Preview",
                icon = PantopusIcon.Eye,
                filled = false,
                onClick = onPreview,
                testTag = "businessOwner.previewAction",
                modifier = Modifier.weight(1f),
            )
            DockButton(
                label = "Edit page",
                icon = PantopusIcon.Edit2,
                filled = true,
                onClick = onEditPage,
                testTag = "businessOwner.editPage",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun DockButton(
    label: String,
    icon: PantopusIcon,
    filled: Boolean,
    onClick: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    val base =
        modifier
            .heightIn(min = 44.dp)
            .clip(RoundedCornerShape(Radii.lg))
    val styled =
        if (filled) {
            base.background(PantopusColors.business)
        } else {
            base.background(PantopusColors.appSurface).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
        }
    val tint = if (filled) PantopusColors.appTextInverse else PantopusColors.appText
    Row(
        modifier = styled.clickable(onClick = onClick).testTag(testTag).semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = tint)
        Text(
            text = label,
            color = tint,
            fontSize = 14.sp,
            fontWeight = if (filled) FontWeight.Bold else FontWeight.SemiBold,
            letterSpacing = (-0.1).sp,
            modifier = Modifier.padding(start = Spacing.s1),
        )
    }
}

// MARK: - Loading / message layouts

@Composable
internal fun OwnerLoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().testTag("businessOwner.loading")) {
        OwnerTopBar(onBack = onBack, onOpenInsights = {}, onOpenSettings = {})
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(116.dp)
                    .background(Brush.linearGradient(listOf(PantopusColors.businessDark, PantopusColors.business))),
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 68.dp, height = 68.dp, cornerRadius = 18.dp)
            Shimmer(width = 200.dp, height = 22.dp, cornerRadius = Radii.sm)
            Shimmer(width = 130.dp, height = 14.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 64.dp, cornerRadius = Radii.lg)
            Shimmer(width = 320.dp, height = 104.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
private fun OwnerMessageLayout(
    icon: PantopusIcon,
    headline: String,
    subcopy: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("businessOwner.message")) {
        ContentDetailTopBar(title = null, onBack = onBack)
        EmptyState(
            icon = icon,
            headline = headline,
            subcopy = subcopy,
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}
