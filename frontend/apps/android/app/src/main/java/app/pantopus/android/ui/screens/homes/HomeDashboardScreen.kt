@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.screens.shared.content_detail.FabCreateCTA
import app.pantopus.android.ui.screens.shared.content_detail.FabSheetAction
import app.pantopus.android.ui.screens.shared.content_detail.GridTabsBody
import app.pantopus.android.ui.screens.shared.content_detail.HomeHeroHeader
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Hub -> MyHomes -> Home Dashboard screen. The ViewModel reads the home id
 * from the nav-backstack [androidx.lifecycle.SavedStateHandle].
 *
 * `onOpenPlaceholder` is invoked for FAB/quick actions whose dedicated
 * screen isn't built yet (Log package, Add mail, etc.) and receives the
 * human-readable action label.
 */
@Composable
fun HomeDashboardScreen(
    onBack: () -> Unit,
    onInviteOwner: ((String) -> Unit)? = null,
    onClaimOwnership: ((String) -> Unit)? = null,
    onOpenClaimsList: (() -> Unit)? = null,
    onOpenBills: ((String) -> Unit)? = null,
    onOpenPolls: ((String) -> Unit)? = null,
    onOpenPlaceholder: ((String) -> Unit)? = null,
    onOpenPets: ((String) -> Unit)? = null,
    onOpenCalendar: ((String) -> Unit)? = null,
    onOpenDocs: ((String) -> Unit)? = null,
    onOpenEmergency: ((String) -> Unit)? = null,
    onOpenPackages: ((String) -> Unit)? = null,
    onOpenAccessCodes: ((homeId: String, homeName: String?) -> Unit)? = null,
    onOpenTasks: ((String) -> Unit)? = null,
    onOpenMaintenance: ((String) -> Unit)? = null,
    onOpenPropertyDetails: ((String) -> Unit)? = null,
    /** T6.3a / P9 - push to the per-home Members list. When wired, the
     *  "Members" / "Add member" quick-actions navigate to the list
     *  (which owns its own invite FAB) instead of opening the legacy
     *  InviteOwner form. */
    onOpenMembers: ((String) -> Unit)? = null,
    /** A14.1 (P5.1) — push to the per-home Settings index. Wired from
     *  the dashboard's top-bar settings affordance. */
    onOpenSettings: ((String) -> Unit)? = null,
    /** H1 — "Hire" on a seasonal-checklist item. Receives the
     *  [app.pantopus.android.ui.screens.gigs.GigsCategory] key derived from
     *  the item's `gig_category` so the host can open the gig composer
     *  pre-filtered (RN routes to `/gig-v2/new?initialText=…`). */
    onHireHelp: ((String) -> Unit)? = null,
    /** FAB → "Add Task" — the household-task create form for this home.
     *  Mirrors RN `homes/[id]/index.tsx:155`. */
    onAddTask: ((String) -> Unit)? = null,
    /** FAB → "Track Bill" (RN `homes/[id]/index.tsx:156`). */
    onTrackBill: ((String) -> Unit)? = null,
    /** FAB → "Track Package" (RN `homes/[id]/index.tsx:157`). */
    onTrackPackage: ((String) -> Unit)? = null,
    /** FAB → "Send Mail" — opens the mail composer
     *  (RN `homes/[id]/index.tsx:160`). */
    onSendMail: ((String) -> Unit)? = null,
    viewModel: HomeDashboardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val healthScore by viewModel.healthScore.collectAsStateWithLifecycle()
    val checklist by viewModel.checklist.collectAsStateWithLifecycle()
    val propertyValue by viewModel.propertyValue.collectAsStateWithLifecycle()
    val billTrends by viewModel.billTrends.collectAsStateWithLifecycle()
    val pendingChecklistItemIds by viewModel.pendingChecklistItemIds.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.load()
        app.pantopus.android.data.analytics.Analytics.track(
            app.pantopus.android.data.analytics.AnalyticsEvent.ScreenHomeDashboardViewed,
        )
    }

    fun actionLabel(actionId: String): String =
        when (actionId) {
            "add_task" -> "Add Task"
            "track_bill" -> "Track Bill"
            "track_package" -> "Track Package"
            "add_pet" -> "Add Pet"
            "create_poll" -> "Create Poll"
            "send_mail" -> "Send Mail"
            "log_package" -> "Log a package"
            "view_packages" -> "Packages"
            "add_mail" -> "Add mail"
            "add_member" -> "Add member"
            "verify" -> "Verify home"
            "view_bills" -> "Bills"
            "view_docs" -> "Documents"
            "view_emergency" -> "Emergency info"
            "view_polls" -> "Polls"
            "view_tasks" -> "Tasks"
            "view_claims" -> "Claims"
            "view_maintenance" -> "Maintenance"
            "pets" -> "Pets"
            "calendar" -> "Calendar"
            "access_codes" -> "Access codes"
            else -> actionId.replace('_', ' ').replaceFirstChar(Char::uppercase)
        }

    fun openPlaceholder(actionId: String) {
        onOpenPlaceholder?.invoke(actionLabel(actionId))
    }

    /**
     * Prefer the dedicated create route, fall back to the feature's list
     * route, and only then to the host's placeholder screen.
     */
    fun routeFab(
        actionId: String,
        primary: ((String) -> Unit)?,
        fallback: ((String) -> Unit)?,
    ) {
        val homeId = viewModel.currentHomeId() ?: return
        val target = primary ?: fallback
        if (target != null) target(homeId) else openPlaceholder(actionId)
    }

    fun handleFab(actionId: String) {
        when (actionId) {
            "add_task" -> routeFab(actionId, onAddTask, onOpenTasks)
            "track_bill" -> routeFab(actionId, onTrackBill, onOpenBills)
            "track_package" -> routeFab(actionId, onTrackPackage, onOpenPackages)
            "add_pet" -> routeFab(actionId, onOpenPets, null)
            "create_poll" -> routeFab(actionId, onOpenPolls, null)
            "send_mail" -> routeFab(actionId, onSendMail, null)
            "add_member" -> {
                viewModel.currentHomeId()?.let { homeId ->
                    // Prefer the dedicated Members screen when its host
                    // wired the callback (T6.3a / P9). Falls back to
                    // the legacy InviteOwner form for older hosts.
                    onOpenMembers?.invoke(homeId)
                        ?: onInviteOwner?.invoke(homeId)
                        ?: openPlaceholder(actionId)
                }
            }
            else -> openPlaceholder(actionId)
        }
    }

    fun handleQuickAction(actionId: String) {
        when (actionId) {
            "verify" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onClaimOwnership?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "add_member" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenMembers?.invoke(homeId)
                        ?: onInviteOwner?.invoke(homeId)
                        ?: openPlaceholder(actionId)
                }
            "view_bills" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenBills?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "view_claims" -> onOpenClaimsList?.invoke() ?: openPlaceholder(actionId)
            "view_polls" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenPolls?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "view_maintenance" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenMaintenance?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "pets" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenPets?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "calendar" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenCalendar?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "view_docs" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenDocs?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "view_emergency" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenEmergency?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "view_packages" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenPackages?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            "access_codes" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenAccessCodes?.invoke(homeId, viewModel.currentHomeName())
                        ?: openPlaceholder(actionId)
                }
            "view_tasks" ->
                viewModel.currentHomeId()?.let { homeId ->
                    onOpenTasks?.invoke(homeId) ?: openPlaceholder(actionId)
                }
            else -> openPlaceholder(actionId)
        }
    }

    /**
     * Security-banner CTA routing. Mirrors RN's
     * `HomeStatusBanner.tsx:53` (claim window → invite co-owner) and
     * `:60` / `:66` (review / dispute → the home's security surface).
     */
    fun handleSecurityAction(action: HomeSecurityBannerAction) {
        val homeId = viewModel.currentHomeId() ?: return
        when (action) {
            HomeSecurityBannerAction.InviteCoOwner ->
                onInviteOwner?.invoke(homeId)
                    ?: onOpenMembers?.invoke(homeId)
                    ?: openPlaceholder("add_member")
            HomeSecurityBannerAction.OpenSecuritySettings ->
                onOpenSettings?.invoke(homeId) ?: openPlaceholder("home_security")
            HomeSecurityBannerAction.NoAction -> Unit
        }
    }

    // H1 — health ring + seasonal checklist + property value + bill
    // trends. Each card owns its loading / loaded / empty / error surface
    // so one failing read can't blank the Overview.
    val intelligenceStack: @Composable () -> Unit = {
        HealthScoreRingCard(
            state = healthScore,
            onAction = ::handleQuickAction,
            onRetry = viewModel::refreshHealthScore,
        )
        SeasonalChecklistCard(
            state = checklist,
            pendingItemIds = pendingChecklistItemIds,
            onComplete = viewModel::completeChecklistItem,
            onSkip = viewModel::skipChecklistItem,
            onHireHelp = { item ->
                onHireHelp?.invoke(GigsCategory.fromBackendKey(item.gigCategory).key)
                    ?: openPlaceholder("hire_help")
            },
            onGenerate = viewModel::generateChecklist,
            onRetry = viewModel::generateChecklist,
        )
        PropertyValueCard(state = propertyValue, onRetry = viewModel::retryPropertyValue)
        BillTrendsCard(state = billTrends, onRetry = viewModel::retryBillTrends)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val current = state) {
            HomeDashboardUiState.Loading -> LoadingLayout(onBack = onBack)
            is HomeDashboardUiState.Loaded ->
                DashboardLayout(
                    content = current.content,
                    intelligence = intelligenceStack,
                    brandNew = null,
                    selectedTab = selectedTab,
                    onSelectTab = viewModel::selectTab,
                    onBack = onBack,
                    onQuickAction = ::handleQuickAction,
                    onFabAction = ::handleFab,
                    onClaim = {
                        viewModel.currentHomeId()?.let { homeId ->
                            onClaimOwnership?.invoke(homeId) ?: openPlaceholder("verify")
                        }
                    },
                    onViewClaims = { onOpenClaimsList?.invoke() ?: openPlaceholder("verify") },
                    onOpenPropertyDetails = {
                        viewModel.currentHomeId()?.let { homeId ->
                            onOpenPropertyDetails?.invoke(homeId) ?: openPlaceholder("property_details")
                        }
                    },
                    onOpenSettings =
                        onOpenSettings?.let { handler ->
                            {
                                viewModel.currentHomeId()?.let { homeId -> handler(homeId) }
                            }
                        },
                    onSecurityAction = ::handleSecurityAction,
                )
            is HomeDashboardUiState.Empty ->
                DashboardLayout(
                    content = current.brandNew.content,
                    brandNew = current.brandNew,
                    selectedTab = selectedTab,
                    onSelectTab = viewModel::selectTab,
                    onBack = onBack,
                    onQuickAction = ::handleQuickAction,
                    onFabAction = ::handleFab,
                    onClaim = {
                        viewModel.currentHomeId()?.let { homeId ->
                            onClaimOwnership?.invoke(homeId) ?: openPlaceholder("verify")
                        }
                    },
                    onViewClaims = { onOpenClaimsList?.invoke() ?: openPlaceholder("verify") },
                    onOpenPropertyDetails = {
                        viewModel.currentHomeId()?.let { homeId ->
                            onOpenPropertyDetails?.invoke(homeId) ?: openPlaceholder("property_details")
                        }
                    },
                    onOpenSettings =
                        onOpenSettings?.let { handler ->
                            {
                                viewModel.currentHomeId()?.let { homeId -> handler(homeId) }
                            }
                        },
                    onSecurityAction = ::handleSecurityAction,
                )
            is HomeDashboardUiState.NeedsAttention ->
                DashboardLayout(
                    content = current.content,
                    intelligence = intelligenceStack,
                    brandNew = null,
                    selectedTab = selectedTab,
                    onSelectTab = viewModel::selectTab,
                    onBack = onBack,
                    onQuickAction = ::handleQuickAction,
                    onFabAction = ::handleFab,
                    onClaim = {
                        viewModel.currentHomeId()?.let { homeId ->
                            onClaimOwnership?.invoke(homeId) ?: openPlaceholder("verify")
                        }
                    },
                    onViewClaims = { onOpenClaimsList?.invoke() ?: openPlaceholder("verify") },
                    onOpenPropertyDetails = {
                        viewModel.currentHomeId()?.let { homeId ->
                            onOpenPropertyDetails?.invoke(homeId) ?: openPlaceholder("property_details")
                        }
                    },
                    onOpenSettings =
                        onOpenSettings?.let { handler ->
                            {
                                viewModel.currentHomeId()?.let { homeId -> handler(homeId) }
                            }
                        },
                    onSecurityAction = ::handleSecurityAction,
                )
            is HomeDashboardUiState.Error ->
                ErrorLayout(message = current.message, onBack = onBack, onRetry = viewModel::refresh)
        }
    }
}

