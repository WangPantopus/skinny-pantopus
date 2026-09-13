@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class HomeTaskRecurrenceControllerTest {
    private val f = HomeTaskRecurrenceFixture()
    private lateinit var scope: CoroutineScope
    private lateinit var controller: HomeTaskRecurrenceController

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        controller = f.controller(scope)
        controller.show()
    }

    @After fun teardown() {
        controller.retire()
        scope.cancel()
        Dispatchers.resetMain()
    }

    @Test fun lost_reply_cold_retry_preserves_later_pause_and_confirmed_proof_until_review() =
        runTest {
            coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } answers {
                f.commit(arg(2))
                NetworkResult.Failure(NetworkError.Server(503, null))
            }
            controller.start()
            assertEquals(f.original, f.store.value)
            f.commit(HomeTaskRecurrenceRequest(f.id, "pause", 1))
            controller.close()
            controller = f.controller(scope)
            controller.show()
            coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } answers {
                NetworkResult.Success(f.state.copy(receipt = f.receipt(), replayed = true))
            }
            controller.retry()
            assertEquals("paused", controller.state.value.schedule?.configuration?.state)
            assertEquals(f.receipt(), f.store.value?.confirmed)
            controller.close()
            controller = f.controller(scope)
            controller.show()
            assertEquals(f.receipt(), controller.state.value.pending?.confirmed)
            controller.start()
            coVerify(exactly = 2) { f.repository.changeRecurrence(f.home, f.taskId, f.request, f.server.sessionScope) }
            controller.acknowledge()
            assertNull(f.store.value)
            assertTrue(controller.state.value.canStart)
        }

    @Test fun pause_or_account_change_during_preflight_keeps_original_without_post() =
        runTest {
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            coEvery { f.repository.getRecurrence(any(), any(), any()) } coAnswers {
                entered.complete(Unit)
                withContext(NonCancellable) { release.await() }
                NetworkResult.Success(f.state)
            }
            controller.start()
            entered.await()
            f.identity.accounts.value = f.home
            release.complete(Unit)
            runCurrent()
            assertNull(controller.state.value.task)
            assertFalse(controller.state.value.active)
            assertEquals(f.original, f.store.value)
            coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
        }

    @Test fun cancelled_durable_write_can_finish_but_cannot_dispatch_after_close() =
        runTest {
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            f.store.afterWrite = {
                entered.complete(Unit)
                withContext(NonCancellable) { release.await() }
            }
            controller.start()
            entered.await()
            controller.close()
            release.complete(Unit)
            runCurrent()
            assertEquals(f.original, f.store.value)
            assertNull(controller.state.value.pending)
            coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
            f.store.afterWrite = {}
            controller.show()
            assertEquals(f.original, controller.state.value.pending)
        }

    @Test fun close_after_post_retains_original_and_queues_current_reload() =
        runTest {
            val release = CompletableDeferred<Unit>()
            coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } coAnswers {
                val result = f.commit(arg(2))
                withContext(NonCancellable) { release.await() }
                NetworkResult.Success(result)
            }
            controller.start()
            controller.pause()
            controller.resume()
            release.complete(Unit)
            runCurrent()
            assertEquals(f.original, controller.state.value.pending)
            assertEquals("active", controller.state.value.schedule?.configuration?.state)
            assertFalse(controller.state.value.busy)
            coVerify(exactly = 1) { f.repository.changeRecurrence(any(), any(), any(), any()) }
        }

    @Test fun competing_original_during_async_preflight_is_never_sent_or_overwritten() =
        runTest {
            val other = f.original.copy(request = f.request.copy(interval = 2))
            coEvery { f.repository.getRecurrence(any(), any(), any()) } answers {
                f.store.value = other
                NetworkResult.Success(f.state)
            }
            controller.start()
            assertEquals(other, f.store.value)
            coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
        }

    @Test fun separate_controller_and_double_tap_cannot_dispatch_while_original_is_running() =
        runTest {
            val second = f.controller(scope).also { it.show() }
            val release = CompletableDeferred<Unit>()
            coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } coAnswers {
                release.await()
                NetworkResult.Success(f.commit(arg(2)))
            }
            controller.start()
            controller.start()
            second.start()
            assertNotNull(second.state.value.error)
            release.complete(Unit)
            runCurrent()
            coVerify(exactly = 1) { f.repository.changeRecurrence(any(), any(), any(), any()) }
            second.close()
        }

    @Test fun confirmation_survives_failed_final_read_and_failed_acknowledgment_clear() =
        runTest {
            coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } answers {
                val result = f.commit(arg(2))
                coEvery { f.repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
                NetworkResult.Success(result)
            }
            controller.start()
            assertEquals(f.receipt(), f.store.value?.confirmed)
            f.store.failClear = true
            coEvery { f.repository.getHomeTask(any(), any(), any()) } answers {
                NetworkResult.Success(app.pantopus.android.data.api.models.homes.HomeTaskResponse(f.task, f.server))
            }
            controller.acknowledge()
            assertEquals(f.receipt(), f.store.value?.confirmed)
            f.store.failClear = false
            controller.acknowledge()
            assertNull(f.store.value)
        }

    @Test fun failed_confirmation_write_keeps_observed_hash_through_background_and_rejects_changed_replay() =
        runTest {
            f.store.failProof = true
            controller.start()
            assertNull(f.store.value?.confirmed)
            controller.pause()
            controller.resume()
            f.store.failProof = false
            coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } answers {
                NetworkResult.Success(f.state.copy(receipt = f.receipt().copy(requestHash = "c".repeat(64)), replayed = true))
            }
            controller.retry()
            assertNull(f.store.value?.confirmed)
            assertNotNull(controller.state.value.error)
        }
}
