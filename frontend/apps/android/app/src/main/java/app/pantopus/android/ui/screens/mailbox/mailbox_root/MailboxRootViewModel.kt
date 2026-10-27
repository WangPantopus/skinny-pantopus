@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mailbox.v2.DrawerListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.mailbox.MailDeliverySeen
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.MailAddressBook
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.components.MailSection
import app.pantopus.android.ui.screens.mailbox.components.MailboxHeroState
import app.pantopus.android.ui.screens.mailbox.components.MappedMail
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import javax.inject.Inject

/**
 * The mailbox drawers. `Business` carries the "Biz" short label per the design; Earn stays hidden with Mail extras.
 */
enum class MailboxDrawer(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    /** Fill tint when the chip is the active drawer: the drawer's identity colour. */
    val accent: Color,
) {
    Me("me", "Me", PantopusIcon.User, PantopusColors.personal),
    Home("home", "Home", PantopusIcon.Home, PantopusColors.home),
    Business("business", "Biz", PantopusIcon.Briefcase, PantopusColors.business),
    Earn("earn", "Earn", PantopusIcon.DollarSign, PantopusColors.primary600),
    ;

    /** Backend drawer key for `GET /api/mailbox/v2/drawer/:drawer`; the UI's `Me` is the backend's `personal`. */
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

/** The delivery moment to play: how many pieces the round brought, and when ("this morning", or "today" after noon). */
data class MailDeliveryMoment(
    val count: Int,
    val cameWhen: String,
)

/** What the Mailbox's list shows for the open drawer and tab. */
sealed interface MailboxUiState {
    data object Loading : MailboxUiState

    data class Loaded(
        val sections: List<MailSection>,
        val hasMore: Boolean,
        /** Why the next page failed; the pieces stay and the end of the list offers Try again. */
        val loadMoreError: String? = null,
    ) : MailboxUiState

    data class Empty(
        val headline: String,
        val body: String,
    ) : MailboxUiState

    data class Error(
        val message: String,
    ) : MailboxUiState
}

/**
 * The Mailbox (Mail tab, receiving; drawings `Main`, `R1-Before`, `R2-Delivery`, `R4-NoMail`): the morning round in
 * the hero, the drawers Me · Home · Biz (Biz for business owners, or whenever it holds mail) with Incoming · Counter ·
 * Vault, and each piece drawn as the thing it is, grouped by the day it came.
 *
 * Reads `GET /api/mailbox/v2/drawers` (counts, `delivery`, `homes`) and `GET /api/mailbox/v2/drawer/:drawer?tab=`
 * (pieces, paged by 25).
 */
@HiltViewModel
@Suppress("TooManyFunctions")
class MailboxRootViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
        private val businesses: BusinessesRepository,
        private val auth: AuthRepository,
        private val deliverySeen: MailDeliverySeen,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MailboxUiState>(MailboxUiState.Loading)
        val state: StateFlow<MailboxUiState> = _state.asStateFlow()

        private val _hero = MutableStateFlow<MailboxHeroState?>(null)

        /** The top card; null until the mailbox's counts have been read once. */
        val hero: StateFlow<MailboxHeroState?> = _hero.asStateFlow()

        private val _selectedDrawer = MutableStateFlow(MailboxDrawer.Me)
        val selectedDrawer: StateFlow<MailboxDrawer> = _selectedDrawer.asStateFlow()

        private val _selectedTab = MutableStateFlow(MailboxTab.Incoming)
        val selectedTab: StateFlow<MailboxTab> = _selectedTab.asStateFlow()

        private val _drawers = MutableStateFlow(listOf(MailboxDrawer.Me, MailboxDrawer.Home))

        /** Me and Home always; Biz for business owners and whenever it holds mail; Earn only with Mail extras. */
        val drawers: StateFlow<List<MailboxDrawer>> = _drawers.asStateFlow()

        private val _drawerUnread = MutableStateFlow<Map<String, Int>>(emptyMap())

        /** Unopened pieces per drawer, keyed by [MailboxDrawer.backendKey]. */
        val drawerUnread: StateFlow<Map<String, Int>> = _drawerUnread.asStateFlow()

        private val _pendingRoutingCount = MutableStateFlow(0)

        /** Mail waiting in the routing queue ("N items need routing"); 0 hides the banner. */
        val pendingRoutingCount: StateFlow<Int> = _pendingRoutingCount.asStateFlow()

        private val _refreshing = MutableStateFlow(false)

        /** A pull to refresh is reading; the indicator stops when it's done, whatever it found. */
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private val _deliveryMoment = MutableStateFlow<MailDeliveryMoment?>(null)

        /**
         * What today's round brought, the first time this phone shows the Mailbox after that round: the door opens and
         * the pieces slide out once. Null when there's nothing to play.
         */
        val deliveryMoment: StateFlow<MailDeliveryMoment?> = _deliveryMoment.asStateFlow()

        private var onOpenMail: (String) -> Unit = {}

        private var book = MailAddressBook(personName = null)

        /** The server listed the person's Homes (`homes`), so the Home drawer can say why it's empty. */
        private var homesKnown = false
        private var zone = java.time.ZoneId.systemDefault()
        private var deliveredAt: String? = null
        private var ownsBusiness = false

        /** When everything was last read; the Mailbox reads again when it comes back after a while or on a new day. */
        private var lastReadAt: Instant? = null

        private val pageSize = 25
        private var offset = 0
        private var hasMore = false

        /** The pieces read so far, each drawn once when its page came. */
        private var loadedMail: MutableList<MappedMail> = mutableListOf()
        private var loading = false

        /** Bumped on every reload so a late page from an earlier drawer or tab can't replace the current one. */
        private var generation = 0
        private var loadMoreError: String? = null

        init {
            // A letter shredded, filed or archived from its page leaves this tab; opening one breaks its seal.
            viewModelScope.launch { MailboxRepository.mailLeftList.collect { mailId -> dropLoadedMail(mailId) } }
            viewModelScope.launch { MailboxRepository.mailViewed.collect { mailId -> markLoadedMailViewed(mailId) } }
            // A mail push came in: read the open tab and the counts again, as the Mail tab's badge does.
            viewModelScope.launch {
                MailboxRepository.mailArrived.collect { if (_state.value !is MailboxUiState.Loading) refreshQuietly() }
            }
            // A letter was put on the counter or brought back from its page: read the tab again.
            viewModelScope.launch {
                MailboxRepository.mailChanged.collect { if (_state.value !is MailboxUiState.Loading) refreshQuietly() }
            }
        }

        fun configureNavigation(onOpenMail: (String) -> Unit) {
            this.onOpenMail = onOpenMail
        }

        fun openMail(mailId: String) = onOpenMail(mailId)

        fun load() {
            if (_state.value is MailboxUiState.Loaded && loadedMail.isNotEmpty()) return
            _state.value = MailboxUiState.Loading
            viewModelScope.launch { readAll() }
        }

        /** Pull to refresh and Try again: everything read again, the pieces kept on screen meanwhile. */
        fun refresh() {
            viewModelScope.launch {
                _refreshing.value = true
                try {
                    readAll()
                } finally {
                    _refreshing.value = false
                }
            }
        }

        /**
         * The Mailbox is showing again (back from a letter, another tab or the background): read again if the last
         * read is a while ago or from another day, so the morning's mail, its moment and the hero are today's.
         */
        fun refreshIfStale() {
            val read = lastReadAt ?: return
            if (_state.value is MailboxUiState.Loading) return
            val now = Instant.now()
            val newDay = read.atZone(zone).toLocalDate() != now.atZone(zone).toLocalDate()
            if (newDay || java.time.Duration.between(read, now) > STALE_AFTER) refreshQuietly()
        }

        /** The same read without the pull indicator, keeping as many pieces as are loaded (mail came in, or it was stale). */
        private fun refreshQuietly() {
            val keep = loadedMail.size.coerceIn(pageSize, MAX_PAGE)
            viewModelScope.launch { readAll(limit = keep) }
        }

        private suspend fun readAll(limit: Int = pageSize) {
            lastReadAt = Instant.now()
            val owner = viewModelScope.async { readBusinessOwnership() }
            readDrawers()
            readPendingRouting()
            owner.await()
            updateDrawers()
            reloadActiveTab(limit)
        }

        /** Near the end of the list: the next page, unless the last one failed (then only [retryLoadMore] asks). */
        fun loadMoreIfNeeded() {
            if (loadMoreError != null || !hasMore || loading) return
            viewModelScope.launch { fetchPage(generation) }
        }

        fun retryLoadMore() {
            if (loadMoreError == null || loading) return
            loadMoreError = null
            publish()
            viewModelScope.launch { fetchPage(generation) }
        }

        fun selectDrawer(drawer: MailboxDrawer) {
            if (_selectedDrawer.value == drawer) return
            _selectedDrawer.value = drawer
            switchList()
        }

        fun selectTab(tab: MailboxTab) {
            if (_selectedTab.value == tab) return
            _selectedTab.value = tab
            switchList()
        }

        /** The delivery moment played, or was skipped: it won't play again for this round. */
        fun deliveryMomentShown() {
            _deliveryMoment.value = null
            val user = signedInUserId() ?: return
            deliveredAt?.let { deliverySeen.markShown(user, it) }
        }

        private fun switchList() {
            _state.value = MailboxUiState.Loading
            viewModelScope.launch { reloadActiveTab() }
        }

        private suspend fun readDrawers() {
            when (val result = repo.drawers()) {
                is NetworkResult.Success -> showDrawers(result.data)
                // The counts keep what they last showed; a hero never read says so instead of loading forever.
                is NetworkResult.Failure ->
                    if (_hero.value == null) {
                        _hero.value =
                            MailboxHeroState(
                                title = "Your mail",
                                // The list below says what went wrong and offers Try again; this only says what's missing.
                                detail = "Couldn't read today's delivery.",
                                address = null,
                                number = null,
                            )
                    }
            }
        }

        private fun showDrawers(response: DrawerListResponse) {
            _drawerUnread.value = response.drawers.associate { it.drawer to it.unreadCount }
            book = MailAddressBook(personName = signedInName(), homes = response.homes.orEmpty())
            homesKnown = response.homes != null
            zone = MailPieceMapper.zoneOf(response.delivery)
            _hero.value = MailboxHeroState.from(response.delivery, book)
            val last = response.delivery?.lastAt
            deliveredAt = last
            val today = Instant.now().atZone(zone).toLocalDate()
            val lastTime = last?.let { runCatching { Instant.parse(it) }.getOrNull() }?.atZone(zone)
            val user = signedInUserId()
            val count = response.delivery?.lastCount ?: 0
            // Today's round, with mail in it, not played yet on this phone for this person (kept as the server wrote it).
            val round = last?.takeIf { lastTime?.toLocalDate() == today && count > 0 }
            if (round != null && user != null && !deliverySeen.shown(user, round)) {
                val morning = (lastTime?.hour ?: 0) < NOON
                _deliveryMoment.value = MailDeliveryMoment(count, cameWhen = if (morning) "this morning" else "today")
            }
        }

        private suspend fun readBusinessOwnership() {
            if (ownsBusiness) return
            ownsBusiness =
                when (val result = businesses.myBusinesses()) {
                    is NetworkResult.Success -> result.data.businesses.any { it.roleBase == "owner" }
                    is NetworkResult.Failure -> false
                }
        }

        private fun updateDrawers() {
            val bizHasMail = (_drawerUnread.value[MailboxDrawer.Business.backendKey] ?: 0) > 0
            _drawers.value =
                buildList {
                    add(MailboxDrawer.Me)
                    add(MailboxDrawer.Home)
                    if (ownsBusiness || bizHasMail || _selectedDrawer.value == MailboxDrawer.Business) add(MailboxDrawer.Business)
                    if (LaunchFeatures.mailExtras) add(MailboxDrawer.Earn)
                }
        }

        private suspend fun readPendingRouting() {
            _pendingRoutingCount.value =
                when (val result = repo.pending()) {
                    is NetworkResult.Success -> result.data.pending.size
                    is NetworkResult.Failure -> 0
                }
        }

        private suspend fun reloadActiveTab(limit: Int = pageSize) {
            val gen = ++generation
            offset = 0
            loadedMail = mutableListOf()
            loadMoreError = null
            hasMore = false
            fetchPage(gen, limit)
        }

        private suspend fun fetchPage(
            gen: Int,
            limit: Int = pageSize,
        ) {
            loading = true
            val drawer = _selectedDrawer.value
            val tab = _selectedTab.value
            val result = repo.drawer(drawer.backendKey, tab.id, limit, offset)
            // A late page from an earlier drawer or tab must not touch the current one or its loading guard.
            if (gen != generation) return
            // Each new piece is drawn once, off the main thread (dates and words), so a long list stays smooth.
            val page =
                (result as? NetworkResult.Success)?.data?.mail?.let { rows ->
                    val book = book
                    val zone = zone
                    withContext(Dispatchers.Default) { rows.map { MailPieceMapper.map(it, book, zone) } }
                }
            if (gen != generation) return
            loading = false
            when (result) {
                is NetworkResult.Success -> {
                    loadedMail.addAll(page.orEmpty())
                    offset = loadedMail.size
                    hasMore = result.data.mail.size >= limit
                    publish()
                }
                is NetworkResult.Failure -> {
                    val message = result.error.mailMessage(online = network.isOnline.value)
                    if (loadedMail.isEmpty()) {
                        _state.value = MailboxUiState.Error(message)
                    } else {
                        loadMoreError = message
                        publish()
                    }
                }
            }
        }

        private fun publish() {
            _state.value =
                if (loadedMail.isEmpty()) {
                    emptyState(_selectedDrawer.value, _selectedTab.value)
                } else {
                    MailboxUiState.Loaded(
                        // Incoming by the day it came; the Counter keeps the server's soonest-due order, the Vault its own.
                        sections = MailPieceMapper.sections(loadedMail, zone, byDay = _selectedTab.value == MailboxTab.Incoming),
                        hasMore = hasMore,
                        loadMoreError = loadMoreError,
                    )
                }
        }

        private fun markLoadedMailViewed(mailId: String) {
            val index = loadedMail.indexOfFirst { it.row.id == mailId }
            if (index >= 0) {
                loadedMail[index] = MailPieceMapper.map(loadedMail[index].row.copy(viewed = true), book, zone)
                publish()
            }
            viewModelScope.launch { readDrawers() }
        }

        private fun dropLoadedMail(mailId: String) {
            if (loadedMail.none { it.row.id == mailId }) return
            loadedMail.removeAll { it.row.id == mailId }
            offset = loadedMail.size
            if (loadedMail.isEmpty() && hasMore) {
                _state.value = MailboxUiState.Loading
                refreshQuietly()
            } else {
                publish()
                viewModelScope.launch { readDrawers() }
            }
        }

        /** Why the Home drawer is empty: no Home yet, a Home not verified yet (its mail waits), or simply no mail. */
        private fun homeEmptyState(): MailboxUiState.Empty =
            when {
                homesKnown && book.homes.isEmpty() ->
                    MailboxUiState.Empty(
                        "No home on Pantopus yet",
                        "Add your home and verify your address, and its mail comes here each morning.",
                    )
                homesKnown && book.homes.none { it.mailAccess == "open" } ->
                    MailboxUiState.Empty(
                        "Verify your home to open its mail",
                        "Prove your address to open your home's mail. It waits here for you until then.",
                    )
                else -> MailboxUiState.Empty("No mail for your home yet", "Mail addressed to your home comes here each morning.")
            }

        private fun signedInUserId(): String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private fun signedInName(): String? =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.displayName?.takeIf { it.isNotBlank() }

        private fun emptyState(
            drawer: MailboxDrawer,
            tab: MailboxTab,
        ): MailboxUiState.Empty =
            when (tab) {
                MailboxTab.Counter ->
                    MailboxUiState.Empty("Nothing waiting on you", "Bills to pay and letters to answer wait here, soonest due first.")
                MailboxTab.Vault -> MailboxUiState.Empty("Nothing filed yet", "Mail you file in the Vault waits here, in its folders.")
                MailboxTab.Incoming ->
                    when (drawer) {
                        MailboxDrawer.Home -> homeEmptyState()
                        MailboxDrawer.Business ->
                            MailboxUiState.Empty("No business mail yet", "Mail for your business comes here each morning.")
                        else -> MailboxUiState.Empty("No mail yet", "Your mail comes each morning. Letters, bills and notices land here.")
                    }
            }

        private companion object {
            const val NOON = 12

            /** The Mailbox reads again when it shows after this long. */
            val STALE_AFTER: java.time.Duration = java.time.Duration.ofMinutes(5)

            /** The server's most per page; a quiet read keeps up to this many pieces in place. */
            const val MAX_PAGE = 100
        }
    }
