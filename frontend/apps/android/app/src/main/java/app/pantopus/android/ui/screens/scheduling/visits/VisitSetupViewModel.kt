@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.visits

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateVisitRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling.resources.HomeMember
import app.pantopus.android.ui.screens.scheduling.resources.ResourceTime
import app.pantopus.android.ui.screens.scheduling.resources.VisitKind
import app.pantopus.android.ui.screens.scheduling.resources.resolvePrimaryHomeId
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import javax.inject.Inject

/** F13 load lifecycle. */
sealed interface VisitSetupLoadState {
    data object Loading : VisitSetupLoadState

    data object Ready : VisitSetupLoadState

    data class Error(
        val message: String,
    ) : VisitSetupLoadState
}

/** The schedule-a-visit form. */
data class VisitSetupForm(
    val title: String = "",
    val kind: VisitKind = VisitKind.Vendor,
    val whoIsHome: Set<String> = emptySet(),
    val date: LocalDate = LocalDate.now(),
    val startTime: LocalTime = LocalTime.of(9, 0),
    val durationHours: Int = 1,
    val entryNote: String = "",
)

/**
 * Stream A12 — F13 Schedule a Visit (vendor/guest). Contract-first: collects a
 * concrete visit (type, who must be home, date + time + length, entry note) and
 * creates it via `POST …/scheduling/visits` (stored as a HomeCalendarEvent; the
 * assigned members count as busy). The design's offer-slots / shareable-link
 * engine has no v1 backend, so it is intentionally out of scope here.
 */
@HiltViewModel
class VisitSetupViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val _loadState = MutableStateFlow<VisitSetupLoadState>(VisitSetupLoadState.Loading)
        val loadState: StateFlow<VisitSetupLoadState> = _loadState.asStateFlow()

        private val _form = MutableStateFlow(VisitSetupForm())
        val form: StateFlow<VisitSetupForm> = _form.asStateFlow()

        private val _memberRoster = MutableStateFlow<List<HomeMember>>(emptyList())
        val memberRoster: StateFlow<List<HomeMember>> = _memberRoster.asStateFlow()

        private val _isSaving = MutableStateFlow(false)
        val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

        private val _saveError = MutableStateFlow<String?>(null)
        val saveError: StateFlow<String?> = _saveError.asStateFlow()

        private val _didAttemptSave = MutableStateFlow(false)
        val didAttemptSave: StateFlow<Boolean> = _didAttemptSave.asStateFlow()

        // Route homeId pins the navigated home; absent → inference on first fetch.
        private var homeId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_HOME_ID)?.takeIf { it.isNotBlank() }
        private var started = false

        /** Post-create hop into the visit's detail keeps the same home. */
        fun detailRoute(visitId: String): String = SchedulingRoutes.visitDetail(visitId, homeId)

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            _loadState.value = VisitSetupLoadState.Loading
            viewModelScope.launch {
                val hid = homeId ?: resolvePrimaryHomeId(homes)
                if (hid == null) {
                    _loadState.value =
                        VisitSetupLoadState.Error("Join or create a home to schedule a visit.")
                    return@launch
                }
                homeId = hid
                when (val result = members.listOccupants(hid)) {
                    is NetworkResult.Success -> {
                        _memberRoster.value = HomeMember.from(result.data.occupants)
                        _loadState.value = VisitSetupLoadState.Ready
                    }
                    is NetworkResult.Failure ->
                        _loadState.value =
                            VisitSetupLoadState.Error(
                                result.error.message ?: "Couldn't load your household.",
                            )
                }
            }
        }

        // ── Editing ───────────────────────────────────────────────────────────
        fun setTitle(value: String) = _form.update { it.copy(title = value) }

        fun setKind(value: VisitKind) = _form.update { it.copy(kind = value) }

        fun setDate(value: LocalDate) = _form.update { it.copy(date = value) }

        fun setStartTime(value: LocalTime) = _form.update { it.copy(startTime = value) }

        fun setDurationHours(value: Int) = _form.update { it.copy(durationHours = value) }

        fun setEntryNote(value: String) = _form.update { it.copy(entryNote = value) }

        fun toggleHost(id: String) =
            _form.update {
                val set = it.whoIsHome.toMutableSet()
                if (!set.add(id)) set.remove(id)
                it.copy(whoIsHome = set)
            }

        fun clearSaveError() {
            _saveError.value = null
        }

        // ── Validation ──────────────────────────────────────────────────────
        val titleError: String?
            get() =
                if (_didAttemptSave.value &&
                    _form.value.title.isBlank()
                ) {
                    "Give this visit a title"
                } else {
                    null
                }

        val hostError: String?
            get() =
                if (_didAttemptSave.value &&
                    _form.value.whoIsHome.isEmpty()
                ) {
                    "Pick at least one host who must be home"
                } else {
                    null
                }

        val isValid: Boolean
            get() {
                val f = _form.value
                return f.title.isNotBlank() && f.whoIsHome.isNotEmpty() && f.durationHours > 0
            }

        val isDirty: Boolean
            get() = _form.value.title.isNotBlank() || _form.value.whoIsHome.isNotEmpty()

        // ── Save ────────────────────────────────────────────────────────────

        /** Returns the created visit id on success (so the screen can route to F14). */
        suspend fun save(): String? {
            _didAttemptSave.value = true
            if (!isValid || _isSaving.value) return null
            val hid = homeId ?: return null
            _isSaving.value = true
            try {
                val f = _form.value
                val start = ResourceTime.combine(f.date, f.startTime.hour, f.startTime.minute)
                val end = start.plus(Duration.ofHours(f.durationHours.toLong()))
                val note = f.entryNote.trim()
                val request =
                    CreateVisitRequest(
                        title = f.title.trim(),
                        startAt = ResourceTime.utcIso(start),
                        endAt = ResourceTime.utcIso(end),
                        visitType = f.kind.wire,
                        description = null,
                        whoIsHome = f.whoIsHome.toList(),
                        locationNotes = note.ifBlank { null },
                        ownerType = SchedulingOwner.OWNER_TYPE_HOME,
                        ownerId = hid,
                    )
                return when (val result = repo.createVisit(SchedulingOwner.Home(hid), request)) {
                    is NetworkResult.Success -> result.data.visit.id
                    is NetworkResult.Failure -> {
                        _saveError.value = messageFor(result.error)
                        null
                    }
                }
            } finally {
                _isSaving.value = false
            }
        }

        private fun messageFor(error: NetworkError): String {
            val decoded = errors.decode(error)
            if (decoded is SchedulingError.Generic && decoded.code == "BAD_RANGE") {
                return "Pick an end time after the start, within a 30-day window."
            }
            return error.message ?: "Couldn't schedule this visit. Please try again."
        }
    }
