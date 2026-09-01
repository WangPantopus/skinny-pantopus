package app.pantopus.android.ui.screens.place.launch

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewStatus
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
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
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _step = MutableStateFlow<LaunchStep>(LaunchStep.Hero)
        val step: StateFlow<LaunchStep> = _step.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _suggestions = MutableStateFlow<List<GeoSuggestion>>(emptyList())
        val suggestions: StateFlow<List<GeoSuggestion>> = _suggestions.asStateFlow()

        private val _loadingPreview = MutableStateFlow(false)
        val loadingPreview: StateFlow<Boolean> = _loadingPreview.asStateFlow()

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
            PlacePendingStore.stash(context, suggestion)
            loadPreview(suggestion.label)
        }

        fun loadPreview(address: String) {
            _loadingPreview.value = true
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
                    is NetworkResult.Failure -> Unit // stay on hero
                }
                _loadingPreview.value = false
            }
        }

        fun backToHero() {
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
