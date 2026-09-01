@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.feed

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.feed.map.FeedMapQuery
import app.pantopus.android.ui.screens.feed.map.FeedMapSection
import app.pantopus.android.ui.screens.feed.map.FeedViewMode
import app.pantopus.android.ui.screens.feed.pulse.PulseFeedUiState
import app.pantopus.android.ui.screens.feed.pulse.PulseFeedViewModel
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCard
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.feed.pulse.PulseSportsEventModule
import app.pantopus.android.ui.screens.feed.pulse.PulseSportsMode
import app.pantopus.android.ui.screens.feed.pulse.PulseSportsStarter
import app.pantopus.android.ui.screens.feed.pulse.PulseSportsStarterRow
import app.pantopus.android.ui.screens.feed.pulse.PulseTopicChipRow
import app.pantopus.android.ui.screens.shared.feed.FeedChipItem
import app.pantopus.android.ui.screens.shared.feed.FeedChipRow
import app.pantopus.android.ui.screens.shared.feed.FeedComposeFAB
import app.pantopus.android.ui.screens.shared.feed.FeedSkeletonCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * Pulse tab — the public neighborhood feed reached from
 * Hub → pillar(.pulse). Replaces the legacy List-of-strings stub.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
@Suppress("CyclomaticComplexMethod")
fun FeedScreen(
    surface: FeedSurface = FeedSurface.Pulse,
    onOpenPost: (String) -> Unit = {},
    onCompose: (PulseIntent) -> Unit = {},
    onEmptyCta: (() -> Unit)? = null,
    onBack: (() -> Unit)? = null,
    /** Sports-lane starter tapped in the empty state — opens the composer
     *  with the prompt already in the body. */
    onComposeStarter: ((PulseSportsStarter) -> Unit)? = null,
    viewModel: PulseFeedViewModel = hiltViewModel(),
    contextBarViewModel: FeedContextBarViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeIntent by viewModel.activeIntent.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val isLoadingMore by viewModel.isLoadingMore.collectAsStateWithLifecycle()
    val searchText by viewModel.searchText.collectAsStateWithLifecycle()
    // The VM is configured in a LaunchedEffect, so the host's `surface`
    // argument stays authoritative for the chrome that must not flash
    // (title, toggle visibility); `activeSurface` drives what the toggle
    // itself selects.
    val activeSurface by viewModel.surface.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val overflowPostId by viewModel.overflowPostId.collectAsStateWithLifecycle()
    val reportingPostId by viewModel.reportingPostId.collectAsStateWithLifecycle()
    val deletingPostId by viewModel.deletingPostId.collectAsStateWithLifecycle()
    val mutingPostId by viewModel.mutingPostId.collectAsStateWithLifecycle()
    val showsPreferences by viewModel.showsPreferences.collectAsStateWithLifecycle()
    val activeTopic by viewModel.activeTopic.collectAsStateWithLifecycle()
    val sportsMode by viewModel.sportsMode.collectAsStateWithLifecycle()
    val primarySportsEvent by viewModel.primarySportsEvent.collectAsStateWithLifecycle()
    val radiusSuggestion by viewModel.radiusSuggestion.collectAsStateWithLifecycle()
    val contextLabel by contextBarViewModel.locationLabel.collectAsStateWithLifecycle()
    val contextRadius by contextBarViewModel.radiusMiles.collectAsStateWithLifecycle()
    val switcherState by contextBarViewModel.sheetState.collectAsStateWithLifecycle()
    val switcherOpen by contextBarViewModel.isSheetOpen.collectAsStateWithLifecycle()
    var showsSearch by remember { mutableStateOf(false) }
    var showsIntentPicker by remember { mutableStateOf(false) }
    // List / Map segment — mirrors RN `FeedHeader.tsx:35-52`.
    var viewMode by remember { mutableStateOf(FeedViewMode.List) }

    LaunchedEffect(Unit) {
        viewModel.configureSurface(surface)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenPulseFeedViewed(intent = activeIntent.key))
        if (surface == FeedSurface.Pulse) {
            contextBarViewModel.onChange = { viewModel.refresh() }
            contextBarViewModel.load()
        }
    }

    // Keep the suggestion ladder aligned with the server-side radius.
    LaunchedEffect(contextRadius) { viewModel.setViewingRadiusMiles(contextRadius) }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }

    fun launchShareSheet(postId: String) {
        val send =
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, viewModel.shareUrl(postId))
            }
        context.startActivity(Intent.createChooser(send, "Share post"))
        viewModel.recordShare(postId)
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("pulseFeed")) {
        Column(modifier = Modifier.fillMaxSize()) {
            TopBar(
                title = surface.title,
                onBack = onBack,
                onSearchTap = {
                    showsSearch = !showsSearch
                    if (!showsSearch) viewModel.setSearchText("")
                },
                onFilterTap = { showsIntentPicker = true },
                onPreferencesTap = { viewModel.openPreferences() },
                viewMode = viewMode.takeIf { surface.supportsMapMode },
                onViewModeChange = { viewMode = it },
            )
            if (surface in FeedSurface.toggleSurfaces) {
                FeedSurfaceTabs(active = activeSurface) { next ->
                    viewMode = FeedViewMode.List
                    viewModel.selectSurface(next)
                }
            }
            if (showsSearch) {
                OutlinedTextField(
                    value = searchText,
                    onValueChange = { viewModel.setSearchText(it) },
                    placeholder = { Text("Search posts", fontSize = 14.sp) },
                    singleLine = true,
                    shape = RoundedCornerShape(Radii.pill),
                    trailingIcon = {
                        Box(
                            modifier =
                                Modifier
                                    .size(32.dp)
                                    .clickable {
                                        showsSearch = false
                                        viewModel.setSearchText("")
                                    }
                                    .semantics { contentDescription = "Clear search" },
                            contentAlignment = Alignment.Center,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.X,
                                contentDescription = null,
                                size = 14.dp,
                                tint = PantopusColors.appTextSecondary,
                            )
                        }
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                            .testTag("pulseSearchField"),
                )
            }
            if (activeSurface == FeedSurface.Pulse) {
                FeedContextBar(
                    label = contextLabel,
                    radiusMiles = contextRadius,
                    onOpen = { contextBarViewModel.openSwitcher() },
                )
            }
            PulseTopicChipRow(
                topics = viewModel.availableTopics,
                activeTopic = activeTopic,
                onSelect = { viewModel.selectTopic(it) },
            )
            // Inside a topic lane the post-type row is replaced by the
            // lane's own mode chips — RN `FeedScreen.tsx:129`.
            if (viewModel.isInSportsLane) {
                val modeChips = viewModel.sportsModeChips()
                if (modeChips.isNotEmpty()) {
                    FeedChipRow(
                        chips = modeChips.map { FeedChipItem(id = it.first.key, label = it.second) },
                        activeId = sportsMode.key,
                        onSelect = { id -> viewModel.selectSportsMode(PulseSportsMode.fromKey(id)) },
                        skeleton = state is PulseFeedUiState.Loading,
                    )
                }
            } else {
                FeedChipRow(
                    chips = PulseIntent.entries.map { FeedChipItem(id = it.key, label = it.label) },
                    activeId = activeIntent.key,
                    onSelect = { id -> viewModel.selectIntent(PulseIntent.fromKey(id)) },
                    skeleton = state is PulseFeedUiState.Loading,
                )
            }
            if (viewModel.isInSportsLane) {
                primarySportsEvent?.let { event ->
                    PulseSportsEventModule(
                        event = event,
                        onSeeThreads = { viewModel.selectSportsEvent(event.eventKey) },
                        onStartThread = { onCompose(activeIntent) },
                    )
                }
            }
            if (activeSurface == FeedSurface.Pulse) {
                radiusSuggestion?.let { suggestion ->
                    FeedRadiusSuggestionBanner(
                        suggestion = suggestion,
                        onApply = {
                            contextBarViewModel.applyRadius(suggestion.suggestedRadius) { applied ->
                                if (applied) viewModel.setViewingRadiusMiles(suggestion.suggestedRadius)
                            }
                        },
                        onDismiss = { viewModel.dismissRadiusSuggestion() },
                    )
                }
            }
            if (viewMode == FeedViewMode.Map && surface.supportsMapMode) {
                FeedMapSection(
                    query = FeedMapQuery(surface = activeSurface, postType = activeIntent.postType),
                    onOpenPost = onOpenPost,
                )
            } else {
                when (val s = state) {
                    is PulseFeedUiState.Loading -> LoadingFrame()
                    is PulseFeedUiState.Empty ->
                        Column(modifier = Modifier.fillMaxSize()) {
                            Box(modifier = Modifier.weight(1f)) {
                                FeedEmptyState(content = s.content) {
                                    onEmptyCta?.invoke() ?: onCompose(activeIntent)
                                }
                            }
                            // Sports lane starter prompts — tapping one
                            // opens the composer pre-filled.
                            if (viewModel.isInSportsLane && onComposeStarter != null) {
                                PulseSportsStarterRow(onSelect = onComposeStarter)
                            }
                        }
                    is PulseFeedUiState.Loaded ->
                        PopulatedFrame(
                            state = s,
                            onTapPost = onOpenPost,
                            onTapReaction = viewModel::tapReaction,
                            isRefreshing = isRefreshing,
                            onRefresh = viewModel::refresh,
                            isLoadingMore = isLoadingMore,
                            onRowAppeared = viewModel::loadMoreIfNeeded,
                            searchActive = searchText.isNotBlank(),
                            rowActions =
                                PulseFeedRowActions(
                                    onOverflow = viewModel::openOverflow,
                                    onDismissSeeded = viewModel::dismissSeededFact,
                                    onToggleSave = viewModel::toggleSave,
                                    onToggleRepost = viewModel::toggleRepost,
                                ),
                        )
                    is PulseFeedUiState.Error ->
                        ErrorFrame(message = s.message, onRetry = { viewModel.refresh() })
                }
            }
        }
        toast?.let { message ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s16)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("pulseFeedToast"),
            ) {
                Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextInverse)
            }
        }
        if (showsIntentPicker) {
            AlertDialog(
                onDismissRequest = { showsIntentPicker = false },
                title = { Text("Filter by intent") },
                text = {
                    Column {
                        PulseIntent.entries.forEach { intent ->
                            TextButton(
                                onClick = {
                                    showsIntentPicker = false
                                    viewModel.selectIntent(intent)
                                },
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .testTag("pulseIntentFilter_${intent.key}"),
                            ) {
                                Text(intent.label, color = PantopusColors.appText)
                            }
                        }
                    }
                },
                confirmButton = {},
                dismissButton = {
                    TextButton(onClick = { showsIntentPicker = false }) { Text("Cancel") }
                },
            )
        }
        if (switcherOpen) {
            FeedLocationSwitcherSheet(
                state = switcherState,
                activeLabel = contextLabel,
                onSelect = { contextBarViewModel.select(it) },
                onRetry = { contextBarViewModel.openSwitcher() },
                onDismiss = { contextBarViewModel.closeSwitcher() },
            )
        }
        FeedComposeFAB(
            onClick = { onCompose(activeIntent) },
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = Spacing.s4, bottom = Spacing.s10),
        )
    }

    val loadedRows = (state as? PulseFeedUiState.Loaded)?.rows.orEmpty()
    overflowPostId?.let { id ->
        loadedRows.firstOrNull { it.id == id }?.let { row ->
            PostOverflowSheet(
                row = row,
                onDismiss = { viewModel.dismissOverflow() },
                onToggleSave = {
                    viewModel.dismissOverflow()
                    viewModel.toggleSave(row.id)
                },
                onToggleRepost = {
                    viewModel.dismissOverflow()
                    viewModel.toggleRepost(row.id)
                },
                onShare = {
                    viewModel.dismissOverflow()
                    launchShareSheet(row.id)
                },
                onHide = {
                    viewModel.dismissOverflow()
                    viewModel.hidePost(row.id)
                },
                onNotHelpful = {
                    viewModel.dismissOverflow()
                    viewModel.markNotHelpful(row.id)
                },
                onMuteAuthor = { viewModel.beginMuteAuthor(row.id) },
                onMuteTopic = {
                    viewModel.dismissOverflow()
                    viewModel.muteTopic(row.id)
                },
                onMarkSolved = {
                    viewModel.dismissOverflow()
                    viewModel.markSolved(row.id)
                },
                onReport = { viewModel.beginReport(row.id) },
                onDelete = { viewModel.beginDelete(row.id) },
            )
        }
    }

    reportingPostId?.let { id ->
        AlertDialog(
            onDismissRequest = { viewModel.cancelReport() },
            title = { Text("Report this post?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text =
                            "Reports are reviewed by the Pantopus team. " +
                                "The author isn't told who reported.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    pulseReportReasons.forEach { (key, label) ->
                        TextButton(
                            onClick = { viewModel.reportPost(id, key) },
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .testTag("pulseFeedReportReason_$key"),
                        ) {
                            Text(label, color = PantopusColors.appText)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { viewModel.cancelReport() }) { Text("Cancel") }
            },
        )
    }

    deletingPostId?.let { id ->
        AlertDialog(
            onDismissRequest = { viewModel.cancelDelete() },
            title = { Text("Delete post?") },
            text = { Text("This will permanently remove your post.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deletePost(id) },
                    modifier = Modifier.testTag("pulseFeedDeleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelDelete() }) { Text("Cancel") }
            },
        )
    }

    mutingPostId?.let { id ->
        val name = loadedRows.firstOrNull { it.id == id }?.actions?.muteEntityName ?: "this author"
        AlertDialog(
            onDismissRequest = { viewModel.cancelMuteAuthor() },
            title = { Text("Mute $name?") },
            text = { Text("You won't see their posts in any feed. You can undo this from their profile.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.muteAuthor(id) },
                    modifier = Modifier.testTag("pulseFeedMuteConfirm"),
                ) {
                    Text("Mute", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelMuteAuthor() }) { Text("Cancel") }
            },
        )
    }

    if (showsPreferences) {
        FeedPreferencesSheet(
            onClose = { viewModel.dismissPreferences() },
            onPrefsChanged = { viewModel.refresh() },
        )
    }
}

/** Report reasons accepted by `reportPostSchema` (`backend/routes/posts.js:3168`). */
private val pulseReportReasons =
    listOf(
        "spam" to "Spam",
        "harassment" to "Harassment",
        "inappropriate" to "Inappropriate content",
        "misinformation" to "Misinformation",
        "safety" to "Safety concern",
        "other" to "Other",
    )

/**
 * Per-row callbacks handed down to [PulsePostCard]. Bundled so
 * [PopulatedFrame] keeps a readable signature.
 */
internal data class PulseFeedRowActions(
    val onOverflow: (String) -> Unit = {},
    val onDismissSeeded: (String) -> Unit = {},
    val onToggleSave: (String) -> Unit = {},
    val onToggleRepost: (String) -> Unit = {},
)

/**
 * Nearby / Connections surface toggle — RN
 * `src/components/feed/FeedSurfaceTabs.tsx:19-33`. Switching hits
 * `GET /api/posts/feed?surface=place|connections`.
 */
@Composable
private fun FeedSurfaceTabs(
    active: FeedSurface,
    onSelect: (FeedSurface) -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3)) {
            FeedSurface.toggleSurfaces.forEach { tab ->
                val isActive = tab == active
                val tint = if (isActive) PantopusColors.primary600 else PantopusColors.appTextSecondary
                Box(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(tab) }
                                .padding(vertical = 10.dp)
                                .semantics { contentDescription = tab.toggleLabel }
                                .testTag("pulseSurfaceTab_${tab.name.lowercase()}"),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        PantopusIconImage(
                            icon = tab.toggleIcon,
                            contentDescription = null,
                            size = 15.dp,
                            tint = tint,
                        )
                        Spacer(modifier = Modifier.size(6.dp))
                        Text(
                            text = tab.toggleLabel,
                            fontSize = 14.sp,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                            color = tint,
                        )
                    }
                    if (isActive) {
                        Box(
                            modifier =
                                Modifier
                                    .align(Alignment.BottomCenter)
                                    .fillMaxWidth()
                                    .height(2.dp)
                                    .background(PantopusColors.primary600),
                        )
                    }
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

/**
 * Card overflow menu — save / repost / share / hide / not-helpful / mute /
 * mark-solved / report / delete, gated exactly as RN gates them
 * (`PostCard.tsx:382-397, 445-470, 507-527`).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PostOverflowSheet(
    row: PulsePostCardContent,
    onDismiss: () -> Unit,
    onToggleSave: () -> Unit,
    onToggleRepost: () -> Unit,
    onShare: () -> Unit,
    onHide: () -> Unit,
    onNotHelpful: () -> Unit,
    onMuteAuthor: () -> Unit,
    onMuteTopic: () -> Unit,
    onMarkSolved: () -> Unit,
    onReport: () -> Unit,
    onDelete: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val actions = row.actions
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("pulseFeedOverflowSheet"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "Post options",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            OverflowAction(
                label = if (actions.isSaved) "Remove bookmark" else "Save post",
                testTag = "pulseFeedOverflowSave",
                onClick = onToggleSave,
            )
            OverflowAction(
                label = if (actions.isReposted) "Undo repost" else "Repost",
                testTag = "pulseFeedOverflowRepost",
                onClick = onToggleRepost,
            )
            OverflowAction(label = "Share…", testTag = "pulseFeedOverflowShare", onClick = onShare)
            OverflowAction(label = "Hide this post", testTag = "pulseFeedOverflowHide", onClick = onHide)
            if (actions.canFlagNotHelpful) {
                OverflowAction(
                    label = "Not helpful here",
                    testTag = "pulseFeedOverflowNotHelpful",
                    onClick = onNotHelpful,
                )
            }
            if (actions.canMuteAuthor) {
                OverflowAction(
                    label = "Mute ${actions.muteEntityName}",
                    testTag = "pulseFeedOverflowMuteAuthor",
                    onClick = onMuteAuthor,
                )
            }
            val topic = actions.topicLabel
            if (actions.canMuteTopic && !topic.isNullOrEmpty()) {
                OverflowAction(
                    label = "Mute $topic posts",
                    testTag = "pulseFeedOverflowMuteTopic",
                    onClick = onMuteTopic,
                )
            }
            if (actions.canMarkSolved) {
                OverflowAction(
                    label = "Mark solved",
                    testTag = "pulseFeedOverflowMarkSolved",
                    onClick = onMarkSolved,
                )
            }
            if (actions.canReport) {
                OverflowAction(
                    label = "Report post",
                    testTag = "pulseFeedOverflowReport",
                    isDestructive = true,
                    onClick = onReport,
                )
            }
            if (actions.canDelete) {
                OverflowAction(
                    label = "Delete post",
                    testTag = "pulseFeedOverflowDelete",
                    isDestructive = true,
                    onClick = onDelete,
                )
            }
            OverflowAction(label = "Cancel", testTag = "pulseFeedOverflowCancel", onClick = onDismiss)
            Spacer(modifier = Modifier.height(Spacing.s6))
        }
    }
}

@Composable
private fun OverflowAction(
    label: String,
    testTag: String,
    isDestructive: Boolean = false,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().testTag(testTag),
    ) {
        Text(
            text = label,
            color = if (isDestructive) PantopusColors.error else PantopusColors.appText,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/**
 * List / Map segmented pill. RN hides it on the `personas` (Beacons)
 * surface — `src/components/feed/FeedHeader.tsx:36`.
 */
@Composable
private fun ViewModeToggle(
    active: FeedViewMode,
    onSelect: (FeedViewMode) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(3.dp)
                .testTag("pulseViewModeToggle"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        FeedViewMode.entries.forEach { mode ->
            val selected = mode == active
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (selected) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                        .clickable { onSelect(mode) }
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                        .testTag("pulseViewModeSegment_${mode.key}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                PantopusIconImage(
                    icon = if (mode == FeedViewMode.List) PantopusIcon.List else PantopusIcon.Map,
                    contentDescription = null,
                    size = 13.dp,
                    tint = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
                Text(
                    text = mode.label,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun TopBar(
    title: String,
    onBack: (() -> Unit)?,
    onSearchTap: (() -> Unit)? = null,
    onFilterTap: (() -> Unit)? = null,
    onPreferencesTap: (() -> Unit)? = null,
    /** Non-null renders the List / Map segment (hidden on Beacons). */
    viewMode: FeedViewMode? = null,
    onViewModeChange: (FeedViewMode) -> Unit = {},
) {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appBg)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clickable(onClick = onBack)
                            .testTag("pulseBackButton"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = "Back",
                        size = 22.dp,
                        tint = PantopusColors.appText,
                    )
                }
                Spacer(modifier = Modifier.size(8.dp))
            }
            Text(
                text = title,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            if (viewMode != null) {
                ViewModeToggle(active = viewMode, onSelect = onViewModeChange)
                Spacer(modifier = Modifier.size(Spacing.s2))
            }
            if (onSearchTap != null) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clickable(onClick = onSearchTap)
                            .testTag("pulseSearchButton")
                            .semantics { contentDescription = "Search posts" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Search,
                        contentDescription = null,
                        size = 20.dp,
                        tint = PantopusColors.appText,
                    )
                }
            }
            if (onFilterTap != null) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clickable(onClick = onFilterTap)
                            .testTag("pulseFilterButton")
                            .semantics { contentDescription = "Filter by intent" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Filter,
                        contentDescription = null,
                        size = 20.dp,
                        tint = PantopusColors.appText,
                    )
                }
            }
            if (onPreferencesTap != null) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clickable(onClick = onPreferencesTap)
                            .testTag("pulsePreferencesButton")
                            .semantics { contentDescription = "Pulse preferences" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.SlidersHorizontal,
                        contentDescription = null,
                        size = 20.dp,
                        tint = PantopusColors.appText,
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s3).testTag("pulseFeedLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        FeedSkeletonCard()
        FeedSkeletonCard(withTitle = true)
        FeedSkeletonCard()
        FeedSkeletonCard()
    }
}

/**
 * Centered empty-state for a feed surface (Pulse radio glyph / Beacons rss
 * glyph). `internal` so the Pulse / Beacons snapshot tests can render it
 * directly from a [FeedSurface] descriptor.
 */
@Composable
internal fun FeedEmptyState(
    content: FeedEmptyContent,
    onCta: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("pulseFeedEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = content.icon,
                contentDescription = null,
                size = 32.dp,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = content.headline,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = content.body,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onCta)
                    .padding(horizontal = 22.dp)
                    .height(44.dp)
                    .testTag("pulseEmptyCreatePost"),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = content.ctaIcon,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = content.ctaLabel,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
        val emphasis = content.footerEmphasis
        if (!emphasis.isNullOrEmpty()) {
            Spacer(modifier = Modifier.size(Spacing.s4))
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = content.footerIcon,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text =
                        buildAnnotatedString {
                            append(content.footerLead)
                            withStyle(
                                SpanStyle(
                                    fontWeight = FontWeight.Bold,
                                    color = PantopusColors.appTextStrong,
                                ),
                            ) { append(emphasis) }
                            append(content.footerTrail)
                        },
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
private fun PopulatedFrame(
    state: PulseFeedUiState.Loaded,
    onTapPost: (String) -> Unit,
    onTapReaction: (String) -> Unit,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    isLoadingMore: Boolean = false,
    onRowAppeared: (String) -> Unit = {},
    searchActive: Boolean = false,
    rowActions: PulseFeedRowActions = PulseFeedRowActions(),
) {
    val pullState = rememberPullRefreshState(refreshing = isRefreshing, onRefresh = onRefresh)
    Box(modifier = Modifier.fillMaxSize().pullRefresh(pullState)) {
        if (state.rows.isEmpty() && searchActive) {
            Text(
                text = "No posts match your search",
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = Spacing.s10)
                        .testTag("pulseSearchEmpty"),
            )
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().testTag("pulseFeedList"),
            contentPadding = PaddingValues(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            items(items = state.rows, key = { it.id }) { row ->
                LaunchedEffect(row.id) { onRowAppeared(row.id) }
                val seeded = row.actions.isSeeded
                PulsePostCard(
                    content = row,
                    onTap = { onTapPost(row.id) },
                    onPrimaryReaction = { onTapReaction(row.id) },
                    onRSVP = if (row.attendees == null) null else ({ onTapReaction(row.id) }),
                    onOverflow = if (seeded) null else ({ rowActions.onOverflow(row.id) }),
                    onDismissSeeded = if (seeded) ({ rowActions.onDismissSeeded(row.id) }) else null,
                    onToggleSave = if (seeded) null else ({ rowActions.onToggleSave(row.id) }),
                    onToggleRepost = if (seeded) null else ({ rowActions.onToggleRepost(row.id) }),
                )
            }
            if (isLoadingMore) {
                item {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(Spacing.s3)
                                .testTag("pulseFeedLoadingMore"),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(80.dp)) }
        }
        PullRefreshIndicator(
            refreshing = isRefreshing,
            state = pullState,
            modifier = Modifier.align(Alignment.TopCenter),
            contentColor = PantopusColors.primary600,
        )
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
                .testTag("pulseFeedError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "Couldn't load Pulse",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.size(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .height(44.dp)
                    .testTag("pulseFeedRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
