@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.net.HttpURLConnection.HTTP_FORBIDDEN
import javax.inject.Inject

data class HouseholdTaskDetailState(
    val task: HomeTaskDto? = null,
    val loading: Boolean = true,
    val busy: Boolean = false,
    val error: String? = null,
    val deleted: Boolean = false,
    /** "you", a member's name, or the short "Member 1A2B" label; null when nobody is assigned. */
    val assignee: String? = null,
)

@HiltViewModel
class HouseholdTaskDetailViewModel
    @Inject
    constructor(
        accessFactory: HomeTaskAccessFactory,
        savedStateHandle: SavedStateHandle,
        // Nullable so tests can construct without them; Hilt always supplies the singletons.
        private val membersRepo: HomeMembersRepository?,
        gates: HomeCopyGateFactory?,
    ) : ViewModel() {
        internal constructor(accessFactory: HomeTaskAccessFactory, savedStateHandle: SavedStateHandle) :
            this(accessFactory, savedStateHandle, null, null)

        private val homeId = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_HOME_ID_KEY))
        private val taskId = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_TASK_ID_KEY))
        private val access = accessFactory.create(homeId, viewModelScope)

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate =
            gates?.create(homeId, listOf(HomeStoreKeys.task(homeId, taskId), HomeStoreKeys.tasks(homeId), HomeStoreKeys.occupants(homeId)))
        private val showsCopy: Boolean get() = gate?.showsCopy == true
        private val _state = MutableStateFlow(HouseholdTaskDetailState())
        val state = _state.asStateFlow()
        private var generation = 0
        private var inFlight = false
        private var active = true
        private var work: Job? = null

        /** Members' names by user id; null until read. Empty when the viewer may not list members. */
        private var memberNames: Map<String, String>? = null
        private var namesWork: Job? = null

        init {
            // First frame (Instant Screens): owners and household roles see the stored task while the screen opens; the
            // read waits for the screen to resume.
            if (showsCopy) access.storedTask(taskId)?.let(::show)
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
            // Founder decision 3: owners and household roles keep the task on screen while away; anyone else blanks.
            if (!showsCopy) _state.value = HouseholdTaskDetailState()
        }

        /**
         * Every return (Instant Screens): owners and household roles see the stored task at once (its own copy, else
         * its row in the stored list), and the store answers a fresh copy without a request or revalidates an older
         * one. "Reload task" after an error reads now. Actions keep reading the task now before they act.
         */
        fun reload() {
            if (inFlight || !active) return
            val retry = _state.value.error != null
            if (_state.value.task == null && showsCopy) access.storedTask(taskId)?.let(::show)
            if (_state.value.task == null) _state.value = HouseholdTaskDetailState()
            runAction({ readTask(force = retry) }) { task ->
                show(task)
                finishArrival()
            }
        }

        override fun onCleared() {
            gate?.leave()
        }

        private suspend fun readTask(force: Boolean): HomeTaskDto {
            val fromCopy = showsCopy && !force
            var stored = readTaskStored(fromCopy)
            // Household access ended meanwhile: whatever came from a copy is read again now.
            if (fromCopy && !showsCopy) stored = readTaskStored(fromCopy = false)
            return stored.data?.task ?: throw (stored.failure ?: NetworkError.NotFound)
        }

        private suspend fun readTaskStored(fromCopy: Boolean) =
            coroutineScope {
                val recheck = async { gate?.recheck(!fromCopy) }
                val task = async { access.readStored(taskId, force = !fromCopy) }
                recheck.await()
                task.await()
            }

        /** Only this exact current account's task arrival can be completed. */
        fun finishArrival() {
            if (access.isCurrent) DeepLinkRouter.completeArrival(DeepLinkRouter.Destination.HomeTask(homeId, taskId))
        }

        fun complete() {
            val current = _state.value.task ?: return
            if (current.capabilities?.canComplete != true) return
            runAction({ access.complete(taskId, current.status != "done") }) { task -> show(task) }
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
                show(task)
                onAllowed()
            }
        }

        private fun show(task: HomeTaskDto) {
            _state.value = HouseholdTaskDetailState(task = task, loading = false, assignee = assigneeLabel(task))
            loadMemberNames(task)
        }

        private fun assigneeLabel(task: HomeTaskDto): String? {
            val id = task.assignedTo?.takeIf(String::isNotEmpty) ?: return null
            return if (id == access.actorId) "you" else HouseholdTasksListViewModel.assigneeDisplay(id, memberNames.orEmpty())
        }

        /** Only for someone else's task; a viewer who may not list members keeps the short label. */
        private fun loadMemberNames(task: HomeTaskDto) {
            val repo = membersRepo ?: return
            val id = task.assignedTo
            if (memberNames != null || namesWork?.isActive == true) return
            if (id.isNullOrEmpty() || id == access.actorId) return
            namesWork =
                viewModelScope.launch {
                    // Through the store: the list and the dashboard share the household's roster.
                    val result = repo.listOccupantsStored(homeId)
                    val roster = result.data
                    if (roster != null) {
                        memberNames =
                            roster.occupants
                                .mapNotNull(HouseholdTaskAssignableMember::from)
                                .associate { it.id to it.displayName }
                    } else if (result.failure?.code == HTTP_FORBIDDEN) {
                        // A refusal won't change on retry; other failures try again on the next read.
                        memberNames = emptyMap()
                    }
                    // Whatever task is shown now (a completion may have replaced it) gets the name.
                    val shown = _state.value.task
                    if (shown != null && active && access.isCurrent) _state.value = _state.value.copy(assignee = assigneeLabel(shown))
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
            if (active) finishArrival()
            namesWork?.cancel()
            memberNames = null
            generation++
            inFlight = false
            _state.value = HouseholdTaskDetailState(loading = false, error = message)
        }
    }