@Composable
fun HomeDashboardScreenContent(
    state: HomeDashboardUiState,
    selectedTab: String = "overview",
    onSelectTab: (String) -> Unit = {},
    onBack: () -> Unit = {},
    onQuickAction: (String) -> Unit = {},
    onFabAction: (String) -> Unit = {},
    onClaim: () -> Unit = {},
    onViewClaims: () -> Unit = {},
    onOpenPropertyDetails: () -> Unit = {},
    onRetry: () -> Unit = {},
) {
    when (state) {
        HomeDashboardUiState.Loading -> LoadingLayout(onBack = onBack)
        is HomeDashboardUiState.Loaded ->
            DashboardLayout(
                content = state.content,
                brandNew = null,
                selectedTab = selectedTab,
                onSelectTab = onSelectTab,
                onBack = onBack,
                onQuickAction = onQuickAction,
                onFabAction = onFabAction,
                onClaim = onClaim,
                onViewClaims = onViewClaims,
                onOpenPropertyDetails = onOpenPropertyDetails,
            )
        is HomeDashboardUiState.Empty ->
            DashboardLayout(
                content = state.brandNew.content,
                brandNew = state.brandNew,
                selectedTab = selectedTab,
                onSelectTab = onSelectTab,
                onBack = onBack,
                onQuickAction = onQuickAction,
                onFabAction = onFabAction,
                onClaim = onClaim,
                onViewClaims = onViewClaims,
                onOpenPropertyDetails = onOpenPropertyDetails,
            )
        is HomeDashboardUiState.NeedsAttention ->
            DashboardLayout(
                content = state.content,
                brandNew = null,
                selectedTab = selectedTab,
                onSelectTab = onSelectTab,
                onBack = onBack,
                onQuickAction = onQuickAction,
                onFabAction = onFabAction,
                onClaim = onClaim,
                onViewClaims = onViewClaims,
                onOpenPropertyDetails = onOpenPropertyDetails,
            )
        is HomeDashboardUiState.Error -> ErrorLayout(message = state.message, onBack = onBack, onRetry = onRetry)
    }
}

