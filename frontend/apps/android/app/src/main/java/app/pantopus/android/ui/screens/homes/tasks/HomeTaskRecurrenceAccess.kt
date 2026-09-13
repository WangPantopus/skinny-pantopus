package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceState
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskRecurrenceScope
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.data.homes.PendingHomeTaskRecurrence
import app.pantopus.android.data.homes.validPendingTaskRecurrence
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal const val RECURRENCE_CHANGED = "The task or schedule changed. Reload and review it before changing repeats."

/** Every response is bound to task detail's opening account and current server session. */
class HomeTaskRecurrenceAccess(
    val identity: HomeTaskRecurrenceScope,
    private val tasks: HomeTaskAccess,
    private val repository: HomeTasksRepository,
) {
    val isCurrent get() = tasks.isCurrent
    val invalidated get() = tasks.invalidated

    suspend fun requireCurrent() = tasks.requireCurrent()

    suspend fun source(): Pair<HomeTaskDto, HomeTaskRecurrenceState> {
        val task = tasks.read(identity.taskId)
        val state = configuration()
        check(task.updatedAt == state.taskUpdatedAt) { RECURRENCE_CHANGED }
        return task to state
    }

    private suspend fun configuration(): HomeTaskRecurrenceState {
        val session = tasks.currentSession()
        val state = repository.getRecurrence(identity.homeId, identity.taskId, session.sessionScope).recurrenceValue()
        tasks.requireCurrent()
        check(state.matches(identity.homeId, identity.taskId)) { RECURRENCE_CHANGED }
        check(state.taskSession == session) { TASK_SESSION_CHANGED }
        return state
    }

    internal suspend fun change(
        original: PendingHomeTaskRecurrence,
        beforeDispatch: suspend () -> Unit,
    ): HomeTaskRecurrenceState {
        check(configuration().canManage) { TASK_ACCESS_CHANGED }
        check(validPendingTaskRecurrence(original, identity) && identity.actorId == tasks.actorId) { RECURRENCE_CHANGED }
        val session = tasks.currentSession()
        // Protected-store IO is the final suspended preflight; the caller checks
        // its lifecycle and stored snapshot after that IO returns, before POST.
        beforeDispatch()
        currentCoroutineContext().ensureActive()
        check(isCurrent) { TASK_SESSION_CHANGED }
        val result =
            try {
                repository.changeRecurrence(identity.homeId, identity.taskId, original.request, session.sessionScope).recurrenceValue()
            } catch (error: NetworkError) {
                throw RecurrenceMutationFailure(error)
            }
        tasks.requireCurrent()
        val receipt = result.receipt
        check(result.matches(identity.homeId, identity.taskId) && result.taskSession == session) { RECURRENCE_CHANGED }
        check(receipt != null && result.replayed != null && result.revision >= receipt.revision) { RECURRENCE_CHANGED }
        check(validPendingTaskRecurrence(original.copy(confirmed = receipt), identity)) { RECURRENCE_CHANGED }
        check(original.confirmed == null || original.confirmed == receipt) { RECURRENCE_CHANGED }
        return result
    }
}

internal class RecurrenceMutationFailure(val failure: NetworkError) : IllegalStateException(failure.message, failure)

private fun <T> NetworkResult<T>.recurrenceValue(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
    }
