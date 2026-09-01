@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.ManageTokenStore
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling.bookings.initialsOf
import app.pantopus.android.ui.screens.scheduling.invitee.edge.formatDate
import app.pantopus.android.ui.screens.scheduling.invitee.edge.formatWhenRange
import app.pantopus.android.ui.screens.scheduling.invitee.edge.parseInstant
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import javax.inject.Inject

/**
 * D11 — My bookings (booker-side). Lists every booking the signed-in user made
 * across all hosts via `GET /my-bookings` (authed, not owner-gated). Splits into
 * Upcoming / Past, surfaces pending approvals under a "Needs attention" group,
 * and tints each row by the host's pillar. Tapping a row opens the manage
 * surface using the one-time `manageToken` persisted at booking time
 * ([ManageTokenStore]); rows whose token isn't on this device are still listed
 * but explain where to manage them.
 */
@HiltViewModel
class MyBookingsViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val manageTokens: ManageTokenStore,
    ) : ViewModel() {
        private val _tab = MutableStateFlow(MyBookingsTab.Upcoming)
        val tab: StateFlow<MyBookingsTab> = _tab.asStateFlow()

        private val _state = MutableStateFlow<MyBookingsUiState>(MyBookingsUiState.Loading)
        val state: StateFlow<MyBookingsUiState> = _state.asStateFlow()

        /** One-shot: a manage token to open the manage surface for. */
        private val _openManage = MutableStateFlow<String?>(null)
        val openManage: StateFlow<String?> = _openManage.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var all: List<BookingDto> = emptyList()
        private var started = false

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() {
            viewModelScope.launch {
                _state.value = MyBookingsUiState.Loading
                fetch()
            }
        }

        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        private suspend fun fetch() {
            when (val r = repo.getMyBookings()) {
                is NetworkResult.Success -> {
                    all = r.data.bookings
                    rebuild()
                }
                is NetworkResult.Failure -> _state.value = MyBookingsUiState.Error("Couldn't load your bookings.")
            }
        }

        fun selectTab(tab: MyBookingsTab) {
            if (tab == _tab.value) return
            _tab.value = tab
            rebuild()
        }

        fun onRowTap(bookingId: String) {
            viewModelScope.launch {
                val token = runCatching { manageTokens.manageToken(bookingId).first() }.getOrNull()
                if (token != null) {
                    _openManage.value = token
                } else {
                    _toast.value = "Manage this booking from your confirmation email link."
                }
            }
        }

        fun openManageConsumed() {
            _openManage.value = null
        }

        fun toastConsumed() {
            _toast.value = null
        }

        private fun rebuild() {
            if (all.isEmpty()) {
                _state.value = MyBookingsUiState.Empty
                return
            }
            val now = Instant.now()
            val zone = ZoneId.systemDefault()
            val (upcoming, past) = all.partition { it.isUpcoming(now) }
            val groups =
                when (_tab.value) {
                    MyBookingsTab.Upcoming -> upcomingGroups(upcoming, now, zone)
                    MyBookingsTab.Past -> pastGroups(past, now, zone)
                }
            _state.value =
                if (groups.isEmpty()) MyBookingsUiState.Empty else MyBookingsUiState.Loaded(_tab.value, groups)
        }

        private fun upcomingGroups(
            bookings: List<BookingDto>,
            now: Instant,
            zone: ZoneId,
        ): List<MyBookingGroup> {
            val sorted = bookings.sortedBy { parseInstant(it.startAt) ?: Instant.MAX }
            val attention = sorted.filter { it.status?.lowercase() == STATUS_PENDING }
            val rest = sorted.filterNot { it.status?.lowercase() == STATUS_PENDING }
            val thisWeek = rest.filter { withinDays(it, now, THIS_WEEK_DAYS) }
            val nextWeek = rest.filter { withinDays(it, now, NEXT_WEEK_DAYS) && !withinDays(it, now, THIS_WEEK_DAYS) }
            val later = rest.filterNot { withinDays(it, now, NEXT_WEEK_DAYS) }
            return buildList {
                if (attention.isNotEmpty()) {
                    add(
                        MyBookingGroup("Needs attention", attention.map { it.toRow(zone, dimmed = false) }, attention = true),
                    )
                }
                if (thisWeek.isNotEmpty()) add(MyBookingGroup("This week", thisWeek.map { it.toRow(zone) }))
                if (nextWeek.isNotEmpty()) add(MyBookingGroup("Next week", nextWeek.map { it.toRow(zone) }))
                if (later.isNotEmpty()) add(MyBookingGroup("Later", later.map { it.toRow(zone) }))
            }
        }

        private fun pastGroups(
            bookings: List<BookingDto>,
            now: Instant,
            zone: ZoneId,
        ): List<MyBookingGroup> {
            val sorted = bookings.sortedByDescending { parseInstant(it.startAt) ?: Instant.MIN }
            val thisMonth = sorted.filter { withinDaysPast(it, now, THIS_MONTH_DAYS) }
            val earlier = sorted.filterNot { withinDaysPast(it, now, THIS_MONTH_DAYS) }
            return buildList {
                if (thisMonth.isNotEmpty()) add(MyBookingGroup("This month", thisMonth.map { it.toRow(zone, dimmed = true) }))
                if (earlier.isNotEmpty()) add(MyBookingGroup("Earlier", earlier.map { it.toRow(zone, dimmed = true) }))
            }
        }

        private fun BookingDto.isUpcoming(now: Instant): Boolean {
            if (status?.lowercase() in TERMINAL_STATUSES) return false
            val start = parseInstant(startAt) ?: return false
            return !start.isBefore(now)
        }

        private fun withinDays(
            b: BookingDto,
            now: Instant,
            days: Long,
        ): Boolean {
            val start = parseInstant(b.startAt) ?: return false
            return ChronoUnit.DAYS.between(now, start) in 0..days
        }

        private fun withinDaysPast(
            b: BookingDto,
            now: Instant,
            days: Long,
        ): Boolean {
            val start = parseInstant(b.startAt) ?: return false
            return ChronoUnit.DAYS.between(start, now) in 0..days
        }

        private fun BookingDto.toRow(
            zone: ZoneId,
            dimmed: Boolean = false,
        ): MyBookingRow {
            val pillar = pillarFor(ownerType)
            val whenRange = formatWhenRange(startAt, endAt, zone)
            return MyBookingRow(
                id = id,
                // /my-bookings doesn't return the event/host name, so the row leads
                // with the date and carries the host pillar + status.
                title = formatDate(startAt, zone) ?: "Booking",
                subtitle = whenRange.substringAfter("· ", whenRange),
                pillar = pillar,
                pill = pillFor(status),
                // Lean payload omits the host name; the avatar mirrors iOS by
                // deriving initials from the booker's own name (falling back to "·").
                initials = initialsOf(inviteeName),
                dimmed = dimmed,
                manageable = status?.lowercase() !in TERMINAL_STATUSES,
                // Design FramePast: past rows carry a "Book again" link.
                // /my-bookings doesn't return the event-type slug needed for deep-link
                // rebooking, so the affordance navigates to the bookings row tap (which
                // opens the manage surface) — the renderer handles the tap correctly.
                footer = if (dimmed) BookingRowFooter.BookAgain else null,
            )
        }

        private fun pillarFor(ownerType: String?): SchedulingPillar =
            when (ownerType?.lowercase()) {
                "business" -> SchedulingPillar.Business
                "home" -> SchedulingPillar.Home
                else -> SchedulingPillar.Personal
            }

        private fun pillFor(status: String?): BookingPillKind =
            when (status?.lowercase()) {
                STATUS_PENDING -> BookingPillKind.Pending
                "cancelled", "canceled", "declined" -> BookingPillKind.Cancelled
                "completed", "no_show", "past" -> BookingPillKind.Past
                else -> BookingPillKind.Confirmed
            }

        private companion object {
            const val STATUS_PENDING = "pending"
            const val THIS_WEEK_DAYS = 7L
            const val NEXT_WEEK_DAYS = 14L
            const val THIS_MONTH_DAYS = 31L
            val TERMINAL_STATUSES = setOf("cancelled", "canceled", "declined")
        }
    }
