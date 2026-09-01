@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "TopLevelPropertyNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.hub

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.hub.sections.HubActionStrip
import app.pantopus.android.ui.screens.hub.sections.HubDiscoveryRail
import app.pantopus.android.ui.screens.hub.sections.HubFirstRunHero
import app.pantopus.android.ui.screens.hub.sections.HubFloatingProgress
import app.pantopus.android.ui.screens.hub.sections.HubJumpBackIn
import app.pantopus.android.ui.screens.hub.sections.HubNeighborDensitySection
import app.pantopus.android.ui.screens.hub.sections.HubPillarGrid
import app.pantopus.android.ui.screens.hub.sections.HubRecentActivity
import app.pantopus.android.ui.screens.hub.sections.HubSetupBanner
import app.pantopus.android.ui.screens.hub.sections.HubSkeleton
import app.pantopus.android.ui.screens.hub.sections.HubStatusStrip
import app.pantopus.android.ui.screens.hub.sections.HubTodayCard
import app.pantopus.android.ui.screens.hub.sections.HubTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the hub scroll container. */
const val HUB_SCREEN_TAG = "hubScreen"

/** Designed Hub screen. */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun HubScreen(
    onIntent: (HubNavigationIntent) -> Unit = {},
    viewModel: HubViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val discoveryFilter by viewModel.discoveryFilter.collectAsStateWithLifecycle()
    val discoveryLoading by viewModel.discoveryLoading.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.load()
        app.pantopus.android.data.analytics.Analytics.track(
            app.pantopus.android.data.analytics.AnalyticsEvent.ScreenHubViewed,
        )
    }

    val pullState =
        rememberPullRefreshState(
            refreshing = state is HubUiState.Skeleton,
            onRefresh = viewModel::refresh,
        )

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .pullRefresh(pullState)
                .testTag(HUB_SCREEN_TAG),
    ) {
        when (val current = state) {
            HubUiState.Skeleton -> HubSkeleton()
            is HubUiState.FirstRun ->
                FirstRunLayout(
                    content = current.content,
                    onIntent = onIntent,
                    discoveryFilter = discoveryFilter,
                    discoveryLoading = discoveryLoading,
                    onDiscoveryFilterChange = viewModel::selectDiscoveryFilter,
                )
            is HubUiState.Populated ->
                PopulatedLayout(
                    content = current.content,
                    onIntent = onIntent,
                    onDismissBanner = viewModel::dismissSetupBanner,
                    onDismissStatusItem = viewModel::dismissStatusItem,
                    onDismissMilestone = viewModel::dismissDensityMilestone,
                    discoveryFilter = discoveryFilter,
                    discoveryLoading = discoveryLoading,
                    onDiscoveryFilterChange = viewModel::selectDiscoveryFilter,
                )
            is HubUiState.Error -> ErrorLayout(current.message, viewModel::refresh)
        }
        PullRefreshIndicator(
            refreshing = state is HubUiState.Skeleton,
            state = pullState,
            modifier = Modifier.align(Alignment.TopCenter),
            contentColor = PantopusColors.primary600,
        )
    }
}

