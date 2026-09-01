@file:Suppress("LongMethod", "MagicNumber", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BeaconIdentity
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.profile.tabs.ProfileGigReviewsSection
import app.pantopus.android.ui.screens.profile.tabs.ProfileGigsSection
import app.pantopus.android.ui.screens.profile.tabs.ProfilePortfolioSection
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileTab
import app.pantopus.android.ui.screens.shared.content_detail.bodies.StatsTabsBody
import app.pantopus.android.ui.screens.transaction_reviews.ReceivedTransactionReviewsSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * Public profile detail screen. ViewModel reads the user id via the
 * nav-backstack [androidx.lifecycle.SavedStateHandle].
 *
 * P6.5 — The view-model picks the profile kind (Persona vs Local) from
 * the loaded DTO. The screen swaps banner color, header chips, sticky
 * footer CTAs (Follow vs Message + Connect), and post styling
 * accordingly.
 *
 * `onOpenMessages` is invoked with the loaded `PublicProfileDto` so the
 * host nav stack can construct a chat-conversation destination with the
 * profile's user as counterparty. The Report flow is presented as a
 * [ReportUserSheet] hosted locally here, not via the nav graph (per P6.2).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicProfileScreen(
    onBack: () -> Unit,
    onOpenMessages: (app.pantopus.android.data.api.models.profile.PublicProfileDto) -> Unit = {},
    onOpenHandshake: (String, Int?) -> Unit = { _, _ -> },
    onOpenInsights: () -> Unit = {},
    onEditPersona: () -> Unit = {},
    onComposeBroadcast: () -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    viewModel: PublicProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val selectedLocalTab by viewModel.selectedLocalTab.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val showOverflow by viewModel.showOverflow.collectAsStateWithLifecycle()
    val connectState by viewModel.connectState.collectAsStateWithLifecycle()
    val connection by viewModel.connection.collectAsStateWithLifecycle()
    val showDisconnectConfirm by viewModel.showDisconnectConfirm.collectAsStateWithLifecycle()
    val showHandshake by viewModel.showFollowHandshake.collectAsStateWithLifecycle()
    val handshakeTier by viewModel.handshakePreselectedTierRank.collectAsStateWithLifecycle()
    val isFollowing by viewModel.isFollowing.collectAsStateWithLifecycle()
    val isFollowInFlight by viewModel.isFollowInFlight.collectAsStateWithLifecycle()
    val canFollow by viewModel.canFollow.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState()
    val reportSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showReportSheet by remember { mutableStateOf(false) }

    LaunchedEffect(showHandshake) {
        if (showHandshake) {
            val handle = viewModel.loadedPersonaHandle()
            if (handle.isNotBlank()) {
                onOpenHandshake(handle, handshakeTier)
                viewModel.setShowFollowHandshake(false)
                viewModel.clearHandshakeTier()
            }
        }
    }
    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("publicProfile"),
    ) {
        when (val s = state) {
            PublicProfileUiState.Loading -> LoadingLayout(onBack = onBack)
            is PublicProfileUiState.Error -> ErrorLayout(message = s.message, onRetry = { viewModel.refresh() }, onBack = onBack)
            is PublicProfileUiState.Loaded -> {
                val content = s.content
                val neighbor = content.neighbor
                if (content.kind == PublicProfileKind.Local && neighbor != null) {
                    LocalProfileLoadedFrame(
                        content = content,
                        neighbor = neighbor,
                        selectedTab = selectedLocalTab,
                        connectState = connectState,
                        onBack = onBack,
                        onSelectTab = { viewModel.selectLocalTab(it) },
                        onMessage = { onOpenMessages(content.profile) },
                        onConnect = { viewModel.connect() },
                        onOverflow = { viewModel.setShowOverflow(true) },
                        follow =
                            ProfileFollowState(
                                canFollow = canFollow,
                                isFollowing = isFollowing,
                                isInFlight = isFollowInFlight,
                            ),
                        connection = connection,
                        onFollow = { viewModel.follow() },
                        onOpenGig = onOpenGig,
                        onOpenProfile = onOpenProfile,
                    )
                } else {
                    PublicProfileLoadedFrame(
                        content = content,
                        selectedTab = selectedTab,
                        connectState = connectState,
                        onBack = onBack,
                        onSelectTab = { viewModel.selectTab(it) },
                        follow =
                            ProfileFollowState(
                                canFollow = canFollow,
                                isFollowing = isFollowing,
                                isInFlight = isFollowInFlight,
                            ),
                        connection = connection,
                        onFollow = { viewModel.follow() },
                        onMessage = { onOpenMessages(content.profile) },
                        onConnect = { viewModel.connect() },
                        onOverflow = { viewModel.setShowOverflow(true) },
                        onUnlock = { post -> viewModel.unlockBroadcast(post.targetTierRank) },
                        onOpenInsights = onOpenInsights,
                        onEditPersona = onEditPersona,
                        onComposeBroadcast = onComposeBroadcast,
                        profileUserId = content.profile.id,
                        onOpenGig = onOpenGig,
                        onOpenProfile = onOpenProfile,
                        receivedReviews = {
                            ReceivedTransactionReviewsSection(userId = content.profile.id)
                        },
                    )
                }
            }
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
        if (showOverflow) {
            ModalBottomSheet(
                onDismissRequest = { viewModel.setShowOverflow(false) },
                sheetState = sheetState,
            ) {
                OverflowSheetContent(
                    onBlock = {
                        viewModel.setShowOverflow(false)
                        viewModel.block()
                    },
                    onReport = {
                        viewModel.setShowOverflow(false)
                        showReportSheet = true
                    },
                    onCancel = { viewModel.setShowOverflow(false) },
                )
            }
        }
        if (showReportSheet) {
            val loaded = state as? PublicProfileUiState.Loaded
            if (loaded != null) {
                ReportUserSheet(
                    userId = loaded.content.profile.id,
                    handle = loaded.content.header.handle,
                    displayName = loaded.content.header.displayName,
                    sheetState = reportSheetState,
                    onDismiss = { showReportSheet = false },
                    onSubmitted = {
                        showReportSheet = false
                        viewModel.showToast("Report received")
                    },
                )
            }
        }
        // Tapping "Connected" removes the edge, and RN gates the same
        // `DELETE api/relationships/:id` behind a "Disconnect · Remove this
        // connection?" alert (`src/app/connections.tsx:69-77`), so confirm
        // first. Mirrors iOS `PublicProfileView`'s disconnect dialog.
        if (showDisconnectConfirm) {
            val name = (state as? PublicProfileUiState.Loaded)?.content?.header?.displayName?.trim().orEmpty()
            AlertDialog(
                onDismissRequest = { viewModel.cancelDisconnect() },
                title = { Text(if (name.isEmpty()) "Disconnect" else "Disconnect from $name") },
                text = { Text("Remove this connection?") },
                confirmButton = {
                    TextButton(
                        onClick = { viewModel.disconnect() },
                        modifier = Modifier.testTag("publicProfileDisconnectConfirm"),
                    ) {
                        Text("Remove", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { viewModel.cancelDisconnect() },
                        modifier = Modifier.testTag("publicProfileDisconnectCancel"),
                    ) {
                        Text("Cancel")
                    }
                },
            )
        }
    }
}

/**
 * T3 — render state for the plain Follow / Following control. A Beacon
 * (persona with a resolvable handle) still hands the tap to the privacy
 * handshake wizard, which owns its own in-flight pose; everyone else
 * toggles `api/users/:id/follow` and uses [isInFlight].
 */
internal data class ProfileFollowState(
    val canFollow: Boolean = false,
    val isFollowing: Boolean = false,
    val isInFlight: Boolean = false,
)

/**
 * P6.5 — Kind-aware loaded frame, exposed as `internal` so Paparazzi
 * snapshot tests can render the populated view without spinning up a
 * Hilt VM.
 *
 * [connection] drives the local profile's Connect → Requested → Accept →
 * Connected label ([connectState] only greys the control while a call is
 * in flight) and [follow] drives the Follow → Following flip; iOS
 * `PublicProfileView.identityActions` renders exactly the same pair.
 */
@Composable
internal fun PublicProfileLoadedFrame(
    content: PublicProfileContent,
    selectedTab: ProfileTab,
    connectState: PublicProfileActionState,
    onBack: () -> Unit,
    onSelectTab: (ProfileTab) -> Unit,
    onFollow: () -> Unit,
    onMessage: () -> Unit,
    onConnect: () -> Unit,
    onOverflow: () -> Unit,
    onUnlock: (PublicProfilePost) -> Unit,
    follow: ProfileFollowState = ProfileFollowState(),
    connection: ProfileConnection = ProfileConnection.None,
    onOpenInsights: () -> Unit = {},
    onEditPersona: () -> Unit = {},
    onComposeBroadcast: () -> Unit = {},
    // Threading the profile id lights up the live Reviews / Gigs /
    // Portfolio panels, which self-load through `hiltViewModel()`. It
    // stays null for the Paparazzi hosts (same escape hatch as
    // [receivedReviews]) — they render without a Hilt graph.
    profileUserId: String? = null,
    onOpenGig: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    receivedReviews: @Composable () -> Unit = {},
) {
    val persona = content.kind == PublicProfileKind.Persona
    ContentDetailShell(
        title = null,
        onBack = onBack,
        topBarAction =
            ContentDetailTopBarAction(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = "More",
                onClick = onOverflow,
            ),
        header = {
            // Box stacks the 120dp banner with the identity block pulled
            // down to overlap the banner's lower 40dp (banner − overlap).
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag(if (persona) "publicProfilePersonaHeader" else "publicProfileLocalHeader"),
            ) {
                PublicProfileBanner(kind = content.kind)
                Box(modifier = Modifier.padding(top = 80.dp)) {
                    BeaconIdentityBlock(
                        identity = if (persona) BeaconIdentity.Personal else BeaconIdentity.Home,
                        name = content.header.displayName,
                        handle = content.header.handle,
                        tierLabel = content.header.tierLabel,
                        isVerifiedNeighbor = content.header.isVerifiedNeighbor,
                        locality = content.header.locality,
                        bio = content.stats.bio,
                        isVerified = content.header.isVerified,
                        avatarUrl = content.header.avatarUrl,
                        stats = content.stats.stats,
                    ) {
                        if (persona) {
                            if (content.isOwner) {
                                BeaconHeaderGhostButton(
                                    icon = PantopusIcon.BarChart3,
                                    actionLabel = "Insights",
                                    onClick = onOpenInsights,
                                )
                                BeaconHeaderGhostButton(
                                    title = "Edit",
                                    icon = PantopusIcon.Pencil,
                                    actionLabel = "Edit Persona",
                                    onClick = onEditPersona,
                                )
                            } else {
                                BeaconHeaderGhostButton(
                                    icon = PantopusIcon.Share,
                                    actionLabel = "Share profile",
                                    onClick = onOverflow,
                                )
                                if (follow.isFollowing) {
                                    BeaconHeaderGhostButton(
                                        icon = PantopusIcon.Check,
                                        actionLabel = "Following. Tap to unfollow",
                                        onClick = onFollow,
                                        title = "Following",
                                    )
                                } else {
                                    BeaconHeaderPrimaryButton(
                                        title = "Follow",
                                        icon = PantopusIcon.Plus,
                                        onClick = onFollow,
                                    )
                                }
                            }
                        } else {
                            ConnectHeaderButton(
                                connection = connection,
                                connectState = connectState,
                                canFollow = follow.canFollow,
                                onConnect = onConnect,
                            )
                            BeaconHeaderPrimaryButton(
                                title = "Message",
                                icon = PantopusIcon.MessageSquare,
                                onClick = onMessage,
                            )
                        }
                    }
                }
            }
        },
        body = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                StatsTabsBody(
                    content = content.stats,
                    selectedTab = selectedTab,
                    onSelectTab = onSelectTab,
                    showStats = false,
                    showActionRow = false,
                    profileUserId = profileUserId,
                    isOwnProfile = content.isOwner,
                    onMessage = onMessage,
                    onConnect = onConnect,
                    onOverflow = onOverflow,
                    onOpenGig = onOpenGig,
                    onOpenReviewer = onOpenProfile,
                )
                receivedReviews()
                PublicProfilePostsFeed(
                    kind = content.kind,
                    posts = content.posts,
                    onUnlock = onUnlock,
                    onEmptyCta =
                        when {
                            !persona -> onMessage
                            content.isOwner -> onComposeBroadcast
                            else -> onFollow
                        },
                )
            }
        },
    )
}

