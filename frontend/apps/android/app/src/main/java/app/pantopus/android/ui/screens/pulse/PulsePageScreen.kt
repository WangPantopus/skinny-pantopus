package app.pantopus.android.ui.screens.pulse

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.data.pulse.PulseFeedQuery
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.feed.FeedEmptyState
import app.pantopus.android.ui.screens.feed.FeedPreferencesSheet
import app.pantopus.android.ui.screens.feed.FeedSurface
import app.pantopus.android.ui.screens.feed.FeedTopMenu
import app.pantopus.android.ui.screens.feed.PostOverflowSheet
import app.pantopus.android.ui.screens.feed.PulseMoreMenu
import app.pantopus.android.ui.screens.feed.pulse.PulseTopic
import app.pantopus.android.ui.screens.feed.pulse.PulseTopicChipRow
import app.pantopus.android.ui.screens.feed.pulseReportReasons
import app.pantopus.android.ui.screens.shared.feed.FeedComposeFAB
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusContentTheme
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * The Pulse tab's page (build spec section 3, wireframes 1 and 4): the header, the views, the topic chips, the
 * conversations in groups that end ("You're caught up"), and new conversations that wait behind a pill. Nothing loads by
 * itself while scrolling.
 *
 * @param quietStateCard The neighborhood meter or "Set up a home" card, drawn when the server's `quiet.card` says so.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PulsePageScreen(
    onOpenPost: (String) -> Unit,
    onCompose: () -> Unit,
    onOpenConnections: () -> Unit,
    onOpenBeacons: (() -> Unit)? = null,
    quietStateCard: @Composable () -> Unit,
    onRefreshQuietStateCard: () -> Unit = {},
    viewModel: PulsePageViewModel = hiltViewModel(),
) {
    PantopusContentTheme(darkTheme = isSystemInDarkTheme()) {
        PulsePageBody(onOpenPost, onCompose, onOpenConnections, onOpenBeacons, quietStateCard, onRefreshQuietStateCard, viewModel)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PulsePageBody(
    onOpenPost: (String) -> Unit,
    onCompose: () -> Unit,
    onOpenConnections: () -> Unit,
    onOpenBeacons: (() -> Unit)?,
    quietStateCard: @Composable () -> Unit,
    onRefreshQuietStateCard: () -> Unit,
    viewModel: PulsePageViewModel,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    val newCount by viewModel.newCount.collectAsStateWithLifecycle()
    val earlier by viewModel.earlier.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var showsPreferences by rememberSaveable { mutableStateOf(false) }
    var showsAreas by rememberSaveable { mutableStateOf(false) }
    ReportContentShown("pulse", state is PulsePageUiState.Loaded)
    val listState = rememberLazyListState()
    val content = (state as? PulsePageUiState.Loaded)?.content
    PulsePageEffects(viewModel, toast, query, content, newCount, listState)
    val callbacks =
        PulsePageCallbacks(
            onOpenPost = onOpenPost,
            onAction = { card -> if (!viewModel.toggleAction(card)) onOpenPost(card.id) },
            onShowEarlier = viewModel::showEarlier,
            onCompose = onCompose,
            onShowAllTopics = { viewModel.selectTopic(null) },
            onOverflow = viewModel::openMenu,
            onRefresh = viewModel::refresh,
        )

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).testTag("pulsePage")) {
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                onRefreshQuietStateCard()
                viewModel.refresh()
            },
            modifier = Modifier.fillMaxSize(),
        ) {
            PulsePageList(
                state,
                query,
                earlier,
                callbacks,
                listState,
                header = {
                    PulsePageHeader(
                        content,
                        query,
                        refreshNotice,
                        FeedTopMenu(onOpenConnections, onOpenBeacons),
                        { showsPreferences = true },
                        { showsAreas = true },
                        viewModel,
                    )
                },
                quietStateCard = quietStateCard,
            )
        }
        PulsePageOverlays(newCount, toast, listState, viewModel::refresh, onCompose)
    }
    PulsePageMenus(viewModel)
    if (showsAreas) {
        PulseAreaPickerSheet(
            selectedId = query.areaId,
            onSelect = { areaId ->
                showsAreas = false
                viewModel.selectArea(areaId)
            },
            onDismiss = { showsAreas = false },
        )
    }
    if (showsPreferences) {
        FeedPreferencesSheet(
            onClose = { showsPreferences = false },
            onPrefsChanged = viewModel::refresh,
            onTopicUnmuted = viewModel::topicUnmuted,
        )
    }
}

