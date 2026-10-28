@file:Suppress("LongMethod", "LongParameterList", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.mailbox.v2.MailHome
import app.pantopus.android.data.api.models.mailbox.v2.MailVacationHold
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.components.NavigationMenuButton
import app.pantopus.android.ui.screens.ceremonial_mail_open.MailWelcomePorch
import app.pantopus.android.ui.screens.mailbox.components.MailboxHeroState
import app.pantopus.android.ui.screens.place.verify.PlaceVerifyMethod
import app.pantopus.android.ui.screens.place.verify.PlaceVerifySheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import java.time.ZoneId

/**
 * The Mailbox, the Mail tab's top screen (Mail tab, receiving; drawings `Main`, `R1-Before`, `R2-Delivery`,
 * `R4-NoMail`, `R9-Counter`, `R10-Vault`, `R11-Vacation`, `R12-Welcome`, `R14-HomeLocked`). One scrolling page: the
 * morning round in the hero card, a mail hold when there is one, the drawers Me · Home · Biz, and Incoming · Counter ·
 * Vault: the pieces drawn as paper, grouped by the day they came; the Counter with its due tags, soonest first; the
 * Vault's folders, search and archive. A Home whose address isn't proven yet is a closed box with Verify your home. The
 * first visit after a round plays the delivery moment; the first day brings the porch with the sealed welcome letter.
 * Errors say what happened and offer Try again; pull to refresh reads everything again.
 *
 * The menu keeps Mail tasks, Home records, Stamps and Hold my mail (Mail party and Community with Mail extras). The
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
    /** Pay on the Counter: the existing invoice screen for that bill's invoice. */
    onPay: (invoiceId: String) -> Unit = {},
    /** Verify your home on the closed Home drawer: the Place verify sheet's doors for that Home. */
    onStartVerify: ((homeId: String, method: PlaceVerifyMethod) -> Unit)? = null,
    onOpenVerificationStatus: ((homeId: String) -> Unit)? = null,
    viewModel: MailboxRootViewModel = hiltViewModel(),
    vault: MailVaultViewModel = hiltViewModel(),
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
    val homes by viewModel.homes.collectAsStateWithLifecycle()
    val hold by viewModel.vacationHold.collectAsStateWithLifecycle()
    val welcome by viewModel.welcome.collectAsStateWithLifecycle()
    val zone by viewModel.mailZone.collectAsStateWithLifecycle()
    var verifyHome by remember { mutableStateOf<MailHome?>(null) }

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenMail = onOpenMail)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMailboxRootViewed)
    }
    // The Vault's folders for the open drawer, read when the Vault tab shows.
    LaunchedEffect(selectedTab, selectedDrawer, homes) {
        if (selectedTab == MailboxTab.Vault) vault.show(selectedDrawer, homes)
    }
    // Back on the Mailbox after a while (or the next morning, or from paying a bill): today's mail, not what was read before.
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
                onRefresh = {
                    viewModel.refresh()
                    if (selectedTab == MailboxTab.Vault) vault.refresh()
                },
                modifier = Modifier.fillMaxSize(),
            ) {
                MailboxList(
                    state = state,
                    hero = hero,
                    hold = hold,
                    zone = zone,
                    drawers = drawers,
                    drawerUnread = { drawerUnread[it.backendKey] ?: 0 },
                    selectedDrawer = selectedDrawer,
                    selectedTab = selectedTab,
                    homes = homes,
                    pendingRoutingCount = pendingRoutingCount,
                    vault = vault,
                    viewModel = viewModel,
                    onOpenHold = onOpenVacationHold,
                    onOpenRoutingQueue = onOpenRoutingQueue,
                    onPay = { invoiceId ->
                        viewModel.payOpened()
                        onPay(invoiceId)
                    },
                    onVerify = { home -> verifyHome = home },
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
    // The first day: once the delivery moment has played, Pantopus's sealed welcome letter waits on the porch.
    val porch = welcome
    if (porch != null && deliveryMoment == null) {
        Dialog(
            onDismissRequest = viewModel::welcomeDone,
            properties = DialogProperties(decorFitsSystemWindows = false),
        ) {
            // Compose 1.7 measures non-default-width dialogs against the whole display, which can be taller than the
            // window on Android 15: keep the window's constraints and stretch the window itself (as MediaViewerDialog).
            val window = (LocalView.current.parent as? DialogWindowProvider)?.window
            SideEffect { window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT) }
            MailWelcomePorch(
                mailId = porch.mailId,
                address = porch.address,
                onOpen = {
                    viewModel.welcomeDone()
                    viewModel.openMail(porch.mailId)
                },
                onClose = viewModel::welcomeDone,
            )
        }
    }
    verifyHome?.let { home ->
        if (onStartVerify != null) {
            PlaceVerifySheet(
                address = home.addressLine.orEmpty(),
                homeId = home.homeId,
                onStart = { method ->
                    verifyHome = null
                    onStartVerify(home.homeId, method)
                },
                onDismiss = { verifyHome = null },
                onOpenDocumentStatus =
                    onOpenVerificationStatus?.let { open ->
                        {
                            verifyHome = null
                            open(home.homeId)
                        }
                    },
            )
        }
    }
}

