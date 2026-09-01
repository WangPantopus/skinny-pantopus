@file:Suppress(
    "ComplexCondition",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongMethod",
    "LongParameterList",
    "MagicNumber",
    "PackageNaming",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.connections

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.connections.BlockedRelationshipDto
import app.pantopus.android.data.api.models.connections.SentRequestDto
import app.pantopus.android.data.api.models.relationships.PendingRequestDto
import app.pantopus.android.data.api.models.relationships.RelationshipDto
import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connections.ConnectionsRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowDestructiveAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowPillTone
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SearchBarConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.screens.shared.list_of_rows.VerticalAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** Stable tab ids exposed for tests + the screen. */
object ConnectionsTab {
    const val ALL = "all"
    const val NEIGHBORS = "neighbors"
    const val PENDING = "pending"

    /** S5 — outbound requests awaiting a decision. RN `connections.tsx:19`. */
    const val SENT = "sent"

    /** S5 — people the viewer has blocked. RN `connections.tsx:20`. */
    const val BLOCKED = "blocked"
}

/**
 * Pending "remove this connection?" confirmation. Names the person so the
 * dialog copy can't be mistaken for a generic destructive prompt.
 */
data class ConnectionRemovalRequest(
    val id: String,
    val displayName: String,
)

/**
 * Routing payload emitted by the Connections row's message-CTA. The host
 * (`RootTabScreen`) maps this onto a `chatConversation` push.
 */
data class ConnectionsChatTarget(
    val userId: String,
    val displayName: String,
    val initials: String,
    val verified: Boolean,
)

/**
 * Six-tone palette for the per-user avatar gradient. Stable mapping
 * from user id keeps the same person always rendering the same color.
 */
enum class ConnectionAvatarTone {
    Sky,
    Teal,
    Amber,
    Rose,
    Violet,
    Slate,
    ;

    val gradient: GradientPair
        get() =
            when (this) {
                Sky -> GradientPair(PantopusColors.primary500, PantopusColors.primary700)
                Teal -> GradientPair(PantopusColors.success, PantopusColors.home)
                Amber -> GradientPair(PantopusColors.warning, PantopusColors.handyman)
                Rose -> GradientPair(PantopusColors.error, PantopusColors.vehicles)
                Violet -> GradientPair(PantopusColors.business, PantopusColors.goods)
                Slate -> GradientPair(PantopusColors.appTextSecondary, PantopusColors.appTextStrong)
            }

    companion object {
        /**
         * Pick a deterministic tone for the given identifier so the same
         * user renders the same color across sessions.
         */
        fun toneFor(id: String): ConnectionAvatarTone {
            val palette = entries
            var hash = 0
            for (ch in id) hash += ch.code
            val index = (hash % palette.size + palette.size) % palette.size
            return palette[index]
        }
    }
}

/**
 * Drives the T5.2.3 Connections center. Mirrors iOS
 * `ConnectionsViewModel` exactly — same tabs, same search, same row
 * mapping, same optimistic accept / reject pattern with rollback on
 * failure.
 *
 * S5 (RN parity, `src/app/connections.tsx:16-21,70-82,126-148`) adds the
 * Sent + Blocked tabs and the per-row Remove (disconnect, confirmed) and
 * Unblock actions. Four GETs fire in parallel on initial load
 * (`/api/relationships`, `…/requests/pending`, `…/requests/sent`,
 * `…/blocked`); subsequent tab switches segment over the cached payload.
 */
@HiltViewModel
class ConnectionsViewModel
    @Inject
    constructor(
        private val repo: RelationshipsRepository,
        // S5 — Sent / Blocked / disconnect / unblock live in their own
        // repository so this feature doesn't contend with the trust-graph
        // half of `/api/relationships`.
        private val connectionsRepo: ConnectionsRepository,
    ) : ViewModel() {
        private var accepted: List<RelationshipDto> = emptyList()
        private var pending: List<PendingRequestDto> = emptyList()
        private var sent: List<SentRequestDto> = emptyList()
        private var blocked: List<BlockedRelationshipDto> = emptyList()
        private var loadedOnce: Boolean = false

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        /** Row awaiting disconnect confirmation. Null = no dialog. */
        private val _pendingRemoval = MutableStateFlow<ConnectionRemovalRequest?>(null)
        val pendingRemoval: StateFlow<ConnectionRemovalRequest?> = _pendingRemoval.asStateFlow()

        private val _selectedTab = MutableStateFlow(ConnectionsTab.ALL)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _searchText = MutableStateFlow("")
        val searchText: StateFlow<String> = _searchText.asStateFlow()

        private val _tabs = MutableStateFlow(makeTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _searchBar =
            MutableStateFlow<SearchBarConfig?>(makeSearchBar(""))
        val searchBar: StateFlow<SearchBarConfig?> = _searchBar.asStateFlow()

        private val _topBarAction = MutableStateFlow<TopBarAction?>(makeTopBarAction(::onFindPeopleStub))
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        private val _fab = MutableStateFlow<FabAction?>(makeFab(::onFindPeopleStub))
        val fab: StateFlow<FabAction?> = _fab.asStateFlow()

        /**
         * Routing callbacks. Set by the screen via [onMessage] / [onFindPeople]
         * before [load]. The defaults are no-ops so the VM is safe to
         * construct in isolation (tests, previews).
         */
        var onMessage: (ConnectionsChatTarget) -> Unit = {}
            set(value) {
                field = value
                applyState()
            }
        var onFindPeople: () -> Unit = {}
            set(value) {
                field = value
                _topBarAction.value = makeTopBarAction(value)
                _fab.value = makeFab(value)
                applyState()
            }

        /** Initial load. Idempotent — re-running won't refetch when already loaded. */
        fun load() {
            if (loadedOnce) return
            reload()
        }

        /** Pull-to-refresh. */
        fun refresh() = reload()

        /** Tab switch — re-segment over the cached payload. */
        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            applyState()
        }

        /** Live search update from the chrome's search bar. */
        fun updateSearch(text: String) {
            if (_searchText.value == text) return
            _searchText.value = text
            _searchBar.value = makeSearchBar(text)
            applyState()
        }

        /**
         * Accept a pending request. Optimistically removes the request and
         * inserts a synthetic accepted row so the All / Neighbors counts
         * bump immediately. Rolls back on failure.
         */
        fun accept(requestId: String) {
            val request = pending.firstOrNull { it.id == requestId } ?: return
            val user = request.requester ?: return
            val previousPending = pending
            val previousAccepted = accepted
            pending = pending.filterNot { it.id == requestId }
            val nowIso = isoString(Instant.now())
            val synthetic =
                RelationshipDto(
                    id = requestId,
                    status = "accepted",
                    createdAt = request.createdAt,
                    respondedAt = nowIso,
                    acceptedAt = nowIso,
                    blockedBy = null,
                    direction = "received",
                    otherUser = user,
                )
            accepted = listOf(synthetic) + accepted
            applyState()
            viewModelScope.launch {
                when (repo.accept(requestId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        pending = previousPending
                        accepted = previousAccepted
                        applyState()
                    }
                }
            }
        }

        /** Decline / ignore a pending request. Optimistic; rolls back on failure. */
        fun reject(requestId: String) {
            val previousPending = pending
            pending = pending.filterNot { it.id == requestId }
            applyState()
            viewModelScope.launch {
                when (repo.reject(requestId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        pending = previousPending
                        applyState()
                    }
                }
            }
        }

        // ─── Remove (disconnect) / Unblock ─────────────────────────

        /**
         * Ask for confirmation before disconnecting. The screen renders an
         * `AlertDialog` off [pendingRemoval]; RN shows the same
         * Cancel / Remove alert (`src/app/connections.tsx:70-77`).
         */
        fun requestRemoval(relationshipId: String) {
            val rel = accepted.firstOrNull { it.id == relationshipId } ?: return
            _pendingRemoval.value =
                ConnectionRemovalRequest(
                    id = relationshipId,
                    displayName = displayNameFor(rel.otherUser) ?: "this connection",
                )
        }

        /** Dismiss the confirmation without disconnecting. */
        fun cancelRemoval() {
            _pendingRemoval.value = null
        }

        /** Run the confirmed disconnect. */
        fun confirmRemoval() {
            val request = _pendingRemoval.value ?: return
            _pendingRemoval.value = null
            disconnect(request.id)
        }

        /**
         * `DELETE /api/relationships/:id`. Optimistic — the row disappears
         * immediately and is restored if the call fails.
         */
        fun disconnect(relationshipId: String) {
            val previous = accepted
            accepted = accepted.filterNot { it.id == relationshipId }
            applyState()
            viewModelScope.launch {
                when (connectionsRepo.disconnect(relationshipId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        accepted = previous
                        applyState()
                    }
                }
            }
        }

        /**
         * `POST /api/relationships/:id/unblock`. Optimistic — the row leaves
         * the Blocked tab and is restored if the call fails. The backend
         * deletes the row outright, so nothing moves into Connections.
         */
        fun unblock(relationshipId: String) {
            val previous = blocked
            blocked = blocked.filterNot { it.id == relationshipId }
            applyState()
            viewModelScope.launch {
                when (connectionsRepo.unblock(relationshipId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        blocked = previous
                        applyState()
                    }
                }
            }
        }

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val acceptedDeferred = async { fetchAccepted() }
                val pendingDeferred = async { fetchPending() }
                val sentDeferred = async { fetchSent() }
                val blockedDeferred = async { fetchBlocked() }
                val acceptedOk = acceptedDeferred.await()
                val pendingOk = pendingDeferred.await()
                val sentOk = sentDeferred.await()
                val blockedOk = blockedDeferred.await()
                if (!acceptedOk && !pendingOk && !sentOk && !blockedOk) {
                    _state.value =
                        ListOfRowsUiState.Error("Couldn't load your connections. Try again.")
                    return@launch
                }
                loadedOnce = true
                applyState()
            }
        }

        private suspend fun fetchSent(): Boolean =
            when (val result = connectionsRepo.sentRequests()) {
                is NetworkResult.Success -> {
                    sent = result.data.requests
                    true
                }
                is NetworkResult.Failure -> false
            }

        private suspend fun fetchBlocked(): Boolean =
            when (val result = connectionsRepo.blocked()) {
                is NetworkResult.Success -> {
                    blocked = result.data.blocked
                    true
                }
                is NetworkResult.Failure -> false
            }

        private suspend fun fetchAccepted(): Boolean =
            when (val result = repo.list(status = "accepted")) {
                is NetworkResult.Success -> {
                    accepted = result.data.relationships
                    true
                }
                is NetworkResult.Failure -> false
            }

        private suspend fun fetchPending(): Boolean =
            when (val result = repo.pendingRequests()) {
                is NetworkResult.Success -> {
                    pending = result.data.requests
                    true
                }
                is NetworkResult.Failure -> false
            }

        private fun applyState() {
            _tabs.value = makeTabs()
            val now = Instant.now()
            val zone = ZoneId.systemDefault()
            val rows: List<RowModel> =
                when (_selectedTab.value) {
                    ConnectionsTab.PENDING -> filteredPending().map { rowForPending(it, now, zone) }
                    ConnectionsTab.SENT -> filteredSent().map { rowForSent(it, now, zone) }
                    ConnectionsTab.BLOCKED -> filteredBlocked().map { rowForBlocked(it, now, zone) }
                    ConnectionsTab.NEIGHBORS -> filteredNeighbors().map { rowForAccepted(it, now, zone) }
                    else -> filteredAccepted().map { rowForAccepted(it, now, zone) }
                }
            if (rows.isEmpty()) {
                _state.value = emptyState(_selectedTab.value)
                return
            }
            val section = RowSection(id = "connections", rows = rows)
            _state.value = ListOfRowsUiState.Loaded(sections = listOf(section), hasMore = false)
        }

        private fun makeTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(id = ConnectionsTab.ALL, label = "All", count = filteredAccepted().size),
                ListOfRowsTab(
                    id = ConnectionsTab.NEIGHBORS,
                    label = "Neighbors",
                    count = filteredNeighbors().size,
                ),
                ListOfRowsTab(id = ConnectionsTab.PENDING, label = "Pending", count = filteredPending().size),
                ListOfRowsTab(id = ConnectionsTab.SENT, label = "Sent", count = filteredSent().size),
                ListOfRowsTab(id = ConnectionsTab.BLOCKED, label = "Blocked", count = filteredBlocked().size),
            )

        private fun makeTopBarAction(handler: () -> Unit): TopBarAction =
            TopBarAction(
                icon = PantopusIcon.UserPlus,
                contentDescription = "Find people",
                onClick = handler,
            )

        private fun makeFab(handler: () -> Unit): FabAction =
            FabAction(
                icon = PantopusIcon.UserPlus,
                contentDescription = "Find people",
                variant = FabVariant.SecondaryCreate,
                onClick = handler,
            )

        private fun makeSearchBar(text: String): SearchBarConfig =
            SearchBarConfig(
                placeholder = "Search by name or neighborhood",
                text = text,
                onChange = { updateSearch(it) },
            )

        private fun emptyState(tab: String): ListOfRowsUiState.Empty =
            when (tab) {
                ConnectionsTab.PENDING ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Mailbox,
                        headline = "No pending requests",
                        subcopy = "When someone sends you a connection request, it'll show up here.",
                    )
                ConnectionsTab.SENT ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Send,
                        headline = "No sent requests",
                        subcopy = "Requests you send will appear here until accepted or declined.",
                    )
                ConnectionsTab.BLOCKED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Ban,
                        headline = "No blocked users",
                        subcopy = "People you block stop seeing your posts and can't message you.",
                        tint = PantopusColors.appSurfaceSunken,
                        accent = PantopusColors.appTextSecondary,
                    )
                ConnectionsTab.NEIGHBORS ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.MapPin,
                        headline = "No neighbors yet",
                        subcopy =
                            "Connections who share their locality show up here. " +
                                "Invite a neighbor or accept a nearby request to get started.",
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.UserPlus,
                        headline = "No connections yet",
                        subcopy =
                            "Meet verified neighbors. Browse the Pulse, reply to a post, " +
                                "or invite someone you know on the block.",
                        ctaTitle = "Find people",
                        onCta = { onFindPeople() },
                    )
            }

        // ─── Filtering ──────────────────────────────────────────────

        private fun filteredAccepted(): List<RelationshipDto> = applySearch(accepted) { it.otherUser.searchableText() }

        private fun filteredNeighbors(): List<RelationshipDto> {
            val withCity = accepted.filter { !(it.otherUser?.city.isNullOrEmpty()) }
            return applySearch(withCity) { it.otherUser.searchableText() }
        }

        private fun filteredPending(): List<PendingRequestDto> = applySearch(pending) { it.requester.searchableText() }

        private fun filteredSent(): List<SentRequestDto> = applySearch(sent) { it.addressee.searchableText() }

        private fun filteredBlocked(): List<BlockedRelationshipDto> = applySearch(blocked) { it.blockedUser.searchableText() }

        private fun <T> applySearch(
            items: List<T>,
            text: (T) -> String,
        ): List<T> {
            val needle = _searchText.value.trim().lowercase(Locale.ROOT)
            if (needle.isEmpty()) return items
            return items.filter { text(it).contains(needle) }
        }

        // ─── Row mapping (pure projections) ────────────────────────

        internal fun rowForAccepted(
            rel: RelationshipDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val user = rel.otherUser
            val displayName = displayNameFor(user) ?: "Member"
            val initials = initialsFor(user, displayName)
            val target =
                ConnectionsChatTarget(
                    userId = user?.id ?: rel.id,
                    displayName = displayName,
                    initials = initials,
                    verified = true,
                )
            val acceptedRaw = rel.acceptedAt ?: rel.createdAt
            val timeFragment = formatRelativeTime(acceptedRaw, now, zone) ?: "recently"
            val locality = localityText(user)
            return RowModel(
                id = rel.id,
                title = displayName,
                subtitle = locality,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = displayName,
                        imageUrl = user?.profilePictureUrl,
                        background = AvatarBackground.Gradient(ConnectionAvatarTone.toneFor(user?.id ?: rel.id).gradient),
                        size = AvatarBadgeSize.Large,
                        verified = true,
                    ),
                trailing =
                    RowTrailing.CircularAction(
                        icon = PantopusIcon.MessageCircle,
                        accessibilityLabel = "Message $displayName",
                        background = PantopusColors.primary50,
                        foreground = PantopusColors.primary600,
                        onClick = { onMessage(target) },
                    ),
                body = "Connected $timeFragment",
                subtitleIcon = if (locality != null) PantopusIcon.MapPin else null,
                bodyIcon = PantopusIcon.UserPlus,
                destructiveAction =
                    RowDestructiveAction(
                        label = "Remove",
                        testTag = "connections.row.${rel.id}.remove",
                        onClick = { requestRemoval(rel.id) },
                    ),
            )
        }

        /**
         * Outbound request row — no actions, just the "Pending" status the
         * RN screen shows (`src/app/connections.tsx:141-143`).
         */
        internal fun rowForSent(
            request: SentRequestDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val user = request.addressee
            val displayName = displayNameFor(user) ?: "Member"
            val timeFragment = formatRelativeTime(request.createdAt, now, zone) ?: "just now"
            val locality = localityText(user)
            return RowModel(
                id = request.id,
                title = displayName,
                subtitle = locality,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = displayName,
                        imageUrl = user?.profilePictureUrl,
                        background =
                            AvatarBackground.Gradient(
                                ConnectionAvatarTone.toneFor(user?.id ?: request.id).gradient,
                            ),
                        size = AvatarBadgeSize.Large,
                        verified = false,
                    ),
                trailing = RowTrailing.Status(text = "Pending", variant = StatusChipVariant.Warning),
                body = "Sent $timeFragment",
                subtitleIcon = if (locality != null) PantopusIcon.MapPin else null,
                bodyIcon = PantopusIcon.Clock,
            )
        }

        /**
         * Blocked row — trailing neutral "Unblock" pill, matching the A14.4
         * blocked-users treatment the shell already ships.
         */
        internal fun rowForBlocked(
            rel: BlockedRelationshipDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val user = rel.blockedUser
            val displayName = displayNameFor(user) ?: "Member"
            val timeFragment = formatRelativeTime(rel.respondedAt ?: rel.createdAt, now, zone) ?: "recently"
            val locality = localityText(user)
            return RowModel(
                id = rel.id,
                title = displayName,
                subtitle = locality,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = displayName,
                        imageUrl = user?.profilePictureUrl,
                        background =
                            AvatarBackground.Gradient(
                                ConnectionAvatarTone.toneFor(user?.id ?: rel.id).gradient,
                            ),
                        size = AvatarBadgeSize.Large,
                        verified = false,
                    ),
                trailing =
                    RowTrailing.PillButton(
                        label = "Unblock",
                        tone = RowPillTone.Neutral,
                        onClick = { unblock(rel.id) },
                    ),
                body = "Blocked $timeFragment",
                subtitleIcon = if (locality != null) PantopusIcon.MapPin else null,
                bodyIcon = PantopusIcon.Ban,
                note = rel.blockReason?.takeIf { it.isNotEmpty() },
            )
        }

        internal fun rowForPending(
            request: PendingRequestDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val user = request.requester
            val displayName = displayNameFor(user) ?: "Member"
            val timeFragment = formatRelativeTime(request.createdAt, now, zone) ?: "just now"
            val locality = localityText(user)
            val requestId = request.id
            return RowModel(
                id = request.id,
                title = displayName,
                subtitle = locality,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = displayName,
                        imageUrl = user?.profilePictureUrl,
                        background = AvatarBackground.Gradient(ConnectionAvatarTone.toneFor(user?.id ?: request.id).gradient),
                        size = AvatarBadgeSize.Large,
                        verified = false,
                    ),
                trailing =
                    RowTrailing.VerticalActions(
                        primary =
                            VerticalAction(
                                label = "Accept",
                                variant = CompactButtonVariant.Primary,
                                onClick = { accept(requestId) },
                            ),
                        secondary =
                            VerticalAction(
                                label = "Ignore",
                                variant = CompactButtonVariant.Ghost,
                                onClick = { reject(requestId) },
                            ),
                    ),
                body = "New request $timeFragment",
                subtitleIcon = if (locality != null) PantopusIcon.MapPin else null,
                bodyIcon = PantopusIcon.UserPlus,
            )
        }

        @Suppress("UnusedPrivateMember")
        private fun onFindPeopleStub() {
            // Replaced by [onFindPeople] when the screen wires it.
        }

        companion object {
            internal fun displayNameFor(user: RelationshipUserDto?): String? {
                user ?: return null
                val name = user.name?.takeIf { it.isNotEmpty() }
                val first = user.firstName?.takeIf { it.isNotEmpty() }
                val last = user.lastName?.takeIf { it.isNotEmpty() }
                return listOfNotNull(
                    name,
                    if (first != null && last != null) "$first $last" else null,
                    first,
                    user.username?.takeIf { it.isNotEmpty() },
                ).firstOrNull()
            }

            internal fun initialsFor(
                user: RelationshipUserDto?,
                displayName: String,
            ): String {
                val parts = displayName.split(" ").filter { it.isNotEmpty() }.take(2)
                val derived = parts.joinToString("") { it.first().toString() }.uppercase(Locale.ROOT)
                if (derived.isNotEmpty()) return derived
                val first = user?.firstName?.firstOrNull()?.toString()
                val last = user?.lastName?.firstOrNull()?.toString()
                if (first != null && last != null) return (first + last).uppercase(Locale.ROOT)
                return displayName.take(2).uppercase(Locale.ROOT)
            }

            internal fun localityText(user: RelationshipUserDto?): String? {
                if (user == null) return null
                val city = user.city?.trim().orEmpty()
                val state = user.state?.trim().orEmpty()
                return when {
                    city.isNotEmpty() && state.isNotEmpty() -> "$city, $state"
                    city.isNotEmpty() -> city
                    state.isNotEmpty() -> state
                    else -> null
                }
            }

            internal fun searchableText(user: RelationshipUserDto?): String =
                listOfNotNull(
                    displayNameFor(user),
                    user?.username,
                    user?.city,
                    user?.state,
                ).joinToString(" ").lowercase(Locale.ROOT)

            internal fun isoString(instant: Instant): String = DateTimeFormatter.ISO_INSTANT.format(instant.truncatedTo(ChronoUnit.SECONDS))

            internal fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            /**
             * Format a relative-time fragment for the row body.
             *  < 1m   → "just now"
             *  < 1h   → "Nm ago"
             *  < 24h  → "Nh ago"
             *  1 day  → "yesterday"
             *  2-6 d  → "Nd ago"
             *  7-29 d → "Nw ago"
             *  ≥ 30 d → "MMM d"
             */
            fun formatRelativeTime(
                raw: String?,
                now: Instant,
                zone: ZoneId,
            ): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, now)
                return when {
                    seconds < 60 -> "just now"
                    seconds < 3600 -> "${seconds / 60}m ago"
                    seconds < 86_400 -> "${seconds / 3600}h ago"
                    else -> {
                        val today = now.atZone(zone).toLocalDate()
                        val createdDate = date.atZone(zone).toLocalDate()
                        val days = ChronoUnit.DAYS.between(createdDate, today)
                        when {
                            days == 1L -> "yesterday"
                            days < 7L -> "${days}d ago"
                            days < 30L -> "${days / 7}w ago"
                            else ->
                                DateTimeFormatter.ofPattern("MMM d", Locale.US)
                                    .withZone(zone)
                                    .format(date)
                        }
                    }
                }
            }

            // Local extensions to keep call sites readable
            private fun RelationshipUserDto?.searchableText(): String = searchableText(this)
        }
    }
