package app.pantopus.android.ui.screens.compose.pulse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.areaLabel
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.location.LocationProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

data class PulseHomeTargetOption(
    val id: String,
    val label: String,
    val latitude: Double,
    val longitude: Double,
)

sealed interface PulsePostTargetPickerState {
    data object Loading : PulsePostTargetPickerState

    data object Ready : PulsePostTargetPickerState

    data class Error(val message: String) : PulsePostTargetPickerState
}

@HiltViewModel
class PulsePostTargetPickerViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        private val geoApi: GeoApi,
        private val locationProvider: LocationProvider,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PulsePostTargetPickerState>(PulsePostTargetPickerState.Loading)
        val state: StateFlow<PulsePostTargetPickerState> = _state.asStateFlow()

        private val _homes = MutableStateFlow<List<PulseHomeTargetOption>>(emptyList())
        val homes: StateFlow<List<PulseHomeTargetOption>> = _homes.asStateFlow()

        private val _isLocating = MutableStateFlow(false)
        val isLocating: StateFlow<Boolean> = _isLocating.asStateFlow()

        fun load() {
            viewModelScope.launch {
                _state.value = PulsePostTargetPickerState.Loading
                when (val homesResult = homesRepository.myHomes()) {
                    is NetworkResult.Failure -> {
                        _state.value = PulsePostTargetPickerState.Error(homesResult.error.message)
                        return@launch
                    }
                    is NetworkResult.Success -> {
                        _homes.value = mapHomes(homesResult.data.sharedHomes)
                    }
                }
                _state.value = PulsePostTargetPickerState.Ready
            }
        }

        suspend fun selectCurrentLocation(): PulsePostingTarget? {
            _isLocating.value = true
            try {
                val coordinate = locationProvider.requestCurrent() ?: return null
                var label =
                    String.format(
                        Locale.US,
                        "%.2f, %.2f",
                        coordinate.latitude,
                        coordinate.longitude,
                    )
                try {
                    val response = geoApi.reverse(coordinate.latitude, coordinate.longitude)
                    val locality = response.normalized.localityLabel
                    if (locality.isNotEmpty()) label = locality
                } catch (_: Exception) {
                    // keep coordinate fallback
                }
                return PulsePostingTarget.CurrentLocation(
                    lat = coordinate.latitude,
                    lng = coordinate.longitude,
                    displayLabel = label,
                )
            } finally {
                _isLocating.value = false
            }
        }

        private fun mapHomes(rows: List<MyHome>) =
            rows.mapNotNull { row ->
                val loc = row.location ?: return@mapNotNull null
                PulseHomeTargetOption(
                    id = row.id,
                    label = row.areaLabel(),
                    latitude = loc.latitude,
                    longitude = loc.longitude,
                )
            }
    }
