@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateBookingRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

enum class ManualStep { EventType, Time, Details, Review, Created }

enum class ContactMode { Phone, Email }

data class ManualEventTypeOption(
    val id: String,
    val slug: String,
    val name: String,
    val durationLabel: String,
    val locationMode: String?,
)

data class ManualBookingUiState(
    val step: ManualStep = ManualStep.EventType,
    val pillar: SchedulingPillar = SchedulingPillar.Personal,
    val loadingEventTypes: Boolean = true,
    val loadError: String? = null,
    val eventTypes: List<ManualEventTypeOption> = emptyList(),
    val selectedEventTypeId: String? = null,
    val loadingSlots: Boolean = false,
    val slotsError: String? = null,
    val days: List<LocalDate> = emptyList(),
    val selectedDay: LocalDate? = null,
    val daySlots: List<SlotDto> = emptyList(),
    val selectedSlotStart: String? = null,
    val tzLabel: String = "",
    val inviteeName: String = "",
    val contactMode: ContactMode = ContactMode.Phone,
    val inviteeEmail: String = "",
    val inviteePhone: String = "",
    val note: String = "",
    val skipApproval: Boolean = false,
    val skipNotifications: Boolean = false,
    val creating: Boolean = false,
    val createError: String? = null,
    val createdBookingId: String? = null,
    val doubleBook: DoubleBookConflict? = null,
    val slotConflict: SchedulingError.Conflict? = null,
) {
    val canContinue: Boolean
        get() =
            when (step) {
                ManualStep.EventType -> selectedEventTypeId != null
                ManualStep.Time -> selectedSlotStart != null
                ManualStep.Details -> inviteeName.isNotBlank()
                ManualStep.Review -> !creating
                ManualStep.Created -> true
            }
}

/**
 * E12 Manual / On-Behalf Booking. A host books for someone else (phone/walk-in):
 * pick event type → time (public booking-page slots reused) → invitee details →
 * review → created. A pre-create overlap check raises the E10 double-book
 * warning; a 409 on create surfaces nearest open times via the shared conflict
 * sheet so the host never dead-ends.
 */
