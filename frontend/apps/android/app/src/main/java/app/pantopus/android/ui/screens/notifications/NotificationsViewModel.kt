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
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.notifications.NotificationDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.ui.components.StatusChipVariant
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
                        "listing" in lower || "mail" in lower -> Listing
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
        // Default keeps the JVM unit tests constructing the VM with just the
        // repository; Hilt always supplies the real handle.
        savedStateHandle: SavedStateHandle = SavedStateHandle(),
    ) : ViewModel() {
        private val pageSize = 20
        private var hasMore = false
        private var loading = false
        private var notifications: MutableList<NotificationDto> = mutableListOf()

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
            val requested = NotificationsZone.fromRaw(savedStateHandle.get<String>(CONTEXT_KEY))
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
            reload()
        }

        private val _selectedTab = MutableStateFlow(NotificationsTab.ALL)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(makeTopBarAction(enabled = false))
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        /** Initial load. Idempotent — re-running won't refetch when already loaded. */
        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && notifications.isNotEmpty()) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() = reload()

        /** Called when the list nears the bottom — fetches the next page. */
        fun loadMoreIfNeeded() {
            if (!hasMore || loading) return
            fetchPage(reset = false)
        }

        /** Tab switch — refetch with the new filter. */
        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            reload()
        }

        /**
         * Mark one row as read. The row stays in the list but its unread
         * highlight + 8dp dot disappear. Optimistic — rolls back on
         * failure.
         */
        fun markRead(id: String) {
            val target = notifications.firstOrNull { it.id == id } ?: return
            if (target.isRead == true) return
            val previous = notifications.toList()
            val previousCount = _unreadCount.value
            notifications =
                notifications.map { if (it.id == id) it.copy(isRead = true) else it }.toMutableList()
            _unreadCount.value = (previousCount - 1).coerceAtLeast(0)
            applyState()
            viewModelScope.launch {
                when (repo.markRead(id)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        notifications = previous.toMutableList()
                        _unreadCount.value = previousCount
                        applyState()
                    }
                }
            }
        }

        /**
         * Sweep every unread row — same optimistic + rollback pattern.
         *
         * Scoped to the active zone so "Mark all read" in the Personal
         * zone never silently clears the Beacon stream (RN
         * `src/app/notifications.tsx:206-214`).
         */
        fun markAllRead() {
            if (_unreadCount.value == 0) return
            val previous = notifications.toList()
            val previousCount = _unreadCount.value
            val contexts = activeContexts()
            notifications = notifications.map { it.copy(isRead = true) }.toMutableList()
            _unreadCount.value = 0
            applyState()
            viewModelScope.launch {
                when (repo.markAllRead(contexts)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        notifications = previous.toMutableList()
                        _unreadCount.value = previousCount
                        applyState()
                    }
                }
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
            val target = notifications.firstOrNull { it.id == id } ?: return
            val previous = notifications.toList()
            val previousCount = _unreadCount.value
            notifications = notifications.filterNot { it.id == id }.toMutableList()
            if (target.isRead != true) {
                _unreadCount.value = (previousCount - 1).coerceAtLeast(0)
            }
            applyState()
            viewModelScope.launch {
                when (repo.delete(id)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        notifications = previous.toMutableList()
                        _unreadCount.value = previousCount
                        applyState()
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
            // Zone firewall: an audience notification must not land in the
            // personal stream (RN `src/app/notifications.tsx:180`).
            if (useScopedZones() && !_zone.value.matches(dto.context)) return
            notifications.add(0, dto)
            if (dto.isRead != true) {
                _unreadCount.value = _unreadCount.value + 1
            }
            applyState()
        }

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            notifications = mutableListOf()
            offsets = mutableMapOf()
            hasMore = false
            fetchPage(reset = true)
        }

        private fun fetchPage(reset: Boolean) {
            if (loading) return
            loading = true
            if (reset) offsets = mutableMapOf()
            val unreadOnly = _selectedTab.value == NotificationsTab.UNREAD
            // A null context means "unscoped legacy list"; the fan-out below
            // walks one request per context so the Personal zone can merge
            // `personal` + `platform` the way RN does.
            val contexts = activeContexts() ?: listOf(UNSCOPED)
            viewModelScope.launch {
                val incoming = mutableListOf<NotificationDto>()
                var anyMore = false
                var scopedUnread = 0
                var sawUnreadCount = false
                var failure: NetworkResult.Failure? = null
                for (context in contexts) {
                    val result =
                        repo.list(
                            limit = pageSize,
                            offset = offsets[context] ?: 0,
                            unreadOnly = unreadOnly,
                            context = context.takeIf { it != UNSCOPED },
                        )
                    when (result) {
                        is NetworkResult.Success -> {
                            val body = result.data
                            incoming.addAll(body.notifications)
                            offsets[context] = (offsets[context] ?: 0) + body.notifications.size
                            anyMore = anyMore || (body.hasMore ?: (body.notifications.size >= pageSize))
                            body.unreadCount?.let {
                                scopedUnread += it
                                sawUnreadCount = true
                            }
                        }
                        is NetworkResult.Failure -> failure = result
                    }
                }
                loading = false
                val failed = failure
                if (failed != null && incoming.isEmpty()) {
                    if (reset) {
                        _state.value =
                            ListOfRowsUiState.Error(failed.error.displayMessage("Couldn't load the list."))
                        _topBarAction.value = makeTopBarAction(enabled = _unreadCount.value > 0)
                    }
                    return@launch
                }
                notifications =
                    if (reset) {
                        sortedByRecency(incoming).toMutableList()
                    } else {
                        merge(notifications, incoming).toMutableList()
                    }
                hasMore = anyMore
                _unreadCount.value =
                    if (sawUnreadCount) scopedUnread else notifications.count { it.isRead != true }
                revealZoneStripIfAudienceSeen()
                applyState()
            }
        }

        /**
         * Reveal the Personal / Audience strip once the unscoped list has
         * actually returned a Beacon row. No probe request, no feature
         * flag, no fabricated zone — the strip only appears when the
         * backend has handed us audience-context data.
         */
        private fun revealZoneStripIfAudienceSeen() {
            if (_showsZoneStrip.value) return
            _showsZoneStrip.value = notifications.any { it.context == NotificationContext.AUDIENCE }
        }

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
                )
            _state.value = ListOfRowsUiState.Loaded(sections = sections, hasMore = hasMore)
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
                label = "Mark all read",
                isEnabled = enabled,
                onClick = { markAllRead() },
            )

        private fun handleTap(dto: NotificationDto) {
            if (dto.isRead != true) markRead(dto.id)
            val link = dto.link
            if (!link.isNullOrEmpty()) {
                DeepLinkRouter.handle(link)
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
