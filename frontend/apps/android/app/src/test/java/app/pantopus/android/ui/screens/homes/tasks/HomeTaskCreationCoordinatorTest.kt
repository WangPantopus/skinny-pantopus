@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskCollectionCapabilitiesDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.PendingHomeTaskCreate
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskCreationCoordinatorTest {
    private lateinit var lifetime: CoroutineScope
    private lateinit var f: HomeTaskCreationTestFixture

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        lifetime = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        f = HomeTaskCreationTestFixture()
    }

    @After fun teardown() {
        lifetime.cancel()
        Dispatchers.resetMain()
    }

    private suspend fun failure(action: suspend () -> Any?) {
        var failed = false
        try {
            action()
        } catch (_: NetworkError) {
            failed = true
        } catch (_: IllegalStateException) {
            failed = true
        }
        assertTrue("The action must fail closed", failed)
    }

    @Test fun save_is_durable_before_post_and_current_returned_title_is_allowed() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            assertEquals(0, f.idsGenerated)
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } coAnswers {
                val stored = checkNotNull(f.store.read(f.scope))
                assertEquals(stored.request, secondArg())
                assertEquals(CREATE_REQUEST, stored.request.requestId)
                NetworkResult.Success(f.response)
            }
            assertEquals("Current title", c.submit(f.payload).title)
            assertNull(c.pending)
            assertNull(f.store.read(f.scope))
            failure { c.submit(f.payload) }
            coVerify(exactly = 1) { f.repository.createHomeTaskWithReceipt(CREATE_HOME, any(), f.session.sessionScope) }
        }

    @Test fun cold_reopen_reads_only_then_explicitly_retries_original_body() =
        runTest {
            val original = f.coordinator(lifetime)
            original.load()
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(503, "lost"))
            failure { original.submit(f.payload) }
            val command = checkNotNull(f.store.read(f.scope)).request
            val reopened = f.coordinator(lifetime)
            assertNotNull(reopened.load())
            coVerify(exactly = 1) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                NetworkResult.Success(f.response.copy(replayed = true))
            reopened.submit(command)
            coVerify(exactly = 2) { f.repository.createHomeTaskWithReceipt(CREATE_HOME, command, f.session.sessionScope) }
            assertEquals(1, f.idsGenerated)
        }

    @Test fun unknown_then_408_and_429_keeps_one_uuid_and_unchanged_payload() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            for (error in listOf(
                NetworkError.Transport(java.io.IOException("offline")),
                NetworkError.ClientError(408, "timeout"),
                NetworkError.ClientError(429, "later"),
                NetworkError.Decoding(IllegalArgumentException("bad response")),
            )) {
                coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns NetworkResult.Failure(error)
                failure { c.submit(f.payload) }
                assertEquals(f.payload.copy(requestId = CREATE_REQUEST), f.store.read(f.scope)?.request)
            }
            assertEquals(1, f.idsGenerated)
            failure { c.submit(f.payload.copy(title = "Changed")) }
            coVerify(exactly = 4) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }

    @Test fun failed_storage_read_never_means_empty_or_permits_post() =
        runTest {
            f.store.readFailure = true
            val c = f.coordinator(lifetime)
            failure { c.load() }
            failure { c.submit(f.payload) }
            assertEquals(0, f.idsGenerated)
            coVerify(exactly = 0) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }

    @Test fun failed_first_write_retries_same_reserved_uuid_without_posting_early() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            f.store.writeFailure = true
            failure { c.submit(f.payload) }
            coVerify(exactly = 0) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
            assertEquals(CREATE_REQUEST, c.pending?.request?.requestId)
            f.store.writeFailure = false
            c.submit(f.payload)
            assertEquals(1, f.idsGenerated)
        }

    @Test fun failed_proof_write_keeps_known_hash_and_retries_same_operation() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            f.store.proofWriteFailure = true
            failure { c.submit(f.payload) }
            assertEquals(f.receipt.payloadHash, c.pending?.payloadHash)
            assertNull(f.store.read(f.scope)?.payloadHash)
            f.store.proofWriteFailure = false
            c.submit(f.payload)
            assertNull(f.store.read(f.scope))
            assertEquals(1, f.idsGenerated)
        }

    @Test fun failed_clear_retains_exact_receipt_and_rejects_a_changed_hash() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            f.store.clearFailure = true
            failure { c.submit(f.payload) }
            val stored = f.store.read(f.scope)
            assertEquals(f.receipt.payloadHash, stored?.payloadHash)
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                NetworkResult.Success(
                    f.response.copy(creationReceipt = f.receipt.copy(payloadHash = "c".repeat(64))),
                )
            failure { c.submit(f.payload) }
            assertEquals(stored, f.store.read(f.scope))
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns NetworkResult.Success(f.response)
            f.store.clearFailure = false
            c.submit(f.payload)
            assertNull(f.store.read(f.scope))
        }

    @Test fun every_exact_receipt_binding_and_metadata_is_required() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            for (wrong in listOf(
                f.receipt.copy(homeId = CREATE_ACTOR),
                f.receipt.copy(actorId = CREATE_HOME),
                f.receipt.copy(requestId = CREATE_HOME),
                f.receipt.copy(taskId = CREATE_HOME),
                f.receipt.copy(payloadHash = "not-a-hash"),
                f.receipt.copy(createdAt = "yesterday"),
            )) {
                coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                    NetworkResult.Success(f.response.copy(creationReceipt = wrong))
                failure { c.submit(f.payload) }
                assertNotNull(f.store.read(f.scope))
            }
        }

    @Test fun response_actor_home_session_and_author_cannot_drift() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            for (wrong in listOf(
                f.response.copy(taskSession = f.session.copy(actorId = CREATE_HOME)),
                f.response.copy(taskSession = f.session.copy(homeId = CREATE_ACTOR)),
                f.response.copy(taskSession = f.session.copy(sessionScope = "c".repeat(64))),
                f.response.copy(task = f.task.copy(homeId = CREATE_ACTOR)),
                f.response.copy(task = f.task.copy(createdBy = CREATE_HOME)),
            )) {
                coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns NetworkResult.Success(wrong)
                failure { c.submit(f.payload) }
                assertNotNull(f.store.read(f.scope))
            }
        }

    @Test fun expired_current_capability_after_durable_reservation_blocks_post() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            f.store.beforeReplace = {
                coEvery { f.repository.getHomeTasks(any(), any()) } returns
                    NetworkResult.Success(
                        GetHomeTasksResponse(collectionCapabilities = HomeTaskCollectionCapabilitiesDto(false), taskSession = f.session),
                    )
            }
            failure { c.submit(f.payload) }
            assertNotNull(f.store.read(f.scope))
            coVerify(exactly = 0) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }

    @Test fun session_changes_during_storage_wait_cannot_submit_under_new_credentials() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            f.store.beforeReplace = { f.identity.storedToken = "replacement" }
            failure { c.submit(f.payload) }
            coVerify(exactly = 0) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
            assertNotNull(f.store.entries[f.scope])
        }

    @Test fun new_same_actor_session_must_explicitly_recover_saved_request() =
        runTest {
            val first = f.coordinator(lifetime)
            first.load()
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(503, "lost"))
            failure { first.submit(f.payload) }
            f.identity.tokens.value = "new-session"
            f.identity.storedToken = "new-session"
            val proof = f.session.copy(sessionScope = "d".repeat(64))
            coEvery { f.repository.getHomeTasks(any(), any()) } returns
                NetworkResult.Success(
                    GetHomeTasksResponse(collectionCapabilities = HomeTaskCollectionCapabilitiesDto(true), taskSession = proof),
                )
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                NetworkResult.Success(f.response.copy(taskSession = proof))
            val next = f.coordinator(lifetime)
            next.load()
            coVerify(exactly = 1) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
            next.submit(checkNotNull(next.pending).request)
            coVerify { f.repository.createHomeTaskWithReceipt(CREATE_HOME, f.payload.copy(requestId = CREATE_REQUEST), proof.sessionScope) }
        }

    @Test fun pending_storage_is_isolated_by_origin_actor_and_home() =
        runTest {
            val original = PendingHomeTaskCreate(f.scope, f.payload.copy(requestId = CREATE_REQUEST))
            f.store.entries[f.scope] = original
            for (scope in listOf(
                f.scope.copy(origin = "https://other.test"),
                f.scope.copy(actorId = CREATE_HOME),
                f.scope.copy(homeId = CREATE_ACTOR),
            )) {
                assertNull(f.store.read(scope))
            }
            assertEquals(original, f.store.read(f.scope))
        }

    @Test fun a_competing_form_cannot_replace_the_occupied_slot() =
        runTest {
            val first = f.coordinator(lifetime)
            val second = f.coordinator(lifetime)
            first.load()
            second.load()
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(503, "lost"))
            failure { first.submit(f.payload) }
            val stored = f.store.read(f.scope)
            failure { second.submit(f.payload.copy(title = "Other form")) }
            assertEquals(stored, f.store.read(f.scope))
            coVerify(exactly = 1) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }

    @Test fun same_turn_double_submit_is_blocked_before_second_request() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            val gate = CompletableDeferred<Unit>()
            val entered = CompletableDeferred<Unit>()
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } coAnswers {
                entered.complete(Unit)
                gate.await()
                NetworkResult.Success(f.response)
            }
            val first = async { c.submit(f.payload) }
            entered.await()
            assertNotNull(f.store.read(f.scope))
            failure { c.submit(f.payload) }
            gate.complete(Unit)
            first.await()
            coVerify(exactly = 1) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }

    @Test fun leave_during_non_cancellable_reply_does_not_clear_or_publish() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            val gate = CompletableDeferred<Unit>()
            val entered = CompletableDeferred<Unit>()
            coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } coAnswers {
                entered.complete(Unit)
                withContext(NonCancellable) { gate.await() }
                NetworkResult.Success(f.response)
            }
            var published = false
            val job =
                launch {
                    c.submit(f.payload)
                    published = true
                }
            entered.await()
            assertNotNull(f.store.read(f.scope))
            job.cancel()
            gate.complete(Unit)
            job.join()
            assertFalse(published)
            assertNotNull(f.store.read(f.scope))
        }

    @Test fun leave_after_proof_persistence_keeps_receipt_before_cleanup() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            var writes = 0
            f.store.beforeReplace = {
                writes++
                if (writes == 2) currentCoroutineContext()[Job]?.cancel()
            }
            var published = false
            val job =
                launch {
                    c.submit(f.payload)
                    published = true
                }
            job.join()
            assertFalse(published)
            assertEquals(2, writes)
            assertEquals(f.receipt.payloadHash, f.store.read(f.scope)?.payloadHash)
        }
}
