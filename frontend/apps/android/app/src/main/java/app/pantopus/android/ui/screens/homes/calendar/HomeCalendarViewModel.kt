@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "TooManyFunctions",
    "LongMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling.bookings.BookingsOwnerRelay
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/** Nav arg key for the Home calendar route. */
const val HOME_CALENDAR_HOME_ID_KEY = "homeId"

/**
 * `source` / `event_type` marker stamped on the synthetic rows that carry
 * a derived task / bill / package due-date through the agenda projection.
 * It is neither `event` nor `booking`, so [HomeAgendaItem.isBooking] stays
 * false and the row never routes to A8; as an `event_type` it infers to
 * [CalendarEventCategory.Generic], which no derived row ever renders.
 * Client-only — never sent on the wire.
 */
private const val DERIVED_SOURCE = "derived"

/** Render state for the bespoke Home calendar agenda (F1). */
sealed interface HomeCalendarUiState {
    data object Loading : HomeCalendarUiState

    data class Error(val message: String) : HomeCalendarUiState

    /** [empty] is non-null when there are no rows to show (first-run / filtered). */
    data class Loaded(
        val sections: List<HomeAgendaSection>,
        val empty: AgendaEmpty?,
    ) : HomeCalendarUiState
}

/**
 * F1 — Home Calendar / Agenda. Fetches the booking **union**
 * (`GET /api/homes/:id/events`, rows tagged `source:'event'|'booking'`)
 * and projects it into a day-grouped agenda + a 7-day month strip + a
 * member filter row. Mirrors iOS `HomeCalendarViewModel`.
 *
 * Booking rows are read-only — tapping one routes to A8's Booking Detail
 * by route; never persisted as a `HomeCalendarEvent`.
 *
 * Task due-dates, bill due-dates and package expected-delivery dates are
 * plotted alongside the events (see [fetchDerived] / [derivedRow]) so a
 * household sees everything that lands on a day, not just calendar
 * entries. Those rows are read-only, and — having no household owner —
 * they are exempt from the member filter, so they stay visible under
 * "All", "Mine" and every per-member chip. Anything else contradicts the
 * month strip, which counts their dots unfiltered.
 */
