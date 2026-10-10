@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.notifications

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.HomeTaskNotificationRoute
import app.pantopus.android.data.api.models.notifications.NotificationDto
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.asResult
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowDestructiveAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** Stable tab ids exposed for tests + the screen. */
object NotificationsTab {
    const val ALL = "all"
    const val UNREAD = "unread"

    /**
     * S5 parity with RN (`src/app/notifications.tsx:56`). Read rows are
     * filtered client-side — the backend only understands `?unread=true`.
     */
    const val READ = "read"
}

/**
 * Identity-firewall context values the backend validates against
 * (`backend/routes/notifications.js:21-22`).
 */
object NotificationContext {
    const val PERSONAL = "personal"
    const val AUDIENCE = "audience"
    const val PLATFORM = "platform"
}

/**
 * Notification zone (P2.3 / unified-IA §6.1). The Personal zone folds
 * `platform` announcements in with `personal`; the Audience (Beacon)
 * zone is isolated so persona traffic never leaks into the personal
 * stream. Mirrors iOS `NotificationsZone` and RN
 * `src/app/notifications.tsx:84-91`.
 */
enum class NotificationsZone(val rawValue: String) {
    Personal(NotificationContext.PERSONAL),
    Audience(NotificationContext.AUDIENCE),
    ;

    /** Firewall contexts this zone pulls from `GET /api/notifications`. */
    val contexts: List<String>
        get() =
            when (this) {
                Personal -> listOf(NotificationContext.PERSONAL, NotificationContext.PLATFORM)
                Audience -> listOf(NotificationContext.AUDIENCE)
            }

    val label: String
        get() =
            when (this) {
                Personal -> "Personal"
                Audience -> "Audience"
            }

    /** Unset context defaults to `personal`, matching RN. */
    fun matches(context: String?): Boolean = contexts.contains(context?.takeIf { it.isNotEmpty() } ?: NotificationContext.PERSONAL)

    companion object {
        fun fromRaw(raw: String?): NotificationsZone? = entries.firstOrNull { it.rawValue == raw }
    }
}

/**
 * Pending "delete this notification?" confirmation. The screen binds an
 * `AlertDialog` to this; the VM never destroys anything until
 * [NotificationsViewModel.confirmDelete] runs.
 */
data class NotificationDeleteRequest(
    val id: String,
    val title: String,
)

/**
 * Seven type buckets the Notifications design surfaces. Each one drives
 * the row's tile icon + chip variant + chip label, mirroring iOS
 * `NotificationCategory`.
 */
enum class NotificationCategory {
    Reply,
    Mention,
    Claim,
    Gig,
    Listing,
    Safety,
    System,
    ;

    val label: String
        get() =
            when (this) {
                Reply -> "Reply"
                Mention -> "Mention"
                Claim -> "Claim"
                Gig -> "Gig"
                Listing -> "Listing"
                Safety -> "Safety"
                System -> "System"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Reply -> PantopusIcon.MessageCircle
                Mention -> PantopusIcon.AtSign
                Claim -> PantopusIcon.BadgeCheck
                Gig -> PantopusIcon.Briefcase
                Listing -> PantopusIcon.Tag
                Safety -> PantopusIcon.ShieldAlert
                System -> PantopusIcon.Info
            }

    val chipVariant: StatusChipVariant
        get() =
            when (this) {
                Reply -> StatusChipVariant.Personal
                Mention -> StatusChipVariant.Business
                Claim -> StatusChipVariant.Success
                Gig -> StatusChipVariant.Warning
                Listing -> StatusChipVariant.Home
                Safety -> StatusChipVariant.ErrorVariant
                System -> StatusChipVariant.Neutral
            }

    val tileBackground: Color
        get() =
            when (this) {
                Reply -> PantopusColors.personalBg
                Mention -> PantopusColors.businessBg
                Claim -> PantopusColors.successBg
                Gig -> PantopusColors.warningBg
                Listing -> PantopusColors.homeBg
                Safety -> PantopusColors.errorBg
                System -> PantopusColors.appSurfaceSunken
            }

    val tileForeground: Color
        get() =
            when (this) {
                Reply -> PantopusColors.personal
                Mention -> PantopusColors.business
                Claim -> PantopusColors.success
                Gig -> PantopusColors.warning
                Listing -> PantopusColors.home
                Safety -> PantopusColors.error
                System -> PantopusColors.appTextSecondary
            }

