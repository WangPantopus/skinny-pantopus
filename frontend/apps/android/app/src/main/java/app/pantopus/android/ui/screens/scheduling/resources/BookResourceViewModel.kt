@file:Suppress("PackageNaming", "TooManyFunctions", "ReturnCount", "CyclomaticComplexMethod", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookResourceRequest
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/** Per-cell render state for the F12 hour grid. */
enum class BookCellState { Free, Selected, SelectedConflict, Taken, Off }

/** The When-section status line tone. */
enum class BookStatusTone { Ok, Conflict, Warning }

/** One status line under the hour grid. */
data class BookStatusLine(
    val tone: BookStatusTone,
    val text: String,
)

/** F12 lifecycle. */
sealed interface BookResourceUiState {
    data object Loading : BookResourceUiState

    data class Error(
        val message: String,
    ) : BookResourceUiState

    data class Form(
        val resourceName: String,
        val ruleChips: List<ResourceRuleChip>,
        val members: List<HomeMember>,
        val forWhom: HomeMember?,
        val dayLabel: String,
        val canStepBack: Boolean,
        val hours: List<Int>,
        val cells: Map<Int, BookCellState>,
        val statusLine: BookStatusLine?,
        val note: String,
        val canSubmit: Boolean,
        val isSubmitting: Boolean,
    ) : BookResourceUiState

    data class Success(
        val approval: Boolean,
        val title: String,
        val body: String,
        /** Home-green note pill text under the body (F12 confirmed / approval frames). */
        val note: String,
    ) : BookResourceUiState
}

/**
 * Stream A12 — F12 Book a Resource. A tz-aware hour grid validated against the
 * resource's rules (max duration) + its existing bookings (taken hours).
 * `POST …/resources/:rid/book` is authoritative: a 409 SLOT_CONFLICT /
 * RESOURCE_UNAVAILABLE surfaces the Foundation `ConflictAlternativesSheet`
 * (never a dead end). `requires_approval` resources resolve to the
 * approval-requested state.
 */
@HiltViewModel
class BookResourceViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        val resourceId: String =
            savedStateHandle
                .get<String>(
                    SchedulingRoutes.ARG_RESOURCE_ID,
                ).orEmpty()

        private val _state = MutableStateFlow<BookResourceUiState>(BookResourceUiState.Loading)
        val state: StateFlow<BookResourceUiState> = _state.asStateFlow()

        private val _saveError = MutableStateFlow<String?>(null)
        val saveError: StateFlow<String?> = _saveError.asStateFlow()

        private val _slotConflict = MutableStateFlow<SchedulingError.Conflict?>(null)
        val slotConflict: StateFlow<SchedulingError.Conflict?> = _slotConflict.asStateFlow()

        // Route homeId pins the navigated home; absent → inference on first fetch.
        private var homeId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_HOME_ID)?.takeIf { it.isNotBlank() }
        private var resourceName = ""
        private var ruleChips: List<ResourceRuleChip> = emptyList()
        private var maxDurationMin: Int? = null
        private var availableHours: AvailableHours? = null
        private var bookings: List<BookingDto> = emptyList()
        private var roster: List<HomeMember> = emptyList()

        private var selectedDay: LocalDate = LocalDate.now()
        private var selectionStart: Int? = null
        private var selectionCount: Int = 0
        private var forWhom: HomeMember? = null
        private var note: String = ""
        private var isSubmitting = false
        private var started = false

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            _state.value = BookResourceUiState.Loading
            viewModelScope.launch {
                val hid = homeId ?: resolvePrimaryHomeId(homes)
                if (hid == null) {
                    _state.value =
                        BookResourceUiState.Error("Join or create a home to book a resource.")
                    return@launch
                }
                homeId = hid
                val owner = SchedulingOwner.Home(hid)
                when (val result = repo.getResources(owner)) {
                    is NetworkResult.Success -> {
                        val resource = result.data.resources.firstOrNull { it.id == resourceId }
                        if (resource == null) {
                            _state.value =
                                BookResourceUiState.Error("This resource is no longer available.")
                            return@launch
                        }
                        bookings = liveBookings(owner)
                        roster = fetchMembers(hid)
                        forWhom = roster.firstOrNull()
                        applyResource(resource)
                        rebuildForm()
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            BookResourceUiState.Error(
                                result.error.message ?: "Couldn't open this resource.",
                            )
                }
            }
        }

        private suspend fun liveBookings(owner: SchedulingOwner.Home): List<BookingDto> =
            (repo.getBookings(owner) as? NetworkResult.Success)
                ?.data
                ?.bookings
                ?.filter { it.resourceId == resourceId && it.isLive() }
                .orEmpty()

        private suspend fun fetchMembers(hid: String): List<HomeMember> =
            (members.listOccupants(hid) as? NetworkResult.Success)
                ?.data
                ?.occupants
                ?.let { HomeMember.from(it) }
                .orEmpty()

        private fun applyResource(resource: ResourceDto) {
            resourceName = resource.name
            maxDurationMin = resource.maxDurationMin
            availableHours = AvailableHours.fromJson(resource.availableHours)
            ruleChips = reminderChips(resource)
        }

        private fun reminderChips(resource: ResourceDto): List<ResourceRuleChip> {
            val chips = mutableListOf<ResourceRuleChip>()
            val minutes = resource.maxDurationMin ?: 0
            if (minutes > 0) {
                val hours = minutes / MINUTES_PER_HOUR
                chips +=
                    ResourceRuleChip(
                        PantopusIcon.Timer,
                        if (hours >=
                            1
                        ) {
                            "$hours hr max"
                        } else {
                            "$minutes min max"
                        },
                    )
            }
            val approval = resource.requiresApproval ?: false
            chips +=
                ResourceRuleChip(
                    if (approval) PantopusIcon.Clock else PantopusIcon.Check,
                    if (approval) "Needs approval" else "No approval",
                )
            chips += ResourceRuleChip(PantopusIcon.Users, "All members")
            return chips
        }

        // ── Day navigation ──────────────────────────────────────────────────
        fun pickMember(member: HomeMember) {
            forWhom = member
            rebuildForm()
        }

        fun setNote(value: String) {
            note = value
            rebuildForm()
        }

        fun stepDay(delta: Int) {
            val next = selectedDay.plusDays(delta.toLong())
            if (next.isBefore(LocalDate.now())) return
            selectedDay = next
            clearSelection()
            rebuildForm()
        }

        private fun clearSelection() {
            selectionStart = null
            selectionCount = 0
        }

        // ── Grid ────────────────────────────────────────────────────────────
        private val hours: List<Int> get() = (FIRST_HOUR..LAST_HOUR).toList()

        private fun takenHours(): Set<Int> {
            val zone = ZoneId.systemDefault()
            val set = mutableSetOf<Int>()
            for (booking in bookings) {
                val start = ResourceTime.parseUtc(booking.startAt)?.atZone(zone) ?: continue
                if (start.toLocalDate() != selectedDay) continue
                val end = ResourceTime.parseUtc(booking.endAt)?.atZone(zone) ?: start.plusHours(1)
                val startHour = start.hour
                val endHour = end.hour + if (end.minute > 0) 1 else 0
                for (hour in startHour until maxOf(startHour + 1, endHour)) set.add(hour)
            }
            return set
        }

        private fun offHours(): Set<Int> {
            val hoursWindow = availableHours ?: return emptySet()
            val weekday = selectedDay.dayOfWeek.value % 7 + 1 // Sun=1 … Sat=7
            if (!hoursWindow.days.contains(weekday)) return hours.toSet()
            val startHour = hoursWindow.start.substringBefore(":").toIntOrNull() ?: FIRST_HOUR
            val endHour = hoursWindow.end.substringBefore(":").toIntOrNull() ?: LAST_HOUR
            return hours.filter { it < startHour || it >= endHour }.toSet()
        }

        private fun cellState(
            hour: Int,
            taken: Set<Int>,
            off: Set<Int>,
        ): BookCellState {
            val start = selectionStart
            val inSelection = start != null && hour >= start && hour < start + selectionCount
            if (inSelection) {
                return if (taken.contains(
                        hour,
                    )
                ) {
                    BookCellState.SelectedConflict
                } else {
                    BookCellState.Selected
                }
            }
            if (taken.contains(hour)) return BookCellState.Taken
            if (off.contains(hour)) return BookCellState.Off
            return BookCellState.Free
        }

        fun tap(hour: Int) {
            if (offHours().contains(hour)) return
            val maxHours = maxDurationMin?.let { maxOf(1, it / MINUTES_PER_HOUR) } ?: MAX_GRID_HOURS
            val start = selectionStart
            when {
                start == null -> {
                    selectionStart = hour
                    selectionCount = 1
                }
                hour == start + selectionCount && selectionCount < maxHours + 1 ->
                    selectionCount +=
                        1
                hour in start until start + selectionCount -> selectionCount = hour - start + 1
                else -> {
                    selectionStart = hour
                    selectionCount = 1
                }
            }
            rebuildForm()
        }

        // ── Validation / status ──────────────────────────────────────────────
        private fun overlapsTaken(taken: Set<Int>): Boolean {
            val start = selectionStart ?: return false
            return (start until start + selectionCount).any { taken.contains(it) }
        }

        private fun exceedsMax(): Boolean {
            val max = maxDurationMin ?: return false
            return selectionCount * MINUTES_PER_HOUR > max
        }

        private fun statusLine(taken: Set<Int>): BookStatusLine? {
            val start = selectionStart ?: return null
            if (selectionCount <= 0) return null
            if (exceedsMax()) {
                val max = (maxDurationMin ?: 0) / MINUTES_PER_HOUR
                return BookStatusLine(BookStatusTone.Warning, "That's longer than the $max hr max")
            }
            if (overlapsTaken(
                    taken,
                )
            ) {
                return BookStatusLine(BookStatusTone.Conflict, conflictText(start))
            }
            return BookStatusLine(BookStatusTone.Ok, "This slot is free · ${selectionRangeLabel()}")
        }

        private fun conflictText(start: Int): String {
            val zone = ZoneId.systemDefault()
            val clash =
                bookings.firstOrNull { booking ->
                    val date =
                        ResourceTime.parseUtc(booking.startAt)?.atZone(zone)
                            ?: return@firstOrNull false
                    if (date.toLocalDate() != selectedDay) return@firstOrNull false
                    val hour = date.hour
                    val end = ResourceTime.parseUtc(booking.endAt)?.atZone(zone)?.hour ?: hour + 1
                    (start until start + selectionCount).any {
                        it >= hour &&
                            it < maxOf(hour + 1, end)
                    }
                }
            if (clash != null) {
                val who =
                    clash.inviteeName ?: roster.firstOrNull { it.id == clash.hostUserId }?.name
                        ?: "Someone"
                val range = ResourceTime.rangeLabel(clash.startAt, clash.endAt)
                return "Taken — $who has it $range · pick another time"
            }
            return "Taken — pick another time"
        }

        private fun selectionRangeLabel(): String {
            val start = selectionStart ?: return ""
            val startInstant = ResourceTime.combine(selectedDay, start)
            val endInstant = ResourceTime.combine(selectedDay, start + selectionCount)
            return ResourceTime.rangeLabel(
                ResourceTime.utcIso(startInstant),
                ResourceTime.utcIso(endInstant),
            )
        }

        private fun canSubmit(taken: Set<Int>): Boolean =
            selectionStart != null &&
                selectionCount > 0 &&
                !overlapsTaken(taken) &&
                !exceedsMax() &&
                !isSubmitting

        private fun rebuildForm() {
            val taken = takenHours()
            val off = offHours()
            _state.value =
                BookResourceUiState.Form(
                    resourceName = resourceName,
                    ruleChips = ruleChips,
                    members = roster,
                    forWhom = forWhom,
                    dayLabel = ResourceTime.dayStripLabel(selectedDay),
                    canStepBack = selectedDay.isAfter(LocalDate.now()),
                    hours = hours,
                    cells = hours.associateWith { cellState(it, taken, off) },
                    statusLine = statusLine(taken),
                    note = note,
                    canSubmit = canSubmit(taken),
                    isSubmitting = isSubmitting,
                )
        }

        // ── Submit ────────────────────────────────────────────────────────────
        fun submit() {
            val taken = takenHours()
            val start = selectionStart ?: return
            if (!canSubmit(taken)) return
            val hid = homeId ?: return
            isSubmitting = true
            rebuildForm()
            viewModelScope.launch {
                val startInstant = ResourceTime.combine(selectedDay, start)
                val request =
                    BookResourceRequest(
                        startAt = ResourceTime.utcIso(startInstant),
                        durationMin = selectionCount * MINUTES_PER_HOUR,
                        name = forWhom?.name,
                        ownerType = SchedulingOwner.OWNER_TYPE_HOME,
                        ownerId = hid,
                    )
                when (
                    val result =
                        repo.bookResource(
                            SchedulingOwner.Home(hid),
                            resourceId,
                            request,
                        )
                ) {
                    is NetworkResult.Success -> {
                        val approval = result.data.booking.status == "pending"
                        val range = selectionRangeLabel()
                        val slotLabel = "$resourceName · ${ResourceTime.dayStripLabel(selectedDay)} · $range"
                        _state.value =
                            BookResourceUiState.Success(
                                approval = approval,
                                title = if (approval) "Request sent to an admin" else "Booked",
                                body =
                                    if (approval) {
                                        "We'll notify you when your booking is approved."
                                    } else {
                                        slotLabel
                                    },
                                // Approval: echo the slot in the pill. Confirmed: calendar note.
                                note = if (approval) slotLabel else "Added to the home calendar",
                            )
                    }
                    is NetworkResult.Failure -> {
                        isSubmitting = false
                        handleConflict(result.error)
                        rebuildForm()
                    }
                }
            }
        }

        private suspend fun handleConflict(error: app.pantopus.android.data.api.net.NetworkError) {
            // Refresh taken hours so the grid reflects live state either way.
            homeId?.let { hid -> bookings = liveBookings(SchedulingOwner.Home(hid)) }
            when (val decoded = errors.decode(error)) {
                is SchedulingError.Conflict -> _slotConflict.value = decoded
                is SchedulingError.Generic ->
                    if (decoded.code == CODE_RESOURCE_UNAVAILABLE) {
                        _slotConflict.value =
                            SchedulingError.Conflict(CODE_RESOURCE_UNAVAILABLE, emptyList())
                    } else {
                        _saveError.value = decoded.message
                    }
                else ->
                    _saveError.value =
                        error.message ?: "Couldn't book this resource. Please try again."
            }
        }

        /** Apply a conflict-sheet alternative back onto the grid. */
        fun applyAlternative(slot: SlotDto) {
            _slotConflict.value = null
            val start = ResourceTime.parseUtc(slot.start) ?: return
            val zone = ZoneId.systemDefault()
            val startZoned = start.atZone(zone)
            selectedDay = startZoned.toLocalDate()
            val startHour = startZoned.hour
            val endHour = ResourceTime.parseUtc(slot.end)?.atZone(zone)?.hour ?: startHour + 1
            selectionStart = startHour
            selectionCount = maxOf(1, endHour - startHour)
            rebuildForm()
        }

        fun dismissConflict() {
            _slotConflict.value = null
        }

        fun clearSaveError() {
            _saveError.value = null
        }

        /** Home Calendar route for the success "Back to calendar" CTA. */
        fun calendarRoute(): String? = homeId?.let { homeCalendarRoute(it) }

        private companion object {
            const val FIRST_HOUR = 8
            const val LAST_HOUR = 19
            const val MINUTES_PER_HOUR = 60
            const val MAX_GRID_HOURS = 24
            const val CODE_RESOURCE_UNAVAILABLE = "RESOURCE_UNAVAILABLE"
        }
    }
