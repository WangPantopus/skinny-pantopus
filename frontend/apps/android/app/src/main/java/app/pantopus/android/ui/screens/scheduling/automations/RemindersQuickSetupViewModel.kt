@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val SAVED_TOAST_MS = 1900L

/** Backend `pageUpdateSchema` caps (backend/routes/scheduling.js:139). */
private const val MAX_REMINDERS = 5
private const val MAX_REMINDER_MINUTES = 43200

private const val MINUTES_PER_HOUR = 60
private const val MINUTES_PER_DAY = 1440

/** Stepper ceiling for a raw minutes entry (the 30-day cap still applies on top). */
private const val MAX_CUSTOM_MINUTES_ENTRY = 999

/** Per-unit stepper ceiling so the custom value can never exceed 30 days. */
private fun maxCustomValue(unit: ReminderPreset.Unit): Int =
    when (unit) {
        ReminderPreset.Unit.Minutes -> MAX_CUSTOM_MINUTES_ENTRY
        ReminderPreset.Unit.Hours -> MAX_REMINDER_MINUTES / MINUTES_PER_HOUR
        ReminderPreset.Unit.Days -> MAX_REMINDER_MINUTES / MINUTES_PER_DAY
    }

/**
 * Stream A16 — H1 Default Reminders Quick-Setup. The flagship simple reminder
 * surface: pick the lead-times that auto-attach to every event the owner owns.
 * Lead-times persist on the BOOKING PAGE (`reminder_minutes[]`) via
 * `PUT /booking-page` — there is no per-reminder channel store, so the Push /
 * Email chips on each active row are illustrative. On first open with no saved
 * reminders we pre-pick the smart default (1 day + 1 hour). Owner comes from the
 * route's ownerKind/ownerId args (like the A1 settings root) so a Business/Home
 * settings root edits ITS booking page, never the personal one; Personal when absent.
 */
