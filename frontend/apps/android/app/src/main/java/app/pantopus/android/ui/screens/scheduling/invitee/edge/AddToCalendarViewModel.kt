@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Backs the .ics download path on D8 (Add to calendar). Pulls the RFC-5545
 * invite from `GET /api/public/booking/:token/ics` via the repository; the sheet
 * writes the returned text to the cache dir and shares it through the app's
 * FileProvider. The native "Add to calendar" / Google / Outlook paths are
 * intent-only and need no network.
 */
@HiltViewModel
class AddToCalendarViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
    ) : ViewModel() {
        sealed interface IcsState {
            data object Idle : IcsState

            data object Loading : IcsState

            data class Ready(val content: String) : IcsState

            data class Error(val message: String) : IcsState
        }

        private val _ics = MutableStateFlow<IcsState>(IcsState.Idle)
        val ics: StateFlow<IcsState> = _ics.asStateFlow()

        fun downloadIcs(manageToken: String) {
            if (_ics.value is IcsState.Loading) return
            viewModelScope.launch {
                _ics.value = IcsState.Loading
                // The repository decodes the streaming body to text on IO, so the
                // result is plain text here — no blocking reads on main.
                _ics.value =
                    when (val result = repo.publicGetIcs(manageToken)) {
                        is NetworkResult.Success -> IcsState.Ready(result.data)
                        is NetworkResult.Failure -> IcsState.Error("Couldn't prepare the calendar file.")
                    }
            }
        }

        fun consume() {
            _ics.value = IcsState.Idle
        }
    }
