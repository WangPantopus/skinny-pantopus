@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.audience_profile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

@Composable
fun AudienceProfileScreen(
    onBack: () -> Unit = {},
    onOpenFollower: (FollowerRowContent) -> Unit = {},
    onOpenThread: (ThreadRowContent) -> Unit = {},
    onOpenBroadcast: (UpdateCardContent, List<TierBreakdownContent.TierSegment>) -> Unit = { _, _ -> },
    onOpenSetup: () -> Unit = {},
    onOpenCreatorInbox: () -> Unit = {},
    onComposeBroadcast: (String) -> Unit = {},
    onOpenEditPersona: () -> Unit = {},
    onOpenBeacons: () -> Unit = {},
    onOpenFollowing: () -> Unit = {},
    onOpenMembers: () -> Unit = {},
    viewModel: AudienceProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeTab by viewModel.activeTab.collectAsStateWithLifecycle()
    val composer by viewModel.composer.collectAsStateWithLifecycle()
    val selectedTier by viewModel.selectedTierRank.collectAsStateWithLifecycle()
    val followerSearch by viewModel.followerSearchText.collectAsStateWithLifecycle()
    val followerSort by viewModel.followerSort.collectAsStateWithLifecycle()
    val activeThreadFilter by viewModel.activeThreadFilter.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    val displayName =
        (state as? AudienceProfileUiState.Loaded)?.content?.header?.displayName ?: "Public Profile"

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("audienceProfile"),
    ) {
        TopBar(title = displayName, onBack = onBack, onEditPersona = onOpenEditPersona)
        when (val current = state) {
            is AudienceProfileUiState.Loading -> LoadingFrame()
            is AudienceProfileUiState.Empty ->
                EmptyFrame(
                    message = current.message,
                    onSetup = onOpenSetup,
                    onTellPeople = { onComposeBroadcast(viewModel.composePersonaId ?: "") },
                )
            is AudienceProfileUiState.Error ->
                ErrorFrame(message = current.message, onRetry = viewModel::load)
            is AudienceProfileUiState.Loaded -> {
                Box(modifier = Modifier.weight(1f)) {
                    LoadedFrame(
                        state =
                            AudienceProfileLoadedFrameState(
                                loaded = current.content,
                                activeTab = activeTab,
                                composer = composer,
                                selectedTier = selectedTier,
                                followerSearchText = followerSearch,
                                followerSort = followerSort,
                                visibleFollowers = viewModel.visibleFollowers(),
                                activeThreadFilter = activeThreadFilter,
                                visibleThreads = viewModel.visibleThreads(),
                            ),
                        actions =
                            AudienceProfileLoadedFrameActions(
                                onSelectTab = viewModel::selectTab,
                                onSelectTier = viewModel::selectTierFilter,
                                onFollowerSearch = viewModel::onFollowerSearchText,
                                onFollowerSort = viewModel::selectFollowerSort,
                                onSelectThreadFilter = viewModel::selectThreadFilter,
                                composer =
                                    AudienceProfileComposerActions(
                                        onText = viewModel::onComposerText,
                                        onVisibility = viewModel::onComposerVisibility,
                                        onTier = viewModel::onComposerTier,
                                        onSubmit = viewModel::submitUpdate,
                                        onOpenFullComposer = { onComposeBroadcast(viewModel.composePersonaId ?: "") },
                                    ),
                                navigation =
                                    AudienceProfileNavigationActions(
                                        onOpenFollower = onOpenFollower,
                                        onOpenThread = onOpenThread,
                                        onOpenBroadcast = onOpenBroadcast,
                                        onOpenCreatorInbox = onOpenCreatorInbox,
                                        onOpenMembers = onOpenMembers,
                                    ),
                            ),
                    )
                }
                BeaconsFooter(onOpenBeacons = onOpenBeacons)
                FollowingFooter(onOpenFollowing = onOpenFollowing)
                // The "You're a member of <persona>, <tier> tier" footer is
                // gone: it rendered `MembershipSampleData.audienceFooter`,
                // a fixture persona ("Lara Chen · Silver"), to every viewer
                // of their own beacon hub. `/api/personas/me` carries no
                // viewer-membership payload, so there is nothing real to
                // put here — see the report for the endpoint gap.
            }
        }
    }
}

