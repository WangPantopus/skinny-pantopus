@file:Suppress("LongMethod", "PackageNaming", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.beacon_profile

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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BeaconIdentity
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.profile.BeaconHeaderGhostButton
import app.pantopus.android.ui.screens.profile.BeaconHeaderPrimaryButton
import app.pantopus.android.ui.screens.profile.BeaconIdentityBlock
import app.pantopus.android.ui.screens.profile.PublicProfileBanner
import app.pantopus.android.ui.screens.profile.PublicProfileKind
import app.pantopus.android.ui.screens.profile.PublicProfilePostsFeed
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * A21.1 — the public Beacon profile, driven by the persona backend. One
 * screen, two roles: owner ("My Beacon") and visitor (`{handle}`). The VM
 * picks the role from the presence of a `handle` nav arg. Reuses the
 * shared `PublicProfileChrome` primitives, adds the tab strip, the owner
 * analytics + composer affordances, and the visitor follow handshake.
 */
@Composable
fun BeaconProfileScreen(
    onBack: () -> Unit,
    onEditPersona: (String) -> Unit = {},
    onComposeBroadcast: (String) -> Unit = {},
    onOpenInsights: () -> Unit = {},
    onCreateBeacon: () -> Unit = {},
    onFollowHandshake: (String, Int?) -> Unit = { _, _ -> },
    viewModel: BeaconProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val followStatus by viewModel.followStatus.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val showHandshake by viewModel.showFollowHandshake.collectAsStateWithLifecycle()
    val handshakeTier by viewModel.handshakePreselectedTierRank.collectAsStateWithLifecycle()
    val uriHandler = LocalUriHandler.current
    // Refresh follow status when returning from the handshake route, mirroring
    // iOS's refresh-on-sheet-dismiss so a successful follow reflects on the CTA.
    var awaitingHandshakeReturn by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(showHandshake) {
        val s = state
        if (showHandshake && s is BeaconProfileUiState.Loaded) {
            awaitingHandshakeReturn = true
            onFollowHandshake(s.content.handle, handshakeTier)
            viewModel.setShowFollowHandshake(false)
        }
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (awaitingHandshakeReturn) {
            awaitingHandshakeReturn = false
            viewModel.refresh()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("beaconProfile"),
    ) {
        when (val s = state) {
            BeaconProfileUiState.Loading -> LoadingLayout(onBack)
            is BeaconProfileUiState.Error -> ErrorLayout(s.message, { viewModel.refresh() }, onBack)
            BeaconProfileUiState.Empty ->
                EmptyOwnerLayout(onBack = onBack, onCreateBeacon = onCreateBeacon)
            is BeaconProfileUiState.Loaded ->
                BeaconProfileLoadedFrame(
                    content = s.content,
                    selectedTab = selectedTab,
                    followStatus = followStatus,
                    onBack = onBack,
                    onSelectTab = { viewModel.selectTab(it) },
                    onEditPersona = { onEditPersona(s.content.personaId) },
                    onComposeBroadcast = { onComposeBroadcast(s.content.personaId) },
                    onOpenInsights = onOpenInsights,
                    onFollow = { viewModel.follow() },
                    onUnfollow = { viewModel.unfollow() },
                    onUnlock = { tierRank -> viewModel.unlockBroadcast(tierRank) },
                    // runCatching: openUri throws if no activity can handle the
                    // URI (mirrors iOS UIApplication.open's silent no-op).
                    onOpenLink = { runCatching { uriHandler.openUri(it) } },
                )
        }
        toast?.let { message ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText.copy(alpha = 0.9f))
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(message, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
            }
        }
    }
}

@Composable
internal fun BeaconProfileLoadedFrame(
    content: BeaconProfileContent,
    selectedTab: BeaconProfileTab,
    followStatus: BeaconFollowStatus,
    onBack: () -> Unit,
    onSelectTab: (BeaconProfileTab) -> Unit,
    onEditPersona: () -> Unit,
    onComposeBroadcast: () -> Unit,
    onOpenInsights: () -> Unit,
    onFollow: () -> Unit,
    onUnfollow: () -> Unit,
    onUnlock: (Int?) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    ContentDetailShell(
        title = null,
        onBack = onBack,
        topBarAction =
            if (content.isOwner) {
                ContentDetailTopBarAction(PantopusIcon.SlidersHorizontal, "Edit Beacon") { onEditPersona() }
            } else {
                ContentDetailTopBarAction(PantopusIcon.MoreHorizontal, "More") { onOpenLink(content.shareUrl) }
            },
        header = {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("beaconProfilePersonaHeader"),
            ) {
                PublicProfileBanner(kind = PublicProfileKind.Persona)
                Box(modifier = Modifier.padding(top = 80.dp)) {
                    BeaconIdentityBlock(
                        identity = BeaconIdentity.Personal,
                        name = content.displayName,
                        handle = content.handle.takeIf { it.isNotEmpty() },
                        tierLabel = content.header.tierLabel,
                        isVerifiedNeighbor = false,
                        locality = null,
                        bio = content.bio,
                        isVerified = content.header.isVerified,
                        avatarUrl = content.header.avatarUrl,
                        stats = content.stats,
                    ) {
                        if (content.isOwner) {
                            BeaconHeaderGhostButton(PantopusIcon.BarChart3, "Insights", onOpenInsights)
                            BeaconHeaderGhostButton(PantopusIcon.Pencil, "Edit Beacon", onEditPersona, title = "Edit")
                        } else {
                            BeaconHeaderGhostButton(PantopusIcon.Share, "Share Beacon", { onOpenLink(content.shareUrl) })
                            when (followStatus) {
                                BeaconFollowStatus.None ->
                                    BeaconHeaderPrimaryButton("Follow", PantopusIcon.Plus, onFollow)
                                BeaconFollowStatus.Pending ->
                                    BeaconHeaderPrimaryButton("Requested", PantopusIcon.Check, {}, isProminent = false)
                                BeaconFollowStatus.Active ->
                                    BeaconHeaderPrimaryButton("Following", PantopusIcon.Check, onUnfollow, isProminent = false)
                            }
                        }
                    }
                }
            }
        },
        body = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                if (content.isOwner) {
                    BeaconOwnerAnalyticsStrip(
                        followerStat = content.stats.firstOrNull()?.value ?: "—",
                        onClick = onOpenInsights,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                    )
                    if (content.broadcastEnabled) {
                        BeaconComposeCta(
                            audienceLabel = content.audienceLabel,
                            onClick = onComposeBroadcast,
                            modifier = Modifier.padding(horizontal = Spacing.s4),
                        )
                    }
                }
                BeaconProfileTabStrip(
                    tabs = tabsFor(content),
                    selected = selectedTab,
                    onSelect = onSelectTab,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
                Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                    when (selectedTab) {
                        BeaconProfileTab.Broadcasts ->
                            if (content.posts.isEmpty() && content.isOwner) {
                                BeaconOwnerEmptyBroadcasts(content.broadcastEnabled, onComposeBroadcast)
                            } else {
                                PublicProfilePostsFeed(
                                    kind = PublicProfileKind.Persona,
                                    posts = content.posts,
                                    onUnlock = { post -> onUnlock(post.targetTierRank) },
                                    onEmptyCta = { if (!content.isOwner) onFollow() },
                                )
                            }
                        BeaconProfileTab.About -> BeaconAboutSection(content, onOpenLink)
                        BeaconProfileTab.Tiers -> BeaconTiersSection(content.tiers)
                    }
                }
            }
        },
    )
}