@Composable
private fun MailboxList(
    state: MailboxUiState,
    hero: MailboxHeroState?,
    hold: MailVacationHold?,
    zone: ZoneId,
    drawers: List<MailboxDrawer>,
    drawerUnread: (MailboxDrawer) -> Int,
    selectedDrawer: MailboxDrawer,
    selectedTab: MailboxTab,
    homes: List<MailHome>,
    pendingRoutingCount: Int,
    vault: MailVaultViewModel,
    viewModel: MailboxRootViewModel,
    onOpenHold: () -> Unit,
    onOpenRoutingQueue: () -> Unit,
    onPay: (String) -> Unit,
    onVerify: (MailHome) -> Unit,
) {
    val shelf by viewModel.vaultShelf.collectAsStateWithLifecycle()
    val folders by vault.folders.collectAsStateWithLifecycle()
    val query by vault.query.collectAsStateWithLifecycle()
    val search by vault.search.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    // "Your mail is here" or Mail tapped again: back up to the hero (Incoming for the morning's mail), even when the ask
    // came while another tab was showing and this list is coming back where it was left.
    val top by MailboxRepository.mailboxTop.collectAsStateWithLifecycle()
    var shownTop by rememberSaveable { mutableLongStateOf(top.id) }
    LaunchedEffect(top) {
        if (top.id != shownTop) {
            shownTop = top.id
            if (top.incoming) viewModel.selectTab(MailboxTab.Incoming)
            listState.scrollToItem(0)
        }
    }
    val searching = selectedTab == MailboxTab.Vault && search != null
    val endReached by rememberUpdatedState { if (!searching) viewModel.loadMoreIfNeeded() }
    // Near the end of the pieces: the next page.
    LaunchedEffect(listState, state) {
        snapshotFlow {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= listState.layoutInfo.totalItemsCount - LOAD_MORE_AHEAD
        }.distinctUntilChanged().filter { it }.collect { if ((state as? MailboxUiState.Loaded)?.hasMore == true) endReached() }
    }
    // Home mail opens once the address is proven: with no Home open yet, the drawer is a closed box.
    val waiting = homes.filter { it.mailAccess == "needs_proof" }
    val closedHome = waiting.firstOrNull()?.takeIf { selectedDrawer == MailboxDrawer.Home && homes.none { it.mailAccess == "open" } }
    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = Spacing.s8)) {
        // Always the first item, so the card coming in after the first frame isn't inserted above the scroll position.
        item(key = "hero") { if (hero != null) MailboxHeroCard(hero) else MailboxHeroPlaceholder() }
        if (hold != null) item(key = "hold") { MailHoldBanner(hold, zone, onOpenHold) }
        item(key = "drawers") { MailboxDrawerRow(drawers, selectedDrawer, drawerUnread, viewModel::selectDrawer) }
        if (pendingRoutingCount > 0) item(key = "routing") { PendingRoutingBanner(pendingRoutingCount, onOpenRoutingQueue) }
        item(key = "tabs") { MailboxTabRow(MailboxTab.entries, selectedTab, viewModel::selectTab) }
        if (closedHome != null) {
            item(key = "closedHome") {
                MailClosedHomeDrawer(
                    closedHome,
                    onVerify = { onVerify(closedHome) },
                    onGoToMe = { viewModel.selectDrawer(MailboxDrawer.Me) },
                )
            }
            return@LazyColumn
        }
        if (selectedDrawer == MailboxDrawer.Home) {
            waiting.firstOrNull()?.let { home -> item(key = "homeWaiting") { MailHomeWaitingBanner(home) { onVerify(home) } } }
        }
        when (selectedTab) {
            MailboxTab.Incoming -> incomingItems(state, viewModel)
            MailboxTab.Counter -> counterItems(state, viewModel, onPay)
            MailboxTab.Vault ->
                vaultItems(
                    VaultContent(state, shelf, folders, query, search, zone),
                    vault,
                    viewModel,
                )
        }
    }
}