/**
 * A03.2 — entry into the Beacon Updates feed (broadcasts from beacons the
 * user follows). Mirrors [FollowingFooter]'s row recipe.
 */
@Composable
private fun BeaconsFooter(onOpenBeacons: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .clickable { onOpenBeacons() }
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .heightIn(min = 48.dp)
                .testTag("audienceProfileBeaconsEntry")
                .semantics {
                    contentDescription = "Beacon Updates. Broadcasts from beacons you follow. Open."
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Rss,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2.3f,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = "Beacon Updates",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Broadcasts from beacons you follow",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "Open",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
    }
}

/**
 * §1A① — entry into "Following" (the list of Beacons the user follows).
 * Mirrors [BeaconsFooter]'s row recipe.
 */
@Composable
private fun FollowingFooter(onOpenFollowing: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .clickable { onOpenFollowing() }
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .heightIn(min = 48.dp)
                .testTag("audienceProfileFollowingEntry")
                .semantics {
                    contentDescription = "Following. Beacons you follow. Open."
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Users,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2.3f,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = "Following",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Beacons you follow",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "Open",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
    }
}

@Composable
private fun TopBar(
    title: String,
    onBack: () -> Unit,
    onEditPersona: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("audienceProfileBackButton"),
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
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onEditPersona)
                        .testTag("audienceProfileEditPersonaButton")
                        .semantics { contentDescription = "Edit persona" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Pencil,
                    contentDescription = null,
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
                .testTag("audienceProfileLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 360.dp, height = 90.dp, cornerRadius = Radii.xl)
        Shimmer(width = 360.dp, height = 44.dp, cornerRadius = 22.dp)
        repeat(3) { Shimmer(width = 360.dp, height = 88.dp, cornerRadius = 14.dp) }
    }
}

@Composable
internal fun EmptyFrame(
    message: String,
    onSetup: () -> Unit,
    onTellPeople: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("audienceProfileEmpty"),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary50)
                        .border(1.dp, PantopusColors.primary100, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.RadioTower,
                    contentDescription = null,
                    size = 30.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.primary600,
                )
            }
            Text(
                text = "Your audience starts here",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = message,
                fontSize = 13.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            PrimaryButton(
                title = "Set up payments",
                onClick = onSetup,
                modifier = Modifier.fillMaxWidth().testTag("audienceProfileSetupButton"),
            )
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.md))
                        .clickable(onClick = onTellPeople)
                        .testTag("audienceProfileTellPeopleButton")
                        .semantics { contentDescription = "Tell people you're here" },
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Share,
                    contentDescription = null,
                    size = 15.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.primary700,
                )
                Spacer(modifier = Modifier.width(Spacing.s2))
                Text(
                    text = "Tell people you're here",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
            }
        }
        OnboardingCard()
    }
}

@Composable
private fun OnboardingCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("audienceProfileOnboardingCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(text = "Start in three steps", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        OnboardingStep(number = 1, title = "Set up payments", subtitle = "Turn on tiers so supporters can join.")
        OnboardingStep(number = 2, title = "Tell people you're here", subtitle = "Share your profile with neighbors and customers.")
        OnboardingStep(number = 3, title = "Send your first broadcast", subtitle = "Post one useful update people can react to.")
    }
}

@Composable
private fun OnboardingStep(
    number: Int,
    title: String,
    subtitle: String,
) {
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "$number", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary700)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = subtitle, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary, maxLines = 2)
        }
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("audienceProfileError"),
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
            text = "Couldn't load Public Profile",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
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
            modifier = Modifier.testTag("audienceProfileRetry"),
        )
    }
}

