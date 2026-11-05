package app.pantopus.android.ui.screens.crewday.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.crewday.CrewDayCardDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Crew Day on Today (screen 9). */
data class CrewDayTodayUi(
    /** The person's bookings the server shows on Today (7 days before through 2 days after, or waiting on them). */
    val mine: List<CrewDayCardDto> = emptyList(),
    /** At most one open Crew Day on the person's street they haven't booked or dismissed. */
    val nearby: List<CrewDayCardDto> = emptyList(),
    /** Cards with a write in flight. */
    val working: Set<String> = emptySet(),
    /** Bookings whose "Gate is ready" went through: the card says so. */
    val gateTold: Set<String> = emptySet(),
    val notice: String? = null,
)

/**
 * Today's Crew Day cards: "Your booking" and "Coming to your street", from `GET /api/crew-days/today`. Shows nothing
 * while the `crew_day` key is off or there is nothing to show; a failed read keeps the cards already shown.
 */
@HiltViewModel
class CrewDayTodayViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(CrewDayTodayUi())
        val ui: StateFlow<CrewDayTodayUi> = _ui.asStateFlow()

        init {
            // Any Crew Day write (a booking, a cancel, an answer) changes what Today shows.
            viewModelScope.launch { repository.changes.drop(1).collect { load() } }
        }

        fun load() {
            if (!LaunchFeatures.crewDay) return
            viewModelScope.launch {
                (repository.today() as? NetworkResult.Success)?.data?.let { today ->
                    _ui.update { it.copy(mine = today.mine, nearby = today.nearby) }
                }
            }
        }

        /** "Gate is ready" on a booking whose crew is on the way. */
        fun gateReady(card: CrewDayCardDto) {
            val id = card.bookingId ?: return
            act(card.id, done = { it.copy(gateTold = it.gateTold + card.id) }) { repository.gateReady(id) }
        }

        /** "Everything looks good": charges now. */
        fun looksGood(card: CrewDayCardDto) {
            val id = card.bookingId ?: return
            act(card.id, done = { it }) { repository.confirm(id) }
        }

        /** "Not for me" on "Coming to your street": hidden for good. */
        fun notForMe(card: CrewDayCardDto) {
            val id = card.crewDayId ?: card.id
            _ui.update { ui -> ui.copy(nearby = ui.nearby.filterNot { it.id == card.id }) }
            viewModelScope.launch { repository.dismiss(id) }
        }

        fun noticeShown() {
            _ui.update { it.copy(notice = null) }
        }

        private fun act(
            key: String,
            done: (CrewDayTodayUi) -> CrewDayTodayUi,
            block: suspend () -> NetworkResult<*>,
        ) {
            if (key in _ui.value.working) return
            _ui.update { it.copy(working = it.working + key) }
            viewModelScope.launch {
                val result = block()
                _ui.update {
                    val next = it.copy(working = it.working - key)
                    when (result) {
                        is NetworkResult.Success -> done(next)
                        is NetworkResult.Failure -> next.copy(notice = result.error.crewDayMessage)
                    }
                }
            }
        }
    }
