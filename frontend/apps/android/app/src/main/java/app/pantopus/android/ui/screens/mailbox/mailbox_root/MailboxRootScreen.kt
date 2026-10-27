@file:Suppress("LongMethod", "LongParameterList", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.NavigationMenuButton
import app.pantopus.android.ui.screens.mailbox.components.MailboxHeroState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter

/**
 * The Mailbox, the Mail tab's top screen (Mail tab, receiving; drawings `Main`, `R1-Before`, `R2-Delivery`,
 * `R4-NoMail`). One scrolling page: the morning round in the hero card, the drawers Me · Home · Biz, Incoming ·
 * Counter · Vault, and the pieces drawn as paper, grouped by the day they came. The first visit after a round plays
 * the delivery moment. Errors say what happened and offer Try again; pull to refresh reads everything again.
 *
 * The menu keeps Mail tasks, Home records, Stamps and Vacation hold (Mail party and Community with Mail extras). The
 * scan entries, "Find a mailbox" and "My mail day" are gone (no photographing paper mail, founder 2026-10-26).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MailboxRootScreen(
    onOpenMail: (String) -> Unit,
    onOpenSearch: () -> Unit = {},
    onOpenVacationHold: () -> Unit = {},
    onOpenStamps: () -> Unit = {},
    onOpenCompose: () -> Unit = {},
    onOpenRoutingQueue: () -> Unit = {},
    onOpenMailParty: () -> Unit = {},
    onOpenCommunity: () -> Unit = {},
    onOpenRecords: () -> Unit = {},
    onOpenMailTasks: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    /** The side menu, while the Mailbox is the Mail tab's top screen (the Mail tab, 2026-10-27). */
    onOpenMenu: (() -> Unit)? = null,
    viewModel: MailboxRootViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val hero by viewModel.hero.collectAsStateWithLifecycle()
    val drawers by viewModel.drawers.collectAsStateWithLifecycle()
    val drawerUnread by viewModel.drawerUnread.collectAsStateWithLifecycle()
    val selectedDrawer by viewModel.selectedDrawer.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val pendingRoutingCount by viewModel.pendingRoutingCount.collectAsStateWithLifecycle()
    val deliveryMoment by viewModel.deliveryMoment.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenMail = onOpenMail)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMailboxRootViewed)
    }
    // Back on the Mailbox after a while (or the next morning): today's mail, not what was read before.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refreshIfStale() }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("mailboxRoot")) {
        Column(modifier = Modifier.fillMaxSize()) {
            MailboxTopBar(
                onBack = onBack,
                onOpenMenu = onOpenMenu,
                onOpenSearch = onOpenSearch,
                onOpenVacationHold = onOpenVacationHold,
                onOpenStamps = onOpenStamps,
                onOpenMailParty = onOpenMailParty,
                onOpenCommunity = onOpenCommunity,
                onOpenRecords = onOpenRecords,
                onOpenMailTasks = onOpenMailTasks,
            )
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = viewModel::refresh,
                modifier = Modifier.fillMaxSize(),
            ) {
                MailboxList(
                    state = state,
                    hero = hero,
                    drawers = drawers,
                    drawerUnread = { drawerUnread[it.backendKey] ?: 0 },
                    selectedDrawer = selectedDrawer,
                    selectedTab = selectedTab,
                    pendingRoutingCount = pendingRoutingCount,
                    onSelectDrawer = viewModel::selectDrawer,
                    onSelectTab = viewModel::selectTab,
                    onOpenRoutingQueue = onOpenRoutingQueue,
                    onOpenMail = viewModel::openMail,
                    onRetry = viewModel::refresh,
                    onEndReached = viewModel::loadMoreIfNeeded,
                    onRetryMore = viewModel::retryLoadMore,
                )
            }
        }
        // Launch cut #8 (Mail extras): writing letters is hidden, so no compose button.
        if (LaunchFeatures.mailExtras) {
            FloatingActionButton(
                onClick = onOpenCompose,
                containerColor = PantopusColors.primary600,
                modifier = Modifier.align(Alignment.BottomEnd).padding(Spacing.s4).testTag("mailboxRootCompose"),
            ) {
                PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = "Write a letter", tint = PantopusColors.appTextInverse)
            }
        }
        deliveryMoment?.let { moment ->
            DeliveryMoment(count = moment.count, cameWhen = moment.cameWhen, onDone = viewModel::deliveryMomentShown)
        }
    }
}