@Composable
private fun DashboardLayout(
    content: HomeDashboardContent,
    brandNew: HomeDashboardBrandNewContent?,
    selectedTab: String,
    onSelectTab: (String) -> Unit,
    onBack: () -> Unit,
    onQuickAction: (String) -> Unit,
    onFabAction: (String) -> Unit,
    onClaim: () -> Unit,
    onViewClaims: () -> Unit,
    onOpenPropertyDetails: () -> Unit,
    onOpenSettings: (() -> Unit)? = null,
    /** Security-state banner CTA. No-op in preview/snapshot hosts. */
    onSecurityAction: (HomeSecurityBannerAction) -> Unit = {},
    /** H1 — Home Intelligence stack slot (health ring, seasonal checklist,
     *  property value, bill trends). Empty in preview/snapshot hosts. */
    intelligence: @Composable () -> Unit = {},
) {
    ContentDetailShell(
        title = "Home",
        onBack = onBack,
        topBarAction =
            onOpenSettings?.let {
                ContentDetailTopBarAction(
                    icon = PantopusIcon.SlidersHorizontal,
                    contentDescription = "Home settings",
                    onClick = it,
                )
            },
        cta = {
            // Six one-tap creates, matching RN's `homeFabActions`
            // (`src/app/homes/[id]/index.tsx:154-161`). Every entry
            // routes to a real create surface — no placeholders.
            FabCreateCTA(
                actions =
                    listOf(
                        FabSheetAction("add_task", "Add Task", PantopusIcon.ListChecks),
                        FabSheetAction("track_bill", "Track Bill", PantopusIcon.CreditCard),
                        FabSheetAction("track_package", "Track Package", PantopusIcon.Package),
                        FabSheetAction("add_pet", "Add Pet", PantopusIcon.PawPrint),
                        FabSheetAction("create_poll", "Create Poll", PantopusIcon.BarChart3),
                        FabSheetAction("send_mail", "Send Mail", PantopusIcon.Mail),
                    ),
                onSelect = onFabAction,
            )
        },
        header = {
            HomeHeroHeader(address = content.address, verified = content.verified, stats = content.stats)
        },
        body = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                content.securityBanner?.let { banner ->
                    HomeSecurityStatusBanner(
                        content = banner,
                        onCta = { onSecurityAction(banner.action) },
                    )
                }
                content.attentionSummary?.let { summary ->
                    NeedsAttentionBanner(summary = summary, onJump = onQuickAction)
                }
                if (!content.isVerifiedOwner) {
                    ClaimOwnershipBanner(onClaim = onClaim, onViewClaims = onViewClaims)
                }
                GridTabsBody(
                    quickActions = content.quickActions,
                    tabs = content.tabs,
                    selectedTab = selectedTab,
                    onSelectTab = onSelectTab,
                    onQuickAction = onQuickAction,
                ) {
                    if (brandNew != null) {
                        BrandNewHomeSection(brandNew = brandNew, onStep = onQuickAction)
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                            intelligence()
                            OverviewSection(
                                content = content,
                                onOpenEmergency = { onQuickAction("view_emergency") },
                                onOpenPropertyDetails = onOpenPropertyDetails,
                            )
                        }
                    }
                }
            }
        },
    )
}

