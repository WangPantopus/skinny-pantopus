@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Nav-arg key for the home id. */
const val EMERGENCY_DETAIL_HOME_ID_KEY = "homeId"

/** Nav-arg key for the emergency item id. */
const val EMERGENCY_DETAIL_ITEM_ID_KEY = "emergencyId"

/** State for the Emergency Info detail screen. */
sealed interface EmergencyInfoDetailUiState {
    data object Loading : EmergencyInfoDetailUiState

    data class Loaded(
        val draft: EmergencyFormDraft,
        val isDeleting: Boolean = false,
        val showsDeleteConfirm: Boolean = false,
    ) : EmergencyInfoDetailUiState

    data object Missing : EmergencyInfoDetailUiState

    data class Error(val message: String) : EmergencyInfoDetailUiState
}

/**
 * P2.8 — Backs the Emergency Info detail. Loads the parent list and
 * finds the row by id (no GET-by-id today). Edit and delete are
 * local-only — a future patch wires PUT / DELETE once the backend
 * routes land.
 */
@HiltViewModel
class EmergencyInfoDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(EMERGENCY_DETAIL_HOME_ID_KEY)) {
                "EmergencyInfoDetailViewModel requires a $EMERGENCY_DETAIL_HOME_ID_KEY nav argument"
            }
        private val emergencyId: String =
            checkNotNull(savedStateHandle.get<String>(EMERGENCY_DETAIL_ITEM_ID_KEY)) {
                "EmergencyInfoDetailViewModel requires a $EMERGENCY_DETAIL_ITEM_ID_KEY nav argument"
            }

        private val _state =
            MutableStateFlow<EmergencyInfoDetailUiState>(EmergencyInfoDetailUiState.Loading)
        val state: StateFlow<EmergencyInfoDetailUiState> = _state.asStateFlow()

        private val _isDeleted = MutableStateFlow(false)
        val isDeleted: StateFlow<Boolean> = _isDeleted.asStateFlow()

        private var onChanged: () -> Unit = {}

        fun configure(onChanged: () -> Unit = {}) {
            this.onChanged = onChanged
        }

        fun load() {
            _state.value = EmergencyInfoDetailUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeEmergencies(homeId)) {
                    is NetworkResult.Success -> {
                        val dto = result.data.emergencies.firstOrNull { it.id == emergencyId }
                        _state.value =
                            when {
                                dto == null -> EmergencyInfoDetailUiState.Missing
                                else -> EmergencyInfoDetailUiState.Loaded(draft = projectDraft(dto))
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            EmergencyInfoDetailUiState.Error(
                                result.error.message ?: "Couldn't load this item.",
                            )
                }
            }
        }

        /** Apply a local edit returned by the form. */
        fun apply(updated: EmergencyFormDraft) {
            _state.update { current ->
                when (current) {
                    is EmergencyInfoDetailUiState.Loaded -> current.copy(draft = updated)
                    else -> current
                }
            }
            onChanged()
        }

        fun showDeleteConfirm() {
            _state.update { current ->
                when (current) {
                    is EmergencyInfoDetailUiState.Loaded -> current.copy(showsDeleteConfirm = true)
                    else -> current
                }
            }
        }

        fun hideDeleteConfirm() {
            _state.update { current ->
                when (current) {
                    is EmergencyInfoDetailUiState.Loaded -> current.copy(showsDeleteConfirm = false)
                    else -> current
                }
            }
        }

        fun confirmDelete() {
            val current = _state.value
            if (current !is EmergencyInfoDetailUiState.Loaded) return
            _state.value = current.copy(isDeleting = true, showsDeleteConfirm = false)
            // Backend has no DELETE handler today; commit locally and
            // signal the parent navigator so the list refresh closes
            // out the cycle.
            _isDeleted.value = true
            onChanged()
        }

        companion object {
            /**
             * Build a draft from a backend DTO. Legacy types
             * (`shutoff_water`, etc.) fall back to the `Other` form
             * category so the detail surface still renders.
             */
            @JvmStatic
            fun projectDraft(dto: HomeEmergencyDto): EmergencyFormDraft =
                EmergencyFormDraft.from(dto) ?: EmergencyFormDraft(
                    id = dto.id,
                    category = EmergencyFormCategory.Other,
                    title = dto.label,
                    severity = EmergencySeverity.fromValue(dto.details?.get("severity")),
                    details = dto.details?.get("detail") ?: dto.location.orEmpty(),
                    verifiedByUserId = dto.details?.get("verified_by"),
                    lastUpdated =
                        try {
                            dto.updatedAt?.let(Instant::parse) ?: Instant.now()
                        } catch (_: Throwable) {
                            Instant.now()
                        },
                )
        }
    }