/** Incoming: the pieces by the day they came. */
private fun LazyListScope.incomingItems(
    state: MailboxUiState,
    viewModel: MailboxRootViewModel,
) {
    when (state) {
        MailboxUiState.Loading -> items(SKELETON_PIECES, key = { "skeleton-$it" }) { MailPieceSkeleton() }
        is MailboxUiState.Error -> item(key = "error") { MailboxErrorCard(state.message, viewModel::refresh) }
        is MailboxUiState.Empty -> item(key = "empty") { MailboxEmptyCard(state.headline, state.body) }
        is MailboxUiState.Loaded -> {
            state.sections.forEach { section ->
                if (section.title.isNotBlank()) {
                    item(key = "section-${section.id}", contentType = "heading") { MailSectionHeader(section.title) }
                }
                items(section.pieces, key = { it.id }, contentType = { it.kind }) { piece ->
                    MailPieceRow(piece, onOpen = { viewModel.openMail(piece.id) })
                }
            }
            if (state.hasMore || state.loadMoreError != null) {
                item(key = "footer") { MailboxListFooter(state.loadMoreError, viewModel::retryLoadMore) }
            }
        }
    }
}

/** The Counter: what needs the person, soonest due first, each with its tag and its button (board `R9-Counter`). */
private fun LazyListScope.counterItems(
    state: MailboxUiState,
    viewModel: MailboxRootViewModel,
    onPay: (String) -> Unit,
) {
    when (state) {
        MailboxUiState.Loading -> items(SKELETON_PIECES, key = { "skeleton-$it" }) { MailPieceSkeleton() }
        is MailboxUiState.Error -> item(key = "error") { MailboxErrorCard(state.message, viewModel::refresh) }
        is MailboxUiState.Empty -> item(key = "empty") { MailboxEmptyCard(state.headline, state.body) }
        is MailboxUiState.Loaded -> {
            item(key = "counterTop") { MailCounterTop(maxOf(state.total ?: 0, state.counter.size)) }
            itemsIndexed(state.counter, key = { _, item -> item.id }, contentType = { _, _ -> "counter" }) { index, item ->
                MailCounterRow(
                    item = item,
                    index = index,
                    onOpen = { viewModel.openMail(item.id) },
                    onAction = { item.payInvoiceId?.let(onPay) ?: viewModel.openMail(item.id) },
                )
            }
            item(key = "counterEnd") { MailCounterEnd(state.hasMore, state.loadMoreError, viewModel::retryLoadMore) }
        }
    }
}

/** What the Vault tab draws from: the filed list, the shelf it shows, the cabinet's folders and the search. */
private data class VaultContent(
    val state: MailboxUiState,
    val shelf: MailVaultShelf,
    val folders: MailVaultFolders,
    val query: String,
    val search: MailVaultSearch?,
    val zone: ZoneId,
)

/**
 * The Vault (board `R10-Vault`): search over everything filed, the drawer's manila folders (each Home's shared cabinet
 * for Home mail), Archived, and what's filed, newest first; a folder or Archived opens in place with All folders to go
 * back.
 */
private fun LazyListScope.vaultItems(
    content: VaultContent,
    vault: MailVaultViewModel,
    viewModel: MailboxRootViewModel,
) {
    item(key = "vaultSearch") {
        MailVaultSearchField(
            query = content.query,
            searching = content.search?.searching == true,
            onChange = vault::onQueryChange,
            onSubmit = vault::submitSearch,
            onClear = vault::clearSearch,
        )
    }
    val search = content.search
    if (search != null) return vaultSearchItems(search, content.zone, vault, viewModel)
    when (val shelf = content.shelf) {
        MailVaultShelf.All -> vaultCabinetItems(content.folders, vault, viewModel)
        is MailVaultShelf.Folder, MailVaultShelf.Archived -> {
            item(key = "vaultAllFolders") {
                MailVaultLinkRow("All folders", PantopusIcon.ChevronLeft, "mailVaultAllFolders", trailing = false) {
                    viewModel.openVaultShelf(MailVaultShelf.All)
                }
            }
            item(key = "vaultShelfTitle") { MailVaultShelfTitle(if (shelf is MailVaultShelf.Folder) shelf.label else "Archived") }
        }
    }
    when (val state = content.state) {
        MailboxUiState.Loading -> items(SKELETON_PIECES, key = { "skeleton-$it" }) { MailPieceSkeleton() }
        is MailboxUiState.Error -> item(key = "vaultError") { MailVaultProblem(state.message, "mailVaultError", viewModel::refresh) }
        is MailboxUiState.Empty -> item(key = "vaultEmpty") { MailVaultNote(state.body, "mailVaultEmpty") }
        is MailboxUiState.Loaded -> {
            items(state.filed, key = { it.id }, contentType = { "filed" }) { row ->
                MailFiledRow(row, vault.folderName(row.vaultFolderId), content.zone) { viewModel.openMail(row.id) }
            }
            if (state.hasMore || state.loadMoreError != null) {
                item(key = "footer") { MailboxListFooter(state.loadMoreError, viewModel::retryLoadMore) }
            }
        }
    }
}

