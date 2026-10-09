@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskCreationResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import javax.inject.Inject

internal const val TASK_SESSION_CHANGED = "Your session changed. Reopen Tasks to continue."
internal const val TASK_ACCESS_CHANGED = "Task access changed. Reload to view current permissions."

class HomeTaskAccessFactory
    @Inject
    constructor(
        private val repository: HomeTasksRepository,
        private val sessions: HomeClaimSessionScopeFactory,
    ) {
        fun create(
            homeId: String,
            scope: CoroutineScope,
            dispatchGuard: (suspend () -> Unit)? = null,
        ): HomeTaskAccess {
            val session = sessions.create(scope)
            val guard =
                dispatchGuard?.let { actionGuard ->
                    AuthenticatedDispatchGuard { credentials ->
                        session.requireCurrent()
                        session.requireDispatchCredentials(credentials)
                        actionGuard()
                    }
                }
            return HomeTaskAccess(homeId, repository, session, guard)
        }
    }

/** Local opening identity is captured before the first suspended server request. */
class HomeTaskAccess(
    private val homeId: String,
    private val repository: HomeTasksRepository,
    private val session: HomeClaimSessionScope,
    private val dispatchGuard: AuthenticatedDispatchGuard? = null,
) {
    val invalidated get() = session.invalidated
    val isCurrent get() = session.isCurrent
    val actorId get() = session.actorId
    private var serverSession: HomeTaskSessionDto? = null

    /** A read now; the confirmed reply also becomes the screens' stored copy. */
    suspend fun list(): GetHomeTasksResponse {
        requireCurrent()
        val response = repository.getHomeTasks(homeId, serverSession?.sessionScope, dispatchGuard).taskValue()
        requireCurrent()
        accept(response)
        repository.rememberHomeTasks(homeId, response)
        return response
    }

    /** A read now; the confirmed reply also becomes the screens' stored copy. */
    suspend fun read(taskId: String): HomeTaskDto {
        requireCurrent()
        val response = repository.getHomeTask(homeId, taskId, serverSession?.sessionScope, dispatchGuard).taskValue()
        requireCurrent()
        bind(response.taskSession)
        return exact(response.task, taskId).also { repository.rememberHomeTask(homeId, taskId, response) }
    }

    /**
     * [list] through the screens' store (Instant Screens): a fresh copy answers without a request, an older one is
     * revalidated, [force] reads now. A copy is checked like a reply.
     */
    suspend fun listStored(force: Boolean): Stored<GetHomeTasksResponse> {
        requireCurrent()
        val stored = repository.getHomeTasksStored(homeId, serverSession?.sessionScope, dispatchGuard, force)
        requireCurrent()
        stored.data?.let(::accept)
        return stored
    }

    /** [read] through the screens' store; a copy is checked like a reply. */
    suspend fun readStored(
        taskId: String,
        force: Boolean,
    ): Stored<HomeTaskResponse> {
        requireCurrent()
        val stored = repository.getHomeTaskStored(homeId, taskId, serverSession?.sessionScope, dispatchGuard, force)
        requireCurrent()
        stored.data?.let { response ->
            bind(response.taskSession)
            exact(response.task, taskId)
        }
        return stored
    }

    /** The stored list without a request, when it checks out like a reply; null otherwise. */
    fun storedList(): GetHomeTasksResponse? = repository.storedHomeTasks(homeId)?.takeIf { runCatching { accept(it) }.isSuccess }

    /** The stored task without a request (its own copy, else its row in the stored list), when it checks out. */
    fun storedTask(taskId: String): HomeTaskDto? =
        runCatching {
            repository.storedHomeTask(homeId, taskId)?.let { response ->
                bind(response.taskSession)
                exact(response.task, taskId)
            } ?: storedList()?.tasks?.firstOrNull { it.id == taskId }
        }.getOrNull()

    private fun accept(response: GetHomeTasksResponse) {
        bind(response.taskSession)
        response.tasks.forEach { exact(it, it.id) }
    }

    suspend fun complete(
        taskId: String,
        completed: Boolean,
        beforeDispatch: suspend () -> Unit = {},
    ): HomeTaskDto {
        check(read(taskId).capabilities?.canComplete == true) { TASK_ACCESS_CHANGED }
        requireCurrent()
        beforeDispatch()
        requireCurrent()
        val requestedStatus = if (completed) "done" else "open"
        val response =
            repository.updateHomeTask(
                homeId,
                taskId,
                UpdateHomeTaskRequest(status = requestedStatus),
                checkNotNull(serverSession).sessionScope,
                dispatchGuard,
            ).taskValue()
        requireCurrent()
        check(exact(response.task, taskId).status == requestedStatus) { TASK_ACCESS_CHANGED }
        // Mutations return a raw receipt. Read the current projection and capabilities.
        return read(taskId).also { check(it.status == requestedStatus) { TASK_ACCESS_CHANGED } }
    }

    suspend fun delete(taskId: String) {
        check(read(taskId).capabilities?.canDelete == true) { TASK_ACCESS_CHANGED }
        requireCurrent()
        repository.deleteHomeTask(homeId, taskId, checkNotNull(serverSession).sessionScope, dispatchGuard).taskValue()
        requireCurrent()
    }

    suspend fun requireCreation() {
        check(list().collectionCapabilities?.canCreate == true) { TASK_ACCESS_CHANGED }
    }

    suspend fun create(request: CreateHomeTaskRequest): HomeTaskCreationResponse {
        requireCreation()
        requireCurrent()
        val response =
            try {
                repository.createHomeTaskWithReceipt(homeId, request, checkNotNull(serverSession).sessionScope, dispatchGuard).taskValue()
            } catch (error: NetworkError) {
                throw HomeTaskCreationFailure(error)
            }
        requireCurrent()
        bind(response.taskSession)
        exact(response.task, response.creationReceipt.taskId)
        return response
    }

    suspend fun edit(
        taskId: String,
        patch: HomeTaskEditPatch,
    ): HomeTaskDto {
        check(read(taskId).capabilities?.canEdit == true) { TASK_ACCESS_CHANGED }
        requireCurrent()
        if (patch.fields.isEmpty()) return read(taskId)
        val response = repository.patchHomeTask(homeId, taskId, patch, checkNotNull(serverSession).sessionScope, dispatchGuard).taskValue()
        requireCurrent()
        exact(response.task, taskId)
        check(patch.matches(response.task)) { "The task update was not confirmed. Reload before continuing." }
        return read(taskId)
    }

    suspend fun requireCurrent() {
        currentCoroutineContext().ensureActive()
        check(session.confirmCurrent()) { TASK_SESSION_CHANGED }
        currentCoroutineContext().ensureActive()
    }

    suspend fun currentSession(): HomeTaskSessionDto {
        requireCurrent()
        return checkNotNull(serverSession) { TASK_SESSION_CHANGED }
    }

    private fun bind(received: HomeTaskSessionDto?) {
        check(received != null && received.homeId == homeId && received.actorId == session.actorId) { TASK_SESSION_CHANGED }
        check(received.sessionScope.matches(Regex("^[a-f0-9]{64}$"))) { TASK_SESSION_CHANGED }
        check(serverSession == null || received == serverSession) { TASK_SESSION_CHANGED }
        serverSession = received
    }

    private fun exact(
        task: HomeTaskDto,
        taskId: String,
    ): HomeTaskDto {
        check(task.id == taskId && task.id.isNotBlank() && task.homeId == homeId) { TASK_ACCESS_CHANGED }
        check(task.automaticRecurrence?.valid() != false) { TASK_ACCESS_CHANGED }
        return task
    }
}

private fun <T> NetworkResult<T>.taskValue(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
    }
