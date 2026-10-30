@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerListResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailHome
import app.pantopus.android.data.api.models.mailbox.v2.MailSentSummary
import app.pantopus.android.data.api.models.mailbox.v2.MailVacationHold
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.mailbox.MailDeliverySeen
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.MailAddressBook
import app.pantopus.android.ui.screens.mailbox.components.MailKind
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
import java.time.ZoneId
import java.util.Locale
import javax.inject.Inject

/**
 * The mailbox drawers. `Business` carries the "Biz" short label per the design; Earn stays hidden with Mail extras.
 * `Sent` is what the person sent (launch key `mailbox`): not a drawer on the server, so it's never read as one, and it
 * has no tabs and no count.
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
    Sent("sent", "Sent", PantopusIcon.Send, PantopusColors.primary600),
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

/** Pantopus's sealed welcome letter, waiting on the first day's porch (board `R12-Welcome`). */
data class MailWelcome(
    val mailId: String,
    /** The person's verified address, for "Your first piece of mail at …". */
    val address: String?,
)

/** What the Mailbox's list shows for the open drawer and tab. */
sealed interface MailboxUiState {
    data object Loading : MailboxUiState

    data class Loaded(
        val sections: List<MailSection>,
        val hasMore: Boolean,
        /** Why the next page failed; the pieces stay and the end of the list offers Try again. */
        val loadMoreError: String? = null,
        /** The Counter's pieces with their due tags, lines and buttons (board `R9-Counter`). */
        val counter: List<MailCounterItem> = emptyList(),
        /** The Vault's filed or archived rows, drawn as a filing list (board `R10-Vault`). */
        val filed: List<DrawerMail> = emptyList(),
        /** How many the server has in this tab, all pages together. */
        val total: Int? = null,
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
        private val holidayCards: HolidayCardsRepository,
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

        private val _homes = MutableStateFlow<List<MailHome>>(emptyList())

        /** The Homes the person lives at, and whether each one's mail opens for them yet (the closed Home drawer). */
        val homes: StateFlow<List<MailHome>> = _homes.asStateFlow()

        private val _vacationHold = MutableStateFlow<MailVacationHold?>(null)

        /** The hold in effect, or the next one: the banner at the top of the Mailbox. */
        val vacationHold: StateFlow<MailVacationHold?> = _vacationHold.asStateFlow()

        private val _vaultShelf = MutableStateFlow<MailVaultShelf>(MailVaultShelf.All)

        /** What the Vault tab lists: everything filed, one folder, or what's archived. */
        val vaultShelf: StateFlow<MailVaultShelf> = _vaultShelf.asStateFlow()

        private val _welcome = MutableStateFlow<MailWelcome?>(null)

        /** The first day's porch, once per person on this phone, until they open the letter or close the porch. */
        val welcome: StateFlow<MailWelcome?> = _welcome.asStateFlow()

        private val _mailZone = MutableStateFlow<ZoneId>(ZoneId.systemDefault())

        /** The mailbox's own time zone, which "today" and the rounds follow. */
        val mailZone: StateFlow<ZoneId> = _mailZone.asStateFlow()

        /**
         * Christmas cards (launch keys `holiday_cards` + `mailbox`): the season and today's card, for the row at the top of
         * Me. Null while cards are off, before they're read, or when the server has none.
         */
        val cards: StateFlow<HolidayCardsResponse?> = holidayCards.latest

        private val _sent = MutableStateFlow<MailSentSummary?>(null)

        /** What the person has sent (`sent` on the drawers): whether Sent shows, and the cards that put the flag up. */
        val sent: StateFlow<MailSentSummary?> = _sent.asStateFlow()

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
        private var serverTotal: Int? = null

        /** Pay opened the invoice screen from the Counter: the Mailbox reads again when it shows next. */
        private var payOpened = false

        /** Today's round, not played yet: it plays once the open tab's first page is read. */
        private var pendingMoment: MailDeliveryMoment? = null

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
            // A card sent or taken back (from Sent or the card screens): the flag and whether Sent shows are read again.
            viewModelScope.launch { HolidayCardsRepository.cardSent.collect { readDrawersAndShow() } }
            viewModelScope.launch { HolidayCardsRepository.takenBack.collect { readDrawersAndShow() } }
            // "See it in Sent" after sending a card.
            viewModelScope.launch { HolidayCardsRepository.showSent.collect { openSent() } }
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
            if (payOpened) {
                // Back from paying a bill on the Counter: it's paid and filed in Receipts now, or still waiting.
                payOpened = false
                return refreshQuietly()
            }
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
            // Today's card is read alongside, so the row says where it is (it's sent once a day); the mail doesn't wait.
            if (LaunchFeatures.holidayCards && LaunchFeatures.mailbox) viewModelScope.launch { holidayCards.load() }
            readDrawers()
            readPendingRouting()
            owner.await()
            updateDrawers()
            reloadActiveTab(limit)
            // The round's moment plays once its pieces are there; on the first day the porch with the welcome letter
            // takes its place, so the day opens with one moment, not two.
            pendingMoment?.let { moment ->
                pendingMoment = null
                if (_welcome.value == null) _deliveryMoment.value = moment else deliveryMomentShown()
            }
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
            _vaultShelf.value = MailVaultShelf.All
            // Sent reads its own list (MailSentViewModel); the drawer's pieces are read again when another opens.
            if (drawer == MailboxDrawer.Sent) {
                ++generation
                updateDrawers()
                return
            }
            switchList()
        }