@Composable
private fun PopulatedLayout(
    content: PopulatedContent,
    onIntent: (HubNavigationIntent) -> Unit,
    onDismissBanner: () -> Unit,
    onDismissStatusItem: (String) -> Unit,
    onDismissMilestone: () -> Unit,
    discoveryFilter: HubDiscoveryFilter,
    discoveryLoading: Boolean,
    onDiscoveryFilterChange: (HubDiscoveryFilter) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        item(key = "topBar") {
            HubTopBar(
                content = content.topBar,
                onAvatarTap = { onIntent(HubNavigationIntent.OpenProfile) },
                onBellTap = { onIntent(HubNavigationIntent.OpenNotifications) },
                onMenuTap = { onIntent(HubNavigationIntent.OpenMenu) },
                onAudienceTap =
                    if (content.topBar.audienceUnreadCount > 0) {
                        { onIntent(HubNavigationIntent.OpenAudienceNotifications) }
                    } else {
                        null
                    },
            )
        }
        item(key = "actionStrip") {
            HubActionStrip(chips = content.actionChips) { onIntent(HubNavigationIntent.ActionTapped(it)) }
        }
        content.neighborDensity?.let { density ->
            item(key = "neighborDensity") {
                HubNeighborDensitySection(content = density, onDismissMilestone = onDismissMilestone)
            }
        }
        // Rendered unconditionally: the empty set is the design's
        // "All caught up" pill, not a hidden section (RN
        // `HubActionStrip.tsx:33-38`).
        item(key = "statusStrip") {
            HubStatusStrip(
                items = content.statusItems,
                onTap = { onIntent(HubNavigationIntent.StatusItemTapped(it)) },
                onDismiss = onDismissStatusItem,
            )
        }
        content.setupBanner?.let { banner ->
            item(key = "setupBanner") {
                HubSetupBanner(
                    content = banner,
                    onStart = { onIntent(HubNavigationIntent.StartVerification) },
                    onDismiss = onDismissBanner,
                )
            }
        }
        content.today?.let {
            item(key = "today") {
                HubTodayCard(it, onTap = { onIntent(HubNavigationIntent.OpenToday) })
            }
        }
        item(key = "pillars") {
            HubPillarGrid(content.pillars) { onIntent(HubNavigationIntent.PillarTapped(it)) }
        }
        item(key = "discovery") {
            HubDiscoveryRail(
                items = content.discovery,
                onTap = { onIntent(HubNavigationIntent.DiscoveryTapped(it)) },
                activeFilter = discoveryFilter,
                onFilterChange = onDiscoveryFilterChange,
                isLoading = discoveryLoading,
                onSeeAll = { onIntent(HubNavigationIntent.OpenDiscoverHub) },
                onExploreMap = { onIntent(HubNavigationIntent.OpenExploreMap) },
                onFindBusinesses = { onIntent(HubNavigationIntent.OpenFindBusinesses) },
            )
        }
        if (content.jumpBackIn.isNotEmpty()) {
            item(key = "jumpBackIn") {
                HubJumpBackIn(content.jumpBackIn) { onIntent(HubNavigationIntent.JumpBackTapped(it)) }
            }
        }
        if (content.activity.isNotEmpty()) {
            item(key = "activity") {
                HubRecentActivity(
                    entries = content.activity,
                    onSeeAll = { onIntent(HubNavigationIntent.OpenRecentActivity) },
                )
            }
        }
        item(key = "footer-spacer") { Spacer(Modifier.height(Spacing.s10)) }
    }
}

@Composable
private fun FirstRunLayout(
    content: FirstRunContent,
    onIntent: (HubNavigationIntent) -> Unit,
    discoveryFilter: HubDiscoveryFilter,
    discoveryLoading: Boolean,
    onDiscoveryFilterChange: (HubDiscoveryFilter) -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            HubTopBar(
                content =
                    TopBarContent(
                        greeting = content.greeting,
                        name = content.name,
                        avatarInitials = content.avatarInitials,
                        identity = content.identity,
                        ringProgress = content.ringProgress,
                        unreadCount = 0,
                    ),
                onAvatarTap = { onIntent(HubNavigationIntent.OpenProfile) },
                onBellTap = {},
                onMenuTap = {},
            )
            HubFirstRunHero(content = content) { onIntent(HubNavigationIntent.StartVerification) }
            HubPillarGrid(content.pillars) { onIntent(HubNavigationIntent.PillarTapped(it)) }
            HubDiscoveryRail(
                items = content.discovery,
                onTap = { onIntent(HubNavigationIntent.DiscoveryTapped(it)) },
                activeFilter = discoveryFilter,
                onFilterChange = onDiscoveryFilterChange,
                isLoading = discoveryLoading,
                onSeeAll = { onIntent(HubNavigationIntent.OpenDiscoverHub) },
                onExploreMap = { onIntent(HubNavigationIntent.OpenExploreMap) },
                onFindBusinesses = { onIntent(HubNavigationIntent.OpenFindBusinesses) },
            )
            // Bottom padding leaves room for the floating progress card.
            Spacer(Modifier.height(96.dp))
        }
        Box(
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s6),
        ) {
            HubFloatingProgress(
                fraction = content.profileCompleteness,
                stepsDone = content.stepsDone,
                stepsTotal = content.stepsTotal,
                onContinue = { onIntent(HubNavigationIntent.StartVerification) },
            )
        }
    }
}