private fun tabsFor(content: BeaconProfileContent): List<BeaconTabItem> {
    val tabs =
        mutableListOf(
            BeaconTabItem(BeaconProfileTab.Broadcasts, "Broadcasts", content.posts.size.takeIf { it > 0 }),
            BeaconTabItem(BeaconProfileTab.About, "About", null),
        )
    if (content.tiers.isNotEmpty()) {
        tabs += BeaconTabItem(BeaconProfileTab.Tiers, "Tiers", content.tiers.size)
    }
    return tabs
}

@Composable
private fun EmptyOwnerLayout(
    onBack: () -> Unit,
    onCreateBeacon: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("beaconProfileEmptyOwner")) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        EmptyState(
            icon = PantopusIcon.Radio,
            headline = "Your signal to the world",
            subcopy =
                "A public page for the people you address one-to-many — " +
                    "followers, students, clients, customers, members.",
            ctaTitle = "Create your Beacon",
            onCta = onCreateBeacon,
            tint = PantopusColors.primary50,
            accent = PantopusColors.primary600,
        )
    }
}

@Composable
private fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().testTag("beaconProfileLoading")) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Shimmer(width = 320.dp, height = 120.dp, cornerRadius = Radii.lg)
            Shimmer(width = 72.dp, height = 72.dp, cornerRadius = 36.dp)
            Shimmer(width = 160.dp, height = 22.dp, cornerRadius = Radii.sm)
            Shimmer(width = 220.dp, height = 12.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 100.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
private fun ErrorLayout(
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("beaconProfileError")) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load this Beacon",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}