/**
 * Home security-state banner — `claim_window` / `review_required` /
 * `disputed` / `frozen`. Rendered at the very top of the dashboard,
 * above the attention / claim banners, mirroring RN's `HomeStatusBanner`
 * (`src/components/HomeStatusBanner.tsx`) which sits directly under the
 * header at `src/app/homes/[id]/index.tsx:211`.
 */
@Composable
private fun HomeSecurityStatusBanner(
    content: HomeSecurityBannerContent,
    onCta: () -> Unit,
) {
    // Severity ramp per state — the same one RN encodes in
    // STATUS_BANNER (`src/constants/ownershipCopy.ts`), in tokens.
    val tint: Color =
        when (content.state) {
            "review_required" -> PantopusColors.primary600
            "frozen" -> PantopusColors.error
            else -> PantopusColors.warning
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, tint.copy(alpha = 0.4f), RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("homeDashboard_securityBanner"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(
                icon = content.icon,
                contentDescription = null,
                size = Radii.xl2,
                tint = tint,
            )
            Text(
                text = content.title,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.Bold,
                color = tint,
            )
        }
        Text(
            text = content.body,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        content.ctaLabel?.let { label ->
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(tint.copy(alpha = 0.12f))
                        .clickable(onClick = onCta)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("homeDashboard_securityBannerCTA"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = tint,
                )
            }
        }
    }
}

