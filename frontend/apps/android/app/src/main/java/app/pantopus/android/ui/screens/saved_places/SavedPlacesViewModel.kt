@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.saved_places

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Transient confirmation / error banner payload. */
data class SavedPlacesToast(
    val text: String,
    val isError: Boolean = false,
)

/**
 * BLOCK 2E — "Saved places". Mirrors the Following ViewModel + repository
 * shape: a cached row list, a `state` the screen renders from, optimistic row
 * mutations that roll back on failure, and a transient toast. Removal is
 * optimistic and surfaces an Undo snackbar that re-POSTs the place; the upsert
 * route makes that re-save idempotent.
 */
@HiltViewModel
class SavedPlacesViewModel
    @Inject
    constructor(
        private val repository: SavedPlacesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<SavedPlacesUiState>(SavedPlacesUiState.Loading)
        val state: StateFlow<SavedPlacesUiState> = _state.asStateFlow()

        private val _selectedFilter = MutableStateFlow(SavedPlaceFilter.All)
        val selectedFilter: StateFlow<SavedPlaceFilter> = _selectedFilter.asStateFlow()

        private val _actionTarget = MutableStateFlow<SavedPlaceActionTarget?>(null)
        val actionTarget: StateFlow<SavedPlaceActionTarget?> = _actionTarget.asStateFlow()

        private val _undo = MutableStateFlow<SavedPlaceUndo?>(null)
        val undo: StateFlow<SavedPlaceUndo?> = _undo.asStateFlow()

        private val _toast = MutableStateFlow<SavedPlacesToast?>(null)
        val toast: StateFlow<SavedPlacesToast?> = _toast.asStateFlow()

        private var nowProvider: () -> Instant = { Instant.now() }
        private var items: List<SavedPlaceDto> = emptyList()
        private var loadedAtLeastOnce = false

        fun load() {
            if (loadedAtLeastOnce && _state.value is SavedPlacesUiState.Loaded) return
            fetch()
        }

        fun refresh() = fetch()

        private fun fetch() {
            if (!loadedAtLeastOnce) _state.value = SavedPlacesUiState.Loading
            viewModelScope.launch {
                when (val result = repository.list()) {
                    is NetworkResult.Success -> {
                        items = result.data.savedPlaces
                        loadedAtLeastOnce = true
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedAtLeastOnce) {
                            _state.value = SavedPlacesUiState.Error(result.error.displayMessage("Couldn't load saved places."))
                        } else {
                            _toast.value = SavedPlacesToast("Couldn't refresh.", isError = true)
                        }
                    }
                }
            }
        }

        private fun rebuild() {
            if (items.isEmpty()) {
                _state.value = SavedPlacesUiState.Empty
                return
            }
            val filters = SavedPlacesProjection.presentFilters(items)
            if (_selectedFilter.value !in filters) _selectedFilter.value = SavedPlaceFilter.All
            val rows = SavedPlacesProjection.rows(items, _selectedFilter.value, nowProvider())
            _state.value = SavedPlacesUiState.Loaded(rows = rows, filters = filters, total = items.size)
        }

        fun selectFilter(filter: SavedPlaceFilter) {
            if (filter == _selectedFilter.value) return
            _selectedFilter.value = filter
            rebuild()
        }

        // region Action sheet

        fun openActions(row: SavedPlaceRow) {
            _actionTarget.value = row.toActionTarget()
        }

        fun closeActions() {
            _actionTarget.value = null
        }

        // endregion

        // region Remove + Undo

        /**
         * Optimistically drop the row and fire the DELETE, then surface an Undo
         * snackbar. A failed DELETE rolls the row back; a tapped Undo re-POSTs.
         */
        fun remove(target: SavedPlaceActionTarget) {
            _actionTarget.value = null
            val index = items.indexOfFirst { it.id == target.id }
            if (index < 0) return
            val removed = items[index]
            val previous = items
            items = items.filterNot { it.id == target.id }
            rebuild()
            _undo.value = SavedPlaceUndo(removed, index)
            viewModelScope.launch {
                if (repository.remove(target.id) is NetworkResult.Failure) {
                    items = previous
                    rebuild()
                    _undo.value = null
                    _toast.value = SavedPlacesToast("Couldn't remove ${target.label}.", isError = true)
                }
            }
        }

        /**
         * Re-save the just-removed place at its original position. The POST
         * upsert returns a fresh row (new id), which replaces the optimistic copy.
         */
        fun undoRemove() {
            val snapshot = _undo.value ?: return
            _undo.value = null
            val dto = snapshot.dto
            val target = snapshot.index.coerceIn(0, items.size)
            items = items.toMutableList().apply { add(target, dto) }
            rebuild()
            viewModelScope.launch {
                when (val result = repository.save(SavePlaceBody.from(dto))) {
                    is NetworkResult.Success -> {
                        items = items.map { if (it.id == dto.id) result.data.savedPlace else it }
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        items = items.filterNot { it.id == dto.id }
                        rebuild()
                        _toast.value = SavedPlacesToast("Couldn't restore ${dto.label}.", isError = true)
                    }
                }
            }
        }

        /** The Undo snackbar timed out — commit the removal silently. */
        fun dismissUndo() {
            _undo.value = null
        }

        fun dismissToast() {
            _toast.value = null
        }

        // endregion

        /** Test seam — pin the clock so the relative-caption math is deterministic. */
        internal fun overrideNow(provider: () -> Instant) {
            nowProvider = provider
        }
    }