@HiltViewModel
class ManualBookingViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        // Owner comes from the route's ownerKind/ownerId query args (the roster
        // hands over the booking's resolved owner); absent args mean Personal.
        // Hardcoding Personal here listed only personal event types and created
        // the booking under owner_type='user', so a business/home roster's
        // add-attendee never landed on that roster.
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        private val _state = MutableStateFlow(ManualBookingUiState(pillar = owner.pillar()))
        val state: StateFlow<ManualBookingUiState> = _state.asStateFlow()
        private val zone: ZoneId = ZoneId.systemDefault()
        private var pageSlug: String? = null
        private var eventTypesById: Map<String, EventTypeDto> = emptyMap()
        private var allSlots: List<SlotDto> = emptyList()
        private var started = false

        fun start() {
            if (started) return
            started = true
            loadEventTypes()
        }

        private fun loadEventTypes() {
            viewModelScope.launch {
                _state.update { it.copy(loadingEventTypes = true, loadError = null, tzLabel = tzLabel()) }
                pageSlug = repo.getBookingPage(owner).dataOrNull()?.page?.slug
                when (val r = repo.getEventTypes(owner)) {
                    is NetworkResult.Success -> {
                        val active = r.data.eventTypes.filter { it.isActive != false }
                        eventTypesById = active.associateBy { it.id }
                        _state.update {
                            it.copy(
                                loadingEventTypes = false,
                                eventTypes = active.map { et -> et.toOption() },
                            )
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                loadingEventTypes = false,
                                loadError = "Couldn't load your event types.",
                            )
                        }
                }
            }
        }

        fun selectEventType(id: String) {
            _state.update { it.copy(selectedEventTypeId = id) }
        }

        fun setContactMode(mode: ContactMode) {
            _state.update { it.copy(contactMode = mode) }
        }

        fun setName(value: String) = _state.update { it.copy(inviteeName = value) }

        fun setEmail(value: String) = _state.update { it.copy(inviteeEmail = value) }

        fun setPhone(value: String) = _state.update { it.copy(inviteePhone = value) }

        fun setNote(value: String) = _state.update { it.copy(note = value) }

        fun setSkipApproval(value: Boolean) = _state.update { it.copy(skipApproval = value) }

        fun setSkipNotifications(value: Boolean) = _state.update { it.copy(skipNotifications = value) }

        fun selectDay(day: LocalDate) {
            _state.update { it.copy(selectedDay = day, daySlots = slotsForDay(day)) }
        }

        fun selectSlot(start: String) {
            _state.update { it.copy(selectedSlotStart = start) }
        }

        fun next() {
            val current = _state.value
            if (!current.canContinue) return
            when (current.step) {
                ManualStep.EventType -> {
                    _state.update { it.copy(step = ManualStep.Time) }
                    loadSlots()
                }
                ManualStep.Time -> _state.update { it.copy(step = ManualStep.Details) }
                ManualStep.Details -> _state.update { it.copy(step = ManualStep.Review) }
                ManualStep.Review -> attemptCreate()
                ManualStep.Created -> Unit
            }
        }

        fun back(): Boolean {
            val current = _state.value
            val prev =
                when (current.step) {
                    ManualStep.Time -> ManualStep.EventType
                    ManualStep.Details -> ManualStep.Time
                    ManualStep.Review -> ManualStep.Details
                    else -> return false
                }
            _state.update { it.copy(step = prev) }
            return true
        }

        private fun loadSlots() {
            val etId = _state.value.selectedEventTypeId ?: return
            val slug = pageSlug
            val eventTypeSlug = eventTypesById[etId]?.slug
            if (slug == null || eventTypeSlug == null) {
                _state.update { it.copy(slotsError = "Set up your booking link first.") }
                return
            }
            viewModelScope.launch {
                _state.update { it.copy(loadingSlots = true, slotsError = null) }
                val from = java.time.Instant.now().toString()
                val to = java.time.Instant.now().plusSeconds(WINDOW_DAYS * SECONDS_PER_DAY).toString()
                when (val r = repo.publicGetSlots(slug, eventTypeSlug, from, to, zone.id)) {
                    is NetworkResult.Success -> {
                        allSlots = r.data.slots
                        val days = allSlots.mapNotNull { dayOf(it) }.distinct().sorted()
                        val firstDay = days.firstOrNull()
                        _state.update {
                            it.copy(
                                loadingSlots = false,
                                days = days,
                                selectedDay = firstDay,
                                daySlots = firstDay?.let { d -> slotsForDay(d) } ?: emptyList(),
                            )
                        }
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(loadingSlots = false, slotsError = "Couldn't load times.") }
                }
            }
        }

        // ─── Create + conflict handling ──────────────────────────────────────

        private fun attemptCreate() {
            viewModelScope.launch {
                val overlap = overlapConflict()
                if (overlap != null) {
                    _state.update { it.copy(doubleBook = overlap) }
                } else {
                    create()
                }
            }
        }

        fun bookAnyway() {
            _state.update { it.copy(doubleBook = null) }
            viewModelScope.launch { create() }
        }

        fun dismissDoubleBook() {
            _state.update { it.copy(doubleBook = null) }
        }

        private suspend fun create() {
            val current = _state.value
            val etId = current.selectedEventTypeId ?: return
            val start = current.selectedSlotStart ?: return
            _state.update { it.copy(creating = true, createError = null) }
            val body =
                CreateBookingRequest(
                    eventTypeId = etId,
                    startAt = start,
                    inviteeName = current.inviteeName.trim().ifBlank { null },
                    inviteeEmail = if (current.contactMode == ContactMode.Email) current.inviteeEmail.trim().ifBlank { null } else null,
                    inviteePhone = if (current.contactMode == ContactMode.Phone) current.inviteePhone.trim().ifBlank { null } else null,
                    inviteeTimezone = zone.id,
                    intakeAnswers = current.note.trim().takeIf { it.isNotEmpty() }?.let { mapOf("note" to it) },
                )
            when (val r = repo.createBooking(owner, body)) {
                is NetworkResult.Success ->
                    _state.update { it.copy(creating = false, createdBookingId = r.data.booking.id, step = ManualStep.Created) }
                is NetworkResult.Failure -> onCreateFailed(r.error)
            }
        }

        private suspend fun onCreateFailed(error: app.pantopus.android.data.api.net.NetworkError) {
            when (val decoded = errors.decode(error)) {
                is SchedulingError.Conflict -> {
                    // Host create doesn't return alternatives — synthesise from fresh slots so we never dead-end.
                    val alternatives = decoded.alternatives.ifEmpty { nearestAlternatives() }
                    _state.update { it.copy(creating = false, slotConflict = SchedulingError.Conflict(decoded.code, alternatives)) }
                }
                is SchedulingError.Generic -> _state.update { it.copy(creating = false, createError = decoded.message) }
                else -> _state.update { it.copy(creating = false, createError = "Couldn't create the booking — try again.") }
            }
        }

        fun pickAlternative(slot: SlotDto) {
            _state.update { it.copy(slotConflict = null, selectedSlotStart = slot.start) }
            viewModelScope.launch { create() }
        }

        fun dismissSlotConflict() {
            _state.update { it.copy(slotConflict = null, step = ManualStep.Time) }
        }

        fun bookAnother() {
            started = false
            _state.value =
                ManualBookingUiState(
                    loadingEventTypes = false,
                    tzLabel = tzLabel(),
                    eventTypes = _state.value.eventTypes,
                    pillar = _state.value.pillar,
                )
            started = true
        }

        private suspend fun overlapConflict(): DoubleBookConflict? {
            val current = _state.value
            val mySlot = allSlots.firstOrNull { it.start == current.selectedSlotStart } ?: return null
            val myStart = BookingsExtrasFormatting.instantOrNull(mySlot.start) ?: return null
            val myEnd = BookingsExtrasFormatting.instantOrNull(mySlot.end) ?: return null
            val existing = repo.getBookings(owner, status = "upcoming").dataOrNull()?.bookings ?: return null
            val clash =
                existing.firstOrNull { b ->
                    val s = BookingsExtrasFormatting.instantOrNull(b.startAt)
                    val e = BookingsExtrasFormatting.instantOrNull(b.endAt)
                    s != null && e != null && s.isBefore(myEnd) && e.isAfter(myStart)
                } ?: return null
            return DoubleBookConflict(
                severity = DoubleBookSeverity.Soft,
                title = "This time overlaps",
                message = "You already have \"${clash.inviteeName ?: "another booking"}\" at this time on your calendar.",
                linkedEvent =
                    DoubleBookLinkedEvent(
                        title = clash.inviteeName ?: "Existing booking",
                        detail = BookingsExtrasFormatting.dayAndTime(clash.startAt),
                    ),
            )
        }

        private fun nearestAlternatives(): List<SlotDto> = allSlots.filter { it.start != _state.value.selectedSlotStart }.take(ALT_COUNT)

        // ─── Helpers ─────────────────────────────────────────────────────────

        private fun slotsForDay(day: LocalDate): List<SlotDto> = allSlots.filter { dayOf(it) == day }

        private fun dayOf(slot: SlotDto): LocalDate? = BookingsExtrasFormatting.instantOrNull(slot.start)?.atZone(zone)?.toLocalDate()

        private fun tzLabel(): String = "Times in ${zone.id.substringAfterLast('/').replace('_', ' ')} · tap to change"

        private fun EventTypeDto.toOption(): ManualEventTypeOption {
            val mins = defaultDuration ?: durations.firstOrNull()
            val location = locationLabel(locationMode)
            val label = listOfNotNull(mins?.let { "$it min" }, location).joinToString(" · ")
            return ManualEventTypeOption(id = id, slug = slug, name = name, durationLabel = label, locationMode = locationMode)
        }

        private fun locationLabel(mode: String?): String =
            when (mode) {
                "video" -> "Video"
                "phone" -> "Phone"
                "in_person" -> "In person"
                "custom" -> "Custom"
                "ask" -> "Ask invitee"
                else -> ""
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data

        private companion object {
            const val WINDOW_DAYS = 14L
            const val SECONDS_PER_DAY = 86_400L
            const val ALT_COUNT = 3
        }
    }
