@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.visits

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.UpdateHomeEventRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling.resources.HomeMember
import app.pantopus.android.ui.screens.scheduling.resources.ResourceTime
import app.pantopus.android.ui.screens.scheduling.resources.VisitKind
import app.pantopus.android.ui.screens.scheduling.resources.resolvePrimaryHomeId
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import javax.inject.Inject

/** Derived lifecycle for a concrete visit. */
enum class VisitLifecycle { Confirmed, Done }

/** F14 lifecycle. */
sealed interface VisitDetailUiState {
    data object Loading : VisitDetailUiState

    data class Error(
        val message: String,
    ) : VisitDetailUiState

    data object Removed : VisitDetailUiState

    data class Loaded(
        val title: String,
        val kind: VisitKind,
        val lifecycle: VisitLifecycle,
        val timeText: String,
        val hostMembers: List<HomeMember>,
        val hostSummary: String,
        val entryNote: String?,
    ) : VisitDetailUiState
}

/** The edit/reschedule form (local sheet). */
data class VisitEditForm(
    val title: String = "",
    val kind: VisitKind = VisitKind.Vendor,
    val whoIsHome: Set<String> = emptySet(),
    val date: LocalDate = LocalDate.now(),
    val startTime: LocalTime = LocalTime.of(9, 0),
    val durationHours: Int = 1,
    val note: String = "",
)

/**
 * Stream A12 — F14 Visit Detail. A visit is a HomeCalendarEvent read via the
 * home calendar events list (filtered by id — Android exposes no single-event
 * read). Status is derived from time (Confirmed when upcoming, Done when past);
 * Reschedule / Edit write through `PUT …/events/:eventId`; Cancel deletes the
 * event; Book again re-opens F13. (The design's offer/reserve/link lifecycle
 * has no v1 backend.)
 */
