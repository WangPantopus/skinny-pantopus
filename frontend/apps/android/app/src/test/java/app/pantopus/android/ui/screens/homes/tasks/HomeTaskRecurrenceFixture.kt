package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceConfiguration
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceReceipt
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceState
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskRecurrenceScope
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.data.homes.PendingHomeTaskRecurrence
import app.pantopus.android.data.homes.PendingHomeTaskRecurrenceStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope

internal class HomeTaskRecurrenceFixture {
    val home = "d1000000-0000-4000-8000-000000000001"
    val actor = "d1000000-0000-4000-8000-000000000002"
    val taskId = "d1000000-0000-4000-8000-000000000003"
    val id = "d1000000-0000-4000-8000-000000000004"
    val stamp = "2026-09-10T12:00:00Z"
    val key = HomeTaskRecurrenceScope("https://task.example.invalid/", actor, home, taskId)
    val identity =
        HomeClaimScopeTestFixture().also {
            it.accounts.value = actor
            it.storedAccount = actor
        }
    val server = HomeTaskSessionDto(actor, home, "a".repeat(64))
    val repository = mockk<HomeTasksRepository>()
    val store = RecurrenceMemoryStore()
    var task = HomeTaskDto(taskId, home, "chore", "Private recurrence source", dueAt = stamp, updatedAt = stamp)
    var state = HomeTaskRecurrenceState(true, home, taskId, true, stamp, 0, server)
    val request = HomeTaskRecurrenceRequest(id, "start", 0, stamp, "WEEKLY", 1, "UTC")
    val original = PendingHomeTaskRecurrence(key, request)

    init {
        coEvery { repository.getHomeTask(any(), any(), any()) } answers { NetworkResult.Success(HomeTaskResponse(task, server)) }
        coEvery { repository.getRecurrence(any(), any(), any()) } answers { NetworkResult.Success(state) }
        coEvery { repository.changeRecurrence(any(), any(), any(), any()) } answers {
            NetworkResult.Success(commit(arg(2)))
        }
    }

    fun commit(request: HomeTaskRecurrenceRequest = this.request): HomeTaskRecurrenceState {
        val next = request.expectedRevision + 1
        val config =
            HomeTaskRecurrenceConfiguration(
                id, next, if (request.action == "pause") "paused" else "active", request.frequency ?: "WEEKLY",
                request.interval ?: 1, request.timezone ?: "UTC", stamp, 0,
                nextDueAt = if (request.action == "pause") null else "2026-09-17T12:00:00Z",
            )
        state = state.copy(revision = next, configuration = config)
        return state.copy(receipt = receipt(request), replayed = false)
    }

    fun receipt(request: HomeTaskRecurrenceRequest = this.request) =
        HomeTaskRecurrenceReceipt(
            request.requestId,
            actor,
            home,
            taskId,
            request.action,
            request.expectedRevision + 1,
            "b".repeat(64),
            stamp,
        )

    fun access(scope: CoroutineScope) =
        HomeTaskRecurrenceAccess(
            key,
            HomeTaskAccessFactory(repository, claimScopeFactory(identity)).create(home, scope),
            repository,
        )

    fun controller(scope: CoroutineScope) = HomeTaskRecurrenceController(access(scope), store, scope) { id }
}

internal class RecurrenceMemoryStore : PendingHomeTaskRecurrenceStore {
    var value: PendingHomeTaskRecurrence? = null
    var failRead = false
    var failWrite = false
    var failProof = false
    var failClear = false
    var beforeRead: suspend () -> Unit = {}
    var afterWrite: suspend () -> Unit = {}

    override suspend fun read(scope: HomeTaskRecurrenceScope): PendingHomeTaskRecurrence? {
        beforeRead()
        check(!failRead) { "Unreadable storage" }
        return value
    }

    override suspend fun replace(
        scope: HomeTaskRecurrenceScope,
        expected: PendingHomeTaskRecurrence?,
        next: PendingHomeTaskRecurrence?,
    ) {
        check(value == expected) { "Changed stored request" }
        check(!failWrite && !(failProof && next?.confirmed != null) && !(failClear && next == null)) { "Failed persistence" }
        value = next
        afterWrite()
    }
}
