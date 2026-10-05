package app.pantopus.android.ui.screens.place.launch

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewStatus
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the signed-out acquisition funnel (A1 → A2 → C0 → A6): the
 * address typeahead (keyless geo autocomplete), the anonymous T0 preview
 * (`/api/public/place`), and the non-US "coming to your region" branch.
 * The selected place is stashed ([PlacePendingStore]) so the wall can
 * save it after sign-up. Mirrors the iOS `PlaceLaunchViewModel`.
 */
@HiltViewModel
class PlaceLaunchViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        private val _step = MutableStateFlow<LaunchStep>(LaunchStep.Hero)
        val step: StateFlow<LaunchStep> = _step.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _suggestions = MutableStateFlow<List<GeoSuggestion>>(emptyList())
        val suggestions: StateFlow<List<GeoSuggestion>> = _suggestions.asStateFlow()

        private val _loadingPreview = MutableStateFlow(false)
        val loadingPreview: StateFlow<Boolean> = _loadingPreview.asStateFlow()

        private var selected: GeoSuggestion? = null
        private val _error = MutableStateFlow<String?>(null)
        val error: StateFlow<String?> = _error.asStateFlow()
        private var lookupJob: Job? = null
        private var autocompleteJob: Job? = null
        private val entryUserId = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        init {
            // This view model outlives the signed-in session (the funnel sits outside the nav graph), so
            // once someone signs in, the funnel starts over: the preview they carried in is already kept
            // for their account (PlacePendingStore), and after sign-out the next person on this device
            // must not see that address or carry it into their own account.
            viewModelScope.launch {
                var wasSignedIn: Boolean? = null
                authRepository.state.collect { state ->
                    val signedIn = state is AuthRepository.State.SignedIn
                    val currentUserId = (state as? AuthRepository.State.SignedIn)?.user?.id
                    val signedInAfterSignOut = signedIn && wasSignedIn == false
                    val entryAccountChanged = entryUserId != null && currentUserId != entryUserId
                    if (signedInAfterSignOut || entryAccountChanged) startOver()
                    wasSignedIn = signedIn
                }
            }
        }

        private fun startOver() {
            lookupJob?.cancel()
            autocompleteJob?.cancel()
            selected = null
            _query.value = ""
            _suggestions.value = emptyList()
            _error.value = null
            _loadingPreview.value = false
            _step.value = LaunchStep.Hero
        }

        fun onQueryChange(value: String) {
            _query.value = value
            autocompleteJob?.cancel()
            lookupJob?.cancel()
            _loadingPreview.value = false
            _error.value = null
            _suggestions.value = emptyList()
            if (selected?.label != value) selected = null
            val q = value.trim()
            if (q.length < MIN_QUERY_LENGTH) {
                return
            }
            autocompleteJob =
                viewModelScope.launch {
                    delay(AUTOCOMPLETE_DEBOUNCE_MS)
                    val r = repo.geoAutocomplete(q)
                    if (_query.value != value) return@launch
                    when (r) {
                        is NetworkResult.Success -> _suggestions.value = r.data.suggestions
                        is NetworkResult.Failure -> _error.value = "We couldn’t look up addresses. Please try again."
                    }
                }
        }

        fun select(suggestion: GeoSuggestion) {
            _query.value = suggestion.label
            _suggestions.value = emptyList()
            autocompleteJob?.cancel()
            selected = suggestion
            loadPreview(suggestion.label)
        }

        fun loadPreview(address: String) {
            lookupJob?.cancel()
            _error.value = null
            _loadingPreview.value = true
            lookupJob =
                viewModelScope.launch {
                    when (val r = repo.publicPreview(address)) {
                        is NetworkResult.Success -> {
                            val preview = r.data
                            _step.value =
                                if (preview.status == PlacePreviewStatus.UNSUPPORTED_REGION) {
                                    LaunchStep.Region(preview.message ?: "Home features are coming to your region.")
                                } else {
                                    LaunchStep.Preview(preview)
                                }
                        }
                        is NetworkResult.Failure -> _error.value = "We couldn’t load this address. Please try again."
                    }
                    _loadingPreview.value = false
                }
        }

        fun retryPreview() {
            if (_loadingPreview.value) return
            val suggestion = selected
            if (suggestion != null && suggestion.label == _query.value) {
                loadPreview(suggestion.label)
            } else {
                onQueryChange(_query.value)
            }
        }

        fun prepareForAuth(): Boolean {
            val suggestion = selected
            if (suggestion == null || suggestion.label != _query.value || !PlacePendingStore.stash(suggestion)) {
                _step.value = LaunchStep.Hero
                _error.value = "Choose an address suggestion to keep this preview through sign-in."
                return false
            }
            return true
        }

        /** The signed-in entry must not hand an unbound preview to another account. */
        fun prepareForSave(): Boolean {
            val currentUserId = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id
            if (entryUserId == null || currentUserId != entryUserId) {
                startOver()
                _error.value = "Your account changed. Reopen Saved places to continue."
                return false
            }
            if (!prepareForAuth()) return false
            if (PlacePendingStore.bind(entryUserId) == null) {
                PlacePendingStore.clear()
                _step.value = LaunchStep.Hero
                _error.value = "We couldn’t keep this preview. Please choose the address again."
                return false
            }
            return true
        }

        fun backToHero() {
            lookupJob?.cancel()
            _loadingPreview.value = false
            PlacePendingStore.clear()
            _step.value = LaunchStep.Hero
        }

        private companion object {
            // Mapbox typeahead needs a few characters before it returns useful hits.
            const val MIN_QUERY_LENGTH = 3

            // Debounce keystrokes so we fire one autocomplete request per pause, not per key.
            const val AUTOCOMPLETE_DEBOUNCE_MS = 220L
        }
    }

sealed interface LaunchStep {
    data object Hero : LaunchStep

    data class Preview(val preview: PlacePreview) : LaunchStep

    data class Region(val message: String) : LaunchStep
}