@Composable
internal fun LoadedFrame(
    state: AudienceProfileLoadedFrameState,
    actions: AudienceProfileLoadedFrameActions,
) {
    Column(
        modifier = Modifier.fillMaxSize().testTag("audienceProfileContent"),
    ) {
        HeaderCard(state.loaded.header)
        TabStrip(activeTab = state.activeTab, onSelect = actions.onSelectTab)
        when (state.activeTab) {
            AudienceProfileTab.Updates ->
                UpdatesTab(
                    header = state.loaded.header,
                    breakdown = state.loaded.tierBreakdown,
                    followers = state.loaded.followers,
                    updates = state.loaded.updates,
                    composer = state.composer,
                    channelId = state.loaded.channelId,
                    composerActions = actions.composer,
                    onOpenBroadcast = { card ->
                        actions.navigation.onOpenBroadcast(card, state.loaded.tierBreakdown.segments)
                    },
                )
            AudienceProfileTab.Followers ->
                FollowersTab(
                    state =
                        FollowersTabState(
                            cells = state.loaded.analyticsCells,
                            breakdown = state.loaded.tierBreakdown,
                            chips = state.loaded.tierChips,
                            selectedTier = state.selectedTier,
                            searchText = state.followerSearchText,
                            activeSort = state.followerSort,
                            followers = state.visibleFollowers,
                        ),
                    actions =
                        FollowersTabActions(
                            onSelectTier = actions.onSelectTier,
                            onFollowerSearch = actions.onFollowerSearch,
                            onFollowerSort = actions.onFollowerSort,
                            onOpenFollower = actions.navigation.onOpenFollower,
                            onOpenMembers = actions.navigation.onOpenMembers,
                        ),
                )
            AudienceProfileTab.Threads ->
                ThreadsTab(
                    threads = state.loaded.threads,
                    visibleThreads = state.visibleThreads,
                    chips = state.loaded.threadsFilterChips,
                    activeFilter = state.activeThreadFilter,
                    onSelectFilter = actions.onSelectThreadFilter,
                    onOpenThread = actions.navigation.onOpenThread,
                    onOpenCreatorInbox = actions.navigation.onOpenCreatorInbox,
                )
        }
    }
}

internal data class AudienceProfileLoadedFrameState(
    val loaded: AudienceProfileLoaded,
    val activeTab: AudienceProfileTab,
    val composer: UpdateComposerState,
    val selectedTier: Int?,
    val followerSearchText: String = "",
    val followerSort: FollowerSort = FollowerSort.NewestActive,
    val visibleFollowers: List<FollowerRowContent> = emptyList(),
    val activeThreadFilter: ThreadsFilter = ThreadsFilter.All,
    val visibleThreads: List<ThreadRowContent> = emptyList(),
)

internal data class AudienceProfileLoadedFrameActions(
    val onSelectTab: (AudienceProfileTab) -> Unit,
    val onSelectTier: (Int?) -> Unit,
    val onFollowerSearch: (String) -> Unit,
    val onFollowerSort: (FollowerSort) -> Unit,
    val onSelectThreadFilter: (ThreadsFilter) -> Unit = {},
    val composer: AudienceProfileComposerActions,
    val navigation: AudienceProfileNavigationActions,
)

internal data class AudienceProfileComposerActions(
    val onText: (String) -> Unit,
    val onVisibility: (UpdateVisibility) -> Unit,
    val onTier: (Int?) -> Unit,
    val onSubmit: () -> Unit,
    val onOpenFullComposer: () -> Unit = {},
)

internal data class AudienceProfileNavigationActions(
    val onOpenFollower: (FollowerRowContent) -> Unit,
    val onOpenThread: (ThreadRowContent) -> Unit,
    val onOpenBroadcast: (UpdateCardContent, List<TierBreakdownContent.TierSegment>) -> Unit = { _, _ -> },
    val onOpenCreatorInbox: () -> Unit = {},
    val onOpenMembers: () -> Unit = {},
)