@Composable
private fun MailboxList(
    state: MailboxUiState,
    hero: MailboxHeroState?,
    drawers: List<MailboxDrawer>,
    drawerUnread: (MailboxDrawer) -> Int,
    selectedDrawer: MailboxDrawer,
    selectedTab: MailboxTab,
    pendingRoutingCount: Int,
    onSelectDrawer: (MailboxDrawer) -> Unit,
    onSelectTab: (MailboxTab) -> Unit,
    onOpenRoutingQueue: () -> Unit,
    onOpenMail: (String) -> Unit,
    onRetry: () -> Unit,
    onEndReached: () -> Unit,
    onRetryMore: () -> Unit,
) {
    val listState = rememberLazyListState()
    // Near the end of the pieces: the next page.
    LaunchedEffect(listState, state) {
        snapshotFlow {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= listState.layoutInfo.totalItemsCount - LOAD_MORE_AHEAD
        }.distinctUntilChanged().filter { it }.collect { if ((state as? MailboxUiState.Loaded)?.hasMore == true) onEndReached() }
    }
    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = Spacing.s8)) {
        // Always the first item, so the card coming in after the first frame isn't inserted above the scroll position.
        item(key = "hero") { if (hero != null) MailboxHeroCard(hero) else MailboxHeroPlaceholder() }
        item(key = "drawers") { MailboxDrawerRow(drawers, selectedDrawer, drawerUnread, onSelectDrawer) }
        if (pendingRoutingCount > 0) item(key = "routing") { PendingRoutingBanner(pendingRoutingCount, onOpenRoutingQueue) }
        item(key = "tabs") { MailboxTabRow(MailboxTab.entries, selectedTab, onSelectTab) }
        when (state) {
            MailboxUiState.Loading -> items(SKELETON_PIECES, key = { "skeleton-$it" }) { MailPieceSkeleton() }
            is MailboxUiState.Error -> item(key = "error") { MailboxErrorCard(state.message, onRetry) }
            is MailboxUiState.Empty -> item(key = "empty") { MailboxEmptyCard(state.headline, state.body) }
            is MailboxUiState.Loaded -> {
                state.sections.forEach { section ->
                    if (section.title.isNotBlank()) {
                        item(key = "section-${section.id}", contentType = "heading") { MailSectionHeader(section.title) }
                    }
                    items(section.pieces, key = { it.id }, contentType = { it.kind }) { piece ->
                        MailPieceRow(piece, onOpen = { onOpenMail(piece.id) })
                    }
                }
                if (state.hasMore || state.loadMoreError != null) {
                    item(key = "footer") { MailboxListFooter(state.loadMoreError, onRetryMore) }
                }
            }
        }
    }
}

/** ☰ (or Back), "Mail", search, and the Mailbox's menu, as the drawing's header. */
@Composable
private fun MailboxTopBar(
    onBack: (() -> Unit)?,
    onOpenMenu: (() -> Unit)?,
    onOpenSearch: () -> Unit,
    onOpenVacationHold: () -> Unit,
    onOpenStamps: () -> Unit,
    onOpenMailParty: () -> Unit,
    onOpenCommunity: () -> Unit,
    onOpenRecords: () -> Unit,
    onOpenMailTasks: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s1, end = Spacing.s1, top = Spacing.s2, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            onBack != null ->
                IconButton(onClick = onBack) {
                    PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", tint = PantopusColors.appText)
                }
            onOpenMenu != null -> NavigationMenuButton(onClick = onOpenMenu, testTag = "mail.menu")
        }
        Text(
            "Mail",
            fontSize = 30.sp,
            lineHeight = 36.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).padding(start = Spacing.s1).semantics { heading() },
        )
        IconButton(onClick = onOpenSearch, modifier = Modifier.testTag("mailboxRootSearch")) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = "Search all mail",
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        MailboxMenu(
            onOpenVacationHold = onOpenVacationHold,
            onOpenStamps = onOpenStamps,
            onOpenMailParty = onOpenMailParty,
            onOpenCommunity = onOpenCommunity,
            onOpenRecords = onOpenRecords,
            onOpenMailTasks = onOpenMailTasks,
        )
    }
}

/** The Mailbox's menu: Mail tasks, Home records, Stamps and Vacation hold (Mail party and Community with Mail extras). */
@Composable
private fun MailboxMenu(
    onOpenVacationHold: () -> Unit,
    onOpenStamps: () -> Unit,
    onOpenMailParty: () -> Unit,
    onOpenCommunity: () -> Unit,
    onOpenRecords: () -> Unit,
    onOpenMailTasks: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    IconButton(onClick = { expanded = true }, modifier = Modifier.testTag("mailboxRootSettings")) {
        PantopusIconImage(
            icon = PantopusIcon.MoreVertical,
            contentDescription = "Mailbox menu",
            size = 22.dp,
            tint = PantopusColors.appText,
        )
    }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        @Composable
        fun entry(
            label: String,
            tag: String,
            onClick: () -> Unit,
        ) = DropdownMenuItem(
            text = { Text(label, color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onClick()
            },
            modifier = Modifier.testTag("mailboxRootSettings.$tag"),
        )
        entry("Mail tasks", "mailTasks", onOpenMailTasks)
        // Launch cut #8 (Mail extras): the Family Mail Party and the community mail stream are hidden.
        if (LaunchFeatures.mailExtras) {
            entry("Mail party", "mailParty", onOpenMailParty)
            entry("Community mail", "community", onOpenCommunity)
        }
        entry("Home records", "homeRecords", onOpenRecords)
        entry("Stamps", "stamps", onOpenStamps)
        entry("Vacation hold", "vacationHold", onOpenVacationHold)
    }
}

/** The next page is read this many items before the end of the list. */
private const val LOAD_MORE_AHEAD = 3

/** Piece-shaped placeholders while the first page is read. */
private const val SKELETON_PIECES = 3
