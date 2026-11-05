package app.pantopus.android.ui.screens.crewday.ask

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayRequestBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.YearMonth
import javax.inject.Inject

/** The home a request is for: its id and "Maple Lane, Camas". */
data class CrewDayAskHome(
    val id: String,
    val street: String,
)

data class CrewDayAskState(
    /** Null while the person's homes load. */
    val loadingHomes: Boolean = true,
    val home: CrewDayAskHome? = null,
    val service: String? = null,
    /** `yyyy-MM` months; empty means any time. */
    val months: Set<String> = emptySet(),
    val note: String = "",
    val sending: Boolean = false,
    val error: String? = null,
    val sent: Boolean = false,
) {
    val canSend: Boolean get() = !sending && home != null && service != null

    companion object {
        const val MAX_NOTE = 500
        const val MONTHS_AHEAD = 6
    }
}

/**
 * Ask for a Crew Day on your street (screen 11): a service, the street from the person's home in Pantopus, the months
 * that suit them (or any time) and an optional note, sent as `POST /api/crew-days/requests`. Without a home: "Add
 * your home first" with the existing home setup.
 */
@HiltViewModel
class CrewDayAskViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        private val homes: HomesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(CrewDayAskState())
        val state: StateFlow<CrewDayAskState> = _state.asStateFlow()

        /** The next six months from this one, in the pilot's time zone. */
        val monthChoices: List<YearMonth> =
            YearMonth.now(CrewDayFormat.DEFAULT_ZONE).let { now ->
                (0 until CrewDayAskState.MONTHS_AHEAD).map { now.plusMonths(it.toLong()) }
            }

        /** Reads the person's homes again (after they add one). */
        fun loadHomes() {
            viewModelScope.launch {
                val mine = (homes.myHomes() as? NetworkResult.Success)?.data ?: homes.myHomesCopy()
                val home =
                    mine?.homes.orEmpty().filter { it.isOpenablePlace && it.location != null && !it.address.isNullOrBlank() }.let { list ->
                        list.firstOrNull { it.id == mine?.defaultHomeId } ?: list.firstOrNull()
                    }
                _state.update {
                    it.copy(
                        loadingHomes = false,
                        home = home?.let { h -> CrewDayAskHome(h.id, streetOf(h.address.orEmpty(), h.city)) },
                    )
                }
            }
        }

        fun setService(key: String) = _state.update { it.copy(service = key, error = null) }

        fun toggleMonth(month: YearMonth) =
            _state.update {
                val key = month.toString()
                it.copy(months = if (key in it.months) it.months - key else it.months + key)
            }

        fun anyTime() = _state.update { it.copy(months = emptySet()) }

        fun setNote(text: String) = _state.update { it.copy(note = text.take(CrewDayAskState.MAX_NOTE)) }

        fun send() {
            val s = _state.value
            if (!s.canSend) return
            _state.update { it.copy(sending = true, error = null) }
            viewModelScope.launch {
                val body =
                    CrewDayRequestBody(
                        service = s.service.orEmpty(),
                        homeId = s.home?.id,
                        months = s.months.sorted().ifEmpty { listOf("any") },
                        note = s.note.trim().ifEmpty { null },
                    )
                when (val result = repository.askForCrewDay(body)) {
                    is NetworkResult.Success -> _state.update { it.copy(sending = false, sent = true) }
                    is NetworkResult.Failure -> _state.update { it.copy(sending = false, error = result.error.crewDayMessage) }
                }
            }
        }

        private companion object {
            /** "140 Maple Lane" in Camas → "Maple Lane, Camas" (the server keeps the street the same way). */
            fun streetOf(
                line: String,
                city: String?,
            ): String {
                val street = line.substringBefore(',').trim().replace(Regex("^\\d+[A-Za-z]?\\s+"), "")
                return listOfNotNull(street.ifBlank { null }, city?.takeIf { it.isNotBlank() }).joinToString(", ")
            }
        }
    }
