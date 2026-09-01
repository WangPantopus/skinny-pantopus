@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * E1 Bookings inbox. One owner-polymorphic lifecycle inbox: the scope pills
 * (All / Personal / Home / Business) re-resolve the owner via
 * [HomesRepository]/[AuthRepository]; the segment maps 1:1 to the backend
 * `?status=` filter (upcoming|pending|past|cancelled). "All" unions every
 * resolved owner. Event-type names are resolved from `GET /event-types` (the
 * list endpoint omits them). Quick approve/decline on a pending row flips
 * optimistically and refetches on error.
 */
@HiltViewModel
class BookingsInboxViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val auth: AuthRepository,
        private val ownerRelay: BookingsOwnerRelay,
    ) : ViewModel() {
        private val _scope = MutableStateFlow(ScopeId.All)
        val scope: StateFlow<ScopeId> = _scope.asStateFlow()

        private val _segment = MutableStateFlow(BookingSegment.Upcoming)
        val segment: StateFlow<BookingSegment> = _segment.asStateFlow()

        private val _scopes = MutableStateFlow<List<ScopeChip>>(emptyList())
        val scopes: StateFlow<List<ScopeChip>> = _scopes.asStateFlow()

        private val _pendingBadge = MutableStateFlow(0)
        val pendingBadge: StateFlow<Int> = _pendingBadge.asStateFlow()

        private val _state = MutableStateFlow<BookingsInboxUiState>(BookingsInboxUiState.Loading)
        val state: StateFlow<BookingsInboxUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _searching = MutableStateFlow(false)
        val searching: StateFlow<Boolean> = _searching.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private var searchJob: Job? = null
        private var started = false
        private var owners: List<OwnerContext> = emptyList()
        private var currentRows: List<Pair<BookingDto, OwnerContext>> = emptyList()
        private var nameMap: Map<String, String> = emptyMap()

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() {
            _state.value = BookingsInboxUiState.Loading
            viewModelScope.launch {
                if (owners.isEmpty()) resolveOwners()
                fetch()
            }
        }

        fun refresh() {
            viewModelScope.launch {
                if (owners.isEmpty()) resolveOwners()
                fetch()
            }
        }

        fun selectScope(target: ScopeId) {
            if (target == _scope.value) return
            _scope.value = target
            _state.value = BookingsInboxUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun selectSegment(target: BookingSegment) {
            if (target == _segment.value) return
            _segment.value = target
            _state.value = BookingsInboxUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun toastConsumed() {
            _toast.value = null
        }

        fun toggleSearch() {
            val next = !_searching.value
            _searching.value = next
            if (!next && _query.value.isNotBlank()) {
                _query.value = ""
                _state.value = BookingsInboxUiState.Loading
                viewModelScope.launch { fetch() }
            }
        }

        fun setQuery(value: String) {
            _query.value = value
            searchJob?.cancel()
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    fetch()
                }
        }

        /** Empty-state CTA / FAB → the booking page (A4) of the currently selected scope's owner. */
        fun shareRoute(): String {
            val owner = owners.firstOrNull { it.id == _scope.value }?.owner ?: SchedulingOwner.Personal
            return SchedulingRoutes.bookingPageManage(owner.routeKind, owner.ownerRouteId)
        }

        /** Open a row's detail, stashing its resolved owner for the arg-less detail route. */
        fun detailRoute(id: String): String {
            ownerRelay.pending = currentRows.firstOrNull { it.first.id == id }?.second?.owner
            return SchedulingRoutes.bookingDetail(id)
        }

        // ─── Owner resolution ────────────────────────────────────────────────

        private suspend fun resolveOwners() {
            val resolved = mutableListOf<OwnerContext>()
            resolved +=
                OwnerContext(
                    ScopeId.Personal,
                    SchedulingOwner.Personal,
                    SchedulingPillar.Personal,
                    "Personal",
                )
            (homes.myHomes() as? NetworkResult.Success)?.data?.homes?.firstOrNull()?.let { home ->
                val label = home.name?.takeIf { it.isNotBlank() }?.let { "Home · $it" } ?: "Home"
                resolved +=
                    OwnerContext(
                        ScopeId.Home,
                        SchedulingOwner.Home(home.id),
                        SchedulingPillar.Home,
                        label,
                    )
            }
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.let { user ->
                val label = user.displayName?.takeIf { it.isNotBlank() }?.let { "Business · $it" } ?: "Business"
                resolved +=
                    OwnerContext(
                        ScopeId.Business,
                        SchedulingOwner.Business(user.id),
                        SchedulingPillar.Business,
                        label,
                    )
            }
            owners = resolved
            _scopes.value = buildScopeChips(resolved)
        }

        private fun buildScopeChips(resolved: List<OwnerContext>): List<ScopeChip> =
            buildList {
                add(ScopeChip(ScopeId.All, "All", ALL_SCOPE_ACCENT, showDot = false))
                resolved.forEach { ctx ->
                    add(ScopeChip(ctx.id, ctx.label, ctx.pillar.accent, showDot = true))
                }
            }

        private fun ownersForScope(): List<OwnerContext> =
            if (_scope.value == ScopeId.All) owners else owners.filter { it.id == _scope.value }

        // ─── Fetch ───────────────────────────────────────────────────────────

        private suspend fun fetch() {
            val active = ownersForScope()
            if (active.isEmpty()) {
                _state.value = BookingsInboxUiState.Empty(emptyFor(_segment.value))
                return
            }
            val viewingPending = _segment.value == BookingSegment.Pending
            val q = _query.value.trim().ifBlank { null }
            // Resolve event-type names + pending-badge count + shown-segment data per owner, in parallel.
            val names = mutableMapOf<String, String>()
            val data = mutableListOf<Pair<BookingDto, OwnerContext>>()
            var pendingCount = 0
            var anyFailure = false
            var anySuccess = false

            active.forEach { ctx ->
                val namesDeferred = viewModelScope.async { repo.getEventTypes(ctx.owner) }
                // Pending-badge count is always query-free so the badge stays accurate.
                val pendingDeferred =
                    viewModelScope.async {
                        repo.getBookings(ctx.owner, status = BookingSegment.Pending.query)
                    }
                // Reuse the badge fetch as the shown list only when viewing Pending with no active search.
                val dataDeferred =
                    if (viewingPending && q == null) {
                        null
                    } else {
                        viewModelScope.async {
                            repo.getBookings(
                                ctx.owner,
                                status = _segment.value.query,
                                query = q,
                            )
                        }
                    }

                (namesDeferred.await() as? NetworkResult.Success)?.data?.eventTypes?.forEach {
                    names[it.id] = it.name
                }
                val pendingResult = pendingDeferred.await()
                if (pendingResult is NetworkResult.Success) pendingCount += pendingResult.data.bookings.size

                when (val shown = dataDeferred?.await() ?: pendingResult) {
                    is NetworkResult.Success -> {
                        anySuccess = true
                        data += shown.data.bookings.map { it to ctx }
                    }
                    is NetworkResult.Failure -> anyFailure = true
                }
            }

            nameMap = names
            val rows = data
            currentRows = rows
            _pendingBadge.value = pendingCount

            if (rows.isEmpty()) {
                _state.value =
                    if (anyFailure && !anySuccess) {
                        BookingsInboxUiState.Error(
                            "We couldn't load your bookings. Check your connection and try again.",
                        )
                    } else {
                        BookingsInboxUiState.Empty(emptyFor(_segment.value))
                    }
                return
            }
            _state.value = BookingsInboxUiState.Content(buildSections(rows))
        }

        // ─── Section building ────────────────────────────────────────────────

        private fun buildSections(rows: List<Pair<BookingDto, OwnerContext>>): List<BookingSection> =
            when (_segment.value) {
                BookingSegment.Upcoming -> upcomingSections(rows)
                BookingSegment.Pending ->
                    listOf(
                        BookingSection(
                            id = "pending",
                            header = "Needs your approval",
                            dot = true,
                            rows = rows.map { (b, ctx) -> b.toRowUi(ctx, quickApprove = true) },
                        ),
                    )
                BookingSegment.Past ->
                    listOf(
                        BookingSection(
                            "past",
                            "Past",
                            dot = false,
                            rows = rows.map { (b, ctx) -> b.toRowUi(ctx) },
                        ),
                    )
                BookingSegment.Cancelled ->
                    listOf(
                        BookingSection(
                            "cancelled",
                            "Cancelled",
                            dot = false,
                            rows = rows.map { (b, ctx) -> b.toRowUi(ctx) },
                        ),
                    )
            }

        private fun upcomingSections(rows: List<Pair<BookingDto, OwnerContext>>): List<BookingSection> {
            val sorted = rows.sortedBy { it.first.startAt.orEmpty() }
            return DateBucket.entries.mapNotNull { bucket ->
                val inBucket = sorted.filter { bucketOf(it.first.startAt) == bucket }
                if (inBucket.isEmpty()) {
                    null
                } else {
                    BookingSection(
                        bucket.name,
                        bucket.label,
                        dot = false,
                        rows = inBucket.map { (b, ctx) -> b.toRowUi(ctx) },
                    )
                }
            }
        }

        private fun BookingDto.toRowUi(
            ctx: OwnerContext,
            quickApprove: Boolean = false,
        ): BookingRowUi {
            val status = BookingStatus.fromRaw(status)
            val name = inviteeName?.takeIf { it.isNotBlank() } ?: "Guest"
            return BookingRowUi(
                id = id,
                pillar = ctx.pillar,
                ownerLabel = ctx.label,
                initials = initialsOf(name),
                inviteeName = name,
                eventName = eventTypeId?.let { nameMap[it] } ?: "Booking",
                whenLabel = rowWhenLabel(startAt),
                pillStatus = status.toPillStatus(),
                showOwnerGlyph = true,
                // hostDisplayName is not in the list DTO. Keep this null (chip
                // hidden) rather than leaking a raw userId prefix into the UI as
                // if it were a name; wire it up once the list endpoint exposes a
                // display name.
                assigneeName = null,
                unread = status == BookingStatus.Pending,
                quickApprove = quickApprove && status == BookingStatus.Pending,
            )
        }

        // ─── Quick approve / decline (optimistic) ────────────────────────────

        fun approve(id: String) = act(id, approve = true)

        fun decline(id: String) = act(id, approve = false)

        private fun act(
            id: String,
            approve: Boolean,
        ) {
            val target = currentRows.firstOrNull { it.first.id == id } ?: return
            val owner = target.second.owner
            // Optimistic: drop it from the pending list + badge.
            currentRows = currentRows.filterNot { it.first.id == id }
            _pendingBadge.value = (_pendingBadge.value - 1).coerceAtLeast(0)
            rebuildOptimistic()
            viewModelScope.launch {
                val result =
                    if (approve) {
                        repo.approveBooking(
                            owner,
                            id,
                        )
                    } else {
                        repo.declineBooking(owner, id)
                    }
                if (result is NetworkResult.Failure) {
                    _toast.value = if (approve) "Couldn't approve. Pulling the latest." else "Couldn't decline. Pulling the latest."
                    fetch()
                }
            }
        }

        private fun rebuildOptimistic() {
            if (currentRows.isEmpty()) {
                _state.value = BookingsInboxUiState.Empty(emptyFor(_segment.value))
            } else {
                _state.value = BookingsInboxUiState.Content(buildSections(currentRows))
            }
        }

        private companion object {
            const val SEARCH_DEBOUNCE_MS = 300L
        }
    }