/**
 * A21.2 — the designed Local Beacon profile archetype: green Home banner,
 * overlapping [BeaconIdentityBlock] with Connect + Message, a Posts ·
 * About tab strip, and the local post feed (or the "Quiet for now" empty
 * state) beneath it. `internal` so Paparazzi can render it without Hilt.
 *
 * Mirrors iOS `PublicProfileView.localLayout`.
 */
@Composable
internal fun LocalProfileLoadedFrame(
    content: PublicProfileContent,
    neighbor: NeighborProfileContent,
    selectedTab: LocalProfileTab,
    connectState: PublicProfileActionState,
    onBack: () -> Unit,
    onSelectTab: (LocalProfileTab) -> Unit,
    onMessage: () -> Unit,
    onConnect: () -> Unit,
    onOverflow: () -> Unit,
    follow: ProfileFollowState = ProfileFollowState(),
    connection: ProfileConnection = ProfileConnection.None,
    onFollow: () -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
) {
    ContentDetailShell(
        title = null,
        onBack = onBack,
        topBarAction =
            ContentDetailTopBarAction(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = "More",
                onClick = onOverflow,
            ),
        header = {
            // Box stacks the 120dp banner with the identity block pulled
            // down to overlap the banner's lower 40dp (banner − overlap).
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("publicProfileLocalHeader"),
            ) {
                PublicProfileBanner(kind = PublicProfileKind.Local)
                Box(modifier = Modifier.padding(top = 80.dp)) {
                    BeaconIdentityBlock(
                        identity = BeaconIdentity.Home,
                        name = content.header.displayName,
                        handle = content.header.handle,
                        tierLabel = null,
                        isVerifiedNeighbor = content.header.isVerifiedNeighbor,
                        locality = content.header.locality,
                        bio = content.stats.bio,
                        isVerified = content.header.isVerified,
                        avatarUrl = content.header.avatarUrl,
                        stats = content.stats.stats,
                    ) {
                        ConnectHeaderButton(
                            connection = connection,
                            connectState = connectState,
                            canFollow = follow.canFollow,
                            onConnect = onConnect,
                        )
                        BeaconHeaderPrimaryButton(
                            title = "Message",
                            icon = PantopusIcon.MessageSquare,
                            onClick = onMessage,
                        )
                    }
                }
            }
        },
        body = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                ProfileFollowRow(
                    follow = follow,
                    onFollow = onFollow,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
                Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                    LocalProfileTabStrip(
                        postCount = content.posts.size.takeIf { it > 0 },
                        selected = selectedTab,
                        onSelect = onSelectTab,
                        reviewCount = content.profile.reviewCount?.takeIf { it > 0 },
                    )
                }
                when (selectedTab) {
                    LocalProfileTab.Posts ->
                        PublicProfilePostsFeed(
                            kind = PublicProfileKind.Local,
                            posts = content.posts,
                            onUnlock = {},
                            onEmptyCta = onMessage,
                            localName = content.header.displayName,
                        )
                    LocalProfileTab.About ->
                        Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                            LocalProfileAboutSection(content = neighbor)
                        }
                    LocalProfileTab.Portfolio ->
                        Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                            ProfilePortfolioSection(
                                userId = content.profile.id,
                                isOwnProfile = content.isOwner,
                            )
                        }
                    LocalProfileTab.Gigs ->
                        Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                            ProfileGigsSection(userId = content.profile.id, onOpenGig = onOpenGig)
                        }
                    LocalProfileTab.Reviews ->
                        Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                            ProfileGigReviewsSection(
                                userId = content.profile.id,
                                onOpenReviewer = onOpenProfile,
                            )
                        }
                }
            }
        },
    )
}

