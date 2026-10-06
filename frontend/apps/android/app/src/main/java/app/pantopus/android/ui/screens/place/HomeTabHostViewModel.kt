package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.ui.screens.homes.PendingVerification
import app.pantopus.android.ui.screens.homes.pendingVerificationFor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
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
        private var resolveJob: Job? = null
        private var previewJob: Job? = null
        private val userId: String? get() = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        init {
            resolve()
        }

        fun resolve() {
            if (resolveJob?.isActive == true) return
            val draft = userId?.let { PlacePendingStore.bind(it) }
            if (draft != null) {
                _arrival.value = PlaceArrivalState(draft = draft)
                _landing.value = HomeLanding.Review
                loadPreview()
                return
            }
            _landing.value = HomeLanding.Loading
            resolveJob =
                viewModelScope.launch {
                    _landing.value =
                        when (val result = homesRepository.myHomes()) {
                            is NetworkResult.Success -> {
                                val homes = result.data.sharedHomes
                                val primary = homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull()
                                if (primary != null) HomeLanding.PlaceDashboard(primary.id) else HomeLanding.Hub
                            }
                            is NetworkResult.Failure ->
                                HomeLanding.Error(result.error.displayMessage("Couldn't load your place. Please try again."))
                        }
                }
        }

        /**
         * Where the Hub's "Verify your address" goes: a Home that already waits on
         * verification continues there, as My Homes does (a filed claim's Waiting
         * Room, residency status, or ownership evidence); with none, Add Home.
         */
        suspend fun verificationTarget(): HubVerificationTarget {
            val homes = (homesRepository.myHomes() as? NetworkResult.Success)?.data?.homes.orEmpty()
            return homes.firstNotNullOfOrNull(::hubVerificationTargetFor) ?: HubVerificationTarget.AddHome
        }

        /**
         * Re-checks quietly while the landing is the no-home Hub, so a home joined or added
         * later in this session lands Place the next time the Hub root shows. No skeleton
         * or error replaces the Hub on this check.
         */
        fun refreshIfNoHome() {
            if (_landing.value != HomeLanding.Hub || resolveJob?.isActive == true) return
            resolveJob =
                viewModelScope.launch {
                    val homes = (homesRepository.myHomes() as? NetworkResult.Success)?.data?.sharedHomes ?: return@launch
                    val primary = homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull() ?: return@launch
                    if (_landing.value == HomeLanding.Hub) _landing.value = HomeLanding.PlaceDashboard(primary.id)
                }
        }

        private var relandOnReturn = false

        /** The user left Place for another tab from the Hub root; the next visit lands on Your Place again. */
        fun markLeftFromHubRoot() {
            if (_landing.value is HomeLanding.PlaceDashboard) relandOnReturn = true
        }

        /** The home to land on now that the user is back on the tab, once. */
        fun consumeReland(): String? {
            if (!relandOnReturn) return null
            relandOnReturn = false
            return (_landing.value as? HomeLanding.PlaceDashboard)?.homeId
        }

        fun loadPreview() {
            if (previewJob?.isActive == true) return
            val draft = _arrival.value.draft ?: return
            _arrival.value = _arrival.value.copy(previewError = false, isLoadingPreview = true)
            previewJob =
                viewModelScope.launch {
                    val result = placeRepository.publicPreview(draft.label)
                    if (userId != draft.userId || _arrival.value.draft?.id != draft.id) return@launch
                    _arrival.value = _arrival.value.copy(isLoadingPreview = false)
                    when (result) {
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
            previewJob?.cancel()
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
    val isLoadingPreview: Boolean = false,
)

sealed interface HomeLanding {
    data object Loading : HomeLanding

    data object Review : HomeLanding

    data class Error(val message: String) : HomeLanding

    data class PlaceDashboard(val homeId: String) : HomeLanding

    data object Hub : HomeLanding
}

/** My Homes' choice for one Home, or null when it isn't waiting on verification. */
private fun hubVerificationTargetFor(home: MyHome): HubVerificationTarget? =
    when {
        home.pendingClaimId != null -> HubVerificationTarget.WaitingRoom(home.id)
        home.accessKind == "private_setup" -> HubVerificationTarget.Residency(home.id)
        pendingVerificationFor(home) == PendingVerification.Owner -> HubVerificationTarget.ClaimOwnership(home.id)
        pendingVerificationFor(home) == PendingVerification.Residency -> HubVerificationTarget.Residency(home.id)
        else -> null
    }

/** The screen the Hub's "Verify your address" opens. */
sealed interface HubVerificationTarget {
    data object AddHome : HubVerificationTarget

    data class WaitingRoom(
        val homeId: String,
    ) : HubVerificationTarget

    data class Residency(
        val homeId: String,
    ) : HubVerificationTarget

    data class ClaimOwnership(
        val homeId: String,
    ) : HubVerificationTarget
}