    companion object {
        fun fromRaw(raw: String?): NotificationCategory {
            val lower = raw?.lowercase(Locale.ROOT).orEmpty()
            return when (lower) {
                "reply", "comment", "chat", "chat_message", "dm" -> Reply
                "mention", "follow", "connection", "connections", "user" -> Mention
                "claim", "home_member_request", "home_claim", "home_ownership" -> Claim
                "gig", "gig_bid", "gig_match" -> Gig
                "listing", "listing_sale", "marketplace" -> Listing
                "safety", "alert", "security", "porch_alert" -> Safety
                "system", "info", "support_train", "support-train", "announcement" -> System
                else ->
                    when {
                        lower.isEmpty() -> System
                        "gig" in lower -> Gig
                        "listing" in lower -> Listing
                        // Mail notices (mail_new, home_mail_removed, …) have no
                        // bucket of their own; they are not listings.
                        "mail" in lower -> System
                        "home" in lower -> Claim
                        "post" in lower || "reply" in lower -> Reply
                        else -> System
                    }
            }
        }
    }
}

/**
 * Drives the T5.1 Notifications V2 center. Mirrors iOS
 * `NotificationsViewModel` exactly — same tabs, same date bucketing,
 * same row-mapping per type, same optimistic mark-read / read-all
 * pattern with rollback on failure.
 *
 * Date bucketing reads `Instant.now()` + `ZoneId.systemDefault()` at
 * `applyState()` time. Tests cover the pure `makeSections` /
 * `formatRelativeTime` helpers directly with deterministic clocks; the
 * full VM is tested for state transitions only.
 */