/**
 * The relationship-driven Connect header action.
 *
 * The label, the glyph and whether the tap does anything all come from the
 * edge `GET api/users/:id/relationship` reported: Connect → Requested →
 * Accept → Connected. An outstanding request renders inert (RN's
 * `disabled={actionLoading || connectionState === 'pending_sent'}`). The
 * control disappears altogether on your own profile, for a signed-out
 * viewer, and once the viewer has blocked this neighbour — RN drops the
 * whole action row in those cases (`src/app/user/[id].tsx:391-398,523`).
 * Mirrors iOS `PublicProfileView.identityActions`.
 */
@Composable
private fun ConnectHeaderButton(
    connection: ProfileConnection,
    connectState: PublicProfileActionState,
    canFollow: Boolean,
    onConnect: () -> Unit,
) {
    if (!canFollow || connection == ProfileConnection.Blocked) return
    Box(modifier = Modifier.testTag("publicProfileConnectCta")) {
        BeaconHeaderGhostButton(
            icon =
                when (connection) {
                    ProfileConnection.Connected -> PantopusIcon.Check
                    ProfileConnection.PendingSent -> PantopusIcon.Clock
                    else -> PantopusIcon.UserPlus
                },
            actionLabel = connection.accessibilityLabel,
            onClick = onConnect,
            title = connection.label,
            enabled = connection.isActionable && connectState !is PublicProfileActionState.InFlight,
        )
    }
}

