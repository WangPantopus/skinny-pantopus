@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.screens.mailbox.MailboxListViewModel
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The four mailbox drawers. `Business` carries the "Biz" short label per
 * the design; `Earn` (B.1) is new.
 */
enum class MailboxDrawer(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    /**
     * Fill tint when the chip is the active drawer. Me/Home/Biz use their
     * identity-pillar colour; Earn (not an identity pillar) uses the
     * primary tint — matching the JSX `DrawerPill` active treatment and
     * the Earn empty-state hero.
     */
    val accent: Color,
) {
    Me("me", "Me", PantopusIcon.User, PantopusColors.personal),
    Home("home", "Home", PantopusIcon.Home, PantopusColors.home),
    Business("business", "Biz", PantopusIcon.Briefcase, PantopusColors.business),
    Earn("earn", "Earn", PantopusIcon.DollarSign, PantopusColors.primary600),
    ;

    /**
     * Backend drawer key for `GET /api/mailbox/v2/drawer/:drawer`. The
     * route validates `['personal', 'home', 'business', 'earn']`
     * (`backend/routes/mailboxV2.js:286`); the UI's `Me` drawer is the
     * backend's `personal` drawer.
     */
    val backendKey: String get() = if (this == Me) "personal" else id
}

/** The three tabs within a drawer. */
enum class MailboxTab(
    val id: String,
    val label: String,
) {
    Incoming("incoming", "Incoming"),
    Counter("counter", "Counter"),
    Vault("vault", "Vault"),
}

/**
 * B.1 — Mailbox root archetype. One screen, four drawer contexts
 * (Me / Home / Biz / Earn) × three tabs (Incoming / Counter / Vault).
 * Replaces the old MailboxDrawersScreen + MailboxListScreen pair with a
 * unified drawer-tabs hybrid.
 *
 * Wiring (P1-B): the production [Inject] path is live —
 *  • `GET /api/mailbox/v2/drawers` (`backend/routes/mailboxV2.js:214`)
 *    seeds the per-drawer unread badges, and
 *  • `GET /api/mailbox/v2/drawer/:drawer?tab=…` (`…:280`) feeds the mail
 *    list for the active (drawer, tab) with limit/offset paging.
 * The internal secondary constructor is the test / preview seam: it
 * projects deterministic [MailboxRootSampleData] into the
 * [ListOfRowsUiState] render states and never touches the network
 * (mirrors the iOS `dataProvider` / `seededState` seam).
 */