@Composable
private fun HeaderCard(header: AudienceHeaderContent) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(38.dp)
                .background(PantopusColors.appSurfaceMuted)
                .padding(horizontal = Spacing.s4)
                .testTag("audienceProfileHeader"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.RadioTower,
            contentDescription = null,
            size = 15.dp,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "${formatCount(header.followerCount)} followers",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextStrong,
        )
        if (header.newThisWeek > 0) {
            Text(
                text = "+${header.newThisWeek} this week",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.success,
            )
        } else {
            Text(
                text = "Invite to grow",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(text = "View", fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.lg,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
    }
}

@Composable
private fun TabStrip(
    activeTab: AudienceProfileTab,
    onSelect: (AudienceProfileTab) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AudienceProfileTab.values().forEach { tab ->
                val isActive = activeTab == tab
                Column(
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clickable { onSelect(tab) }
                            .testTag("audienceProfileTab_${tab.key}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = tab.title,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isActive) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = 10.dp, bottom = Spacing.s2),
                    )
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (isActive) PantopusColors.primary600 else Color.Transparent),
                    )
                }
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// MARK: - Updates tab

@Composable
private fun UpdatesTab(
    header: AudienceHeaderContent,
    breakdown: TierBreakdownContent,
    followers: List<FollowerRowContent>,
    updates: List<UpdateCardContent>,
    composer: UpdateComposerState,
    channelId: String?,
    composerActions: AudienceProfileComposerActions,
    onOpenBroadcast: (UpdateCardContent) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("audienceProfileUpdatesList"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        FollowerStackCard(header = header, breakdown = breakdown, followers = followers)
        ComposerCard(
            composer = composer,
            channelId = channelId,
            onText = composerActions.onText,
            onVisibility = composerActions.onVisibility,
            onTier = composerActions.onTier,
            onSubmit = composerActions.onSubmit,
            onOpenFullComposer = composerActions.onOpenFullComposer,
        )
        SectionHeader(title = "Recent broadcasts", action = if (updates.isEmpty()) null else "See all")
        if (updates.isEmpty()) {
            EmptyUpdatesCard(onCompose = composerActions.onOpenFullComposer)
        } else {
            updates.forEach { card ->
                UpdateCard(card = card, onOpen = { onOpenBroadcast(card) })
            }
        }
        Spacer(modifier = Modifier.height(Spacing.s6))
    }
}

@Composable
private fun FollowerStackCard(
    header: AudienceHeaderContent,
    breakdown: TierBreakdownContent,
    followers: List<FollowerRowContent>,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(14.dp)
                .testTag("audienceProfileFollowerStack")
                .semantics {
                    contentDescription =
                        "Follower stack, ${header.followerCount} followers, ${header.newThisWeek} new in the past 7 days"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(
                text = "FOLLOWER STACK",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextSecondary,
                letterSpacing = 0.8.sp,
            )
            FollowerAvatarStack(followers = followers)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                breakdown.segments.take(3).forEach { segment ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(tierColor(segment.rank)))
                        Text(
                            text = "${segment.name} ${segment.count}",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                text = formatCount(header.followerCount),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = if (header.newThisWeek > 0) "+${header.newThisWeek} / 7 days" else "Past 7 days",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (header.newThisWeek > 0) PantopusColors.success else PantopusColors.appTextSecondary,
            )
            Sparkline(points = growthSamples(header), modifier = Modifier.width(88.dp).height(28.dp))
        }
    }
}