/** The cabinet: the folders in pairs, titled per Home when there are several, then Archived and the filed list's heading. */
private fun LazyListScope.vaultCabinetItems(
    folders: MailVaultFolders,
    vault: MailVaultViewModel,
    viewModel: MailboxRootViewModel,
) {
    when (folders) {
        MailVaultFolders.Loading -> item(key = "vaultFoldersLoading") { MailPieceSkeleton() }
        is MailVaultFolders.Error ->
            item(key = "vaultFoldersError") { MailVaultProblem(folders.message, "mailVaultFoldersError", vault::refresh) }
        is MailVaultFolders.Loaded ->
            folders.cabinets.forEach { cabinet ->
                cabinet.title?.let { title -> item(key = "cabinet-${cabinet.key}") { MailSectionHeader(title) } }
                cabinet.folders.chunked(2).forEachIndexed { index, pair ->
                    item(key = "folders-${cabinet.key}-$index", contentType = "folders") {
                        MailVaultFolderRow(pair) { folder -> viewModel.openVaultShelf(MailVaultShelf.Folder(folder.id, folder.label)) }
                    }
                }
            }
    }
    item(key = "vaultArchived") {
        MailVaultLinkRow("Archived", PantopusIcon.Archive, "mailVaultArchived") { viewModel.openVaultShelf(MailVaultShelf.Archived) }
    }
    item(key = "vaultFiledTitle") { MailSectionHeader("Filed mail") }
}

/** Search results: the filed and archived pieces that match, or why not. */
private fun LazyListScope.vaultSearchItems(
    search: MailVaultSearch,
    zone: ZoneId,
    vault: MailVaultViewModel,
    viewModel: MailboxRootViewModel,
) {
    when {
        search.results.isEmpty() && search.error != null ->
            item(key = "vaultSearchError") { MailVaultProblem(search.error, "mailVaultSearchError", vault::submitSearch) }
        search.results.isEmpty() && search.searching -> item(key = "vaultSearching") { MailPieceSkeleton() }
        search.results.isEmpty() ->
            item(key = "vaultNoMatches") {
                MailVaultNote("Nothing you've filed matches. Try a sender or a word from the letter.", "mailVaultNoMatches")
            }
        else -> {
            item(key = "vaultMatches") {
                MailSectionHeader(if (search.results.size == 1) "1 filed piece matches" else "${search.results.size} filed pieces match")
            }
            items(search.results, key = { "match-${it.id}" }, contentType = { "filed" }) { row ->
                MailFiledRow(row, vault.folderName(row.vaultFolderId), zone) { viewModel.openMail(row.id) }
            }
            when {
                search.error != null ->
                    item(key = "vaultMoreError") { MailVaultProblem(search.error, "mailVaultMoreError", vault::loadMoreResults) }
                search.canLoadMore || search.searching ->
                    item(key = "vaultMore") { MailVaultMore(search.searching, vault::loadMoreResults) }
            }
        }
    }
}

/** An open folder's name, or Archived, over its pieces. */
@Composable
private fun MailVaultShelfTitle(title: String) {
    Text(
        title,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appText,
        modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1, bottom = Spacing.s2).semantics { heading() },
    )
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

/** The Mailbox's menu: Mail tasks, Home records, Stamps and Hold my mail (Mail party and Community with Mail extras). */
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
        entry("Hold my mail", "vacationHold", onOpenVacationHold)
    }
}

/** The next page is read this many items before the end of the list. */
private const val LOAD_MORE_AHEAD = 3

/** Piece-shaped placeholders while the first page is read. */
private const val SKELETON_PIECES = 3
