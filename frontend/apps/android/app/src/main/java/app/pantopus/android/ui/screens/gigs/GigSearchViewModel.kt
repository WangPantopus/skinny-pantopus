@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Render state for the Gig Search surface (P4.4). Mirrors the iOS
 * `GigSearchState`. `Idle` (blank query) maps to the shell's "recent"
 * phase; `Loading` to the typing-shimmer; `Empty` and `Error` both
 * surface through the shell's empty phase with different copy.
 */
sealed interface GigSearchUiState {
    data object Idle : GigSearchUiState

    data object Loading : GigSearchUiState

    data class Loaded(
        val rows: List<GigCardContent>,
    ) : GigSearchUiState

    data object Empty : GigSearchUiState

    data class Error(
        val message: String,
    ) : GigSearchUiState
}

/**
 * Backs the Gig Search surface. Debounces the query 250ms, then hits
 * `GET /api/gigs?search=&category=` — the backend does a case-insensitive
 * substring match on title + body. Category chips narrow the same query.
 * Rows reuse [GigsFeedViewModel.projectCard] so results render identically
 * to the feed.
 */
@HiltViewModel
class GigSearchViewModel
    @Inject
    constructor(
        private val repo: GigsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<GigSearchUiState>(GigSearchUiState.Idle)
        val state: StateFlow<GigSearchUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _activeCategory = MutableStateFlow(GigsCategory.All)
        val activeCategory: StateFlow<GigsCategory> = _activeCategory.asStateFlow()

        private var searchJob: Job? = null

        fun onQueryChange(text: String) {
            _query.value = text
            scheduleSearch()
        }

        /** Chip tap — re-issues the search immediately when there's an
         *  active query; otherwise just records the filter. */
        fun selectCategory(category: GigsCategory) {
            if (_activeCategory.value == category) return
            searchJob?.cancel()
            _activeCategory.value = category
            if (_query.value.isBlank()) return
            _state.value = GigSearchUiState.Loading
            searchJob = viewModelScope.launch { search() }
        }

        private fun scheduleSearch() {
            searchJob?.cancel()
            val trimmed = _query.value.trim()
            if (trimmed.isEmpty()) {
                _state.value = GigSearchUiState.Idle
                return
            }
            _state.value = GigSearchUiState.Loading
            searchJob =
                viewModelScope.launch {
                    delay(DEBOUNCE_MS)
                    search()
                }
        }

        /**
         * Immediate (non-debounced) fetch for the current query +
         * category. The screen drives the debounced [scheduleSearch]; this
         * is the seam tests exercise directly.
         */
        suspend fun search() {
            val trimmed = _query.value.trim()
            if (trimmed.isEmpty()) {
                _state.value = GigSearchUiState.Idle
                return
            }
            _state.value = GigSearchUiState.Loading
            val category = _activeCategory.value
            when (
                val result =
                    repo.list(
                        category = category.key.takeIf { category != GigsCategory.All },
                        search = trimmed,
                    )
            ) {
                is NetworkResult.Success -> {
                    val gigs = result.data.gigs
                    _state.value =
                        if (gigs.isEmpty()) {
                            GigSearchUiState.Empty
                        } else {
                            GigSearchUiState.Loaded(rows = gigs.map { GigsFeedViewModel.projectCard(it) })
                        }
                }
                is NetworkResult.Failure -> {
                    _state.value = GigSearchUiState.Error(result.error.displayMessage("Couldn't load search."))
                }
            }
        }

        private companion object {
            const val DEBOUNCE_MS = 250L
        }
    }