@Composable
private fun FollowerAvatarStack(followers: List<FollowerRowContent>) {
    val visible = followers.take(4)
    val width =
        when {
            visible.isEmpty() -> 36.dp
            followers.size > 4 -> (36 + visible.size * 28).dp
            else -> (36 + (visible.size - 1) * 28).dp
        }
    Box(modifier = Modifier.width(width).height(38.dp)) {
        visible.forEachIndexed { index, follower ->
            Box(
                modifier =
                    Modifier
                        .offset(x = (index * 28).dp)
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(tierColor(follower.tierRank))
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = follower.displayName.take(1).uppercase(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
        if (followers.size > 4) {
            Box(
                modifier =
                    Modifier
                        .offset(x = (visible.size * 28).dp)
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "+${followers.size - 4}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun Sparkline(
    points: List<Float>,
    modifier: Modifier = Modifier,
) {
    Canvas(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.primary50.copy(alpha = 0.55f)),
    ) {
        if (points.size < 2) return@Canvas
        val minValue = points.minOrNull() ?: 0f
        val maxValue = points.maxOrNull() ?: 1f
        val range = (maxValue - minValue).takeIf { it > 0f } ?: 1f
        val path = Path()
        points.forEachIndexed { index, value ->
            val x = size.width * index / (points.size - 1).toFloat()
            val normalized = (value - minValue) / range
            val y = size.height - normalized * size.height
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path = path, color = PantopusColors.primary600, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round))
    }
}

@Composable
private fun SectionHeader(
    title: String,
    action: String?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 2.dp).testTag("audienceProfileBroadcastsHeader"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.8.sp,
            modifier = Modifier.weight(1f),
        )
        action?.let {
            Text(text = it, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Radii.lg,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
    }
}

/**
 * Entry to the canonical full-screen Compose Broadcast surface. The
 * quick-post composer beneath it stays for one-tap text updates.
 */
@Composable
private fun FullComposerEntry(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50.copy(alpha = 0.5f))
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(10.dp)
                .testTag("audienceProfileComposeBroadcast")
                .semantics { contentDescription = "Compose a broadcast" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Megaphone,
                contentDescription = null,
                size = Radii.xl,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = "Compose a broadcast", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                text = "Full editor · media · audience · scheduling",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun ComposerCard(
    composer: UpdateComposerState,
    channelId: String?,
    onText: (String) -> Unit,
    onVisibility: (UpdateVisibility) -> Unit,
    onTier: (Int?) -> Unit,
    onSubmit: () -> Unit,
    onOpenFullComposer: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .padding(14.dp)
                .testTag("audienceProfileComposer"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        FullComposerEntry(onClick = onOpenFullComposer)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "POSTING AS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextSecondary,
                letterSpacing = 0.6.sp,
            )
            Spacer(modifier = Modifier.weight(1f))
            VisibilityPicker(visibility = composer.visibility, onVisibility = onVisibility, onTier = onTier)
        }
        OutlinedTextField(
            value = composer.text,
            onValueChange = onText,
            placeholder = {
                Text(
                    text = "Share an update with your followers",
                    fontSize = 14.sp,
                    color = PantopusColors.appTextMuted,
                )
            },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("audienceProfileComposerInput"),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                ),
        )
        composer.error?.let {
            Text(text = it, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.error)
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            val canSubmit = composer.canSubmit && channelId != null
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (canSubmit) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                        .clickable(enabled = canSubmit) { onSubmit() }
                        .padding(horizontal = Spacing.s4)
                        .height(38.dp)
                        .testTag("audienceProfileComposerSubmit"),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (composer.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = PantopusColors.appTextInverse,
                            strokeWidth = 2.dp,
                        )
                    }
                    Text(
                        text = "Post update",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun VisibilityPicker(
    visibility: UpdateVisibility,
    onVisibility: (UpdateVisibility) -> Unit,
    onTier: (Int?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary50)
                    .clickable { expanded = true }
                    .padding(horizontal = 10.dp, vertical = 5.dp)
                    .testTag("audienceProfileVisibilityPicker"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "Visible to ${visibility.title}",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary700,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = Radii.lg,
                strokeWidth = 2f,
                tint = PantopusColors.primary700,
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            UpdateVisibility.values().forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.title) },
                    onClick = {
                        onVisibility(option)
                        if (option != UpdateVisibility.TierOrAbove) onTier(null)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun EmptyUpdatesCard(onCompose: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s5, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.RadioTower,
                contentDescription = null,
                size = 22.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Text(
            text = "No broadcasts yet",
            fontSize = 14.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Share an update with your audience so it appears in their Pulse and inbox.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .height(38.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onCompose)
                    .padding(horizontal = 14.dp)
                    .testTag("audienceProfileEmptyBroadcastCompose"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Pencil,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.3f,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Compose broadcast",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun UpdateCard(
    card: UpdateCardContent,
    onOpen: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onOpen)
                .padding(Spacing.s3)
                .testTag("updateCard_${card.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(text = card.timeAgo, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            Text(text = "·", fontSize = 11.sp, color = PantopusColors.appTextMuted)
            VisibilityChip(card)
            Spacer(modifier = Modifier.weight(1f))
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
        Text(text = card.body, fontSize = 13.5.sp, color = PantopusColors.appText, maxLines = 3)
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            MetricLabel(icon = PantopusIcon.RadioTower, value = compactCount(card.deliveredCount))
            MetricLabel(icon = PantopusIcon.Eye, value = compactCount(card.readCount))
            MetricLabel(icon = PantopusIcon.Heart, value = "${(card.readCount / 26).coerceAtLeast(0)}")
            Spacer(modifier = Modifier.weight(1f))
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun VisibilityChip(card: UpdateCardContent) {
    val foreground = visibilityForeground(card)
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(visibilityBackground(card))
                .padding(horizontal = 7.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = visibilityIcon(card),
            contentDescription = null,
            size = 9.dp,
            strokeWidth = 2.3f,
            tint = foreground,
        )
        Text(
            text = visibilityTitle(card),
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
        )
    }
}

@Composable
private fun MetricLabel(
    icon: PantopusIcon,
    value: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Radii.lg,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = value,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Followers tab

private data class FollowersTabState(
    val cells: List<AnalyticsCellContent>,
    val breakdown: TierBreakdownContent,
    val chips: List<TierChipContent>,
    val selectedTier: Int?,
    val searchText: String,
    val activeSort: FollowerSort,
    val followers: List<FollowerRowContent>,
)

private data class FollowersTabActions(
    val onSelectTier: (Int?) -> Unit,
    val onFollowerSearch: (String) -> Unit,
    val onFollowerSort: (FollowerSort) -> Unit,
    val onOpenFollower: (FollowerRowContent) -> Unit,
    val onOpenMembers: () -> Unit,
)

/** A22.2 entry point — pushes the "Your audience" member-management surface
 *  (pending requests + tier-grouped members). */
@Composable
private fun ManageAudienceRow(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("audienceProfileOpenMembers"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UsersRound,
            contentDescription = null,
            size = 20.dp,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Your audience",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Approve requests · manage members",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun FollowersTab(
    state: FollowersTabState,
    actions: FollowersTabActions,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("audienceProfileFollowersList"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        AnalyticsRow(state.cells)
        ManageAudienceRow(onClick = actions.onOpenMembers)
        TierStackedBar(state.breakdown)
        TierChipRow(chips = state.chips, selectedTier = state.selectedTier, onSelect = actions.onSelectTier)
        FollowerSearchField(text = state.searchText, onChange = actions.onFollowerSearch)
        FollowerSortChipRow(active = state.activeSort, onSelect = actions.onFollowerSort)
        if (state.followers.isEmpty()) {
            if (state.searchText.trim().isNotEmpty()) {
                EmptyFollowerSearchCard()
            } else {
                EmptyFollowersCard()
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                state.followers.forEach { follower -> FollowerRow(follower, onOpen = { actions.onOpenFollower(follower) }) }
            }
        }
        Spacer(modifier = Modifier.height(Spacing.s6))
    }
}

@Composable
private fun FollowerSearchField(
    text: String,
    onChange: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3)
                .height(40.dp)
                .testTag("followerSearchField"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 15.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Box(modifier = Modifier.weight(1f)) {
            if (text.isEmpty()) {
                Text(
                    text = "Search followers by name or handle",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextMuted,
                )
            }
            BasicTextField(
                value = text,
                onValueChange = onChange,
                textStyle =
                    TextStyle(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appText,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(),
                singleLine = true,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics { contentDescription = "Search followers by name or handle" }
                        .testTag("followerSearchInput"),
            )
        }
        if (text.isNotEmpty()) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .clickable { onChange("") }
                        .testTag("followerSearchClear"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Clear search",
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun FollowerSortChipRow(
    active: FollowerSort,
    onSelect: (FollowerSort) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .testTag("followerSortChipRow")
                .semantics { contentDescription = "Sort followers" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FollowerSort.entries.forEach { sort ->
            val isActive = sort == active
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (isActive) PantopusColors.primary600 else PantopusColors.appSurface,
                        )
                        .border(
                            width = 1.dp,
                            color = if (isActive) PantopusColors.primary600 else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onSelect(sort) }
                        .padding(horizontal = Spacing.s3)
                        .heightIn(min = 28.dp)
                        .wrapContentSize(Alignment.Center)
                        .testTag("followerSortChip_${sort.key}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (isActive) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 11.dp,
                        strokeWidth = 2.6f,
                        tint = PantopusColors.appTextInverse,
                    )
                }
                Text(
                    text = sort.title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color =
                        if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun EmptyFollowerSearchCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5)
                .testTag("followerSearchEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No followers match that search",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Try a different name or handle.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun AnalyticsRow(cells: List<AnalyticsCellContent>) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        cells.forEach { cell ->
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))
                        .padding(10.dp)
                        .testTag("analyticsCell_${cell.id}"),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = cell.label.uppercase(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextSecondary,
                    letterSpacing = 0.6.sp,
                )
                Text(
                    text = cell.value,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                cell.trend?.let {
                    Text(text = it, fontSize = 10.sp, color = PantopusColors.success)
                }
            }
        }
    }
}

@Composable
private fun TierStackedBar(breakdown: TierBreakdownContent) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("tierStackedBar"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = "Audience by tier",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(14.dp)) {
            val totalWidth = maxWidth
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                breakdown.segments.forEach { seg ->
                    val w =
                        if (breakdown.total > 0) {
                            totalWidth * (seg.count.toFloat() / breakdown.total.toFloat())
                        } else {
                            0.dp
                        }
                    val displayed =
                        if (seg.count > 0 && w < 4.dp) 4.dp else w
                    Box(
                        modifier =
                            Modifier
                                .width(displayed)
                                .height(14.dp)
                                .background(tierColor(seg.rank)),
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            breakdown.segments.forEach { seg ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Box(
                        modifier =
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(tierColor(seg.rank)),
                    )
                    Text(
                        text = "${seg.name} · ${seg.count}",
                        fontSize = 10.5.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun TierChipRow(
    chips: List<TierChipContent>,
    selectedTier: Int?,
    onSelect: (Int?) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        chips.forEach { chip ->
            val isActive = selectedTier == chip.rank
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(
                            1.dp,
                            if (isActive) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onSelect(chip.rank) }
                        .padding(horizontal = 10.dp)
                        .height(28.dp)
                        .wrapContentSize(Alignment.Center)
                        .testTag("tierChip_${chip.id}"),
            ) {
                Text(
                    text = "${chip.label} · ${chip.count}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun FollowerRow(
    row: FollowerRowContent,
    onOpen: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onOpen)
                .padding(Spacing.s3)
                .testTag("followerRow_${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = row.displayName.take(1).uppercase(),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = row.displayName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                if (row.verifiedLocal) {
                    PantopusIconImage(
                        icon = PantopusIcon.ShieldCheck,
                        contentDescription = "Verified neighbor",
                        size = Radii.lg,
                        strokeWidth = 2f,
                        tint = PantopusColors.success,
                    )
                }
            }
            Text(text = row.handle, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = row.tierName,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = tierColor(row.tierRank),
            )
            row.tenureLabel?.let {
                Text(text = it, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun EmptyFollowersCard() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.User,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No followers in this tier yet",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Share your Public Profile to start building your audience.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Threads tab

@Composable
private fun ThreadsTab(
    threads: List<ThreadRowContent>,
    visibleThreads: List<ThreadRowContent>,
    chips: List<ThreadsFilterChipContent>,
    activeFilter: ThreadsFilter,
    onSelectFilter: (ThreadsFilter) -> Unit,
    onOpenThread: (ThreadRowContent) -> Unit,
    onOpenCreatorInbox: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("audienceProfileThreadsList"),
    ) {
        ThreadsFilterStrip(chips = chips, activeFilter = activeFilter, onSelect = onSelectFilter)
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (threads.isEmpty()) {
                EmptyThreadsCard()
            } else if (visibleThreads.isEmpty()) {
                FilteredEmptyThreadsCard()
            } else {
                ViewAllMessagesCTA(onClick = onOpenCreatorInbox)
                visibleThreads.forEach { ThreadRow(it, onOpen = { onOpenThread(it) }) }
            }
            Spacer(modifier = Modifier.height(Spacing.s6))
        }
    }
}

@Composable
private fun ThreadsFilterStrip(
    chips: List<ThreadsFilterChipContent>,
    activeFilter: ThreadsFilter,
    onSelect: (ThreadsFilter) -> Unit,
) {
    val scroll = rememberScrollState()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("audienceProfileThreadsFilterStrip"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(scroll)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            chips.forEach { chip ->
                ThreadsFilterChip(chip = chip, isActive = chip.filter == activeFilter, onSelect = onSelect)
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
private fun ThreadsFilterChip(
    chip: ThreadsFilterChipContent,
    isActive: Boolean,
    onSelect: (ThreadsFilter) -> Unit,
) {
    val bg = if (isActive) PantopusColors.primary600 else PantopusColors.appSurface
    val border = if (isActive) PantopusColors.primary600 else PantopusColors.appBorder
    val fg = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong
    val description = chip.count?.let { "${chip.label}, $it" } ?: chip.label
    Row(
        modifier =
            Modifier
                .heightIn(min = 28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.pill))
                .clickable { onSelect(chip.filter) }
                .padding(horizontal = 11.dp, vertical = 5.dp)
                .testTag("threadsFilterChip_${chip.id}")
                .semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text(
            text = chip.label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = fg,
        )
        chip.count?.let { count ->
            Text(
                text = "$count",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = fg.copy(alpha = 0.85f),
            )
        }
    }
}

@Composable
private fun FilteredEmptyThreadsCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5)
                .testTag("audienceProfileThreadsFilteredEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Inbox,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No threads in this view",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = "Try another filter to see the rest of your inbox.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ViewAllMessagesCTA(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .heightIn(min = 44.dp)
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("audienceProfileViewAllMessages")
                .semantics { contentDescription = "View all messages in Creator Inbox" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Inbox,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "View all messages",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.lg,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
    }
}

@Composable
private fun ThreadRow(
    row: ThreadRowContent,
    onOpen: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onOpen)
                .padding(Spacing.s3)
                .testTag("threadRow_${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.size(40.dp), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = row.displayName.take(1).uppercase(),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
            }
            if (row.unreadCount > 0) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.error)
                            .padding(horizontal = Spacing.s1)
                            .widthIn(min = 16.dp)
                            .height(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "${row.unreadCount}",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = row.displayName,
                    fontSize = 14.sp,
                    fontWeight = if (row.unreadCount > 0) FontWeight.Bold else FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                row.tierName?.let {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.primary50)
                                .padding(horizontal = 5.dp, vertical = 1.dp),
                    ) {
                        Text(
                            text = it,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.primary700,
                        )
                    }
                }
            }
            Text(
                text = row.preview,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
            )
        }
        Text(text = row.timeAgo, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun EmptyThreadsCard() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Inbox,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No threads yet",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Tier 2+ followers can open a thread with you.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

internal fun tierColor(rank: Int): Color =
    when (rank) {
        1 -> PantopusColors.primary600
        2 -> PantopusColors.success
        3 -> PantopusColors.warning
        4 -> PantopusColors.business
        else -> PantopusColors.appTextSecondary
    }

private fun tierBgColor(rank: Int): Color =
    when (rank) {
        1 -> PantopusColors.primary50
        2 -> PantopusColors.successBg
        3 -> PantopusColors.warningBg
        4 -> PantopusColors.businessBg
        else -> PantopusColors.appSurfaceSunken
    }

private fun visibilityTitle(card: UpdateCardContent): String =
    when (card.visibility) {
        UpdateVisibility.Public -> "All beacons"
        UpdateVisibility.Followers -> "Followers"
        UpdateVisibility.TierOrAbove ->
            when (card.targetTierRank) {
                2 -> "Bronze+"
                3 -> "Silver+"
                4 -> "Gold+"
                else -> card.visibilityLabel
            }
    }

private fun visibilityIcon(card: UpdateCardContent): PantopusIcon =
    when (card.visibility) {
        UpdateVisibility.Public -> PantopusIcon.Globe
        UpdateVisibility.Followers -> PantopusIcon.Users
        UpdateVisibility.TierOrAbove -> PantopusIcon.Lock
    }

private fun visibilityForeground(card: UpdateCardContent): Color =
    when (card.visibility) {
        UpdateVisibility.Public -> PantopusColors.primary700
        UpdateVisibility.Followers -> PantopusColors.appTextStrong
        UpdateVisibility.TierOrAbove -> tierColor(card.targetTierRank ?: 2)
    }

private fun visibilityBackground(card: UpdateCardContent): Color =
    when (card.visibility) {
        UpdateVisibility.Public -> PantopusColors.primary50
        UpdateVisibility.Followers -> PantopusColors.appSurfaceSunken
        UpdateVisibility.TierOrAbove -> tierBgColor(card.targetTierRank ?: 2)
    }

private fun growthSamples(header: AudienceHeaderContent): List<Float> {
    val current = header.followerCount.coerceAtLeast(0)
    val gain = header.newThisWeek.coerceAtLeast(0)
    val start = (current - gain).coerceAtLeast(0)
    if (gain == 0) return List(7) { current.toFloat() }
    return List(7) { index ->
        (start + ((gain.toDouble() * index.toDouble()) / 6.0).toInt()).toFloat()
    }
}

private fun formatCount(value: Int): String = "%,d".format(Locale.US, value)

private fun compactCount(value: Int): String =
    if (value >= 1_000) {
        val oneDecimal = value / 1_000.0
        if (oneDecimal >= 10) {
            "%.0fK".format(Locale.US, oneDecimal)
        } else {
            "%.1fK".format(Locale.US, oneDecimal)
        }
    } else {
        "$value"
    }
