package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskGigResponse
import app.pantopus.android.data.api.models.homes.HomeTaskGigState
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeTaskGigApi
import app.pantopus.android.data.homes.HomeTaskGigScope
import app.pantopus.android.data.homes.PendingHomeTaskGig
import app.pantopus.android.data.homes.validPendingTaskGig
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal const val GIG_SOURCE_CHANGED = "The household task changed. Reload and review it before publishing."

class HomeTaskGigAccess(
    val identity: HomeTaskGigScope,
    private val tasks: HomeTaskAccess,
    private val api: HomeTaskGigApi,
) {
    val isCurrent get() = tasks.isCurrent
    val invalidated get() = tasks.invalidated

    suspend fun requireCurrent() = tasks.requireCurrent()

    suspend fun source(): Pair<HomeTaskDto, HomeTaskGigState> {
        val task = tasks.read(identity.taskId)
        val state = configuration()
        check(task.updatedAt == state.taskUpdatedAt) { GIG_SOURCE_CHANGED }
        return task to state
    }

    private suspend fun configuration(): HomeTaskGigState {
        val session = tasks.currentSession()
        val state = safeApiCall { api.read(identity.homeId, identity.taskId, session.sessionScope) }.gigValue()
        tasks.requireCurrent()
        check(state.matches(identity.homeId, identity.taskId)) { GIG_SOURCE_CHANGED }
        check(state.taskSession == session) { TASK_SESSION_CHANGED }
        return state
    }

    suspend fun publish(
        original: PendingHomeTaskGig,
        beforeDispatch: suspend () -> Unit,
    ): HomeTaskGigResponse {
        // An original request must remain recoverable after its task was linked.
        configuration()
        check(validPendingTaskGig(original, identity) && identity.actorId == tasks.actorId) { GIG_SOURCE_CHANGED }
        val session = tasks.currentSession()
        beforeDispatch()
        currentCoroutineContext().ensureActive()
        check(isCurrent) { TASK_SESSION_CHANGED }
        val response =
            try {
                safeApiCall { api.publish(original.request, session.sessionScope) }.gigValue()
            } catch (error: NetworkError) {
                throw GigPublicationFailure(error)
            }
        tasks.requireCurrent()
        check(response.taskSession == session && response.matches(original.request, identity.actorId)) { GIG_SOURCE_CHANGED }
        check(original.confirmed == null || original.confirmed == response.receipt) { GIG_SOURCE_CHANGED }
        return response
    }
}

internal class GigPublicationFailure(val failure: NetworkError) : IllegalStateException(failure.message, failure)

internal fun <T> NetworkResult<T>.gigValue(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
    }
