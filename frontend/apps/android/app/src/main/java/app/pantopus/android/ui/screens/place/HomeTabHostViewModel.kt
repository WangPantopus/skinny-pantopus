package app.pantopus.android.ui.screens.place

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.place.launch.PlacePendingStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Decides what the Home tab lands on (W3): the Place dashboard when the
 * user has a primary home, else the classic Hub. Resolves the primary
 * home from `/api/homes/my-homes` (the authoritative `is_primary_owner`
 * source). Mirrors the iOS `HubTabRoot.primaryHomeId()` auto-land.
 */
@HiltViewModel
class HomeTabHostViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _landing = MutableStateFlow<HomeLanding>(HomeLanding.Loading)
        val landing: StateFlow<HomeLanding> = _landing.asStateFlow()

        init {
            resolve()
        }

        fun resolve() {
            _landing.value = HomeLanding.Loading
            viewModelScope.launch {
                // W6 — save the place a stranger looked up before signing
                // up (one-shot, best effort), then resolve the landing.
                savePendingPlaceIfNeeded()
                _landing.value =
                    when (val result = homesRepository.myHomes()) {
                        is NetworkResult.Success -> {
                            val homes = result.data.homes
                            val primary =
                                homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull()
                            if (primary != null) HomeLanding.PlaceDashboard(primary.id) else HomeLanding.Hub
                        }
                        // On failure, fall back to the always-safe Hub surface.
                        is NetworkResult.Failure -> HomeLanding.Hub
                    }
            }
        }

        private suspend fun savePendingPlaceIfNeeded() {
            val pending = PlacePendingStore.take(context) ?: return
            if (pending.street.isBlank()) return
            homesRepository.create(
                CreateHomeRequest(
                    address = pending.street,
                    city = pending.city,
                    state = pending.state,
                    zipCode = pending.zip,
                    latitude = pending.latitude,
                    longitude = pending.longitude,
                    homeType = "house",
                ),
            )
        }
    }

sealed interface HomeLanding {
    data object Loading : HomeLanding

    data class PlaceDashboard(val homeId: String) : HomeLanding

    data object Hub : HomeLanding
}