/**
 * T3 — plain Follow / Following for an ordinary neighbour.
 *
 * The A21.2 Local header is spec'd at exactly two buttons (Connect +
 * Message — `beacon-primitives.jsx:268-272`), so the follow control lives
 * directly beneath the identity block, the same slot RN puts its action
 * row in (`src/app/user/[id].tsx:522-569`). Hidden on your own profile and
 * when signed out. Mirrors iOS `PublicProfileView.followRow`.
 */
@Composable
private fun ProfileFollowRow(
    follow: ProfileFollowState,
    onFollow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (follow.canFollow) {
        Box(modifier = modifier.testTag("publicProfileFollowButton")) {
            if (follow.isFollowing) {
                GhostButton(
                    title = "Following",
                    onClick = onFollow,
                    isLoading = follow.isInFlight,
                    isEnabled = !follow.isInFlight,
                )
            } else {
                PrimaryButton(
                    title = "Follow",
                    onClick = onFollow,
                    isLoading = follow.isInFlight,
                    isEnabled = !follow.isInFlight,
                )
            }
        }
    }
}

@Composable
private fun OverflowSheetContent(
    onBlock: () -> Unit,
    onReport: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        OverflowSheetRow(label = "Block this user", destructive = true, onClick = onBlock)
        OverflowSheetRow(label = "Report", onClick = onReport)
        OverflowSheetRow(label = "Cancel", onClick = onCancel)
    }
}

@Composable
private fun OverflowSheetRow(
    label: String,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.body,
            color = if (destructive) PantopusColors.error else PantopusColors.appText,
        )
    }
}

@Composable
internal fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Shimmer(width = 72.dp, height = 72.dp, cornerRadius = 36.dp)
            Shimmer(width = 160.dp, height = 22.dp, cornerRadius = Radii.sm)
            Shimmer(width = 220.dp, height = 12.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 80.dp, cornerRadius = Radii.lg)
            Shimmer(width = 320.dp, height = 42.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
internal fun ErrorLayout(
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit,
) {
    // Mirror iOS: the error layout keeps a back chevron so a load failure
    // is escapable from in-screen chrome (LoadingLayout already does this).
    Column(modifier = Modifier.fillMaxSize()) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load this profile",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}
