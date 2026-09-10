@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.HomeTaskCreationResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.homes.HomeTaskCreateScope
import app.pantopus.android.data.homes.PendingHomeTaskCreate
import app.pantopus.android.data.homes.PendingHomeTaskCreateStore
import app.pantopus.android.data.homes.PersistentPendingHomeTaskCreateStore
import app.pantopus.android.data.homes.validPendingTaskCreate
import kotlinx.coroutines.CoroutineScope
import retrofit2.Retrofit
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

class HomeTaskCreationFactory
    @Inject
    constructor(
        private val accessFactory: HomeTaskAccessFactory,
        private val store: PersistentPendingHomeTaskCreateStore,
        private val retrofit: Retrofit,
    ) {
        fun create(
            homeId: String,
            lifetime: CoroutineScope,
        ): HomeTaskCreationCoordinator =
            HomeTaskCreationCoordinator(homeId, retrofit.baseUrl().toString(), accessFactory.create(homeId, lifetime), store)
    }

/** One retained command per origin/account/Home; reopening never resubmits it automatically. */
class HomeTaskCreationCoordinator(
    private val homeId: String,
    private val origin: String,
    val access: HomeTaskAccess,
    private val store: PendingHomeTaskCreateStore,
    private val newRequestId: () -> String = { UUID.randomUUID().toString() },
) {
    var pending: PendingHomeTaskCreate? = null
        private set
    private var loaded = false
    private var working = false
    private var completed = false
    var canClear: Boolean = false
        private set

    suspend fun load(): PendingHomeTaskCreate? {
        access.requireCreation()
        val saved = store.read(scope())
        access.requireCurrent()
        if (saved != null) check(validPendingTaskCreate(saved, scope())) { "Saved task recovery could not be verified." }
        check(pending == null || saved == null || compatible(checkNotNull(pending), saved)) {
            "Another task request is saved. Reopen its form."
        }
        if (saved != null && pending?.taskId == null) pending = saved
        loaded = true
        return pending
    }

    suspend fun submit(payload: CreateHomeTaskRequest): HomeTaskDto {
        check(!working) { "A task request is already being checked." }
        check(!completed) { "This task was already created. Close this form to view it." }
        check(loaded) { "Reload the task form before saving." }
        working = true
        canClear = false
        try {
            val original = retain(payload)
            access.requireCurrent()
            val result =
                try {
                    access.create(original.request)
                } catch (failure: HomeTaskCreationFailure) {
                    canClear = canClearTaskCreation(failure.error)
                    throw failure
                }
            val confirmed = verify(original, result)
            pending = confirmed
            access.requireCurrent()
            store.replace(scope(), original, confirmed)
            access.requireCurrent()
            store.replace(scope(), confirmed, null)
            access.requireCurrent()
            pending = null
            completed = true
            return result.task
        } finally {
            working = false
        }
    }

    private suspend fun retain(payload: CreateHomeTaskRequest): PendingHomeTaskCreate {
        access.requireCurrent()
        var original = pending ?: PendingHomeTaskCreate(scope(), payload.copy(requestId = newRequestId())).also { pending = it }
        check(original.request.copy(requestId = null) == payload.copy(requestId = null)) {
            "Retry the saved task request before changing its fields."
        }
        check(validPendingTaskCreate(original, scope())) { "The task request could not be verified." }
        val stored = store.read(scope())
        access.requireCurrent()
        check(stored == null || compatible(original, stored)) { "Another task request is saved. Reopen its form." }
        if (stored?.taskId != null && original.taskId == null) {
            original = stored
            pending = stored
        }
        if (stored == null) {
            store.replace(scope(), null, original)
        } else if (stored != original) {
            store.replace(scope(), stored, original)
        }
        return original
    }

    private fun verify(
        original: PendingHomeTaskCreate,
        result: HomeTaskCreationResponse,
    ): PendingHomeTaskCreate {
        val receipt = result.creationReceipt
        check(receipt.homeId == homeId && receipt.actorId == original.scope.actorId && receipt.requestId == original.request.requestId) {
            "Task creation is not confirmed. Retry the saved request."
        }
        val confirmed = original.copy(taskId = receipt.taskId, payloadHash = receipt.payloadHash)
        check(validPendingTaskCreate(confirmed, scope()) && result.task.id == receipt.taskId && result.task.createdBy == receipt.actorId) {
            "The task receipt could not be verified. Retry the saved request."
        }
        check(runCatching { Instant.parse(receipt.createdAt) }.isSuccess) { "The task receipt date could not be verified." }
        check(original.taskId == null || (original.taskId == receipt.taskId && original.payloadHash == receipt.payloadHash)) {
            "The task receipt changed. Keep the original request and contact support."
        }
        return confirmed
    }

    suspend fun clearRejectedRequest() {
        check(!working && canClear && !completed) { "Only a confirmed rejected request can be cleared." }
        working = true
        try {
            access.requireCurrent()
            val original = checkNotNull(pending)
            store.replace(scope(), original, null)
            access.requireCurrent()
            pending = null
            canClear = false
            completed = true
        } finally {
            working = false
        }
    }

    private fun scope(): HomeTaskCreateScope = HomeTaskCreateScope(origin, checkNotNull(access.actorId) { TASK_SESSION_CHANGED }, homeId)

    private fun compatible(
        first: PendingHomeTaskCreate,
        second: PendingHomeTaskCreate,
    ): Boolean {
        if (first.scope != second.scope || first.request != second.request) return false
        if (first.taskId == null || second.taskId == null) return true
        return first.taskId == second.taskId && first.payloadHash == second.payloadHash
    }
}
