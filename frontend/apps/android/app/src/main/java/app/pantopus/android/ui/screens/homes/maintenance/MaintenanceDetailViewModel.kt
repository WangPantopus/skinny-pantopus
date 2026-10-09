@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
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
        gates: HomeCopyGateFactory,
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

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate = gates.create(homeId, listOf(HomeStoreKeys.maintenance(homeId)))
        private var readGeneration = 0L
        private var active = true

        /**
         * Screen entry and every return (Instant Screens): the entry shows at once from the log the list stored, and
         * the store answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() {
            active = true
            if (_state.value !is MaintenanceDetailUiState.Loaded && gate.showsCopy) repo.storedMaintenance(homeId)?.let(::show)
            read(force = false)
        }

        /** Retry: read now. */
        fun refresh() = read(force = true)

        /** No presentation or pending read survives a guest/expiring screen leaving the foreground. */
        fun suspendContent() {
            active = false
            readGeneration += 1
            if (!gate.showsCopy) clearCopy()
            gate.leave()
        }

        private fun clearCopy() {
            _actionError.value = null
            _state.value = MaintenanceDetailUiState.Loading
        }

        override fun onCleared() {
            gate.leave()
        }

        private fun read(force: Boolean) {
            if (!active) return
            val generation = ++readGeneration
            if (_state.value !is MaintenanceDetailUiState.Loaded) _state.value = MaintenanceDetailUiState.Loading
            viewModelScope.launch {
                val stored = readLog(force, generation)
                if (generation != readGeneration) return@launch
                val loaded = stored.data
                if (loaded != null) {
                    show(loaded)
                } else {
                    val failure = stored.failure ?: NetworkError.NotFound
                    _state.value = MaintenanceDetailUiState.Error(failure.displayMessage("Couldn't load this entry."))
                }
            }
        }

        private suspend fun readLog(
            force: Boolean,
            generation: Long,
        ): Stored<GetHomeMaintenanceResponse> {
            val refusal = gate.checkForRead(force) { if (generation == readGeneration) clearCopy() }
            if (refusal != null) return Stored(failure = refusal)
            if (generation != readGeneration) return Stored()
            val stored = repo.getHomeMaintenanceStored(homeId, force || !gate.showsCopy)
            // Guests cannot fall back to a previous visit's data after a failed forced read.
            return if (!gate.showsCopy && stored.failure != null) Stored(failure = stored.failure) else stored
        }

        private fun show(log: GetHomeMaintenanceResponse) {
            val task = log.tasks.firstOrNull { it.id == taskId }
            _state.value =
                if (task == null) {
                    MaintenanceDetailUiState.Error("This maintenance entry is no longer available.")
                } else {
                    MaintenanceDetailUiState.Loaded(task = task, draft = draftStore.draft(taskId))
                }
        }

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
