package app.pantopus.android.ui.screens.place.launch

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewStatus
import app.pantopus.android.data.api.net.NetworkResult
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

        fun onQueryChange(value: String) {
            _query.value = value
            autocompleteJob?.cancel()
            val q = value.trim()
            if (q.length < MIN_QUERY_LENGTH) {
                _suggestions.value = emptyList()
                return
            }
            autocompleteJob =
                viewModelScope.launch {
                    delay(AUTOCOMPLETE_DEBOUNCE_MS)
                    when (val r = repo.geoAutocomplete(q)) {
                        is NetworkResult.Success -> _suggestions.value = r.data.suggestions
                        is NetworkResult.Failure -> Unit
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

        fun prepareForAuth(): Boolean {
            val suggestion = selected
            if (suggestion == null || suggestion.label != _query.value || !PlacePendingStore.stash(suggestion)) {
                _step.value = LaunchStep.Hero
                _error.value = "Choose an address suggestion to keep this preview through sign-in."
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
