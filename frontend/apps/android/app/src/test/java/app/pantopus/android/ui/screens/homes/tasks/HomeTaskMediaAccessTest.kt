package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskCapabilitiesDto
import app.pantopus.android.data.api.models.homes.HomeTaskMediaRemoval
import app.pantopus.android.data.api.models.homes.HomeTaskMediaUpload
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskMediaBytes
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskMediaAccessTest {
    private val f = HomeTaskMediaFixture()

    @Test fun exact_read_only_list_and_bytes_never_mutate() = runTest {
        f.taskRecord = f.taskRecord.copy(capabilities = HomeTaskCapabilitiesDto())
        val access = f.access(backgroundScope)
        assertFalse(access.list().canUpload)
        assertArrayEquals(f.bytes, access.read(f.record).bytes)
        coVerify { f.repository.list(f.server, f.task) }
        coVerify(exactly = 0) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        coVerify(exactly = 0) { f.repository.remove(any(), any(), any()) }
    }

    @Test fun both_task_and_media_permissions_are_required_for_writes() = runTest {
        val access = f.access(backgroundScope)
        for (taskPermission in listOf(false, true)) {
            f.taskRecord = f.taskRecord.copy(capabilities = HomeTaskCapabilitiesDto(canUpload = taskPermission))
            f.listing = f.listing.copy(canUpload = !taskPermission)
            mediaDenied { access.upload(f.pending) }
            mediaDenied { access.remove(f.record) }
        }
        coVerify(exactly = 0) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        coVerify(exactly = 0) { f.repository.remove(any(), any(), any()) }
    }

    @Test fun foreign_duplicate_or_unsafe_legacy_metadata_is_denied() = runTest {
        val access = f.access(backgroundScope)
        for (records in listOf(
            listOf(f.record.copy(homeId = f.task)), listOf(f.record.copy(taskId = f.home)),
            listOf(f.record, f.record), listOf(f.record.copy(state = "legacy")),
        )) {
            f.listing = f.listing.copy(media = records)
            mediaDenied { access.list() }
        }
    }

    @Test fun stored_only_session_replacement_denies_before_any_request() = runTest {
        val access = f.access(backgroundScope)
        f.identity.storedToken = "replacement"
        mediaDenied { access.list() }
        coVerify(exactly = 0) { f.tasks.getHomeTask(any(), any(), any()) }
        coVerify(exactly = 0) { f.repository.list(any(), any()) }
    }

    @Test fun changed_server_scope_cannot_upload() = runTest {
        val access = f.access(backgroundScope)
        access.list()
        coEvery { f.tasks.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(
            HomeTaskResponse(f.taskRecord, f.server.copy(sessionScope = "b".repeat(64))),
        )
        mediaDenied { access.upload(f.pending) }
        coVerify(exactly = 0) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
    }

    @Test fun upload_uses_immutable_bytes_safe_name_and_exact_current_receipt() = runTest {
        val access = f.access(backgroundScope)
        var sent: ByteArray? = null
        coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } answers {
            sent = arg<ByteArray>(5).copyOf()
            NetworkResult.Success(HomeTaskMediaUpload(listOf(f.record)))
        }
        assertEquals(f.record, access.upload(f.pending))
        assertArrayEquals(f.bytes, sent)
        coVerify { f.repository.upload(f.server, f.task, f.uploadId, f.pending.serverFilename, "text/plain", any()) }
    }

    @Test fun wrong_upload_receipt_cannot_confirm_success() = runTest {
        val access = f.access(backgroundScope)
        for (wrong in listOf(
            f.record.copy(id = f.home), f.record.copy(uploadedBy = "other"), f.record.copy(fileName = "other.txt"),
            f.record.copy(fileSize = 1), f.record.copy(state = "retired", available = false),
        )) {
            coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(HomeTaskMediaUpload(listOf(wrong)))
            mediaDenied { access.upload(f.pending) }
        }
    }

    @Test fun concurrent_retirement_after_download_hides_and_erases_bytes() = runTest {
        val delivered = f.bytes.copyOf()
        coEvery { f.repository.download(any(), any(), any()) } answers {
            f.listing = f.listing.copy(media = listOf(f.record.copy(state = "retired", available = false)))
            NetworkResult.Success(HomeTaskMediaBytes(delivered, "text/plain"))
        }
        mediaDenied { f.access(backgroundScope).read(f.record) }
        assertArrayEquals(ByteArray(delivered.size), delivered)
    }

    @Test fun current_task_denial_after_download_hides_and_erases_bytes() = runTest {
        val delivered = f.bytes.copyOf()
        coEvery { f.repository.download(any(), any(), any()) } answers {
            coEvery { f.tasks.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            NetworkResult.Success(HomeTaskMediaBytes(delivered, "text/plain"))
        }
        mediaDenied { f.access(backgroundScope).read(f.record) }
        assertArrayEquals(ByteArray(delivered.size), delivered)
    }

    @Test fun removal_needs_exact_complete_cleanup_receipt() = runTest {
        val access = f.access(backgroundScope)
        val removed = f.record.copy(state = "retired", available = false, cleanupPending = false)
        for (wrong in listOf(removed.copy(id = f.home), removed.copy(cleanupPending = true), removed.copy(state = "ready"))) {
            coEvery { f.repository.remove(any(), any(), any()) } returns NetworkResult.Success(HomeTaskMediaRemoval(wrong))
            mediaDenied { access.remove(f.record) }
        }
    }

    @Test fun other_uploaders_removed_record_may_be_absent_after_exact_receipt() = runTest {
        val record = f.record.copy(uploadedBy = "other-uploader")
        f.listing = f.listing.copy(media = listOf(record))
        val removed = record.copy(state = "retired", available = false, cleanupPending = false)
        coEvery { f.repository.remove(any(), any(), any()) } answers {
            f.listing = f.listing.copy(media = emptyList())
            NetworkResult.Success(HomeTaskMediaRemoval(removed))
        }
        assertEquals(removed, f.access(backgroundScope).remove(record))
    }

    @Test fun a_second_mutation_cannot_overtake_a_suspended_upload() = runTest {
        val entered = CompletableDeferred<Unit>()
        val result = CompletableDeferred<NetworkResult<HomeTaskMediaUpload>>()
        coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } coAnswers {
            entered.complete(Unit)
            result.await()
        }
        val access = f.access(backgroundScope)
        val uploading = async { access.upload(f.pending) }
        entered.await()
        mediaDenied { access.remove(f.record) }
        result.complete(NetworkResult.Success(HomeTaskMediaUpload(listOf(f.record))))
        runCurrent()
        assertEquals(f.record, uploading.await())
        coVerify(exactly = 0) { f.repository.remove(any(), any(), any()) }
    }
}