@Composable
private fun BoxScope.PulsePageOverlays(
    newCount: Int,
    toast: String?,
    listState: LazyListState,
    onRefresh: () -> Unit,
    onCompose: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    if (newCount > 0) {
        PulseNewPill(
            count = newCount,
            onClick = {
                onRefresh()
                scope.launch { listState.scrollToItem(0) }
            },
            modifier = Modifier.align(Alignment.TopCenter).padding(top = HEADER_PILL_TOP),
        )
    }
    toast?.let { message ->
        PulsePageToast(message, Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s16))
    }
    FeedComposeFAB(
        onClick = onCompose,
        modifier = Modifier.align(Alignment.BottomEnd).padding(end = Spacing.s4, bottom = Spacing.s4),
    )
}

@Composable
private fun PulsePageHeader(
    content: PulsePageContent?,
    query: PulseFeedQuery,
    refreshNotice: RefreshNotice?,
    menu: FeedTopMenu,
    onPreferences: () -> Unit,
    onAreas: () -> Unit,
    viewModel: PulsePageViewModel,
) {
    PulseHeader(content?.areaName, menu, onPreferences, onAreas)
    PulseViews(selected = query.view, onSelect = viewModel::selectView)
    PulseTopicChips(selected = query.topic, onSelect = viewModel::selectTopic)
    refreshNotice?.let { RefreshFailedLine(it, modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1)) }
}

@Composable
private fun PulsePageList(
    state: PulsePageUiState,
    query: PulseFeedQuery,
    earlier: PulseEarlierState,
    callbacks: PulsePageCallbacks,
    listState: LazyListState,
    header: @Composable () -> Unit,
    quietStateCard: @Composable () -> Unit,
) {
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().testTag("pulseList"),
        contentPadding = PaddingValues(bottom = BOTTOM_ROOM),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        item(key = "header") { header() }
        when (val s = state) {
            PulsePageUiState.Loading -> item(key = "loading") { PulseSkeleton() }
            is PulsePageUiState.Error ->
                item(key = "error") {
                    ErrorState(headline = "Couldn't load Pulse", message = s.message, onRetry = callbacks.onRefresh)
                }
            is PulsePageUiState.Loaded ->
                pulseItems(
                    content = s.content,
                    earlier = earlier,
                    query = query,
                    callbacks = callbacks,
                    quietStateCard = quietStateCard,
                )
        }
    }
}

@Composable
private fun PulsePageMenus(viewModel: PulsePageViewModel) {
    val menu by viewModel.menu.collectAsStateWithLifecycle()
    val selected = menu ?: return
    val card = selected.card
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    if (selected.action == null) {
        PostOverflowSheet(
            actions = card.actions.copy(pulseTopic = card.actions.pulseTopic.takeIf { card.areaId != null }),
            onDismiss = viewModel::dismissMenu,
            onToggleSave = { viewModel.toggleSave(card) },
            onToggleRepost = null,
            onShare =
                if (card.canShare) {
                    {
                        viewModel.shareExternally(card) { url ->
                            // The answer can arrive after the person left the page: no chooser over another screen.
                            if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                                val share =
                                    Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, url)
                                    }
                                context.startActivity(Intent.createChooser(share, "Share post"))
                            }
                        }
                    }
                } else {
                    null
                },
            onHide = { viewModel.hide(card) },
            onNotHelpful = {},
            onMuteAuthor = { viewModel.confirmMenu(PulsePageMenuAction.MuteAuthor) },
            onMuteTopic = {},
            onMuteThisTopic = { viewModel.muteTopic(card) },
            onMarkSolved = {},
            onKeepOpen = { viewModel.keepOpen(card) },
            onCloseAsk = { viewModel.confirmMenu(PulsePageMenuAction.Close) },
            onReport = { viewModel.confirmMenu(PulsePageMenuAction.Report) },
            onDelete = { viewModel.confirmMenu(PulsePageMenuAction.Delete) },
            topicMuteLabel = "Mute this topic in this area",
        )
    } else if (selected.action == PulsePageMenuAction.Report) {
        PulsePageReport(card, viewModel)
    } else {
        PulsePageConfirm(selected, viewModel)
    }
}

