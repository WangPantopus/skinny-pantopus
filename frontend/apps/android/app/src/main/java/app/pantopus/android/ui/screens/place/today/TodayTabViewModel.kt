package app.pantopus.android.ui.screens.place.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.ui.screens.place.detail.AddressCalendarActions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.net.HttpURLConnection.HTTP_CONFLICT
import javax.inject.Inject

/**
 * The Today tab (Wedge v2 D2): the primary home's Today group — weather,
 * air, alerts, sun, and the address calendar — as a tab root instead of
 * a detail page. Resolves the primary home the same way the Place tab
 * does (`/api/homes/my-homes`, `is_primary_owner` first). Mirrors the
 * iOS `TodayTabRoot`.
 */
@HiltViewModel
class TodayTabViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        private val repo: PlaceRepository,
        private val savedPlacesRepository: SavedPlacesRepository,
    ) : ViewModel(),
        AddressCalendarActions {
        private val _state = MutableStateFlow<TodayTabUiState>(TodayTabUiState.Loading)
        val state: StateFlow<TodayTabUiState> = _state.asStateFlow()
        private var homeId: String? = null
        private var loadJob: Job? = null

        private val _calendarBusy = MutableStateFlow(false)
        override val calendarBusy: StateFlow<Boolean> = _calendarBusy.asStateFlow()
        private val _calendarError = MutableStateFlow<String?>(null)
        override val calendarError: StateFlow<String?> = _calendarError.asStateFlow()

        /** Re-resolve on tab entry, including an address saved since the last visit. */
        fun load() {
            refresh()
        }

        fun refresh() {
            loadJob?.cancel()
            homeId = null
            _state.value = TodayTabUiState.Loading
            loadJob =
                viewModelScope.launch {
                    val id =
                        when (val homes = resolvePrimaryHome()) {
                            is NetworkResult.Success -> homes.data
                            is NetworkResult.Failure -> {
                                // A failed lookup isn't "no place": offer a retry instead of
                                // sending a resident off to claim an address they already have.
                                _state.value = TodayTabUiState.Error(homes.error.displayMessage("Couldn't load your place."))
                                return@launch
                            }
                        }
                    val result =
                        if (id != null) {
                            homeId = id
                            repo.intelligence(id)
                        } else {
                            val savedId =
                                when (val saved = savedPlacesRepository.list()) {
                                    is NetworkResult.Success -> saved.data.savedPlaces.firstOrNull()?.id
                                    is NetworkResult.Failure -> {
                                        _state.value = TodayTabUiState.Error(saved.error.displayMessage("Couldn't load your place."))
                                        return@launch
                                    }
                                }
                            if (savedId == null) {
                                _state.value = TodayTabUiState.NoPlace
                                return@launch
                            }
                            savedPlacesRepository.today(savedId)
                        }
                    _state.value =
                        when (result) {
                            is NetworkResult.Success -> TodayTabUiState.Loaded(result.data, calendarHomeId = id)
                            is NetworkResult.Failure -> TodayTabUiState.Error(result.error.displayMessage("Couldn't load today."))
                        }
                }
        }

        /** The primary home's id (null when there is none), or the failure. */
        private suspend fun resolvePrimaryHome(): NetworkResult<String?> =
            when (val result = homesRepository.myHomes()) {
                is NetworkResult.Success -> {
                    val homes = result.data.sharedHomes
                    NetworkResult.Success((homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull())?.id)
                }
                is NetworkResult.Failure -> result
            }

        override fun setPickupDay(request: app.pantopus.android.data.api.models.place.SetPickupDayRequest) {
            val id = homeId ?: return
            if (_calendarBusy.value) return
            _calendarBusy.value = true
            viewModelScope.launch {
                _calendarError.value = null
                when (val r = repo.setPickupDay(id, request)) {
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure -> pickupFailed(r.error, "Couldn't save your pickup day.")
                }
                _calendarBusy.value = false
            }
        }

        override fun clearPickupDay(expectedVersion: String?) {
            val id = homeId ?: return
            if (_calendarBusy.value) return
            _calendarBusy.value = true
            viewModelScope.launch {
                _calendarError.value = null
                when (val r = repo.clearPickupDay(id, expectedVersion)) {
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure -> pickupFailed(r.error, "Couldn't reset your pickup day.")
                }
                _calendarBusy.value = false
            }
        }

        /**
         * Changed meanwhile (409): nothing was saved. Reload so the card shows the current schedule, with the
         * reason kept on the card. Any other failure keeps the editor as it was.
         */
        private fun pickupFailed(
            error: NetworkError,
            fallback: String,
        ) {
            if ((error as? NetworkError.ClientError)?.code == HTTP_CONFLICT) {
                _calendarError.value = "The pickup schedule changed since you opened it. Review the current schedule and try again."
                refresh()
            } else {
                _calendarError.value = error.displayMessage(fallback)
            }
        }
    }

sealed interface TodayTabUiState {
    data object Loading : TodayTabUiState

    /** No primary home yet — the tab is a claim prompt. */
    data object NoPlace : TodayTabUiState

    data class Loaded(val intelligence: PlaceIntelligence, val calendarHomeId: String? = null) : TodayTabUiState

    data class Error(val message: String) : TodayTabUiState
}
