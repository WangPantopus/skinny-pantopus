@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key for the Maintenance detail route. */
const val MAINTENANCE_DETAIL_HOME_ID_KEY = "homeId"
const val MAINTENANCE_DETAIL_TASK_ID_KEY = "taskId"

/** UI state for the Maintenance detail screen. */
sealed interface MaintenanceDetailUiState {
    data object Loading : MaintenanceDetailUiState

    data class Loaded(
        val task: MaintenanceTaskDto,
        val draft: MaintenanceDraft?,
    ) : MaintenanceDetailUiState

    data class Error(val message: String) : MaintenanceDetailUiState
}

/** Outbound event from the detail VM — host listens and routes. */
sealed interface MaintenanceDetailEvent {
    data object Deleted : MaintenanceDetailEvent
}

@HiltViewModel
class MaintenanceDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val draftStore: MaintenanceDraftStore,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle[MAINTENANCE_DETAIL_HOME_ID_KEY]) {
                "MaintenanceDetailViewModel requires a $MAINTENANCE_DETAIL_HOME_ID_KEY nav argument"
            }
        private val taskId: String =
            checkNotNull(savedStateHandle[MAINTENANCE_DETAIL_TASK_ID_KEY]) {
                "MaintenanceDetailViewModel requires a $MAINTENANCE_DETAIL_TASK_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<MaintenanceDetailUiState>(MaintenanceDetailUiState.Loading)
        val state: StateFlow<MaintenanceDetailUiState> = _state.asStateFlow()

        private val _isMutating = MutableStateFlow(false)
        val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        private val _event = MutableStateFlow<MaintenanceDetailEvent?>(null)
        val event: StateFlow<MaintenanceDetailEvent?> = _event.asStateFlow()

        fun load() {
            _state.value = MaintenanceDetailUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeMaintenance(homeId)) {
                    is NetworkResult.Success -> {
                        val task = result.data.tasks.firstOrNull { it.id == taskId }
                        _state.value =
                            if (task == null) {
                                MaintenanceDetailUiState.Error("This maintenance entry is no longer available.")
                            } else {
                                MaintenanceDetailUiState.Loaded(task = task, draft = draftStore.draft(taskId))
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value = MaintenanceDetailUiState.Error(result.error.displayMessage("Couldn't load this entry."))
                }
            }
        }

        fun refresh() = load()

        fun delete() {
            if (_isMutating.value) return
            _isMutating.value = true
            _actionError.value = null
            viewModelScope.launch {
                when (val result = repo.deleteHomeMaintenance(homeId, taskId)) {
                    is NetworkResult.Success -> {
                        draftStore.remove(taskId)
                        Analytics.track(AnalyticsEvent.CtaMaintenanceDelete(AnalyticsResult.SUCCESS))
                        _isMutating.value = false
                        _event.value = MaintenanceDetailEvent.Deleted
                    }
                    is NetworkResult.Failure -> {
                        Analytics.track(AnalyticsEvent.CtaMaintenanceDelete(AnalyticsResult.ERROR))
                        _isMutating.value = false
                        _actionError.value = result.error.message
                    }
                }
            }
        }

        fun consumeEvent() {
            _event.value = null
        }
    }