@Composable
private fun PulsePageReport(
    card: PulseCardUi,
    viewModel: PulsePageViewModel,
) {
    AlertDialog(
        onDismissRequest = viewModel::dismissMenu,
        title = { Text("Report this post?") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text("Reports are reviewed by the Pantopus team. The author isn't told who reported.")
                pulseReportReasons.forEach { (key, label) ->
                    TextButton(
                        onClick = { viewModel.report(card, key) },
                        modifier = Modifier.fillMaxWidth().testTag("pulseFeedReportReason_$key"),
                    ) {
                        Text(label)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = viewModel::dismissMenu) { Text("Cancel") } },
    )
}

@Composable
private fun PulsePageConfirm(
    menu: PulsePageMenu,
    viewModel: PulsePageViewModel,
) {
    val card = menu.card
    val words =
        when (menu.action) {
            PulsePageMenuAction.Close -> Triple("Close this question?", "It leaves Pulse. You can restore it from My posts.", "Close")
            PulsePageMenuAction.Delete -> Triple("Delete post?", "This will permanently remove your post.", "Delete")
            PulsePageMenuAction.MuteAuthor ->
                Triple(
                    "Mute ${card.authorName}?",
                    "You won't see their posts in any feed. You can undo this from their profile.",
                    "Mute",
                )
            else -> return
        }
    AlertDialog(
        onDismissRequest = viewModel::dismissMenu,
        title = { Text(words.first) },
        text = { Text(words.second) },
        confirmButton = {
            TextButton(onClick = {
                when (menu.action) {
                    PulsePageMenuAction.Close -> viewModel.closeAsk(card)
                    PulsePageMenuAction.Delete -> viewModel.delete(card)
                    PulsePageMenuAction.MuteAuthor -> viewModel.muteAuthor(card)
                    else -> Unit
                }
            }, modifier = Modifier.testTag("pulsePageConfirm_${menu.action}")) { Text(words.third, color = PantopusColors.error) }
        },
        dismissButton = { TextButton(onClick = viewModel::dismissMenu) { Text("Cancel") } },
    )
}

@Composable
private fun PulsePageEffects(
    viewModel: PulsePageViewModel,
    toast: String?,
    query: PulseFeedQuery,
    content: PulsePageContent?,
    newCount: Int,
    listState: LazyListState,
) {
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        onPauseOrDispose { }
    }
    // While reading, new posts wait behind the pill. A later tab entry can read the marked copy again.
    RefreshOnStoreChange(viewModel::pollNew)
    // Once a minute while the page is on screen: how many conversations arrived since it was read.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(viewModel, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                delay(NEW_POLL_MS)
                viewModel.pollNew()
            }
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_MS)
            viewModel.dismissToast()
        }
    }
    // The end card on screen means the page was read to its end: tell the server, once per read.
    LaunchedEffect(query) { listState.scrollToItem(0) }
    LaunchedEffect(content?.endKey, query, newCount, lifecycle) {
        if (content != null) {
            lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                snapshotFlow { listState.layoutInfo.visibleItemsInfo.any { it.key == content.endKey } }.collectLatest { visible ->
                    // Retry a failed acknowledgement only while this page's end remains visible.
                    while (visible) {
                        viewModel.endShown(content.endKey)
                        delay(NEW_POLL_MS)
                    }
                }
            }
        }
    }
}

@Composable
private fun PulsePageToast(
    message: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(MaterialTheme.colorScheme.inverseSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("pulsePageToast")
                .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Text(text = message, fontSize = 13.sp, color = MaterialTheme.colorScheme.inverseOnSurface)
    }
}

private data class PulsePageCallbacks(
    val onOpenPost: (String) -> Unit,
    val onAction: (PulseCardUi) -> Unit,
    val onShowEarlier: () -> Unit,
    val onCompose: () -> Unit,
    val onShowAllTopics: () -> Unit,
    val onOverflow: (PulseCardUi) -> Unit,
    val onRefresh: () -> Unit,
)

// ─── Header, views, topics ─────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PulseHeader(
    areaName: String?,
    menu: FeedTopMenu,
    onPreferences: () -> Unit,
    onAreas: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        FlowRow(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "Pulse",
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() },
            )
            PulseAreaPill(name = areaName ?: "Choose an area", onClick = onAreas)
        }
        PulseMoreMenu(menu = menu, onPreferences = onPreferences)
    }
}

/** An area the pill can switch to. The viewer's town is the one with a null id. */
data class PulseAreaChoice(
    val id: String?,
    val name: String,
)

