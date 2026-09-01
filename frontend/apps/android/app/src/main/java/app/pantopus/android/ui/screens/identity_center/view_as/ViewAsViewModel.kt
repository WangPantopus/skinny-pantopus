@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.identity_center.view_as

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.identity.IdentityCenterRepository
import app.pantopus.android.ui.components.ViewerAudience
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * B5.2 (A18.5) / P1-F — backs the "View as" identity preview: render YOUR
 * profile as a chosen [ViewerAudience] would see it. Mirrors iOS
 * `ViewAsViewModel.swift`.
 *
 * The production path resolves the preview live from
 * `GET /api/identity-center/view-as`, which performs the per-field privacy
 * resolution server-side; [ViewAsMapper] projects it onto the design render.
 * A fetch failure falls back to the local [ViewAsSampleData] render (the
 * surface has no error state). Previews / tests drive the deterministic
 * sample matrix via the sample constructor.
 */
@HiltViewModel
class ViewAsViewModel
    @Inject
    constructor(
        private val repository: IdentityCenterRepository,
    ) : ViewModel() {
        private var useSample: Boolean = false

        /** Sample/preview + test seam — resolve locally, no network. */
        internal constructor(
            repository: IdentityCenterRepository,
            useSample: Boolean,
        ) : this(repository) {
            this.useSample = useSample
        }

        private val _selected = MutableStateFlow(ViewerAudience.Connection)
        val selected: StateFlow<ViewerAudience> = _selected.asStateFlow()

        private val _state = MutableStateFlow<ViewAsUiState>(ViewAsUiState.Loading)
        val state: StateFlow<ViewAsUiState> = _state.asStateFlow()

        /** Resolve the initial render for the seeded audience. */
        fun load() {
            if (useSample) {
                _state.value = resolveSample(_selected.value)
            } else {
                fetchLive(showLoading = true)
            }
        }

        /** Switch the previewed audience and re-resolve the render. */
        fun select(viewer: ViewerAudience) {
            if (viewer == _selected.value) return
            _selected.value = viewer
            if (useSample) {
                if (_state.value is ViewAsUiState.Loaded) _state.value = resolveSample(viewer)
            } else {
                fetchLive(showLoading = false)
            }
        }

        private fun fetchLive(showLoading: Boolean) {
            if (showLoading) _state.value = ViewAsUiState.Loading
            val audience = _selected.value
            val (surface, viewer) = ViewAsMapper.backendParams(audience)
            viewModelScope.launch {
                val result = repository.viewAs(surface = surface, viewer = viewer)
                val render =
                    if (result is NetworkResult.Success) {
                        ViewAsMapper.render(result.data, audience)
                    } else {
                        // No error state on this surface — fall back to sample.
                        ViewAsSampleData.render(audience)
                    }
                _state.value = ViewAsUiState.Loaded(selected = audience, render = render)
            }
        }

        private fun resolveSample(viewer: ViewerAudience): ViewAsUiState.Loaded =
            ViewAsUiState.Loaded(selected = viewer, render = ViewAsSampleData.render(viewer))
    }
