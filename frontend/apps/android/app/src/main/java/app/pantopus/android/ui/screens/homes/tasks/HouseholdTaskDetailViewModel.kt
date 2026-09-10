@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HouseholdTaskDetailState(
    val task: HomeTaskDto? = null,
    val loading: Boolean = true,
    val busy: Boolean = false,
    val error: String? = null,
    val deleted: Boolean = false,
)

@HiltViewModel
class HouseholdTaskDetailViewModel
    @Inject
    constructor(
        accessFactory: HomeTaskAccessFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_HOME_ID_KEY))
        private val taskId = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_TASK_ID_KEY))
        private val access = accessFactory.create(homeId, viewModelScope)
        private val _state = MutableStateFlow(HouseholdTaskDetailState())
        val state = _state.asStateFlow()
        private var generation = 0
        private var inFlight = false
        private var active = true
        private var work: Job? = null

        init {
            viewModelScope.launch {
                access.invalidated.collect { if (it) deny(TASK_SESSION_CHANGED) }
            }
        }

        fun resume() {
            active = true
            reload()
        }

        fun pause() {
            active = false
            generation++
            work?.cancel()
            work = null
            inFlight = false
            _state.value = HouseholdTaskDetailState()
        }

        fun reload() {
            if (inFlight || !active) return
            _state.value = HouseholdTaskDetailState()
            runAction({ access.read(taskId) }) { task ->
                _state.value = HouseholdTaskDetailState(task = task, loading = false)
            }
        }

        fun complete() {
            val current = _state.value.task ?: return
            if (current.capabilities?.canComplete != true) return
            runAction({ access.complete(taskId, current.status != "done") }) { task ->
                _state.value = HouseholdTaskDetailState(task = task, loading = false)
            }
        }

        fun delete() {
            if (_state.value.task?.capabilities?.canDelete != true) return
            runAction({ access.delete(taskId) }) {
                _state.value = HouseholdTaskDetailState(loading = false, deleted = true)
            }
        }

        fun edit(onAllowed: () -> Unit) {
            if (_state.value.task?.capabilities?.canEdit != true) return
            runAction({
                val task = access.read(taskId)
                check(task.capabilities?.canEdit == true) { TASK_ACCESS_CHANGED }
                task
            }) { task ->
                _state.value = HouseholdTaskDetailState(task = task, loading = false)
                onAllowed()
            }
        }

        private fun <T> runAction(
            action: suspend () -> T,
            publish: (T) -> Unit,
        ) {
            if (!active || inFlight || _state.value.deleted) return
            if (!access.isCurrent) {
                deny(TASK_SESSION_CHANGED)
                return
            }
            inFlight = true
            val revision = ++generation
            _state.value = _state.value.copy(busy = true, error = null)
            work =
                viewModelScope.launch {
                    try {
                        val result = action()
                        if (current(revision)) publish(result)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: NetworkError) {
                        if (current(revision)) deny(error.displayMessage("Could not refresh task access. Try again."))
                    } catch (error: IllegalStateException) {
                        reportCurrentFailure(revision, error)
                    } catch (error: IllegalArgumentException) {
                        reportCurrentFailure(revision, error)
                    } finally {
                        if (revision == generation) {
                            inFlight = false
                            _state.value = _state.value.copy(busy = false)
                        }
                    }
                }
        }

        private fun reportCurrentFailure(
            revision: Int,
            error: RuntimeException,
        ) {
            if (active && revision == generation) deny(error.message ?: TASK_ACCESS_CHANGED)
        }

        private fun current(revision: Int): Boolean = active && revision == generation && access.isCurrent

        private fun deny(message: String) {
            generation++
            inFlight = false
            _state.value = HouseholdTaskDetailState(loading = false, error = message)
        }
    }
