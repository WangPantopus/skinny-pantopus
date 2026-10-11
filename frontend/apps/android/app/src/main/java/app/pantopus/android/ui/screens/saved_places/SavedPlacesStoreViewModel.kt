@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.saved_places

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

/**
 * Small Saved Places cache for host surfaces with bookmark toggles. Mirrors the
 * iOS `SavedPlacesStore`: GET-backed matching, POST save, optimistic DELETE,
 * and Undo by re-POSTing the removed row.
 */
@HiltViewModel
class SavedPlacesStoreViewModel
    @Inject
    constructor(
        private val repository: SavedPlacesRepository,
    ) : ViewModel() {
        private val _saved = MutableStateFlow<List<SavedPlaceDto>>(emptyList())
        val saved: StateFlow<List<SavedPlaceDto>> = _saved.asStateFlow()

        private val _pendingSave = MutableStateFlow<PendingSavePlace?>(null)
        val pendingSave: StateFlow<PendingSavePlace?> = _pendingSave.asStateFlow()

        private val _undo = MutableStateFlow<SavedPlaceUndo?>(null)
        val undo: StateFlow<SavedPlaceUndo?> = _undo.asStateFlow()

        private val _toast = MutableStateFlow<SavedPlacesToast?>(null)
        val toast: StateFlow<SavedPlacesToast?> = _toast.asStateFlow()

        private var loading = false
        private var writing = false
        private var readJob: Job? = null

        fun loadIfNeeded() {
            if (loading || writing) return
            loading = true
            repository.listCopy()?.let { _saved.value = it.savedPlaces }
            readJob =
                viewModelScope.launch {
                    try {
                        val stored = repository.listStored()
                        stored.data?.let { _saved.value = it.savedPlaces }
                        if (stored.data == null) {
                            _saved.value = emptyList()
                            _toast.value = SavedPlacesToast("Couldn't load saved places.", isError = true)
                        }
                    } finally {
                        loading = false
                    }
                }
        }

        fun isSaved(
            geocodePlaceId: String?,
            latitude: Double,
            longitude: Double,
        ): Boolean = savedId(geocodePlaceId, latitude, longitude) != null

        fun toggle(pending: PendingSavePlace) {
            if (writing) return
            val id = savedId(pending.geocodePlaceId, pending.latitude, pending.longitude)
            if (id != null) {
                remove(id)
            } else {
                _pendingSave.value = pending
            }
        }

        fun commitSave(
            label: String,
            choice: SavePlaceTypeChoice,
        ) {
            if (writing) return
            val pending = _pendingSave.value ?: return
            beginWrite("Pending · Saving $label")
            _pendingSave.value = null
            val optimistic =
                SavedPlaceDto(
                    id = "optimistic-${UUID.randomUUID()}",
                    label = label,
                    placeType = choice.wire,
                    latitude = pending.latitude,
                    longitude = pending.longitude,
                    city = pending.city,
                    state = pending.state,
                    sourceId = pending.sourceId,
                    geocodePlaceId = pending.geocodePlaceId,
                    createdAt = null,
                )
            _saved.value = _saved.value.filterNot { samePlace(it, pending) } + optimistic
            viewModelScope.launch {
                val body =
                    SavePlaceBody(
                        label = label,
                        placeType = choice.wire,
                        latitude = pending.latitude,
                        longitude = pending.longitude,
                        city = pending.city,
                        state = pending.state,
                        geocodePlaceId = pending.geocodePlaceId,
                        sourceId = pending.sourceId,
                    )
                when (val result = repository.save(body)) {
                    is NetworkResult.Success -> {
                        _toast.value = SavedPlacesToast("Saved $label.")
                        _saved.value =
                            _saved.value.map { item ->
                                if (item.id == optimistic.id) result.data.savedPlace else item
                            }
                    }
                    is NetworkResult.Failure -> {
                        _saved.value = _saved.value.filterNot { it.id == optimistic.id }
                        _toast.value = SavedPlacesToast("Couldn't save $label.", isError = true)
                    }
                }
                writing = false
            }
        }

        fun closeSheet() {
            _pendingSave.value = null
        }

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
                            _saved.value = _saved.value.map { if (it.id == dto.id) result.data.savedPlace else it }
                            _toast.value = SavedPlacesToast("Restored ${dto.label}.")
                        }
                        is NetworkResult.Failure -> {
                            _saved.value = _saved.value.filterNot { it.id == dto.id }
                            _toast.value = SavedPlacesToast("Couldn't restore ${dto.label}.", isError = true)
                        }
                    }
                } finally {
                    writing = false
                }
            }
        }

        fun dismissUndo() {
            _undo.value = null
        }

        fun dismissToast() {
            if (_toast.value?.isPending != true) _toast.value = null
        }

        private fun remove(id: String) {
            if (writing) return
            val index = _saved.value.indexOfFirst { it.id == id }
            if (index < 0) return
            val removed = _saved.value[index]
            beginWrite("Pending · Removing ${removed.label}")
            _saved.value = _saved.value.filterNot { it.id == id }
            viewModelScope.launch {
                try {
                    when (repository.remove(id)) {
                        is NetworkResult.Success -> {
                            _toast.value = null
                            _undo.value = SavedPlaceUndo(removed, index)
                        }
                        is NetworkResult.Failure -> {
                            restoreRow(removed, index)
                            _toast.value = SavedPlacesToast("Couldn't remove ${removed.label}.", isError = true)
                        }
                    }
                } finally {
                    writing = false
                }
            }
        }

        private fun beginWrite(message: String) {
            writing = true
            readJob?.cancel()
            loading = false
            _undo.value = null
            _toast.value = SavedPlacesToast(message, isPending = true)
        }

        private fun restoreRow(
            dto: SavedPlaceDto,
            index: Int,
        ) {
            _saved.value = _saved.value.filterNot { it.id == dto.id }.toMutableList().apply { add(index.coerceIn(0, size), dto) }
        }

        private fun savedId(
            geocodePlaceId: String?,
            latitude: Double,
            longitude: Double,
        ): String? {
            val target = matchKey(geocodePlaceId, latitude, longitude)
            return _saved.value.firstOrNull { dto ->
                matchKey(dto.geocodePlaceId, dto.latitude, dto.longitude) == target
            }?.id
        }

        private fun samePlace(
            dto: SavedPlaceDto,
            pending: PendingSavePlace,
        ): Boolean =
            matchKey(dto.geocodePlaceId, dto.latitude, dto.longitude) ==
                matchKey(pending.geocodePlaceId, pending.latitude, pending.longitude)

        private fun matchKey(
            geocodePlaceId: String?,
            latitude: Double,
            longitude: Double,
        ): String =
            if (!geocodePlaceId.isNullOrBlank()) {
                "gid:$geocodePlaceId"
            } else {
                String.format(Locale.US, "ll:%.5f,%.5f", latitude, longitude)
            }
    }