@HiltViewModel
@Suppress("TooManyFunctions")
class MailboxRootViewModel
    @Inject
    constructor(
        // Nullable so the test/preview seam can construct without a repo;
        // Hilt always injects the non-null singleton on the production path.
        private val repo: MailboxRepository?,
    ) : ViewModel() {
        // Non-null → sample mode (offline preview/test seam); null → live.
        private var dataProvider: ((MailboxDrawer, MailboxTab) -> List<MailboxSampleSection>)? = null
        private var seededState: ListOfRowsUiState? = null

        /** Test / preview seam — sample-backed, never touches [repo]. */
        internal constructor(
            initialDrawer: MailboxDrawer = MailboxDrawer.Me,
            initialTab: MailboxTab = MailboxTab.Incoming,
            dataProvider: (MailboxDrawer, MailboxTab) -> List<MailboxSampleSection> = MailboxRootSampleData::sections,
            seededState: ListOfRowsUiState? = null,
        ) : this(repo = null) {
            this.dataProvider = dataProvider
            this.seededState = seededState
            _selectedDrawer.value = initialDrawer
            _selectedTab.value = initialTab
        }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)

        /** Observed UI state. */
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedDrawer = MutableStateFlow(MailboxDrawer.Me)

        /** Active drawer. */
        val selectedDrawer: StateFlow<MailboxDrawer> = _selectedDrawer.asStateFlow()

        private val _selectedTab = MutableStateFlow(MailboxTab.Incoming)

        /** Active tab. Preserved across drawer switches. */
        val selectedTab: StateFlow<MailboxTab> = _selectedTab.asStateFlow()

        private val _pendingRoutingCount = MutableStateFlow(0)

        /**
         * Count of mail sitting unresolved in `MailRoutingQueue` — drives the
         * "N items need routing" banner. `0` hides it. Source:
         * `GET /api/mailbox/v2/pending` (`backend/routes/mailboxV2.js:612`),
         * polled on load + refresh exactly like RN
         * (`src/app/mailbox/index.tsx:65-70`).
         */
        val pendingRoutingCount: StateFlow<Int> = _pendingRoutingCount.asStateFlow()

        val drawers: List<MailboxDrawer> = MailboxDrawer.entries
        val mailTabs: List<MailboxTab> = MailboxTab.entries

        private var onOpenMail: (String) -> Unit = {}
        private var onOpenSearch: () -> Unit = {}
        private var onOpenMap: () -> Unit = {}

        // A10.11 — opens the standalone Earn dashboard. Surfaced as the
        // Earn-drawer empty-state CTA (the drawer is intentionally
        // always-empty, so it acts as the launchpad into the Earn surface).
        private var onOpenEarn: () -> Unit = {}

        // ── Live paging state ──────────────────────────────────────────
        private val pageSize = 25
        private var offset = 0
        private var hasMore = false
        private var loadedMail: MutableList<DrawerMail> = mutableListOf()
        private var loading = false

        /** Bumped on every combo reload so a late in-flight page from a
         *  previous (drawer, tab) is discarded instead of clobbering the
         *  current view. */
        private var generation = 0

        /** Per-drawer unread counts from `GET /api/mailbox/v2/drawers`,
         *  keyed by backend drawer key (`personal`/`home`/`business`/`earn`). */
        private var drawerUnread: Map<String, Int> = emptyMap()

        /** Wire nav callbacks before first load. */
        fun configureNavigation(
            onOpenMail: (String) -> Unit,
            onOpenSearch: () -> Unit = {},
            onOpenMap: () -> Unit = {},
            onOpenEarn: () -> Unit = {},
        ) {
            this.onOpenMail = onOpenMail
            this.onOpenSearch = onOpenSearch
            this.onOpenMap = onOpenMap
            this.onOpenEarn = onOpenEarn
        }

        fun load() {
            seededState?.let {
                _state.value = it
                return
            }
            if (dataProvider != null) {
                rebuildFromSample()
                return
            }
            if (_state.value is ListOfRowsUiState.Loaded && loadedMail.isNotEmpty()) return
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                fetchDrawerBadges()
                fetchPendingRouting()
                reloadActiveCombo()
            }
        }

        fun refresh() {
            if (seededState != null) return
            if (dataProvider != null) {
                rebuildFromSample()
                return
            }
            viewModelScope.launch {
                fetchDrawerBadges()
                fetchPendingRouting()
                reloadActiveCombo()
            }
        }

        /** Called when the list nears the bottom — fetches the next page. */
        fun loadMoreIfNeeded() {
            if (dataProvider != null || !hasMore || loading) return
            viewModelScope.launch { fetchPage(generation) }
        }

        /** Switch drawer, preserving the active tab (B.1 acceptance). */
        fun selectDrawer(drawer: MailboxDrawer) {
            if (_selectedDrawer.value == drawer) return
            _selectedDrawer.value = drawer
            handleSelectionChange()
        }

        fun selectTab(tab: MailboxTab) {
            if (_selectedTab.value == tab) return
            _selectedTab.value = tab
            handleSelectionChange()
        }

        /** Unread badge for a drawer chip — total unread across its tabs.
         *  Live reads the per-drawer `unread_count` from `GET /drawers`;
         *  the sample path counts unviewed rows across the fixture's tabs. */
        fun drawerBadge(drawer: MailboxDrawer): Int =
            if (dataProvider != null) {
                MailboxTab.entries.sumOf { unreadCount(drawer, it) }
            } else {
                drawerUnread[drawer.backendKey] ?: 0
            }

        /**
         * Per-(drawer, tab) unread count for the segmented bar. Vault never
         * shows a count (saved mail isn't "unread"); a zero count hides the
         * badge. The live backend exposes per-*drawer* unread only (no
         * per-tab breakdown), so the wired path returns `null` for every
         * tab — the drawer-chip badge carries the unread signal instead.
         */
        fun tabBadge(tab: MailboxTab): Int? {
            if (dataProvider == null || tab == MailboxTab.Vault) return null
            return unreadCount(_selectedDrawer.value, tab).takeIf { it > 0 }
        }

        /** Sample-projection helper — counts unviewed rows for a
         *  (drawer, tab) in the injected fixture. `0` on the live path. */
        fun unreadCount(
            drawer: MailboxDrawer,
            tab: MailboxTab,
        ): Int {
            val provider = dataProvider ?: return 0
            return provider(drawer, tab).sumOf { section -> section.items.count { !it.item.viewed } }
        }

        // ── Selection routing ──────────────────────────────────────────

        private fun handleSelectionChange() {
            if (seededState != null) return
            if (dataProvider != null) {
                rebuildFromSample()
            } else {
                _state.value = ListOfRowsUiState.Loading
                viewModelScope.launch { reloadActiveCombo() }
            }
        }

        // ── Live fetch ─────────────────────────────────────────────────

        private suspend fun reloadActiveCombo() {
            val gen = ++generation
            offset = 0
            loadedMail = mutableListOf()
            fetchPage(gen)
        }

        private suspend fun fetchPage(gen: Int) {
            val repo = repo ?: return
            loading = true
            val drawer = _selectedDrawer.value
            val tab = _selectedTab.value
            val result = repo.drawer(drawer.backendKey, tab.id, pageSize, offset)
            loading = false
            // Drop late responses if the user has since switched combo.
            if (gen != generation) return
            when (result) {
                is NetworkResult.Success -> {
                    loadedMail.addAll(result.data.mail)
                    offset = loadedMail.size
                    hasMore = result.data.mail.size >= pageSize
                    applyLiveState(drawer, tab)
                }
                is NetworkResult.Failure -> _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
            }
        }

        private suspend fun fetchDrawerBadges() {
            val repo = repo ?: return
            when (val result = repo.drawers()) {
                is NetworkResult.Success ->
                    drawerUnread = result.data.drawers.associate { it.drawer to it.unreadCount }
                // Badges are non-blocking chrome — leave them empty on
                // failure so the list still renders.
                is NetworkResult.Failure -> drawerUnread = emptyMap()
            }
        }

        /**
         * Poll the disambiguation queue. The banner is non-blocking chrome —
         * a transport failure just leaves the count at zero so the list
         * still renders (mirrors RN's swallowed catch).
         */
        private suspend fun fetchPendingRouting() {
            val repo = repo ?: return
            _pendingRoutingCount.value =
                when (val result = repo.pending()) {
                    is NetworkResult.Success -> result.data.pending.size
                    is NetworkResult.Failure -> 0
                }
        }

        private fun applyLiveState(
            drawer: MailboxDrawer,
            tab: MailboxTab,
        ) {
            if (loadedMail.isEmpty()) {
                _state.value = emptyState(drawer, tab)
            } else {
                val rows =
                    loadedMail.map { dm ->
                        MailboxListViewModel.makeRow(
                            id = dm.id,
                            categoryRaw = dm.mailType ?: dm.type,
                            title = dm.displayTitle ?: dm.senderBusinessName ?: dm.senderDisplay,
                            subtitle = dm.senderBusinessName ?: dm.senderAddress ?: dm.senderDisplay,
                            body = dm.previewText,
                            createdAt = dm.createdAt,
                            viewed = dm.viewed,
                            trust = MailTrust.fromRaw(dm.senderTrust),
                            onOpenMail = { onOpenMail(it) },
                        )
                    }
                _state.value =
                    ListOfRowsUiState.Loaded(
                        sections = listOf(RowSection(id = "mail", rows = rows)),
                        hasMore = hasMore,
                    )
            }
        }

        // ── Sample projection (preview/test seam) ──────────────────────

        private fun rebuildFromSample() {
            val provider = dataProvider ?: return
            val drawer = _selectedDrawer.value
            val tab = _selectedTab.value
            val sections = provider(drawer, tab).filter { it.items.isNotEmpty() }
            _state.value =
                if (sections.isEmpty()) {
                    emptyState(drawer, tab)
                } else {
                    ListOfRowsUiState.Loaded(
                        sections = sections.map { rowSection(it, drawer, tab) },
                        hasMore = false,
                    )
                }
        }

        private fun rowSection(
            section: MailboxSampleSection,
            drawer: MailboxDrawer,
            tab: MailboxTab,
        ): RowSection =
            RowSection(
                id = "${drawer.id}.${tab.id}.${section.id}",
                header = section.header,
                rows =
                    section.items.map { sample ->
                        MailboxListViewModel.makeRow(
                            mail = sample.item,
                            onOpenMail = { onOpenMail(it) },
                            trustOverride = sample.trust,
                        )
                    },
            )

        private fun emptyState(
            drawer: MailboxDrawer,
            tab: MailboxTab,
        ): ListOfRowsUiState.Empty =
            when {
                drawer == MailboxDrawer.Earn && tab == MailboxTab.Incoming ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Wallet,
                        headline = "No earn items yet",
                        subcopy = "Complete gigs to see payouts, 1099s, and tax docs land here automatically.",
                        ctaTitle = "Open Earn dashboard",
                        onCta = { onOpenEarn() },
                    )
                drawer == MailboxDrawer.Earn && tab == MailboxTab.Counter ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Wallet,
                        headline = "Nothing to action",
                        subcopy = "Payout approvals and tax to-dos for your gigs show up here.",
                    )
                drawer == MailboxDrawer.Earn && tab == MailboxTab.Vault ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Archive,
                        headline = "No saved earn mail",
                        subcopy = "Save payout statements and 1099s to find them fast.",
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = if (tab == MailboxTab.Vault) PantopusIcon.Archive else PantopusIcon.Mailbox,
                        headline = "No mail in ${drawer.label} → ${tab.label} yet",
                        subcopy = "When something lands here, it shows up in this view.",
                    )
            }
    }