@HiltViewModel
class NotificationsViewModel
    @Inject
    constructor(
        private val repo: NotificationsRepository,
        // Targeted tests may omit navigation arguments; Hilt supplies the real handle.
        savedStateHandle: SavedStateHandle = SavedStateHandle(),
        sessions: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        private val taskScope = sessions.create(viewModelScope)
        private val pageSize = 20
        private var hasMore = false
        private var loading = false
        private var quietRefreshPending = false
        private val pendingReads = mutableSetOf<String>()
        private var markingAllRead = false
        private var notifications: MutableList<NotificationDto> = mutableListOf()

        /** Bumped by every reload so a late page from the previous tab or zone is dropped. */
        private var fetchGeneration = 0

        /** Why the next page failed; the rows stay and the list end offers Try again. */
        private var loadMoreError: String? = null

        /**
         * Per-context pagination cursors. The Personal zone fans out over
         * two contexts, so a single `notifications.size` offset would skip
         * rows on the second page (RN keeps the same per-context map —
         * `src/app/notifications.tsx:16-18`).
         */
        private var offsets: MutableMap<String, Int> = mutableMapOf()

        /**
         * True when the route explicitly named a zone (Hub megaphone →
         * `notifications?context=audience`). Keeps the strip visible from
         * first paint and scopes the very first fetch.
         */
        private val hasExplicitZone: Boolean

        /**
         * True once the user picked a zone from the strip. Until then the
         * list stays unscoped, matching RN's flag-off behaviour
         * (`src/app/notifications.tsx:60-66`).
         */
        private var zoneWasChosen = false

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        /** A pull or Retry is reading while the rows stay: the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        private val _openGig = MutableSharedFlow<String>(extraBufferCapacity = 1)

        /** A gig row's task, opened on top of this list so Back returns here. */
        val openGig: SharedFlow<String> = _openGig.asSharedFlow()

        private val _unreadCount = MutableStateFlow(0)
        val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

        private val _zone = MutableStateFlow(NotificationsZone.Personal)
        val zone: StateFlow<NotificationsZone> = _zone.asStateFlow()

        /**
         * Whether the Personal / Audience strip should render. True when
         * the route asked for a zone, or once the loaded list has actually
         * returned an audience-context row. Never assumed.
         */
        private val _showsZoneStrip = MutableStateFlow(false)
        val showsZoneStrip: StateFlow<Boolean> = _showsZoneStrip.asStateFlow()

        /** Row awaiting delete confirmation. Null = no dialog. */
        private val _pendingDelete = MutableStateFlow<NotificationDeleteRequest?>(null)
        val pendingDelete: StateFlow<NotificationDeleteRequest?> = _pendingDelete.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)

        /** Says when a delete or Mark all read failed and its rows were put back. */
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        fun consumeToast() {
            _toast.value = null
        }

        private val _tabs =
            MutableStateFlow(
                listOf(
                    ListOfRowsTab(id = NotificationsTab.ALL, label = "All", count = 0),
                    ListOfRowsTab(id = NotificationsTab.UNREAD, label = "Unread", count = 0),
                    ListOfRowsTab(id = NotificationsTab.READ, label = "Read", count = 0),
                ),
            )
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        init {
            val requested =
                NotificationsZone
                    .fromRaw(savedStateHandle.get<String>(CONTEXT_KEY))
                    // Launch cuts #1/#2 (Beacon + Personas): the Audience stream is hidden; its route opens the plain list.
                    ?.takeIf { it != NotificationsZone.Audience || isAudienceLaunchAvailable() }
            hasExplicitZone = requested != null
            if (requested != null) {
                _zone.value = requested
                _showsZoneStrip.value = true
            }
        }

        /**
         * Contexts the current view is scoped to — null while nobody has
         * named a zone, which keeps the legacy unscoped list so Beacon rows
         * are not silently hidden.
         */
        private fun activeContexts(): List<String>? = if (useScopedZones()) _zone.value.contexts else null

        private fun useScopedZones(): Boolean = hasExplicitZone || zoneWasChosen

        /**
         * Switch the firewall zone and refetch. Also the moment the list
         * stops being unscoped: once the user (or the route) has named a
         * zone we start sending `?context=`.
         */
        fun selectZone(next: NotificationsZone) {
            val becomesScoped = !useScopedZones()
            if (_zone.value == next && !becomesScoped) return
            _zone.value = next
            zoneWasChosen = true
            reload(force = false)
        }

        private val _selectedTab = MutableStateFlow(NotificationsTab.ALL)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(makeTopBarAction(enabled = false))
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        /**
         * Initial load. Idempotent — re-running won't refetch when already loaded. A first entry shows the stored
         * first pages at once (Instant Screens) and reads them again when they are out of date.
         */
        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded || _state.value is ListOfRowsUiState.Empty) {
                refreshIfNeeded()
            } else {
                reload(force = false)
            }
        }

        /** A live signal or return refreshes the first page quietly, preserving older rows and the reading position. */
        fun refreshIfNeeded() {
            if (loading || pendingReads.isNotEmpty() || markingAllRead) {
                quietRefreshPending = true
                return
            }
            fetchPage(reset = true, keepTail = true)
        }

        /** Pull-to-refresh / retry: reads now, with the rows kept under the pull indicator. */
        fun refresh() = reload(force = true)

        /** Called when the list nears the bottom — fetches the next page.
         *  After a failed page only [retryLoadMore] asks again. */
        fun loadMoreIfNeeded() {
            if (loadMoreError != null || !hasMore || loading) return
            fetchPage(reset = false)
        }

        /** Try again on a failed page: the same offsets, rows kept. */
        fun retryLoadMore() {
            if (loadMoreError == null || loading) return
            loadMoreError = null
            applyState()
            fetchPage(reset = false)
        }

        /** Tab switch — refetch with the new filter. */
        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            reload(force = false)
        }

        /**
         * Mark one row as read. The row stays in the list but its unread
         * highlight + 8dp dot disappear. Optimistic — rolls back on
         * failure.
         */
        fun markRead(id: String) {
            val target = notifications.firstOrNull { it.id == id } ?: return
            if (HomeTaskNotificationRoute.isTask(target.type)) {
                viewModelScope.launch {
                    if (confirmTaskScope(target)) markReadCurrent(id)
                }
            } else {
                markReadCurrent(id)
            }
        }

        private fun markReadCurrent(id: String) {
            val target = notifications.firstOrNull { it.id == id } ?: return
            if (!mayOpenTask(target) || target.isRead == true || markingAllRead || !pendingReads.add(id)) return
            val generation = fetchGeneration
            notifications = notifications.map { if (it.id == id) it.copy(isRead = true) else it }.toMutableList()
            _unreadCount.value = (_unreadCount.value - 1).coerceAtLeast(0)
            applyState()
            viewModelScope.launch {
                try {
                    if (!confirmTaskScope(target)) return@launch
                    when (repo.markRead(id)) {
                        is NetworkResult.Success -> Unit
                        is NetworkResult.Failure -> {
                            if (!confirmTaskScope(target)) return@launch
                            // Restore this action only: another read or a newly arrived row must survive the failure.
                            notifications = notifications.map { if (it.id == id) it.copy(isRead = false) else it }.toMutableList()
                            if (generation == fetchGeneration) _unreadCount.value++
                            _toast.value = ToastMessage("Couldn't mark as read. Try again.", ToastKind.Error)
                        }
                    }
                } finally {
                    pendingReads.remove(id)
                    finishReadAction()
                }
            }
        }

        /** Mark the current zone read at once, keeping other in-flight actions and new arrivals intact. */
        fun markAllRead() {
            if (_unreadCount.value == 0 || markingAllRead || pendingReads.isNotEmpty()) return
            val targets = notifications.filter { it.isRead != true }.map { it.id }.toSet()
            val previousCount = _unreadCount.value
            val generation = fetchGeneration
            val contexts = activeContexts()
            markingAllRead = true
            pendingReads.addAll(targets)
            notifications = notifications.map { if (it.id in targets) it.copy(isRead = true) else it }.toMutableList()
            _unreadCount.value = 0
            applyState()
            viewModelScope.launch {
                try {
                    when (repo.markAllRead(contexts)) {
                        is NetworkResult.Success -> Unit
                        is NetworkResult.Failure -> {
                            notifications = notifications.map { if (it.id in targets) it.copy(isRead = false) else it }.toMutableList()
                            if (generation == fetchGeneration) _unreadCount.value += previousCount
                            _toast.value = ToastMessage("Couldn't mark all as read. Try again.", ToastKind.Error)
                        }
                    }
                } finally {
                    pendingReads.removeAll(targets)
                    markingAllRead = false
                    finishReadAction()
                }
            }
        }

        private fun finishReadAction() {
            // An access refusal owns the empty/error state; completing a write must not republish its old rows.
            if (_state.value is ListOfRowsUiState.Loaded || _state.value is ListOfRowsUiState.Empty) applyState()
            if (quietRefreshPending && pendingReads.isEmpty() && !markingAllRead) {
                quietRefreshPending = false
                refreshIfNeeded()
            }
        }

        // ─── Delete ────────────────────────────────────────────────

        /**
         * Ask for confirmation before deleting a row. The screen renders
         * an `AlertDialog` off [pendingDelete].
         */
        fun requestDelete(id: String) {
            val target = notifications.firstOrNull { it.id == id } ?: return
            _pendingDelete.value =
                NotificationDeleteRequest(
                    id = target.id,
                    title = target.title ?: "this notification",
                )
        }

        /** Dismiss the confirmation without deleting. */
        fun cancelDelete() {
            _pendingDelete.value = null
        }

        /** `DELETE /api/notifications/:id` once the user confirms. */
        fun confirmDelete() {
            val request = _pendingDelete.value ?: return
            _pendingDelete.value = null
            delete(request.id)
        }

        /**
         * Delete without the confirmation hop. Optimistic — the row
         * disappears immediately and is restored if the call fails.
         */
        fun delete(id: String) {
            if (id in pendingReads || markingAllRead) return
            val generation = fetchGeneration
            val target = notifications.firstOrNull { it.id == id } ?: return
            val previousCount = _unreadCount.value
            notifications = notifications.filterNot { it.id == id }.toMutableList()
            if (target.isRead != true) {
                _unreadCount.value = (previousCount - 1).coerceAtLeast(0)
            }
            applyState()
            viewModelScope.launch {
                when (val result = repo.delete(id)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        // Already deleted (say on another device): the row stays gone.
                        if (result.error == NetworkError.NotFound) return@launch
                        if (generation != fetchGeneration || _state.value is ListOfRowsUiState.Error) return@launch
                        if (notifications.none { it.id == target.id }) {
                            notifications = sortedByRecency(notifications + target).toMutableList()
                            if (target.isRead != true) _unreadCount.value++
                        }
                        applyState()
                        _toast.value = ToastMessage("Couldn't delete the notification. Try again.", ToastKind.Error)
                    }
                }
            }
        }

        /**
         * Hand a freshly-arrived notification to the VM. Used by the
         * socket bridge so the list updates in real time.
         */
        fun handleIncoming(dto: NotificationDto) {
            if (notifications.any { it.id == dto.id }) return
            if (!isLaunchVisible(dto)) return
            // Zone firewall: an audience notification must not land in the
            // personal stream (RN `src/app/notifications.tsx:180`).
            if (useScopedZones() && !_zone.value.matches(dto.context)) return
            notifications.add(0, dto)
            if (dto.isRead != true) {
                _unreadCount.value = _unreadCount.value + 1
            }
            applyState()
        }

        /**
         * [force]: a pull or Retry, which keeps the rows on screen under the pull indicator. Otherwise (entry, a tab or
         * zone switch) the stored first pages show at once when they are all there, and the skeleton only when not.
         */
        private fun reload(force: Boolean) {
            // A tab or zone switch mid-load must refetch with the new filter:
            // retire the running request instead of skipping this one.
            fetchGeneration++
            quietRefreshPending = false
            loading = false
            loadMoreError = null
            val keepRows = force && _state.value is ListOfRowsUiState.Loaded
            if (!keepRows) {
                notifications = mutableListOf()
                offsets = mutableMapOf()
                hasMore = false
                if (!showStoredFirstPages()) _state.value = ListOfRowsUiState.Loading
            }
            _refreshing.value = keepRows
            fetchPage(reset = true, force = force)
        }

        /** The stored first page of every active context, shown before any request; false when one is missing. */
        private fun showStoredFirstPages(): Boolean {
            val unreadOnly = _selectedTab.value == NotificationsTab.UNREAD
            val pages =
                (activeContexts() ?: listOf(UNSCOPED)).map { context ->
                    val copy = repo.firstPageCopy(pageSize, unreadOnly, context.takeIf { it != UNSCOPED }) ?: return false
                    context to (NetworkResult.Success(copy) as NetworkResult<NotificationsListResponse>)
                }
            publishPages(pages, reset = true)
            return true
        }

        private fun fetchPage(
            reset: Boolean,
            force: Boolean = false,
            keepTail: Boolean = false,
        ) {
            if (loading) return
            loading = true
            if (reset && !keepTail) offsets = mutableMapOf()
            val generation = fetchGeneration
            val unreadOnly = _selectedTab.value == NotificationsTab.UNREAD
            // A null context means "unscoped legacy list"; the fan-out below
            // walks one request per context so the Personal zone can merge
            // `personal` + `platform` the way RN does.
            val contexts = activeContexts() ?: listOf(UNSCOPED)
            viewModelScope.launch {
                var notice: RefreshNotice? = null
                val pages =
                    contexts.map { context ->
                        val scope = context.takeIf { it != UNSCOPED }
                        // The first page goes through the screens' store; later pages never do.
                        val result =
                            if (reset) {
                                repo.firstPageStored(pageSize, unreadOnly, scope, force).let { stored ->
                                    if (stored.showsRefreshFailure(StoreKind.NOTIFICATIONS)) {
                                        notice = RefreshNotice(stored.fetchedAt, ::refresh)
                                    }
                                    stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
                                }
                            } else {
                                repo.list(limit = pageSize, offset = offsets[context] ?: 0, unreadOnly = unreadOnly, context = scope)
                            }
                        // A reload since this request started owns the list, offsets
                        // and loading flag now; drop this late page.
                        if (generation != fetchGeneration) return@launch
                        context to result
                    }
                loading = false
                _refreshing.value = false
                if (reset) _refreshNotice.value = notice
                publishPages(pages, reset, keepTail)
                if (quietRefreshPending) {
                    quietRefreshPending = false
                    refreshIfNeeded()
                }
            }
        }

        private fun publishPages(
            pages: List<Pair<String, NetworkResult<NotificationsListResponse>>>,
            reset: Boolean,
            keepTail: Boolean = false,
        ) {
            val refusal =
                pages.mapNotNull { it.second as? NetworkResult.Failure }
                    .firstOrNull { it.error is NetworkError.Forbidden || it.error == NetworkError.NotFound || it.error == NetworkError.Unauthorized }
            if (refusal != null) {
                notifications.clear()
                offsets.clear()
                hasMore = false
                _unreadCount.value = 0
                _state.value = ListOfRowsUiState.Error(refusal.error.displayMessage("Couldn't load the list."))
                return
            }
            val hadLaterPages = offsets.values.any { it > pageSize }
            val incoming = mutableListOf<NotificationDto>()
            var anyMore = false
            var scopedUnread = 0
            var sawUnreadCount = false
            var failure: NetworkResult.Failure? = null
            for ((context, result) in pages) {
                when (result) {
                    is NetworkResult.Success -> {
                        val body = result.data
                        // Launch cut: rows of features hidden for the first launch never
                        // enter the list, nor count as unread; paging keeps server offsets.
                        val visible = body.notifications.filter(::isLaunchVisible)
                        if (keepTail) {
                            incoming.addAll(refreshedHead(context, body, visible))
                        } else {
                            incoming.addAll(visible)
                            offsets[context] = (offsets[context] ?: 0) + body.notifications.size
                        }
                        anyMore = anyMore || (body.hasMore ?: (body.notifications.size >= pageSize))
                        body.unreadCount?.let {
                            val hiddenUnread = (body.notifications - visible.toSet()).count { row -> row.isRead != true }
                            scopedUnread += (it - hiddenUnread).coerceAtLeast(0)
                            sawUnreadCount = true
                        }
                    }
                    is NetworkResult.Failure -> {
                        failure = result
                        if (keepTail) {
                            incoming.addAll(
                                notifications.filter { context == UNSCOPED || (it.context ?: NotificationContext.PERSONAL) == context },
                            )
                        }
                    }
                }
            }
            val failed = failure
            if (failed != null && incoming.isEmpty()) {
                when {
                    // A failed refresh keeps the rows on screen (Instant Screens contract §3).
                    reset && _state.value is ListOfRowsUiState.Loaded -> applyState()
                    reset -> {
                        _state.value =
                            ListOfRowsUiState.Error(failed.error.displayMessage("Couldn't load the list."))
                        _topBarAction.value = makeTopBarAction(enabled = _unreadCount.value > 0)
                    }
                    else -> {
                        // A later page failed: keep the rows and offer Try again
                        // instead of an endless spinner.
                        loadMoreError = failed.error.displayMessage("Couldn't load more notifications.")
                        applyState()
                    }
                }
                return
            }
            notifications =
                if (reset) {
                    sortedByRecency(incoming).toMutableList()
                } else {
                    merge(notifications, incoming).toMutableList()
                }
            if (!keepTail || !hadLaterPages) hasMore = anyMore
            _unreadCount.value =
                if (sawUnreadCount) scopedUnread else notifications.count { it.isRead != true }
            val pendingUnread = notifications.count { it.id in pendingReads && it.isRead != true }
            notifications = notifications.map { if (it.id in pendingReads) it.copy(isRead = true) else it }.toMutableList()
            _unreadCount.value = (_unreadCount.value - pendingUnread).coerceAtLeast(0)
            revealZoneStripIfAudienceSeen()
            applyState()
        }

        /** Keep rows older than the refreshed head; rows missing inside its covered range have been removed. */
        private fun refreshedHead(
            context: String,
            body: NotificationsListResponse,
            visible: List<NotificationDto>,
        ): List<NotificationDto> {
            val previous = notifications.filter { context == UNSCOPED || (it.context ?: NotificationContext.PERSONAL) == context }
            val boundary = body.notifications.lastOrNull()?.createdAt?.let(::parseInstant)
            val more = body.hasMore ?: (body.notifications.size >= pageSize)
            val retained =
                if (more && boundary != null) {
                    previous.filter { row -> (parseInstant(row.createdAt) ?: Instant.EPOCH) <= boundary }
                } else {
                    emptyList()
                }
            val merged = merge(visible, retained)
            offsets[context] = maxOf(body.notifications.size, (offsets[context] ?: 0) + merged.size - previous.size)
            return merged
        }

        /**
         * Reveal the Personal / Audience strip once the unscoped list has
         * actually returned a Beacon row. No probe request, no feature
         * flag, no fabricated zone — the strip only appears when the
         * backend has handed us audience-context data.
         */
        private fun revealZoneStripIfAudienceSeen() {
            // Launch cuts #1/#2 (Beacon + Personas): no Audience zone, so no Personal / Audience strip.
            if (_showsZoneStrip.value || !isAudienceLaunchAvailable()) return
            _showsZoneStrip.value = notifications.any { it.context == NotificationContext.AUDIENCE }
        }

        /**
         * Launch cut (2026-09-27): false for a Beacon (Audience) row while #1/#2 are
         * hidden, and for a row whose type or link opens another hidden feature.
         */
        private fun isLaunchVisible(dto: NotificationDto): Boolean =
            (isAudienceLaunchAvailable() || dto.context != NotificationContext.AUDIENCE) &&
                DeepLinkRouter.isLaunchAvailable(dto.type, HomeTaskNotificationRoute.metadataPath(dto.type, dto.metadata) ?: dto.link)

        /** The Audience (Beacon) stream serves Beacon (#1) and personas (#2); both must be on, as on the backend. */
        private fun isAudienceLaunchAvailable(): Boolean = LaunchFeatures.beacon && LaunchFeatures.personas

        /**
         * Rows for the active tab. `read` has no backend filter — the
         * handler only understands `?unread=true` — so it is applied
         * client-side exactly like RN (`src/app/notifications.tsx:259`).
         */
        private fun displayedNotifications(): List<NotificationDto> =
            if (_selectedTab.value == NotificationsTab.READ) {
                notifications.filter { it.isRead == true }
            } else {
                notifications
            }

        private fun applyState() {
            _tabs.value =
                listOf(
                    ListOfRowsTab(
                        id = NotificationsTab.ALL,
                        label = "All",
                        count = notifications.size,
                    ),
                    ListOfRowsTab(
                        id = NotificationsTab.UNREAD,
                        label = "Unread",
                        count = _unreadCount.value,
                    ),
                    ListOfRowsTab(
                        id = NotificationsTab.READ,
                        label = "Read",
                        count = notifications.count { it.isRead == true },
                    ),
                )
            val rows = displayedNotifications()
            if (rows.isEmpty()) {
                _state.value = emptyState()
                _topBarAction.value = makeTopBarAction(enabled = _unreadCount.value > 0)
                return
            }
            val now = Instant.now()
            val timeZone = ZoneId.systemDefault()
            val sections =
                makeSections(
                    rows,
                    now = now,
                    zone = timeZone,
                    onDelete = ::requestDelete,
                    onTap = ::handleTap,
                ).map { section ->
                    section.copy(
                        rows =
                            section.rows.map { row ->
                                if (row.id in pendingReads) {
                                    row.copy(
                                        chips =
                                            row.chips.orEmpty() +
                                                RowChip(
                                                    "Pending",
                                                    tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                                                ),
                                        wrapChips = true,
                                        destructiveAction = null,
                                    )
                                } else {
                                    row
                                }
                            },
                    )
                }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = sections,
                    hasMore = hasMore,
                    loadMoreError = loadMoreError,
                    onRetryLoadMore = ::retryLoadMore,
                )
            _topBarAction.value = makeTopBarAction(enabled = _unreadCount.value > 0)
        }

        private fun emptyState(): ListOfRowsUiState.Empty =
            when (_selectedTab.value) {
                NotificationsTab.UNREAD ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCheck,
                        headline = "You’re all caught up",
                        subcopy =
                            "No unread notifications. Replies, mentions, claim updates, " +
                                "and safety alerts from your neighborhood will land here.",
                        ctaTitle = "View all notifications",
                        onCta = { selectTab(NotificationsTab.ALL) },
                    )
                NotificationsTab.READ ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.BellOff,
                        headline = "No read notifications",
                        subcopy = "Notifications you’ve already opened will collect here.",
                        ctaTitle = "View all notifications",
                        onCta = { selectTab(NotificationsTab.ALL) },
                    )
                else ->
                    if (_zone.value == NotificationsZone.Audience) {
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.Bell,
                            headline = "No audience activity",
                            subcopy = "Replies, follows, and mentions on your Beacon land here.",
                        )
                    } else {
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.Bell,
                            headline = "All caught up",
                            subcopy = "When something needs your attention, it'll show up here.",
                        )
                    }
            }

        private fun makeTopBarAction(enabled: Boolean): TopBarAction =
            TopBarAction(
                icon = PantopusIcon.Check,
                contentDescription = "Mark all read",
                label = if (markingAllRead) "Pending" else "Mark all read",
                isEnabled = enabled && !markingAllRead && pendingReads.isEmpty(),
                onClick = { markAllRead() },
            )

        private fun mayOpenTask(dto: NotificationDto): Boolean =
            !HomeTaskNotificationRoute.isTask(dto.type) || (
                taskScope.isCurrent && taskScope.actorId != null &&
                    taskScope.actorId == dto.userId && (dto.context == null || dto.context == NotificationContext.PERSONAL)
            )

        private fun handleTap(dto: NotificationDto) {
            if (!mayOpenTask(dto)) return
            if (HomeTaskNotificationRoute.isTask(dto.type)) {
                viewModelScope.launch {
                    if (confirmTaskScope(dto)) openNotification(dto)
                }
            } else {
                openNotification(dto)
            }
        }

        private suspend fun confirmTaskScope(dto: NotificationDto): Boolean {
            if (!HomeTaskNotificationRoute.isTask(dto.type)) return true
            currentCoroutineContext().ensureActive()
            val confirmed = mayOpenTask(dto) && taskScope.confirmCurrent()
            currentCoroutineContext().ensureActive()
            return confirmed && mayOpenTask(dto)
        }

        private fun openNotification(dto: NotificationDto) {
            if (dto.isRead != true) markRead(dto.id)
            if (!mayOpenTask(dto)) return
            val link =
                HomeTaskNotificationRoute.metadataPath(dto.type, dto.metadata)
                    ?: DeepLinkRouter.notificationPath(dto.type, dto.link)
            if (!link.isNullOrEmpty()) {
                val gigId = DeepLinkRouter.gigIdForLink(link)
                if (gigId != null) _openGig.tryEmit(gigId) else DeepLinkRouter.handle(link)
            }
        }

        companion object {
            /** `SavedStateHandle` key for the optional `?context=` nav arg. */
            const val CONTEXT_KEY = "context"

            /** Sentinel offset key for the unscoped (no `?context=`) list. */
            private const val UNSCOPED = "__all__"

            /** Newest-first, matching the backend's `created_at desc` order. */
            internal fun sortedByRecency(items: List<NotificationDto>): List<NotificationDto> =
                items.sortedByDescending { parseInstant(it.createdAt) ?: Instant.EPOCH }

            /** Append-and-dedupe for a paged multi-context fan-out. */
            internal fun merge(
                existing: List<NotificationDto>,
                incoming: List<NotificationDto>,
            ): List<NotificationDto> {
                val seen = existing.map { it.id }.toMutableSet()
                val next = existing.toMutableList()
                for (item in incoming) {
                    if (!seen.add(item.id)) continue
                    next.add(item)
                }
                return sortedByRecency(next)
            }

            /**
             * Group DTOs into Today + Earlier sections, in that order.
             * Public so the test suite can assert bucketing directly.
             */
            fun makeSections(
                dtos: List<NotificationDto>,
                now: Instant,
                zone: ZoneId,
                onDelete: ((String) -> Unit)? = null,
                onTap: (NotificationDto) -> Unit,
            ): List<RowSection> {
                val today = now.atZone(zone).toLocalDate()
                val todayRows = mutableListOf<RowModel>()
                val earlierRows = mutableListOf<RowModel>()
                for (dto in dtos) {
                    val created = parseInstant(dto.createdAt) ?: now
                    val createdDate = created.atZone(zone).toLocalDate()
                    val row = row(dto = dto, now = now, zone = zone, onDelete = onDelete) { onTap(dto) }
                    if (!createdDate.isBefore(today)) {
                        todayRows.add(row)
                    } else {
                        earlierRows.add(row)
                    }
                }
                val sections = mutableListOf<RowSection>()
                if (todayRows.isNotEmpty()) {
                    sections.add(RowSection(id = "today", header = "Today", rows = todayRows))
                }
                if (earlierRows.isNotEmpty()) {
                    sections.add(RowSection(id = "earlier", header = "Earlier", rows = earlierRows))
                }
                return sections
            }

            /**
             * Pure projection from a [NotificationDto] to a [RowModel].
             * Public so the test suite can assert the mapping without
             * standing up the full ViewModel.
             */
            fun row(
                dto: NotificationDto,
                now: Instant = Instant.now(),
                zone: ZoneId = ZoneId.systemDefault(),
                onDelete: ((String) -> Unit)? = null,
                onSelect: () -> Unit,
            ): RowModel {
                val unread = dto.isRead != true
                val category = NotificationCategory.fromRaw(dto.type)
                val destructive =
                    onDelete?.let { handler ->
                        RowDestructiveAction(
                            label = "Delete",
                            testTag = "notifications.row.${dto.id}.delete",
                            onClick = { handler(dto.id) },
                        )
                    }
                return RowModel(
                    id = dto.id,
                    title = dto.title ?: "Notification",
                    template = RowTemplate.StatusChip,
                    leading =
                        RowLeading.TypeIcon(
                            icon = category.icon,
                            background = category.tileBackground,
                            foreground = category.tileForeground,
                        ),
                    trailing = RowTrailing.None,
                    onTap = onSelect,
                    body = dto.body,
                    chips =
                        listOf(
                            RowChip(
                                text = category.label,
                                icon = category.icon,
                                tint = RowChip.Tint.Status(category.chipVariant),
                            ),
                        ),
                    timeMeta = formatRelativeTime(dto.createdAt, now = now, zone = zone),
                    highlight = if (unread) RowHighlight.Unread else null,
                    destructiveAction = destructive,
                )
            }

            /** ISO-8601 with optional fractional seconds, mirrors iOS. */
            fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            /**
             * Format the per-row time meta:
             *  < 1m  → "now"
             *  < 1h  → "Nm"
             *  < 24h → "Nh"
             *  yesterday → "Yesterday"
             *  2–6 days → weekday short ("Tue")
             *  ≥ 7 days → "MMM d" ("Mar 10")
             */
            fun formatRelativeTime(
                raw: String?,
                now: Instant,
                zone: ZoneId,
            ): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, now)
                val label =
                    when {
                        seconds < 60 -> "now"
                        seconds < 3600 -> "${seconds / 60}m"
                        seconds < 86_400 -> "${seconds / 3600}h"
                        else -> {
                            val today = now.atZone(zone).toLocalDate()
                            val createdDate = date.atZone(zone).toLocalDate()
                            val days = ChronoUnit.DAYS.between(createdDate, today)
                            when {
                                days == 1L -> "Yesterday"
                                days < 7L ->
                                    createdDate.dayOfWeek.getDisplayName(
                                        TextStyle.SHORT,
                                        Locale.US,
                                    )
                                else ->
                                    DateTimeFormatter.ofPattern("MMM d", Locale.US)
                                        .withZone(zone)
                                        .format(date)
                            }
                        }
                    }
                return label
            }
        }
    }
