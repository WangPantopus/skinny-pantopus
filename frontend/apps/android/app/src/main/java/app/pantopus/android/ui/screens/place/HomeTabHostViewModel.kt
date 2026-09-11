package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Resolves the Home tab. An unfinished preview requires explicit bookmark consent. */
@HiltViewModel
class HomeTabHostViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        private val savedPlacesRepository: SavedPlacesRepository,
        private val placeRepository: PlaceRepository,
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        private val _landing = MutableStateFlow<HomeLanding>(HomeLanding.Loading)
        val landing = _landing.asStateFlow()
        private val _arrival = MutableStateFlow(PlaceArrivalState())
        val arrival = _arrival.asStateFlow()
        private val userId: String? get() = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        init {
            resolve()
        }

        fun resolve() {
            val draft = userId?.let { PlacePendingStore.bind(it) }
            if (draft != null) {
                _arrival.value = PlaceArrivalState(draft = draft)
                _landing.value = HomeLanding.Review
                loadPreview()
                return
            }
            _landing.value = HomeLanding.Loading
            viewModelScope.launch {
                _landing.value =
                    when (val result = homesRepository.myHomes()) {
                        is NetworkResult.Success -> {
                            val homes = result.data.sharedHomes
                            val primary = homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull()
                            if (primary != null) HomeLanding.PlaceDashboard(primary.id) else HomeLanding.Hub
                        }
                        is NetworkResult.Failure -> HomeLanding.Hub
                    }
            }
        }

        fun loadPreview() {
            val draft = _arrival.value.draft ?: return
            _arrival.value = _arrival.value.copy(previewError = false)
            viewModelScope.launch {
                when (val result = placeRepository.publicPreview(draft.label)) {
                    is NetworkResult.Success -> _arrival.value = _arrival.value.copy(preview = result.data)
                    is NetworkResult.Failure -> _arrival.value = _arrival.value.copy(previewError = true)
                }
            }
        }

        fun save() {
            val state = _arrival.value
            val draft = state.draft ?: return
            if (state.isSaving || state.saved != null) return
            val stored = PlacePendingStore.read()
            val belongsToCurrentUser = userId != null && userId == draft.userId
            val matchesStoredDraft = stored?.id == draft.id && stored.userId == userId
            if (!belongsToCurrentUser || !matchesStoredDraft) {
                _arrival.value = state.copy(error = "This preview expired or belongs to another session. Look up the address again.")
                return
            }
            _arrival.value = state.copy(isSaving = true, error = null)
            viewModelScope.launch {
                val result =
                    savedPlacesRepository.save(
                        SavePlaceBody(
                            label = draft.label,
                            placeType = "searched",
                            latitude = draft.latitude,
                            longitude = draft.longitude,
                            expectedUserId = draft.userId,
                        ),
                    )
                val saved = (result as? NetworkResult.Success)?.data?.savedPlace
                val belongsToDraft = saved?.userId == draft.userId && userId == draft.userId
                if (belongsToDraft && !saved?.id.isNullOrBlank()) {
                    PlacePendingStore.clear(id = draft.id)
                    _arrival.value = _arrival.value.copy(isSaving = false, saved = saved)
                } else {
                    _arrival.value =
                        _arrival.value.copy(
                            isSaving = false,
                            error = "We couldn’t confirm the save. Your preview is still here — please try again.",
                        )
                }
            }
        }

        fun finish() {
            if (_arrival.value.isSaving) return
            _arrival.value.draft?.let { PlacePendingStore.clear(id = it.id) }
            resolve()
        }
    }

data class PlaceArrivalState(
    val draft: PlacePendingStore.Pending? = null,
    val saved: SavedPlaceDto? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
    val preview: PlacePreview? = null,
    val previewError: Boolean = false,
)

sealed interface HomeLanding {
    data object Loading : HomeLanding

    data object Review : HomeLanding

    data class PlaceDashboard(val homeId: String) : HomeLanding

    data object Hub : HomeLanding
}