@HiltViewModel
class VisitDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
    ) : ViewModel() {
        val eventId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_VISIT_ID).orEmpty()

        private val _state = MutableStateFlow<VisitDetailUiState>(VisitDetailUiState.Loading)
        val state: StateFlow<VisitDetailUiState> = _state.asStateFlow()

        private val _isEditing = MutableStateFlow(false)
        val isEditing: StateFlow<Boolean> = _isEditing.asStateFlow()

        private val _editForm = MutableStateFlow(VisitEditForm())
        val editForm: StateFlow<VisitEditForm> = _editForm.asStateFlow()

        private val _memberRoster = MutableStateFlow<List<HomeMember>>(emptyList())
        val memberRoster: StateFlow<List<HomeMember>> = _memberRoster.asStateFlow()

        private val _isSavingEdit = MutableStateFlow(false)
        val isSavingEdit: StateFlow<Boolean> = _isSavingEdit.asStateFlow()

        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        private val _showCancelConfirm = MutableStateFlow(false)
        val showCancelConfirm: StateFlow<Boolean> = _showCancelConfirm.asStateFlow()

        private val _isMutating = MutableStateFlow(false)
        val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

        private val _cancelled = Channel<Unit>(Channel.BUFFERED)

        /** One-shot: emits once the cancel landed so the screen can dismiss. */
        val cancelled = _cancelled.receiveAsFlow()

        // Route homeId pins the navigated home; absent → inference on first fetch.
        private var homeId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_HOME_ID)?.takeIf { it.isNotBlank() }
        private var started = false

        /** "Book again" hop into a fresh visit setup keeps the same home. */
        fun bookAgainRoute(): String = SchedulingRoutes.visitSetup(homeId)

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() = fetch(showLoading = true)

        fun refresh() = fetch(showLoading = false)

        private fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = VisitDetailUiState.Loading
            viewModelScope.launch {
                val hid = homeId ?: resolvePrimaryHomeId(homes)
                if (hid == null) {
                    _state.value =
                        VisitDetailUiState.Error("Join or create a home to view this visit.")
                    return@launch
                }
                homeId = hid
                val eventsTask = async { homes.getHomeEvents(hid) }
                val rosterTask = async { members.listOccupants(hid) }
                val eventsResult = eventsTask.await()
                val roster =
                    (rosterTask.await() as? NetworkResult.Success)
                        ?.data
                        ?.occupants
                        ?.let { HomeMember.from(it) }
                        .orEmpty()
                _memberRoster.value = roster
                when (eventsResult) {
                    is NetworkResult.Success -> {
                        val event = eventsResult.data.events.firstOrNull { it.id == eventId }
                        if (event == null) {
                            _state.value = VisitDetailUiState.Removed
                        } else {
                            apply(event, roster)
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            VisitDetailUiState.Error(
                                eventsResult.error.message ?: "Couldn't load this visit.",
                            )
                }
            }
        }

        private fun apply(
            event: CalendarEventDto,
            roster: List<HomeMember>,
        ) {
            val now = Instant.now()
            val start = ResourceTime.parseUtc(event.startAt)
            val end = ResourceTime.parseUtc(event.endAt) ?: start?.plusSeconds(SECONDS_PER_HOUR)
            val isPast = (end ?: now).isBefore(now)
            val lifecycle = if (isPast) VisitLifecycle.Done else VisitLifecycle.Confirmed
            val ids = event.assignedTo ?: emptyList()
            val hostMembers = ids.mapNotNull { id -> roster.firstOrNull { it.id == id } }

            _state.value =
                VisitDetailUiState.Loaded(
                    title = event.title,
                    kind = VisitKind.fromWire(event.eventType),
                    lifecycle = lifecycle,
                    timeText =
                        if (isPast) {
                            "Done · ${ResourceTime.shortDate(event.startAt)}"
                        } else {
                            ResourceTime.longRangeLabel(event.startAt, event.endAt)
                        },
                    hostMembers = hostMembers,
                    hostSummary = hostSummary(hostMembers, ids),
                    entryNote = event.locationNotes?.takeIf { it.isNotBlank() },
                )

            // Seed the edit form from the live event.
            val zone = ZoneId.systemDefault()
            val startZoned = start?.atZone(zone)
            val duration =
                if (start != null && end != null) {
                    maxOf(
                        1,
                        Math
                            .round(
                                Duration.between(start, end).toMinutes() / MINUTES_PER_HOUR.toDouble(),
                            ).toInt(),
                    )
                } else {
                    1
                }
            _editForm.value =
                VisitEditForm(
                    title = event.title,
                    kind = VisitKind.fromWire(event.eventType),
                    whoIsHome = ids.toSet(),
                    date = startZoned?.toLocalDate() ?: LocalDate.now(),
                    startTime = startZoned?.toLocalTime() ?: LocalTime.of(9, 0),
                    durationHours = duration,
                    note = event.locationNotes.orEmpty(),
                )
        }

        private fun hostSummary(
            hostMembers: List<HomeMember>,
            ids: List<String>,
        ): String {
            if (hostMembers.isNotEmpty()) {
                val names = hostMembers.map { it.name }
                return when (names.size) {
                    1 -> "${names[0]} must be home"
                    2 -> "${names[0]} & ${names[1]} must be home"
                    else -> "${names[0]} + ${names.size - 1} must be home"
                }
            }
            if (ids.isEmpty()) return "No host required"
            return if (ids.size == 1) "1 host must be home" else "${ids.size} hosts must be home"
        }

        // ── Edit sheet ────────────────────────────────────────────────────────
        fun beginEdit() {
            _isEditing.value = true
        }

        fun dismissEdit() {
            _isEditing.value = false
        }

        fun setEditTitle(value: String) = _editForm.update { it.copy(title = value) }

        fun setEditKind(value: VisitKind) = _editForm.update { it.copy(kind = value) }

        fun setEditDate(value: LocalDate) = _editForm.update { it.copy(date = value) }

        fun setEditStartTime(value: LocalTime) = _editForm.update { it.copy(startTime = value) }

        fun setEditDuration(value: Int) = _editForm.update { it.copy(durationHours = value) }

        fun setEditNote(value: String) = _editForm.update { it.copy(note = value) }

        fun toggleEditHost(id: String) =
            _editForm.update {
                val set = it.whoIsHome.toMutableSet()
                if (!set.add(id)) set.remove(id)
                it.copy(whoIsHome = set)
            }

        val editValid: Boolean
            get() {
                val f = _editForm.value
                return f.title.isNotBlank() && f.whoIsHome.isNotEmpty() && f.durationHours > 0
            }

        fun saveEdit() {
            if (!editValid || _isSavingEdit.value) return
            val hid = homeId ?: return
            _isSavingEdit.value = true
            viewModelScope.launch {
                try {
                    val f = _editForm.value
                    val start = ResourceTime.combine(f.date, f.startTime.hour, f.startTime.minute)
                    val end = start.plus(Duration.ofHours(f.durationHours.toLong()))
                    val note = f.note.trim()
                    val request =
                        UpdateHomeEventRequest(
                            eventType = f.kind.wire,
                            title = f.title.trim(),
                            startAt = ResourceTime.utcIso(start),
                            endAt = ResourceTime.utcIso(end),
                            locationNotes = note.ifBlank { null },
                            assignedTo = f.whoIsHome.toList(),
                        )
                    when (val result = homes.updateHomeEvent(hid, eventId, request)) {
                        is NetworkResult.Success -> {
                            _isEditing.value = false
                            fetch(showLoading = false)
                        }
                        is NetworkResult.Failure ->
                            _actionError.value =
                                result.error.message ?: "Couldn't update this visit."
                    }
                } finally {
                    _isSavingEdit.value = false
                }
            }
        }

        // ── Cancel ──────────────────────────────────────────────────────────
        fun requestCancel() {
            _showCancelConfirm.value = true
        }

        fun dismissCancel() {
            _showCancelConfirm.value = false
        }

        fun clearActionError() {
            _actionError.value = null
        }

        /**
         * Cancel (delete) the visit. Runs in [viewModelScope] — not the screen's
         * remembered composition scope — so dismissing the dialog/screen mid-flight
         * can't cancel the DELETE. Emits on [cancelled] for the screen to dismiss.
         */
        fun cancelVisit() {
            val hid = homeId ?: return
            if (_isMutating.value) return
            _isMutating.value = true
            _showCancelConfirm.value = false
            viewModelScope.launch {
                try {
                    when (val result = homes.deleteHomeEvent(hid, eventId)) {
                        is NetworkResult.Success -> _cancelled.send(Unit)
                        is NetworkResult.Failure ->
                            _actionError.value = result.error.message ?: "Couldn't cancel this visit."
                    }
                } finally {
                    _isMutating.value = false
                }
            }
        }

        private companion object {
            const val MINUTES_PER_HOUR = 60
            const val SECONDS_PER_HOUR = 3600L
        }
    }
