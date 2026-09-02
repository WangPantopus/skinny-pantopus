package app.pantopus.android.ui.screens.place.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.ui.screens.place.detail.AddressCalendarActions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
    ) : ViewModel(),
        AddressCalendarActions {
        private val _state = MutableStateFlow<TodayTabUiState>(TodayTabUiState.Loading)
        val state: StateFlow<TodayTabUiState> = _state.asStateFlow()
        private var homeId: String? = null

        private val _calendarBusy = MutableStateFlow(false)
        override val calendarBusy: StateFlow<Boolean> = _calendarBusy.asStateFlow()
        private val _calendarError = MutableStateFlow<String?>(null)
        override val calendarError: StateFlow<String?> = _calendarError.asStateFlow()

        /** Idempotent once loaded; `refresh()` forces a reload. */
        fun load() {
            if (_state.value is TodayTabUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = TodayTabUiState.Loading
            viewModelScope.launch {
                val id = homeId ?: resolvePrimaryHome()
                if (id == null) {
                    _state.value = TodayTabUiState.NoPlace
                    return@launch
                }
                homeId = id
                _state.value =
                    when (val result = repo.intelligence(id)) {
                        is NetworkResult.Success -> TodayTabUiState.Loaded(result.data)
                        is NetworkResult.Failure -> TodayTabUiState.Error(result.error.displayMessage("Couldn't load today."))
                    }
            }
        }

        private suspend fun resolvePrimaryHome(): String? =
            when (val result = homesRepository.myHomes()) {
                is NetworkResult.Success -> {
                    val homes = result.data.homes
                    (homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull())?.id
                }
                is NetworkResult.Failure -> null
            }

        override fun setPickupDay(weekday: String) {
            val id = homeId ?: return
            viewModelScope.launch {
                _calendarBusy.value = true
                _calendarError.value = null
                when (val r = repo.setPickupDay(id, weekday)) {
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure -> _calendarError.value = r.error.displayMessage("Couldn't save your pickup day.")
                }
                _calendarBusy.value = false
            }
        }

        override fun clearPickupDay() {
            val id = homeId ?: return
            viewModelScope.launch {
                _calendarBusy.value = true
                _calendarError.value = null
                when (val r = repo.clearPickupDay(id)) {
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure -> _calendarError.value = r.error.displayMessage("Couldn't reset your pickup day.")
                }
                _calendarBusy.value = false
            }
        }
    }

sealed interface TodayTabUiState {
    data object Loading : TodayTabUiState

    /** No primary home yet — the tab is a claim prompt. */
    data object NoPlace : TodayTabUiState

    data class Loaded(val intelligence: PlaceIntelligence) : TodayTabUiState

    data class Error(val message: String) : TodayTabUiState
}