@HiltViewModel
class HomeCalendarViewModel
    internal constructor(
        private val repo: HomesRepository,
        private val membersRepo: HomeMembersRepository,
        private val authRepository: AuthRepository,
        private val networkMonitor: NetworkMonitor,
        private val bookingsOwnerRelay: BookingsOwnerRelay,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
        // Device-local display zone — agenda rows and the month strip render
        // the same wall time the event form composes instants from (iOS
        // parity), and a bare `yyyy-MM-dd` due date anchors to midnight in it.
        // Tests inject a fixed zone; the all-day heuristic for *timestamped*
        // events stays pinned to UTC inside HomeAgendaBuilder.
        private val zone: ZoneId = ZoneId.systemDefault(),
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomesRepository,
            membersRepo: HomeMembersRepository,
            authRepository: AuthRepository,
            networkMonitor: NetworkMonitor,
            bookingsOwnerRelay: BookingsOwnerRelay,
            savedStateHandle: SavedStateHandle,
        ) : this(
            repo,
            membersRepo,
            authRepository,
            networkMonitor,
            bookingsOwnerRelay,
            savedStateHandle,
            Instant::now,
            ZoneId.systemDefault(),
        )

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(HOME_CALENDAR_HOME_ID_KEY)) {
                "HomeCalendarViewModel requires a $HOME_CALENDAR_HOME_ID_KEY nav argument"
            }

        val isOnline: StateFlow<Boolean> get() = networkMonitor.isOnline

        private val _state = MutableStateFlow<HomeCalendarUiState>(HomeCalendarUiState.Loading)
        val state: StateFlow<HomeCalendarUiState> = _state.asStateFlow()

        private val _monthStrip = MutableStateFlow<MonthStripState?>(null)
        val monthStrip: StateFlow<MonthStripState?> = _monthStrip.asStateFlow()

        private val _filterChips = MutableStateFlow<List<MemberFilter>>(listOf(MemberFilter.All, MemberFilter.Mine))
        val filterChips: StateFlow<List<MemberFilter>> = _filterChips.asStateFlow()

        private val _memberFilter = MutableStateFlow<MemberFilter>(MemberFilter.All)
        val memberFilter: StateFlow<MemberFilter> = _memberFilter.asStateFlow()

        private var events: List<CalendarEventDto> = emptyList()

        /**
         * Task due-dates, bill due-dates and package expected-delivery
         * dates plotted alongside the home events, already projected into
         * the agenda's own entry shape. RN's month grid does the same
         * (`src/app/homes/[id]/calendar.tsx:48-74`) so a household can see
         * everything that lands on a day, not just calendar entries.
         *
         * Kept as rows (rather than as the raw [HomeCalendarDerivedItem]
         * feed) so events and derived due-dates share exactly one grouping
         * pass through [HomeAgendaBuilder] — the same single-pass contract
         * the list-of-rows projection expressed with its `AgendaEntry`.
         */
        private var derivedRows: List<CalendarEventDto> = emptyList()

        /**
         * The [HomeCalendarDerivedItem] behind each row in [derivedRows],
         * keyed by the synthetic DTO id. Travelling alongside the rows — not
         * folded into them — is what lets the projection render each row
         * with its kind's own label / icon / background / foreground and its
         * `detail ?: kind.label` subtitle, exempt it from the member filter
         * and mark it read-only, instead of re-deriving any of that from an
         * `event_type` string.
         */
        private var derivedIndex: HomeAgendaDerivedIndex = emptyMap()

        private var membersMap: Map<String, HomeMember> = emptyMap()
        private var resolvedUserId: String? = null
        private var weekAnchorIso: String = HomeAgendaBuilder.weekAnchorIso(clock(), zone)
        private var selectedIsoDate: String? = null

        private var onAddEvent: () -> Unit = {}
        private var onOpenEvent: (String) -> Unit = {}
        private var onNavigate: (String) -> Unit = {}

        fun configureNavigation(
            onAddEvent: () -> Unit = {},
            onOpenEvent: (String) -> Unit = {},
            onNavigate: (String) -> Unit = {},
        ) {
            this.onAddEvent = onAddEvent
            this.onOpenEvent = onOpenEvent
            this.onNavigate = onNavigate
        }

        // MARK: - Lifecycle

        fun load() {
            _state.value = HomeCalendarUiState.Loading
            fetch()
        }

        fun refresh() {
            fetch()
        }

        private fun fetch() {
            viewModelScope.launch {
                if (resolvedUserId == null) resolvedUserId = signedInUserId()
                val eventsTask = async { repo.getHomeEvents(homeId) }
                val membersTask = async { membersRepo.listOccupants(homeId) }
                val eventsResult = eventsTask.await()
                applyMembers(membersTask.await())
                when (eventsResult) {
                    is NetworkResult.Success -> {
                        events = eventsResult.data.events
                        // Events are the primary read — the three derived
                        // feeds are best-effort side-reads that must never
                        // fail the calendar.
                        fetchDerived()
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        events = emptyList()
                        derivedRows = emptyList()
                        derivedIndex = emptyMap()
                        // Keep the last-built month strip so a refresh failure
                        // after a successful load retains the chrome (design
                        // FrameError keeps the strip; mirrors iOS, which never
                        // clears `monthStrip` on error).
                        _state.value =
                            HomeCalendarUiState.Error(
                                eventsResult.error.displayMessage("Couldn't load your calendar."),
                            )
                    }
                }
            }
        }

        /**
         * `GET /api/homes/:id/tasks`, `…/bills`, `…/packages`. Each is
         * optional: a member without `tasks.view` / `finance.view` /
         * `mailbox.view` simply gets fewer dots.
         */
        private suspend fun fetchDerived() =
            coroutineScope {
                val tasksDeferred = async { repo.getHomeTasks(homeId) }
                val billsDeferred = async { repo.getHomeBills(homeId) }
                val packagesDeferred = async { repo.getHomePackages(homeId) }
                val items =
                    HomeCalendarDerivedItem.build(
                        tasks = (tasksDeferred.await() as? NetworkResult.Success)?.data?.tasks.orEmpty(),
                        bills = (billsDeferred.await() as? NetworkResult.Success)?.data?.bills.orEmpty(),
                        packages = (packagesDeferred.await() as? NetworkResult.Success)?.data?.packages.orEmpty(),
                    )
                // Anything the agenda can't place is dropped here — it would be
                // skipped silently downstream and must not count towards "the
                // household has nothing at all". Bare `yyyy-MM-dd` values are
                // resolved in the display zone, exactly as the projection does.
                val placeable = items.filter { HomeAgendaBuilder.parseInstant(it.dateIso, zone) != null }
                derivedRows = placeable.map(::derivedRow)
                derivedIndex = placeable.associateBy { it.id }
            }

        private fun applyMembers(result: NetworkResult<OccupantsResponse>) {
            val occupants =
                when (result) {
                    is NetworkResult.Success -> result.data.occupants.filter { it.isActive }
                    is NetworkResult.Failure -> emptyList()
                }
            val members = occupants.map(::projectMember)
            membersMap = members.associateBy { it.id }
            _filterChips.value =
                buildList {
                    add(MemberFilter.All)
                    add(MemberFilter.Mine)
                    members.forEach { add(MemberFilter.Member(it.id, it.name)) }
                }
        }

        private fun projectMember(occupant: OccupantDto): HomeMember {
            val name =
                occupant.displayName?.takeIf { it.isNotBlank() }
                    ?: occupant.username
                    ?: "Member"
            return HomeMember(
                id = occupant.userId,
                name = name,
                initials = HomeMember.initialsFor(name),
                isYou = occupant.userId == resolvedUserId,
            )
        }

        /**
         * Project one derived due-date into the agenda's wire shape so the
         * single [HomeAgendaBuilder] pass buckets it, headers it, counts its
         * month-strip dot and honours the selected day exactly like an event.
         * The row's *presentation* does not come from this DTO — the
         * [HomeCalendarDerivedItem] travels alongside it in [derivedIndex],
         * and the row reads its kind's own label / icon / background /
         * foreground plus `detail ?: kind.label`.
         *
         *  - `source` is [DERIVED_SOURCE], so the row is not a booking; the
         *    screen renders it disabled and [openAgendaItem] refuses it.
         *  - `eventType` is [DERIVED_SOURCE] too — a client-only marker that
         *    infers to [CalendarEventCategory.Generic] and is never rendered.
         *    Borrowing a real `event_type` here would route a bill through the
         *    category palette and paint an unpaid bill green.
         *  - `assignedTo` is null: a task / bill / package due-date has no
         *    household owner. The projection therefore *exempts* derived
         *    entries from the member predicate instead of letting them be
         *    filtered out. Documented parity contract — iOS applies the same
         *    rule.
         *  - `endAt` is null; `startAt` carries the raw `dateIso`, so a bare
         *    `yyyy-MM-dd` is recognised as date-only and reads "All day".
         */
        private fun derivedRow(item: HomeCalendarDerivedItem): CalendarEventDto =
            CalendarEventDto(
                id = item.id,
                homeId = homeId,
                eventType = DERIVED_SOURCE,
                title = item.title,
                startAt = item.dateIso,
                endAt = null,
                assignedTo = null,
                source = DERIVED_SOURCE,
            )

        // MARK: - Mutators

        fun selectDay(isoDate: String) {
            if (selectedIsoDate == isoDate) {
                selectedIsoDate = null
            } else {
                selectedIsoDate = isoDate
                runCatching { LocalDate.parse(isoDate) }.getOrNull()?.let {
                    weekAnchorIso = HomeAgendaBuilder.weekAnchorIso(it.atStartOfDay(zone).toInstant(), zone)
                }
            }
            rebuild()
        }

        fun shiftWeek(direction: WeekShift) {
            val delta = if (direction == WeekShift.Previous) -7L else 7L
            val anchor = runCatching { LocalDate.parse(weekAnchorIso) }.getOrNull() ?: return
            weekAnchorIso = anchor.plusDays(delta).toString()
            rebuild()
        }

        fun jumpToToday() {
            selectedIsoDate = null
            weekAnchorIso = HomeAgendaBuilder.weekAnchorIso(clock(), zone)
            rebuild()
        }

        fun selectFilter(filter: MemberFilter) {
            _memberFilter.value = filter
            rebuild()
        }

        fun clearMemberFilter() {
            _memberFilter.value = MemberFilter.All
            rebuild()
        }

        // MARK: - Navigation

        fun openAgendaItem(item: HomeAgendaItem) {
            if (isDerived(item)) {
                // Derived task / bill / package due-dates mirror surfaces that
                // own their own screens, so tapping is a no-op exactly as in
                // RN's calendar.
                return
            }
            if (item.isBooking && item.bookingId != null) {
                // Booking-union rows belong to THIS home — stash the home owner
                // for the arg-less detail route (iOS parity:
                // `.bookingDetail(owner: .home(homeId), …)`), else the detail
                // screen falls back to a stale relay value or Personal.
                bookingsOwnerRelay.pending = SchedulingOwner.Home(homeId)
                onNavigate(SchedulingRoutes.bookingDetail(item.bookingId))
            } else {
                onOpenEvent(item.eventId ?: item.id)
            }
        }

        /**
         * True for the read-only task / bill / package due-date rows. The row
         * carries its own kind, so this is a property of the row rather than a
         * lookup — the screen uses the same signal to render it disabled.
         */
        internal fun isDerived(item: HomeAgendaItem): Boolean = item.derived != null

        fun openWhosFree() {
            onNavigate(SchedulingRoutes.WHOS_FREE)
        }

        fun onCreateAction(action: HomeCreateAction) {
            when (action) {
                HomeCreateAction.AddEvent -> onAddEvent()
                HomeCreateAction.FindATime -> onNavigate(SchedulingRoutes.FIND_A_TIME)
                // Carry this calendar's home so F9/F13 act on it, not an inferred one.
                HomeCreateAction.BookResource -> onNavigate(SchedulingRoutes.resourceList(homeId))
                HomeCreateAction.ScheduleVisit -> onNavigate(SchedulingRoutes.visitSetup(homeId))
            }
        }

        fun addEvent() {
            onAddEvent()
        }

        // MARK: - Projection

        private fun rebuild() {
            val now = clock()
            // Every dated thing that belongs on this week's strip and in the
            // agenda: calendar events plus task / bill / package due dates.
            val agenda = events + derivedRows
            _monthStrip.value =
                HomeAgendaBuilder.weekStrip(
                    events = agenda,
                    anchorIso = weekAnchorIso,
                    selectedIso = selectedIsoDate,
                    now = now,
                    zone = zone,
                )
            val onlyUser =
                when (val filter = _memberFilter.value) {
                    MemberFilter.All -> null
                    MemberFilter.Mine -> resolvedUserId
                    is MemberFilter.Member -> filter.id
                }
            val sections =
                HomeAgendaBuilder.sections(
                    events = agenda,
                    members = membersMap,
                    now = now,
                    zone = zone,
                    selectedIsoDate = selectedIsoDate,
                    onlyUserId = onlyUser,
                    derived = derivedIndex,
                )
            _state.value = HomeCalendarUiState.Loaded(sections = sections, empty = resolveEmpty(sections))
        }

        private fun resolveEmpty(sections: List<HomeAgendaSection>): AgendaEmpty? {
            if (sections.isNotEmpty()) return null
            if (events.isEmpty() && derivedRows.isEmpty()) return AgendaEmpty.FirstRun
            return when (val filter = _memberFilter.value) {
                is MemberFilter.Member -> AgendaEmpty.FilteredMember(filter.name)
                MemberFilter.Mine -> AgendaEmpty.FilteredMember("you")
                MemberFilter.All -> if (selectedIsoDate != null) AgendaEmpty.FilteredDay else AgendaEmpty.FirstRun
            }
        }

        private fun signedInUserId(): String? = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        enum class WeekShift { Previous, Next }
    }
