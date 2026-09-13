@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskAutomaticRecurrence
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceReceipt
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

class HomeTaskRecurrenceBoundaryTest {
    private lateinit var scope: CoroutineScope

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    }

    @After fun teardown() {
        scope.cancel()
        Dispatchers.resetMain()
    }

    @Test fun only_definitive_post_rejection_can_be_acknowledged() =
        runTest {
            for ((status, code, allowed) in listOf(
                Triple(409, "HOME_TASK_RECURRENCE_STALE", true),
                Triple(400, "HOME_RECORD_INVALID", true),
                Triple(409, "HOME_TASK_RECURRENCE_CONFLICT", false),
                Triple(429, "HOME_RECORD_INVALID", false),
                Triple(408, "HOME_RECORD_INVALID", false),
            )) {
                val f = HomeTaskRecurrenceFixture()
                val controller = f.controller(scope).also { it.show() }
                coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } returns
                    NetworkResult.Failure(NetworkError.ClientError(status, """{"code":"$code"}"""))
                controller.start()
                assertEquals(allowed, controller.state.value.canDismiss)
                controller.acknowledge()
                assertEquals(allowed, f.store.value == null)
                coVerify(exactly = 1) { f.repository.changeRecurrence(any(), any(), any(), any()) }
                controller.close()
            }
        }

    @Test fun unreadable_or_unwritable_protected_storage_cannot_send_new_request() =
        runTest {
            for (unreadable in listOf(true, false)) {
                val f = HomeTaskRecurrenceFixture()
                val controller = f.controller(scope).also { it.show() }
                f.store.failRead = unreadable
                f.store.failWrite = !unreadable
                controller.start()
                assertNotNull(controller.state.value.error)
                coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
                controller.close()
            }
        }

    @Test fun current_denial_or_management_loss_clears_visible_source_and_blocks_post() =
        runTest {
            for (denied in listOf(true, false)) {
                val f = HomeTaskRecurrenceFixture()
                val controller = f.controller(scope).also { it.show() }
                coEvery { f.repository.getRecurrence(any(), any(), any()) } returns
                    if (denied) NetworkResult.Failure(NetworkError.Forbidden) else NetworkResult.Success(f.state.copy(canManage = false))
                controller.start()
                assertNull(controller.state.value.task)
                assertNull(controller.state.value.schedule)
                coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
                controller.close()
            }
        }

    @Test fun changed_source_timestamp_cannot_enable_start() =
        runTest {
            val f = HomeTaskRecurrenceFixture()
            f.state = f.state.copy(taskUpdatedAt = "2026-09-10T12:00:01Z")
            val controller = f.controller(scope).also { it.show() }
            assertFalse(controller.state.value.canStart)
            assertNull(controller.state.value.task)
            controller.start()
            coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
            controller.close()
        }

    @Test fun malformed_or_mismatched_receipts_never_confirm_original() =
        runTest {
            val changes: List<(HomeTaskRecurrenceReceipt) -> HomeTaskRecurrenceReceipt> =
                listOf(
                    { it.copy(actorId = it.homeId) },
                    { it.copy(taskId = it.homeId) },
                    { it.copy(homeId = it.taskId) },
                    { it.copy(requestId = it.taskId) },
                    { it.copy(action = "pause") },
                    { it.copy(revision = 99) },
                    { it.copy(requestHash = "invalid") },
                    { it.copy(createdAt = "invalid") },
                )
            for (change in changes) {
                val f = HomeTaskRecurrenceFixture()
                val controller = f.controller(scope).also { it.show() }
                coEvery { f.repository.changeRecurrence(any(), any(), any(), any()) } answers {
                    NetworkResult.Success(f.commit().copy(receipt = change(f.receipt())))
                }
                controller.start()
                assertEquals(f.original, f.store.value)
                assertNotNull(controller.state.value.error)
                controller.close()
            }
        }

    @Test fun schedule_and_session_mismatch_never_render_or_authorize() =
        runTest {
            for (wrongSession in listOf(true, false)) {
                val f = HomeTaskRecurrenceFixture()
                f.state =
                    if (wrongSession) {
                        f.state.copy(taskSession = f.server.copy(sessionScope = "b".repeat(64)))
                    } else {
                        f.state.copy(taskId = f.home)
                    }
                val controller = f.controller(scope).also { it.show() }
                assertNull(controller.state.value.task)
                assertFalse(controller.state.value.canStart)
                controller.close()
            }
        }

    @Test fun unpublished_credential_replacement_during_protected_read_cannot_publish_private_source() =
        runTest {
            val f = HomeTaskRecurrenceFixture()
            val controller = f.controller(scope).also { it.show() }
            f.store.beforeRead = { f.identity.storedToken = "unpublished-replacement" }
            controller.reload()
            assertNull(controller.state.value.task)
            assertFalse(controller.state.value.active)
            controller.start()
            coVerify(exactly = 0) { f.repository.changeRecurrence(any(), any(), any(), any()) }
            controller.close()
        }

    @Test fun actual_schedule_filter_and_chip_do_not_require_legacy_rule() {
        val f = HomeTaskRecurrenceFixture()
        val automatic = HomeTaskAutomaticRecurrence("active", "MONTHLY", 2, "UTC", "2026-11-10T12:00:00Z")
        val task = f.task.copy(automaticRecurrence = automatic)
        assertTrue(automatic.valid())
        assertTrue(HouseholdTasksListViewModel.passes(task, HouseholdTasksTab.Recurring, Instant.now()))
        assertEquals("Repeats every 2 months", automatic.label())
        assertFalse(automatic.copy(nextDueAt = null).valid())
        assertFalse(automatic.copy(state = "paused").valid())
        assertFalse(automatic.copy(frequency = "HOURLY").valid())
        assertFalse(automatic.copy(timezone = "bad-zone").valid())
        assertEquals("Repeats paused", automatic.copy(state = "paused", nextDueAt = null).label())
    }
}