@Composable
private fun ErrorLayout(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s6),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Couldn't load your hub",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
        )
        Spacer(Modifier.height(Spacing.s2))
        Text(
            message,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.s4))
        PrimaryButton(title = "Try again", onClick = onRetry)
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 1400)
@Composable
private fun HubScreenSkeletonPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg)) { HubSkeleton() }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 1400)
@Composable
private fun HubScreenFirstRunPreview() {
    FirstRunLayout(
        content =
            FirstRunContent(
                greeting = "Good morning",
                name = "Alice",
                avatarInitials = "A",
                identity = app.pantopus.android.ui.components.IdentityPillar.Personal,
                ringProgress = 0.2f,
                profileCompleteness = 0.25f,
                stepsDone = 1,
                stepsTotal = 4,
                steps =
                    listOf(
                        SetupStep("name", "Set your name", done = true),
                        SetupStep("address", "Claim your home", done = false),
                    ),
                pillars = sampleContent().pillars.map { it.copy(chip = "Set up", chipSetupState = true) },
                discovery = sampleContent().discovery,
            ),
        onIntent = {},
        discoveryFilter = HubDiscoveryFilter.Gigs,
        discoveryLoading = false,
        onDiscoveryFilterChange = {},
    )
}

@Preview(showBackground = true, widthDp = 360, heightDp = 1800)
@Composable
private fun HubScreenPopulatedPreview() {
    PopulatedLayout(
        content = sampleContent(),
        onIntent = {},
        onDismissBanner = {},
        onDismissStatusItem = {},
        onDismissMilestone = {},
        discoveryFilter = HubDiscoveryFilter.Gigs,
        discoveryLoading = false,
        onDiscoveryFilterChange = {},
    )
}

private fun sampleContent(): PopulatedContent =
    PopulatedContent(
        topBar =
            TopBarContent(
                greeting = "Good afternoon",
                name = "Alice",
                avatarInitials = "A",
                ringProgress = 0.8f,
                unreadCount = 2,
            ),
        actionChips =
            listOf(
                ActionChipContent(ActionChipContent.Kind.PostTask, "Post task", PantopusIcon.PlusCircle, active = true),
                ActionChipContent(ActionChipContent.Kind.SnapAndSell, "Snap & sell", PantopusIcon.Camera, active = false),
                ActionChipContent(ActionChipContent.Kind.ScanMail, "Scan mail", PantopusIcon.ScanLine, active = false),
                ActionChipContent(ActionChipContent.Kind.AddHome, "Add home", PantopusIcon.Home, active = false),
            ),
        setupBanner = SetupBannerContent(),
        today = TodaySummary(temperatureFahrenheit = 72, conditions = "Clear", aqiLabel = "Good"),
        pillars =
            listOf(
                PillarTile(
                    PillarTile.Pillar.Pulse,
                    "Pulse",
                    PantopusIcon.Megaphone,
                    app.pantopus.android.ui.components.IdentityPillar.Personal,
                    "3",
                    false,
                ),
                PillarTile(
                    PillarTile.Pillar.Marketplace,
                    "Marketplace",
                    PantopusIcon.ShoppingBag,
                    app.pantopus.android.ui.components.IdentityPillar.Business,
                    "Set up",
                    true,
                ),
                PillarTile(
                    PillarTile.Pillar.Gigs,
                    "Gigs",
                    PantopusIcon.Hammer,
                    app.pantopus.android.ui.components.IdentityPillar.Personal,
                    "5",
                    false,
                ),
                PillarTile(
                    PillarTile.Pillar.Mail,
                    "Mail",
                    PantopusIcon.Mailbox,
                    app.pantopus.android.ui.components.IdentityPillar.Home,
                    "1",
                    false,
                ),
            ),
        discovery =
            listOf(
                DiscoveryCardContent(
                    "g1",
                    "Mow front lawn",
                    "\$40 · 0.3mi",
                    "Yardwork",
                    "AB",
                    DiscoveryKind.Gig,
                ),
                DiscoveryCardContent(
                    "g2",
                    "Pick up grocery",
                    "\$15 · 0.6mi",
                    "Errands",
                    "CD",
                    DiscoveryKind.Gig,
                ),
            ),
        jumpBackIn =
            listOf(
                JumpBackItem("j1", "Finish profile", PantopusIcon.User, route = "/app/me"),
            ),
        activity =
            listOf(
                ActivityEntry(
                    id = "a1",
                    title = "Neighbor accepted your gig",
                    timeAgo = "1h ago",
                    icon = PantopusIcon.Bell,
                    tint = app.pantopus.android.ui.components.IdentityPillar.Personal,
                ),
            ),
    )
