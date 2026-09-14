@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskCollectionCapabilitiesDto
import app.pantopus.android.data.api.models.homes.HomeTaskCreationReceiptDto
import app.pantopus.android.data.api.models.homes.HomeTaskCreationResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskCreateScope
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.data.homes.PendingHomeTaskCreate
import app.pantopus.android.data.homes.PendingHomeTaskCreateStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope

internal const val CREATE_HOME = "11111111-1111-4111-8111-111111111111"
internal const val CREATE_ACTOR = "22222222-2222-4222-8222-222222222222"
internal const val CREATE_TASK = "33333333-3333-4333-8333-333333333333"
internal const val CREATE_REQUEST = "44444444-4444-4444-8444-444444444444"
internal const val CREATE_ORIGIN = "https://claim.example.invalid"

internal class TaskCreateMemoryStore : PendingHomeTaskCreateStore {
    val entries = mutableMapOf<HomeTaskCreateScope, PendingHomeTaskCreate>()
    var readFailure = false
    var writeFailure = false
    var clearFailure = false
    var proofWriteFailure = false
    var beforeReplace: (suspend () -> Unit)? = null

    override suspend fun read(scope: HomeTaskCreateScope): PendingHomeTaskCreate? {
        check(!readFailure) { "Storage read failed" }
        return entries[scope]
    }

    override suspend fun replace(
        scope: HomeTaskCreateScope,
        expected: PendingHomeTaskCreate?,
        next: PendingHomeTaskCreate?,
    ) {
        beforeReplace?.invoke()
        check(!writeFailure && !(next == null && clearFailure) && !(next?.taskId != null && proofWriteFailure)) { "Storage write failed" }
        check(entries[scope] == expected) { "Saved request changed" }
        if (next == null) entries.remove(scope) else entries[scope] = next
    }
}

internal class HomeTaskCreationTestFixture {
    val repository = mockk<HomeTasksRepository>()
    val identity =
        HomeClaimScopeTestFixture().apply {
            accounts.value = CREATE_ACTOR
            storedAccount = CREATE_ACTOR
        }
    val store = TaskCreateMemoryStore()
    val scope = HomeTaskCreateScope(CREATE_ORIGIN, CREATE_ACTOR, CREATE_HOME)
    val payload = CreateHomeTaskRequest("chore", "Original", description = "private notes", dueAt = "2026-09-10T18:32:00-07:00")
    val session = HomeTaskSessionDto(CREATE_ACTOR, CREATE_HOME, "a".repeat(64))
    val task = HomeTaskDto(CREATE_TASK, CREATE_HOME, "chore", "Current title", createdBy = CREATE_ACTOR)
    val receipt = HomeTaskCreationReceiptDto(CREATE_HOME, CREATE_ACTOR, CREATE_REQUEST, CREATE_TASK, "b".repeat(64), "2026-09-10T00:00:00Z")
    val response = HomeTaskCreationResponse(task, receipt, session, replayed = false)
    var idsGenerated = 0

    init {
        coEvery { repository.getHomeTasks(any(), any()) } returns
            NetworkResult.Success(
                GetHomeTasksResponse(
                    collectionCapabilities = HomeTaskCollectionCapabilitiesDto(true), taskSession = session,
                ),
            )
        coEvery { repository.createHomeTaskWithReceipt(any(), any(), any()) } returns NetworkResult.Success(response)
    }

    fun coordinator(
        lifetime: CoroutineScope,
        home: String = CREATE_HOME,
        origin: String = CREATE_ORIGIN,
    ): HomeTaskCreationCoordinator {
        val access = HomeTaskAccessFactory(repository, claimScopeFactory(identity)).create(home, lifetime)
        return HomeTaskCreationCoordinator(home, origin, access, store) {
            idsGenerated++
            CREATE_REQUEST
        }
    }
}
