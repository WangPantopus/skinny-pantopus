@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.saved_places

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.RefreshNotice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
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
    val isPending: Boolean = false,
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
        private var loading = false
        private var writing = false
        private var readJob: Job? = null
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        fun load() = fetch(force = false)

        fun refresh() = fetch(force = true)

        private fun fetch(force: Boolean) {
            if (loading || writing) return
            loading = true
            _refreshing.value = force && loadedAtLeastOnce
            if (!loadedAtLeastOnce) {
                repository.listCopy()?.let {
                    items = it.savedPlaces
                    loadedAtLeastOnce = true
                    rebuild()
                }
                if (!loadedAtLeastOnce) _state.value = SavedPlacesUiState.Loading
            }
            readJob = viewModelScope.launch {
                try {
                    val stored = repository.listStored(force)
                    val data = stored.data
                    _refreshNotice.value =
                        if (stored.showsRefreshFailure(StoreKind.YOU)) {
                            RefreshNotice(stored.fetchedAt, ::refresh)
                        } else {
                            null
                        }
                    if (data != null) {
                        items = data.savedPlaces
                        loadedAtLeastOnce = true
                        rebuild()
                    } else if (!loadedAtLeastOnce ||
                        stored.failure.refusesStoredCopy
                    ) {
                        items = emptyList()
                        loadedAtLeastOnce = false
                        _state.value =
                            SavedPlacesUiState.Error(
                                stored.failure?.displayMessage("Couldn't load saved places.") ?: "Couldn't load saved places.",
                            )
                    }
                } finally {
                    loading = false
                    _refreshing.value = false
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
            if (!writing) _actionTarget.value = row.toActionTarget()
        }

        fun closeActions() {
            _actionTarget.value = null
        }

        // endregion

        // region Remove + Undo

        /** Show the removal as pending, then offer Undo once DELETE has completed. */
        fun remove(target: SavedPlaceActionTarget) {
            if (writing) return
            _actionTarget.value = null
            val index = items.indexOfFirst { it.id == target.id }
            if (index < 0) return
            val removed = items[index]
            beginWrite("Pending · Removing ${target.label}")
            items = items.filterNot { it.id == target.id }
            rebuild()
            viewModelScope.launch {
                try {
                    when (repository.remove(target.id)) {
                        is NetworkResult.Success -> {
                            _toast.value = null
                            _undo.value = SavedPlaceUndo(removed, index)
                        }
                        is NetworkResult.Failure -> {
                            restoreRow(removed, index)
                            _toast.value = SavedPlacesToast("Couldn't remove ${target.label}.", isError = true)
                        }
                    }
                } finally {
                    writing = false
                }
            }
        }

        /** Undo can only start after the removal is confirmed, and can't be submitted twice. */
        fun undoRemove() {
            if (writing) return
            val snapshot = _undo.value ?: return
            val dto = snapshot.dto
            beginWrite("Pending · Restoring ${dto.label}")
            restoreRow(dto, snapshot.index)
            viewModelScope.launch {
                try {
                    when (val result = repository.save(SavePlaceBody.from(dto))) {
                        is NetworkResult.Success -> {
                            items = items.map { if (it.id == dto.id) result.data.savedPlace else it }
                            _toast.value = SavedPlacesToast("Restored ${dto.label}.")
                        }
                        is NetworkResult.Failure -> {
                            items = items.filterNot { it.id == dto.id }
                            _toast.value = SavedPlacesToast("Couldn't restore ${dto.label}.", isError = true)
                        }
                    }
                    rebuild()
                } finally {
                    writing = false
                }
            }
        }

        private fun beginWrite(message: String) {
            writing = true
            readJob?.cancel()
            loading = false
            _refreshing.value = false
            _undo.value = null
            _toast.value = SavedPlacesToast(message, isPending = true)
        }

        private fun restoreRow(dto: SavedPlaceDto, index: Int) {
            items = items.filterNot { it.id == dto.id }.toMutableList().apply { add(index.coerceIn(0, size), dto) }
            rebuild()
        }

        /** The Undo snackbar timed out — commit the removal silently. */
        fun dismissUndo() {
            _undo.value = null
        }

        fun dismissToast() {
            if (_toast.value?.isPending != true) _toast.value = null
        }

        // endregion

        /** Test seam — pin the clock so the relative-caption math is deterministic. */
        internal fun overrideNow(provider: () -> Instant) {
            nowProvider = provider
        }
    }