@Composable
private fun PulseAreaPill(
    name: String,
    onClick: () -> Unit,
) {
    Box {
        Row(
            modifier =
                Modifier
                    .heightIn(min = 36.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(Radii.pill))
                    .clickable(role = Role.Button, onClick = onClick)
                    .padding(horizontal = Spacing.s3)
                    .semantics { contentDescription = "Area: $name. Change area" }
                    .testTag("pulseAreaPill"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.MapPin, contentDescription = null, size = 16.dp, tint = MaterialTheme.colorScheme.primary)
            Text(text = name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 14.dp,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Nearby and Following (Known arrives with its own slice). */
@Composable
private fun PulseViews(
    selected: String,
    onSelect: (String) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        listOf(PulseFeedQuery.VIEW_NEARBY to "Nearby", PulseFeedQuery.VIEW_FOLLOWING to "Following").forEach { (view, label) ->
            val isSelected = selected == view
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (isSelected) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable { onSelect(view) }
                        .semantics {
                            role = Role.Tab
                            this.selected = isSelected
                            contentDescription = label
                        }
                        .testTag("pulseView_$view"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    fontSize = 15.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isSelected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Reuse S4's few-at-a-time topics, More control and accessibility names. */
@Composable
private fun PulseTopicChips(
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    PulseTopicChipRow(
        topics = PulseTopic.entries,
        activeTopic = PulseTopic.fromKey(selected),
        onSelect = { onSelect(it?.key) },
    )
}

// ─── The list ──────────────────────────────────────────────────────────────────

private fun LazyListScope.pulseItems(
    content: PulsePageContent,
    earlier: PulseEarlierState,
    query: PulseFeedQuery,
    callbacks: PulsePageCallbacks,
    quietStateCard: @Composable () -> Unit,
) {
    if (content.quiet?.card != null) {
        item(key = "quiet") { Box(modifier = Modifier.padding(horizontal = Spacing.s4)) { quietStateCard() } }
    }
    if (content.groups.isEmpty()) {
        item(key = "empty") {
            val topic = PulseTopic.fromKey(query.topic)
            if (topic == null) {
                PulseQuietDay(content.areaName, query.view == PulseFeedQuery.VIEW_FOLLOWING, callbacks.onCompose)
            } else {
                val empty = FeedSurface.topicEmptyContent(topic, scopeLabel = null)
                FeedEmptyState(
                    content =
                        if (query.view == PulseFeedQuery.VIEW_FOLLOWING) {
                            empty.copy(body = "New conversations about ${topic.label.lowercase()} that you follow will show here.")
                        } else {
                            empty
                        },
                    onCta = callbacks.onShowAllTopics,
                )
            }
        }
    }
    content.groups.forEach { group ->
        item(key = "group_${group.key}") { PulseGroupHeader(group.title) }
        items(group.cards, key = { it.id }) { card ->
            PulseConversationCard(
                card = card,
                onOpen = { callbacks.onOpenPost(card.id) },
                onAction = { callbacks.onAction(card) },
                onOverflow = { callbacks.onOverflow(card) },
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
    }
    item(key = content.endKey) { PulseEnd(content.end, earlier, callbacks.onShowEarlier) }
}

@Composable
private fun PulseGroupHeader(title: String) {
    Text(
        text = title,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier =
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .semantics { heading() },
    )
}

/** The end: "You're caught up" says nothing is hidden below it, and "Show earlier" is the only way to go back. */
@Composable
private fun PulseEnd(
    end: PulseEndUi,
    earlier: PulseEarlierState,
    onShowEarlier: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6, vertical = Spacing.s6).testTag("pulseEnd"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (end.caughtUp) {
            Box(
                modifier = Modifier.size(56.dp).clip(CircleShape).background(PantopusColors.successBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 28.dp, tint = PantopusColors.success)
            }
            Text(
                text = "You're caught up",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() }.testTag("pulseCaughtUp"),
            )
            Text(text = end.sentence, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
        when (earlier) {
            PulseEarlierState.Loading ->
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(24.dp).testTag("pulseEarlierLoading"),
                )
            PulseEarlierState.NothingEarlier ->
                Text(
                    text = "Nothing earlier.",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            PulseEarlierState.Idle ->
                if (end.canShowEarlier) {
                    TextButton(onClick = onShowEarlier, modifier = Modifier.heightIn(min = 48.dp).testTag("pulseShowEarlier")) {
                        Text(
                            text = "Show earlier",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
        }
    }
}

/** A quiet day says so; nothing is invented to fill the page. */
@Composable
private fun PulseQuietDay(
    areaName: String,
    following: Boolean,
    onCompose: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6, vertical = Spacing.s10).testTag("pulseQuietDay"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = if (following) "No new conversations" else "Quiet in $areaName today",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        Text(
            text =
                if (following) {
                    "New activity in conversations you follow will show here."
                } else {
                    "When neighbors post, it shows here. Start a conversation if you'd like."
                },
            fontSize = 15.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (!following) {
            TextButton(onClick = onCompose, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(
                    text = "Start a conversation",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

/** "↑ 3 new conversations": new conversations wait here and never move the page until it is tapped. */
@Composable
private fun PulseNewPill(
    count: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val words = if (count == 1) "1 new conversation" else "$count new conversations"
    Box(
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(MaterialTheme.colorScheme.inverseSurface)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s5)
                .semantics {
                    role = Role.Button
                    contentDescription = "$words. Show them"
                }
                .testTag("pulseNewPill"),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = "↑ $words", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.inverseOnSurface)
    }
}

/** Mirrors the loaded geometry: a header band and cards. */
@Composable
private fun PulseSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("pulseSkeleton"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(SKELETON_CARDS) {
            Shimmer(height = 120.dp, cornerRadius = Radii.xl, modifier = Modifier.fillMaxWidth())
        }
    }
}

private const val NEW_POLL_MS = 60_000L
private const val TOAST_MS = 2_500L
private const val SKELETON_CARDS = 4
private val BOTTOM_ROOM = 96.dp
private val HEADER_PILL_TOP = Spacing.s2