@Composable
private fun NeedsAttentionBanner(
    summary: HomeDashboardAttentionSummary,
    onJump: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("homeDashboard_attentionBanner"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.Top) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.warningBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.AlertTriangle,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.warning,
                )
            }
            Text(
                text = summary.message,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            summary.chips.forEach { chip ->
                Row(
                    modifier =
                        Modifier
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.warningBg)
                            .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.pill))
                            .clickable { onJump(chip.actionId) }
                            .padding(horizontal = Spacing.s3)
                            .testTag("homeDashboard_attentionChip_${chip.id}")
                            .semantics {
                                role = Role.Button
                                contentDescription = chip.label
                            },
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = chip.icon,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.warning,
                    )
                    Text(
                        text = chip.label,
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.warning,
                    )
                }
            }
        }
    }
}

@Composable
private fun ClaimOwnershipBanner(
    onClaim: () -> Unit,
    onViewClaims: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    1.dp,
                    PantopusColors.primary600.copy(alpha = 0.4f),
                    RoundedCornerShape(Radii.lg),
                )
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Are you the owner?",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
        }
        Text(
            text = "Claim this home to unlock private features for owners.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onClaim)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("homeDashboard_claimCTA"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Claim ownership",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable(onClick = onViewClaims)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("homeDashboard_viewClaimsCTA"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "View claims",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun BrandNewHomeSection(
    brandNew: HomeDashboardBrandNewContent,
    onStep: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        DashboardCard(title = "Welcome home", accent = PantopusColors.home) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.Top) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.PartyPopper,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.home,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1), modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Welcome home",
                        style = PantopusTextStyle.h3,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "Set up the essentials for this verified address.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            brandNew.onboardingSteps.forEachIndexed { index, step ->
                OnboardingStepRow(step = step) { onStep(step.actionId) }
                if (index != brandNew.onboardingSteps.lastIndex) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                }
            }
        }
        EmergencyInfoRow(info = brandNew.content.overview.emergency) { onStep("view_emergency") }
    }
}

