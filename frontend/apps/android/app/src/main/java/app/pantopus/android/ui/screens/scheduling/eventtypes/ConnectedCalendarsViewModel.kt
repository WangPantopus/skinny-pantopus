@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.ConnectedCalendarDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * B8 Connected calendars (personal). OAuth sync is deferred: the read returns an
 * empty list in v1 and `POST /connected-calendars/connect` returns
 * `501 NOT_AVAILABLE`. An empty list renders the calm "coming soon" placeholder;
 * [connect] exercises the 501 path and surfaces the coming-soon message.
 */
@HiltViewModel
class ConnectedCalendarsViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ConnectedCalendarsUiState>(ConnectedCalendarsUiState.Loading)
        val state: StateFlow<ConnectedCalendarsUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var started = false

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            viewModelScope.launch {
                _state.value = ConnectedCalendarsUiState.Loading
                when (val r = repo.getConnectedCalendars()) {
                    is NetworkResult.Success -> _state.value = ConnectedCalendarsUiState.Loaded(r.data.calendars)
                    is NetworkResult.Failure -> {
                        // Network failure surfaces the Error state with retry so the user can
                        // recover. Previously this fell through to Loaded(emptyList()) which made
                        // the Error branch in the screen unreachable on real network failures.
                        val msg =
                            when (val decoded = errors.decode(r.error)) {
                                is SchedulingError.Generic -> decoded.message
                                else -> "Couldn't load your calendars."
                            }
                        _state.value = ConnectedCalendarsUiState.Error(msg)
                    }
                }
            }
        }

        fun connect() {
            viewModelScope.launch {
                when (val r = repo.connectCalendar()) {
                    is NetworkResult.Success -> _toast.value = "Connected"
                    is NetworkResult.Failure ->
                        _toast.value =
                            when (errors.decode(r.error)) {
                                is SchedulingError.NotAvailable501 -> "Calendar sync is coming soon."
                                else -> "Couldn't connect. Try again."
                            }
                }
            }
        }

        fun toastConsumed() {
            _toast.value = null
        }
    }

sealed interface ConnectedCalendarsUiState {
    data object Loading : ConnectedCalendarsUiState

    /** Empty list → coming-soon placeholder; non-empty → connected rows. */
    data class Loaded(
        val calendars: List<ConnectedCalendarDto>,
    ) : ConnectedCalendarsUiState

    data class Error(
        val message: String,
    ) : ConnectedCalendarsUiState
}