        /** The flag, or "See it in Sent": Sent opens (and its chip shows, even before the drawers are read again). */
        fun openSent() {
            selectDrawer(MailboxDrawer.Sent)
        }

        private fun readDrawersAndShow() {
            viewModelScope.launch {
                readDrawers()
                updateDrawers()
            }
        }

        fun selectTab(tab: MailboxTab) {
            if (_selectedTab.value == tab) return
            _selectedTab.value = tab
            _vaultShelf.value = MailVaultShelf.All
            switchList()
        }

        /** The Vault lists one folder, what's archived, or everything filed again. */
        fun openVaultShelf(shelf: MailVaultShelf) {
            if (_vaultShelf.value == shelf) return
            _vaultShelf.value = shelf
            switchList()
        }

        /** Pay on the Counter opened the invoice screen. */
        fun payOpened() {
            payOpened = true
        }

        /** The porch was answered (the letter opened, or the porch closed): it doesn't come back on this phone. */
        fun welcomeDone() {
            val welcome = _welcome.value ?: return
            _welcome.value = null
            signedInUserId()?.let { deliverySeen.markWelcomeShown(it, welcome.mailId) }
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
            _sent.value = response.sent
            book = MailAddressBook(personName = signedInName(), homes = response.homes.orEmpty())
            homesKnown = response.homes != null
            _homes.value = response.homes.orEmpty()
            _vacationHold.value = response.vacationHold
            zone = MailPieceMapper.zoneOf(response.delivery)
            _mailZone.value = zone
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
                pendingMoment = MailDeliveryMoment(count, cameWhen = if (morning) "this morning" else "today")
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
            val selected = _selectedDrawer.value
            // Sent: once something was sent, or while cards can be sent (keys `holiday_cards` + `mailbox`).
            val sent = _sent.value?.any == true || LaunchFeatures.holidayCards || selected == MailboxDrawer.Sent
            _drawers.value =
                buildList {
                    add(MailboxDrawer.Me)
                    add(MailboxDrawer.Home)
                    if (ownsBusiness || bizHasMail || selected == MailboxDrawer.Business) add(MailboxDrawer.Business)
                    if (sent) add(MailboxDrawer.Sent)
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
            // Sent isn't a drawer on the server: its list reads itself, and the open drawer's pieces stay as they were.
            if (_selectedDrawer.value == MailboxDrawer.Sent) {
                ++generation
                loading = false
                return
            }
            val gen = ++generation
            offset = 0
            loadedMail = mutableListOf()
            loadMoreError = null
            hasMore = false
            serverTotal = null
            fetchPage(gen, limit)
        }

        private suspend fun fetchPage(
            gen: Int,
            limit: Int = pageSize,
        ) {
            val drawer = _selectedDrawer.value
            if (drawer == MailboxDrawer.Sent) return
            loading = true
            val tab = _selectedTab.value
            val shelf = _vaultShelf.value
            val result =
                when {
                    tab != MailboxTab.Vault -> repo.drawer(drawer.backendKey, tab.id, limit, offset)
                    shelf is MailVaultShelf.Archived -> repo.drawer(drawer.backendKey, ARCHIVED_TAB, limit, offset)
                    shelf is MailVaultShelf.Folder -> repo.drawer(drawer.backendKey, tab.id, limit, offset, shelf.id)
                    else -> repo.drawer(drawer.backendKey, tab.id, limit, offset)
                }
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
                    val first = offset == 0
                    loadedMail.addAll(page.orEmpty())
                    offset = loadedMail.size
                    hasMore = result.data.mail.size >= limit
                    serverTotal = result.data.total
                    publish()
                    if (first && drawer == MailboxDrawer.Me && tab == MailboxTab.Incoming) findWelcome()
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
            val tab = _selectedTab.value
            _state.value =
                if (loadedMail.isEmpty()) {
                    emptyState(_selectedDrawer.value, tab)
                } else {
                    MailboxUiState.Loaded(
                        // Incoming by the day it came; the Counter keeps the server's soonest-due order, the Vault its own.
                        sections = MailPieceMapper.sections(loadedMail, zone, byDay = tab == MailboxTab.Incoming),
                        hasMore = hasMore,
                        loadMoreError = loadMoreError,
                        counter = if (tab == MailboxTab.Counter) loadedMail.map { MailCounterItem.from(it, zone) } else emptyList(),
                        filed = if (tab == MailboxTab.Vault) loadedMail.map { it.row } else emptyList(),
                        total = serverTotal,
                    )
                }
        }

        /**
         * The first day (`R12-Welcome`): Pantopus's welcome letter, still sealed in Me, came today or yesterday (it's made
         * the first time Mail opens), and the porch hasn't been shown to this person on this phone. A long-time reader
         * signing in on a new phone isn't greeted as if it were their first day.
         */
        private fun findWelcome() {
            val user = signedInUserId()
            if (_welcome.value != null || user == null || deliverySeen.welcomeShown(user)) return
            val firstDay = Instant.now().atZone(zone).toLocalDate().minusDays(1)
            val letter =
                loadedMail.firstOrNull { mail ->
                    !mail.row.viewed && isWelcomeLetter(mail.row) && mail.day?.isBefore(firstDay) == false
                } ?: return
            _welcome.value = MailWelcome(letter.row.id, book.ownAddress)
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
                    MailboxUiState.Empty("Nothing waiting on you.", "Bills and letters that need you wait here until they're done.")
                MailboxTab.Vault ->
                    when (_vaultShelf.value) {
                        is MailVaultShelf.Folder -> MailboxUiState.Empty("Nothing in this folder yet", "Nothing in this folder yet.")
                        MailVaultShelf.Archived -> MailboxUiState.Empty("Nothing archived", "Nothing archived.")
                        MailVaultShelf.All ->
                            MailboxUiState.Empty(
                                "Nothing filed yet",
                                "Nothing filed in ${drawer.label} yet. Open a piece and choose File in the Vault.",
                            )
                    }
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

            /** The Vault's Archived shelf is the server's `archived` tab. */
            const val ARCHIVED_TAB = "archived"

            /** Pantopus's welcome letter (SRV-6): its own letter in Me, "Welcome to your mailbox". */
            fun isWelcomeLetter(row: DrawerMail): Boolean {
                if (!row.fromPantopus || row.recipientHomeId != null) return false
                val title = (row.displayTitle ?: row.subject).orEmpty().lowercase(Locale.US)
                return MailKind.fromWire(row.kind) == MailKind.Letter && title.startsWith("welcome to your mailbox")
            }

            /** The Mailbox reads again when it shows after this long. */
            val STALE_AFTER: java.time.Duration = java.time.Duration.ofMinutes(5)

            /** The server's most per page; a quiet read keeps up to this many pieces in place. */
            const val MAX_PAGE = 100
        }
    }