@Composable
private fun OnboardingStepRow(
    step: HomeDashboardOnboardingStep,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(step.tone.backgroundColor),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = step.icon,
                contentDescription = null,
                size = 18.dp,
                tint = step.tone.color,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = step.title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = step.body,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.md))
                    .clickable(onClick = onClick)
                    .padding(horizontal = Spacing.s3)
                    .testTag("homeDashboard_onboarding_${step.id}")
                    .semantics {
                        role = Role.Button
                        contentDescription = step.title
                    },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = step.cta,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun OverviewSection(
    content: HomeDashboardContent,
    onOpenEmergency: () -> Unit,
    onOpenPropertyDetails: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        DashboardCard(title = "Upcoming", action = "See all", accent = PantopusColors.warning) {
            if (content.overview.upcoming.isEmpty()) {
                OverviewEmptyRow("Nothing due today. You're all clear.")
            }
            content.overview.upcoming.forEachIndexed { index, item ->
                TimelineRow(item)
                if (index != content.overview.upcoming.lastIndex) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                }
            }
        }
        DashboardCard(title = "Recent activity", action = "See all") {
            if (content.overview.activity.isEmpty()) {
                OverviewEmptyRow("No household activity yet.")
            }
            content.overview.activity.forEachIndexed { index, item ->
                ActivityRow(item)
                if (index != content.overview.activity.lastIndex) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                }
            }
        }
        EmergencyInfoRow(info = content.overview.emergency, onOpen = onOpenEmergency)
        PropertyDetailsRow(onClick = onOpenPropertyDetails)
    }
}

/** Shared card chrome for the Overview + Home Intelligence sections. */
@Composable
internal fun DashboardCard(
    title: String,
    action: String? = null,
    accent: Color? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
                accent?.let {
                    Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(Radii.pill)).background(it))
                }
                Text(
                    text = title.uppercase(),
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextSecondary,
                )
            }
            action?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
        Column(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1), content = content)
        Spacer(Modifier.height(Spacing.s2))
    }
}

@Composable
private fun OverviewEmptyRow(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
    )
}

@Composable
private fun TimelineRow(item: HomeDashboardTimelineItem) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(item.tone.backgroundColor),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = item.icon, contentDescription = null, size = Radii.xl, tint = item.tone.color)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = item.title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = item.subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        item.trailing?.let {
            Text(
                text = it,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun ActivityRow(item: HomeDashboardActivityItem) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(item.tone.backgroundColor),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = item.initials,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = item.tone.color,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = item.title,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "${item.detail} - ${item.time}",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun EmergencyInfoRow(
    info: HomeDashboardEmergencyInfo,
    onOpen: () -> Unit,
) {
    DashboardCard(
        title = info.title,
        accent = if (info.isConfigured) PantopusColors.error else PantopusColors.appTextMuted,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clickable(onClick = onOpen)
                    .testTag("homeDashboard_emergencyInfoRow")
                    .semantics {
                        role = Role.Button
                        contentDescription = info.body
                    },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (info.isConfigured) PantopusColors.errorBg else PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Siren,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = if (info.isConfigured) PantopusColors.error else PantopusColors.appTextMuted,
                )
            }
            Text(
                text = info.body,
                style = PantopusTextStyle.caption,
                color = if (info.isConfigured) PantopusColors.appTextStrong else PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun PropertyDetailsRow(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s4)
                .semantics(
                    mergeDescendants = true,
                ) {
                    role = Role.Button
                    contentDescription = "Property details. County records, beds, baths and verification"
                }
                .testTag("homeDashboard_propertyDetailsRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = PantopusIcon.Home, contentDescription = null, size = Radii.xl2, tint = PantopusColors.home)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Property details",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "County records, beds, baths & verification",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun LoadingLayout(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Home",
        onBack = onBack,
        header = {
            Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4)) {
                Shimmer(width = 328.dp, height = 180.dp, cornerRadius = Radii.xl2)
            }
        },
        body = {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 328.dp, height = 80.dp, cornerRadius = Radii.md)
                Shimmer(width = 200.dp, height = 40.dp, cornerRadius = Radii.sm)
                Shimmer(width = 328.dp, height = 120.dp, cornerRadius = Radii.lg)
            }
        },
    )
}

@Composable
private fun ErrorLayout(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Home",
        onBack = onBack,
        header = { Spacer(Modifier.height(Spacing.s2)) },
        body = {
            Box(modifier = Modifier.fillMaxWidth().height(400.dp)) {
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load this home",
                    subcopy = message,
                    ctaTitle = "Try again",
                    onCta = onRetry,
                )
            }
        },
    )
}
