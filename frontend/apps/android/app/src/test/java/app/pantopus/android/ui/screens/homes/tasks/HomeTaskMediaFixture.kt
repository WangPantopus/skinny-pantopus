package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskCapabilitiesDto
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskMediaDto
import app.pantopus.android.data.api.models.homes.HomeTaskMediaList
import app.pantopus.android.data.api.models.homes.HomeTaskMediaRemoval
import app.pantopus.android.data.api.models.homes.HomeTaskMediaUpload
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskMediaBytes
import app.pantopus.android.data.homes.HomeTaskMediaRepository
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import org.junit.Assert.fail

internal class HomeTaskMediaFixture {
    val home = "a1000000-0000-4000-8000-000000000001"
    val task = "b1000000-0000-4000-8000-000000000002"
    val uploadId = "c1000000-0000-4000-8000-000000000003"
    val identity = HomeClaimScopeTestFixture()
    val server = HomeTaskSessionDto("user-1", home, "a".repeat(64))
    val repository = mockk<HomeTaskMediaRepository>()
    val tasks = mockk<HomeTasksRepository>()
    val bytes = "Private task file — original".toByteArray()
    val pending = PendingTaskMediaUpload(uploadId, "住所-é.txt", "text/plain", bytes)
    val record = HomeTaskMediaDto(uploadId, home, task, "user-1", pending.serverFilename, "text/plain", bytes.size.toLong(), "ready", true)
    var taskRecord = HomeTaskDto(task, home, "chore", "Task", capabilities = HomeTaskCapabilitiesDto(canUpload = true))
    var listing = HomeTaskMediaList(listOf(record), true)

    init {
        coEvery { tasks.getHomeTask(any(), any(), any()) } answers { NetworkResult.Success(HomeTaskResponse(taskRecord, server)) }
        coEvery { repository.list(any(), any()) } answers { NetworkResult.Success(listing) }
        coEvery { repository.download(any(), any(), any()) } answers {
            NetworkResult.Success(HomeTaskMediaBytes(bytes.copyOf(), "text/plain"))
        }
        coEvery { repository.upload(any(), any(), any(), any(), any(), any()) } answers {
            val saved = record.copy(id = arg(2), fileName = arg(3), mimeType = arg(4), fileSize = arg<ByteArray>(5).size.toLong())
            listing = listing.copy(media = listOf(saved))
            NetworkResult.Success(HomeTaskMediaUpload(listOf(saved)))
        }
        coEvery { repository.remove(any(), any(), any()) } answers {
            val removed = record.copy(id = arg(2), state = "retired", available = false, cleanupPending = false)
            listing = listing.copy(media = listOf(removed))
            NetworkResult.Success(HomeTaskMediaRemoval(removed))
        }
    }

    fun access(scope: CoroutineScope): HomeTaskMediaAccess = HomeTaskMediaAccess(
        home, task, HomeTaskAccessFactory(tasks, claimScopeFactory(identity)).create(home, scope), repository,
    )
}

internal suspend fun mediaDenied(action: suspend () -> Unit) {
    try {
        action()
        fail("Unconfirmed private media access was accepted")
    } catch (_: IllegalStateException) {
        // Exact receipt/access validation is expected to reject.
    } catch (_: NetworkError) {
        // An explicit current server denial must propagate.
    }
}
