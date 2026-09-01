@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.saved_places

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
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

        private var loaded = false

        fun loadIfNeeded() {
            if (loaded) return
            viewModelScope.launch {
                when (val result = repository.list()) {
                    is NetworkResult.Success -> {
                        _saved.value = result.data.savedPlaces
                        loaded = true
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = SavedPlacesToast("Couldn't load saved places.", isError = true)
                    }
                }
            }
        }

        fun isSaved(
            geocodePlaceId: String?,
            latitude: Double,
            longitude: Double,
        ): Boolean = savedId(geocodePlaceId, latitude, longitude) != null

        fun toggle(pending: PendingSavePlace) {
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
            val pending = _pendingSave.value ?: return
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
            }
        }

        fun closeSheet() {
            _pendingSave.value = null
        }

        fun undoRemove() {
            val snapshot = _undo.value ?: return
            _undo.value = null
            val dto = snapshot.dto
            _saved.value = _saved.value.toMutableList().apply { add(snapshot.index.coerceIn(0, size), dto) }
            viewModelScope.launch {
                when (val result = repository.save(SavePlaceBody.from(dto))) {
                    is NetworkResult.Success -> {
                        _saved.value = _saved.value.map { if (it.id == dto.id) result.data.savedPlace else it }
                    }
                    is NetworkResult.Failure -> {
                        _saved.value = _saved.value.filterNot { it.id == dto.id }
                        _toast.value = SavedPlacesToast("Couldn't restore ${dto.label}.", isError = true)
                    }
                }
            }
        }

        fun dismissUndo() {
            _undo.value = null
        }

        fun dismissToast() {
            _toast.value = null
        }

        private fun remove(id: String) {
            val index = _saved.value.indexOfFirst { it.id == id }
            if (index < 0) return
            val removed = _saved.value[index]
            val previous = _saved.value
            _saved.value = previous.filterNot { it.id == id }
            _undo.value = SavedPlaceUndo(removed, index)
            viewModelScope.launch {
                if (repository.remove(id) is NetworkResult.Failure) {
                    _saved.value = previous
                    _undo.value = null
                    _toast.value = SavedPlacesToast("Couldn't remove ${removed.label}.", isError = true)
                }
            }
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