@HiltViewModel
class RemindersQuickSetupViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        val pillar: SchedulingPillar = owner.pillar()

        private val _state = MutableStateFlow<RemindersUiState>(RemindersUiState.Loading)
        val state: StateFlow<RemindersUiState> = _state.asStateFlow()

        private val _savedToast = MutableStateFlow(false)
        val savedToast: StateFlow<Boolean> = _savedToast.asStateFlow()

        private var lastSaved: List<Int> = emptyList()

        fun load() {
            if (_state.value !is RemindersUiState.Loaded) _state.value = RemindersUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getBookingPage(owner)) {
                    is NetworkResult.Success -> {
                        val saved = result.data.page.reminderMinutes
                        if (saved.isEmpty()) {
                            lastSaved = emptyList()
                            _state.value =
                                RemindersUiState.Loaded(
                                    reminderMinutes = ReminderPreset.smartDefault.sortedDescending(),
                                    firstOpen = true,
                                )
                        } else {
                            val sorted = saved.sortedDescending()
                            lastSaved = sorted
                            _state.value = RemindersUiState.Loaded(reminderMinutes = sorted, firstOpen = false)
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.value = RemindersUiState.Error(errors.decode(result.error).reminderMessage())
                }
            }
        }

        fun refresh() = load()

        // ── Editing ──────────────────────────────────────────────────────────

        fun toggle(minutes: Int) =
            updateLoaded { current ->
                val next =
                    if (current.reminderMinutes.contains(minutes)) {
                        current.reminderMinutes - minutes
                    } else {
                        // Backend caps reminder_minutes at 5 items — block a 6th
                        // selection (the "Up to 5 reminders" note explains why).
                        if (current.atLimit) return@updateLoaded current
                        current.reminderMinutes + minutes
                    }
                current.copy(reminderMinutes = next.sortedDescending())
            }

        fun showCustom() = updateLoaded { it.copy(showCustom = true) }

        fun hideCustom() = updateLoaded { it.copy(showCustom = false) }

        fun stepCustom(delta: Int) = updateLoaded { it.copy(customValue = (it.customValue + delta).coerceIn(1, it.customMax)) }

        fun setCustomUnit(unit: ReminderPreset.Unit) =
            updateLoaded { it.copy(customUnit = unit, customValue = it.customValue.coerceIn(1, maxCustomValue(unit))) }

        fun addCustom() =
            updateLoaded { current ->
                val minutes = current.customResolvedMinutes
                // Rejected when out of range, already present, or the 5-reminder cap is hit.
                val rejected =
                    minutes !in 1..MAX_REMINDER_MINUTES ||
                        current.reminderMinutes.contains(minutes) ||
                        current.atLimit
                if (rejected) {
                    current.copy(showCustom = false)
                } else {
                    current.copy(
                        reminderMinutes = (current.reminderMinutes + minutes).sortedDescending(),
                        showCustom = false,
                        customValue = 2,
                        customUnit = ReminderPreset.Unit.Hours,
                    )
                }
            }

        // ── Save ─────────────────────────────────────────────────────────────

        fun save() {
            val loaded = _state.value as? RemindersUiState.Loaded ?: return
            if (loaded.isSaving) return
            _state.value = loaded.copy(isSaving = true, saveError = null)
            viewModelScope.launch {
                val result = repo.updateBookingPage(owner, UpdateBookingPageRequest(reminderMinutes = loaded.reminderMinutes))
                val current = _state.value as? RemindersUiState.Loaded ?: return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        val saved = result.data.page.reminderMinutes.ifEmpty { loaded.reminderMinutes }.sortedDescending()
                        lastSaved = saved
                        _state.value = current.copy(reminderMinutes = saved, firstOpen = false, isSaving = false, saveError = null)
                        flashSaved()
                    }
                    is NetworkResult.Failure ->
                        _state.value = current.copy(isSaving = false, saveError = errors.decode(result.error).saveMessage())
                }
            }
        }

        private fun flashSaved() {
            viewModelScope.launch {
                _savedToast.value = true
                delay(SAVED_TOAST_MS)
                _savedToast.value = false
            }
        }

        private inline fun updateLoaded(transform: (RemindersUiState.Loaded) -> RemindersUiState.Loaded) {
            val loaded = _state.value as? RemindersUiState.Loaded ?: return
            _state.value = transform(loaded)
        }

        private fun SchedulingError.reminderMessage(): String =
            (this as? SchedulingError.Generic)?.message ?: "Couldn't load your reminders."

        private fun SchedulingError.saveMessage(): String =
            when (this) {
                is SchedulingError.Validation -> details.firstOrNull()?.message ?: "Couldn't save your reminders. Try again."
                is SchedulingError.Generic -> message
                else -> "Couldn't save your reminders. Try again."
            }
    }

@Immutable
sealed interface RemindersUiState {
    data object Loading : RemindersUiState

    data class Loaded(
        val reminderMinutes: List<Int>,
        val firstOpen: Boolean,
        val showCustom: Boolean = false,
        val customValue: Int = 2,
        val customUnit: ReminderPreset.Unit = ReminderPreset.Unit.Hours,
        val isSaving: Boolean = false,
        val saveError: String? = null,
    ) : RemindersUiState {
        /** Backend cap: at 5 selections further rows can't be turned on. */
        val atLimit: Boolean get() = reminderMinutes.size >= MAX_REMINDERS

        /** Per-unit stepper ceiling (30-day per-item backend cap). */
        val customMax: Int get() = maxCustomValue(customUnit)

        /** Custom value resolves to this many minutes-before-start. */
        val customResolvedMinutes: Int get() = customValue.coerceAtLeast(0) * customUnit.multiplier

        /** Page minutes that aren't one of the fixed presets — rendered as extra rows. */
        val customMinutes: List<Int>
            get() {
                val presets = ReminderPreset.all.map { it.first }.toSet()
                return reminderMinutes.filter { it !in presets }.sortedDescending()
            }

        fun isOn(minutes: Int): Boolean = reminderMinutes.contains(minutes)
    }

    data class Error(val message: String) : RemindersUiState
}
