@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskMediaRemoval
import app.pantopus.android.data.api.models.homes.HomeTaskMediaUpload
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskMediaBytes
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskMediaControllerTest {
    private val f = HomeTaskMediaFixture()
    private lateinit var scope: CoroutineScope
    private lateinit var controller: HomeTaskMediaController

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        controller = HomeTaskMediaController(f.access(scope), scope)
        controller.show()
    }

    @After fun teardown() {
        controller.retire()
        scope.cancel()
        Dispatchers.resetMain()
    }

    private fun choose(): String {
        val ticket = checkNotNull(controller.beginPick())
        controller.picked("住所-é.txt", "text/plain", f.bytes, ticket)
        return checkNotNull(controller.state.value.pending).id
    }

    @Test fun unknown_upload_retains_original_id_and_bytes_across_reopen_and_timeout_retries() =
        runTest {
            val id = choose()
            val sent = mutableListOf<ByteArray>()
            for (status in listOf(503, 408, 429)) {
                coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } answers {
                    sent += arg<ByteArray>(5).copyOf()
                    NetworkResult.Failure(NetworkError.ClientError(status, "unconfirmed"))
                }
                controller.upload(id)
                assertEquals(id, controller.state.value.pending?.id)
                assertTrue(controller.state.value.mayRetryUpload)
                assertFalse(controller.state.value.mayDiscard)
                assertNull(controller.state.value.notice)
                controller.close()
                controller.show()
                assertEquals(id, controller.state.value.pending?.id)
            }
            assertEquals(3, sent.size)
            sent.forEach { assertArrayEquals(f.bytes, it) }
            coVerify(exactly = 3) { f.repository.upload(any(), f.task, id, any(), "text/plain", any()) }
        }

    @Test fun successful_receipt_clears_original_and_same_turn_second_upload_cannot_repeat() =
        runTest {
            val id = choose()
            controller.upload(id)
            controller.upload(id)
            assertNull(controller.state.value.pending)
            assertEquals("Private attachment saved.", controller.state.value.notice)
            coVerify(exactly = 1) { f.repository.upload(any(), any(), id, any(), any(), any()) }
        }

    @Test fun suspended_upload_blocks_double_tap_and_keeps_unknown_after_background() =
        runTest {
            val id = choose()
            val reply = CompletableDeferred<NetworkResult<HomeTaskMediaUpload>>()
            val entered = CompletableDeferred<Unit>()
            coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } coAnswers {
                entered.complete(Unit)
                withContext(NonCancellable) { reply.await() }
            }
            controller.upload(id)
            entered.await()
            controller.upload(id)
            controller.pause()
            controller.resume()
            val saved = f.record.copy(id = id, fileName = "task-attachment-$id.txt")
            f.listing = f.listing.copy(media = listOf(saved))
            reply.complete(NetworkResult.Success(HomeTaskMediaUpload(listOf(saved))))
            runCurrent()
            assertEquals(id, controller.state.value.pending?.id)
            assertNull(controller.state.value.notice)
            assertEquals(saved, controller.state.value.media.single())
            coVerify(exactly = 1) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        }

    @Test fun system_picker_pause_preserves_only_the_original_live_picker_ticket() =
        runTest {
            val ticket = checkNotNull(controller.beginPick())
            controller.pause()
            controller.resume()
            controller.picked("chosen.txt", "text/plain", f.bytes, ticket)
            assertNotNull(controller.state.value.pending)
            coVerify(exactly = 0) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        }

    @Test fun a_picker_result_after_actual_close_or_another_selection_is_ignored() =
        runTest {
            val old = checkNotNull(controller.beginPick())
            controller.close()
            controller.show()
            controller.picked("old.txt", "text/plain", f.bytes, old)
            assertNull(controller.state.value.pending)
            val current = choose()
            controller.discardUnsent(current)
            controller.reload()
            controller.picked("old.txt", "text/plain", f.bytes, old)
            assertNull(controller.state.value.pending)
        }

    @Test fun unpublished_session_replacement_cannot_populate_a_picker_result() =
        runTest {
            val ticket = checkNotNull(controller.beginPick())
            f.identity.storedToken = "replacement"
            controller.picked("old.txt", "text/plain", f.bytes, ticket)
            runCurrent()
            assertNull(controller.state.value.pending)
            assertTrue(controller.state.value.media.isEmpty())
        }

    @Test fun selected_bytes_are_copied_before_any_caller_changes_them() =
        runTest {
            val input = f.bytes.copyOf()
            val ticket = checkNotNull(controller.beginPick())
            controller.picked("chosen.txt", "text/plain", input, ticket)
            input.fill(0)
            var sent: ByteArray? = null
            coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } answers {
                sent = arg<ByteArray>(5).copyOf()
                NetworkResult.Failure(NetworkError.Server(503, "unconfirmed"))
            }
            controller.upload(checkNotNull(controller.state.value.pending).id)
            assertArrayEquals(f.bytes, sent)
        }

    @Test fun current_denial_clears_an_open_preview_and_prior_metadata() =
        runTest {
            controller.open(f.record)
            assertNotNull(controller.state.value.preview)
            coEvery { f.tasks.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            controller.reload()
            assertNull(controller.state.value.preview)
            assertTrue(controller.state.value.media.isEmpty())
            assertFalse(controller.state.value.mayChoose)
        }

    @Test fun a_late_download_cannot_restore_bytes_after_dialog_departure() =
        runTest {
            val reply = CompletableDeferred<NetworkResult<HomeTaskMediaBytes>>()
            val entered = CompletableDeferred<Unit>()
            coEvery { f.repository.download(any(), any(), any()) } coAnswers {
                entered.complete(Unit)
                withContext(NonCancellable) { reply.await() }
            }
            controller.open(f.record)
            entered.await()
            controller.close()
            val data = f.bytes.copyOf()
            reply.complete(NetworkResult.Success(HomeTaskMediaBytes(data, "text/plain")))
            runCurrent()
            assertNull(controller.state.value.preview)
            assertFalse(controller.state.value.visible)
            assertArrayEquals(ByteArray(data.size), data)
        }

    @Test fun unknown_removal_retries_only_its_original_retired_attachment() =
        runTest {
            coEvery { f.repository.remove(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, "unconfirmed"))
            controller.remove(f.record)
            assertEquals(f.record, controller.state.value.removing)
            val removed = f.record.copy(state = "retired", available = false, cleanupPending = false)
            coEvery { f.repository.remove(any(), any(), any()) } answers {
                f.listing = f.listing.copy(media = listOf(removed))
                NetworkResult.Success(HomeTaskMediaRemoval(removed))
            }
            controller.retryRemoval(f.home)
            controller.retryRemoval(f.uploadId)
            assertNull(controller.state.value.removing)
            assertEquals("Attachment removed. Its history remains.", controller.state.value.notice)
            coVerify(exactly = 2) { f.repository.remove(f.server, f.task, f.uploadId) }
        }

    @Test fun reopened_reservation_and_pending_cleanup_offer_removal_without_uploading() =
        runTest {
            for (record in listOf(
                f.record.copy(state = "reserved", available = false),
                f.record.copy(state = "retired", available = false, cleanupPending = true),
            )) {
                f.listing = f.listing.copy(media = listOf(record))
                controller.reload()
                assertTrue(controller.state.value.mayRemove(record))
            }
            val complete = f.record.copy(state = "retired", available = false, cleanupPending = false)
            f.listing = f.listing.copy(media = listOf(complete))
            controller.reload()
            assertFalse(controller.state.value.mayRemove(complete))
            coVerify(exactly = 0) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        }
}
