@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.booking

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.api.models.crewday.CrewDayBookingPatch
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayCode
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface CrewDayBookingUiState {
    data object Loading : CrewDayBookingUiState

    /** Not the viewer's booking, or gone: the server answers 404 for both. */
    data object Gone : CrewDayBookingUiState

    data class Loaded(val booking: CrewDayBookingDto) : CrewDayBookingUiState

    data class Error(val message: String) : CrewDayBookingUiState
}

/**
 * The household's booking (screen 5): `GET /api/crew-days/bookings/:id` and everything the page does with it: the
 * price answer, Gate is ready, Everything looks good, the note for the crew, the home's details before the cutoff,
 * cancel or ask the crew to cancel, the rain dates and Remind me next fall. Reads again after any Crew Day write.
 */
@HiltViewModel
class CrewDayBookingViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val bookingId: String = savedStateHandle.get<String>(CrewDayRoutes.BOOKING_ID_KEY).orEmpty()
        private val _state = MutableStateFlow<CrewDayBookingUiState>(CrewDayBookingUiState.Loading)
        val state: StateFlow<CrewDayBookingUiState> = _state.asStateFlow()

        /** The day's price list, for "Change my home details" (read from the invitation by its code). */
        private val _prices = MutableStateFlow<CrewDayPublicDto?>(null)
        val prices: StateFlow<CrewDayPublicDto?> = _prices.asStateFlow()

        /** Writes in flight (by action key), so each button shows it's working and can't be tapped twice. */
        private val _working = MutableStateFlow<Set<String>>(emptySet())
        val working: StateFlow<Set<String>> = _working.asStateFlow()

        private val _notice = MutableStateFlow<String?>(null)
        val notice: StateFlow<String?> = _notice.asStateFlow()

        /** Set once "Gate is ready" went through: the card says so. */
        private val _gateTold = MutableStateFlow(false)
        val gateTold: StateFlow<Boolean> = _gateTold.asStateFlow()

        init {
            viewModelScope.launch { repository.changes.drop(1).collect { load() } }
        }

        fun load() {
            viewModelScope.launch {
                when (val result = repository.booking(bookingId)) {
                    is NetworkResult.Success -> _state.value = CrewDayBookingUiState.Loaded(result.data)
                    is NetworkResult.Failure ->
                        when {
                            result.error.crewDayCode == "NOT_FOUND" -> _state.value = CrewDayBookingUiState.Gone
                            _state.value !is CrewDayBookingUiState.Loaded ->
                                _state.value = CrewDayBookingUiState.Error(result.error.crewDayMessage)
                            // A failed refresh keeps the page; the next write or visit reads again.
                            else -> Unit
                        }
                }
            }
        }

        fun retry() {
            _state.value = CrewDayBookingUiState.Loading
            load()
        }

        /** The price list for changing the home's details, read once. */
        fun loadPrices() {
            if (_prices.value != null) return
            val code = (state.value as? CrewDayBookingUiState.Loaded)?.booking?.crewDay?.code ?: return
            viewModelScope.launch { (repository.invitation(code) as? NetworkResult.Success)?.data?.let { _prices.value = it } }
        }

        fun answerPrice(approve: Boolean) =
            act(if (approve) APPROVE else DECLINE, if (approve) "You're booked." else "You declined. Nothing was charged.") {
                repository.answerPrice(bookingId, approve)
            }

        fun gateReady() =
            act(GATE, null) {
                repository.gateReady(bookingId).also { if (it is NetworkResult.Success) _gateTold.value = true }
            }

        /** "Everything looks good": the charge runs now; the answer says paid or that the card failed. */
        fun looksGood() = act(CONFIRM, null) { repository.confirm(bookingId) }

        fun saveNote(note: String) =
            act(NOTE, "We'll show the crew your note on the day.") {
                repository.updateBooking(bookingId, CrewDayBookingPatch(accessNote = note.trim()))
            }

        fun changeDetails(
            optionId: String,
            addOnIds: List<String>,
        ) = act(CHANGE, "Your home's details are changed.") {
            repository.updateBooking(bookingId, CrewDayBookingPatch(optionId = optionId, addOnIds = addOnIds))
        }

        fun cancel() = act(CANCEL, "You cancelled. Nothing was charged.") { repository.cancelBooking(bookingId) }

        fun askRelease() = act(RELEASE, "We asked the crew to release your home.") { repository.askRelease(bookingId) }

        fun answerNewDate(
            proposalId: String,
            choice: String,
        ) = act(NEW_DATE, if (choice == CANCEL_CHOICE) "Cancelled at no charge." else "You picked a new date.") {
            repository.answerNewDate(bookingId, proposalId, choice)
        }

        fun remindNextSeason(on: Boolean) =
            act(REMIND, if (on) "We'll ask you before next season." else null) {
                repository.updateBooking(bookingId, CrewDayBookingPatch(remindNextSeason = on))
            }

        fun noticeShown() {
            _notice.value = null
        }

        private fun act(
            key: String,
            done: String?,
            block: suspend () -> NetworkResult<CrewDayBookingDto>,
        ) {
            if (key in _working.value) return
            _working.update { it + key }
            viewModelScope.launch {
                val result = block()
                _working.update { it - key }
                when (result) {
                    is NetworkResult.Success -> {
                        _state.value = CrewDayBookingUiState.Loaded(result.data)
                        done?.let { _notice.value = it }
                    }
                    is NetworkResult.Failure -> _notice.value = result.error.crewDayMessage
                }
            }
        }

        companion object {
            const val APPROVE = "approve"
            const val DECLINE = "decline"
            const val GATE = "gate"
            const val CONFIRM = "confirm"
            const val NOTE = "note"
            const val CHANGE = "change"
            const val CANCEL = "cancel"
            const val RELEASE = "release"
            const val NEW_DATE = "newDate"
            const val REMIND = "remind"

            /** The rain answer that cancels instead of picking a date. */
            const val CANCEL_CHOICE = "cancel"
        }
    }
