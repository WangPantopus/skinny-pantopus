@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskCreationAcknowledgementTest {
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

    private suspend fun terminal(): HomeTaskCreationCoordinator {
        val c = f.coordinator(lifetime)
        c.load()
        coEvery { f.repository.createHomeTaskWithReceipt(any(), any(), any()) } returns
            NetworkResult.Failure(
                NetworkError.ClientError(409, """{"code":"HOME_TASK_CREATE_RETIRED"}"""),
            )
        assertTrue(runCatching { c.submit(f.payload) }.isFailure)
        return c
    }

    @Test fun only_exact_post_terminal_status_and_code_can_enable_clear() {
        assertTrue(canClearTaskCreation(NetworkError.ClientError(400, """{"code":"HOME_RECORD_INVALID"}""")))
        assertTrue(canClearTaskCreation(NetworkError.ClientError(409, """{"code":"HOME_TASK_CREATE_RETIRED"}""")))
        for ((code, body) in listOf(
            400 to "{}",
            409 to """{"code":"HOME_TASK_CREATE_CONFLICT"}""",
            408 to """{"code":"HOME_RECORD_INVALID"}""",
            429 to """{"code":"HOME_TASK_CREATE_RETIRED"}""",
            409 to "not json",
            403 to """{"code":"HOME_TASK_CREATE_RETIRED"}""",
        )) {
            assertFalse(canClearTaskCreation(NetworkError.ClientError(code, body)))
        }
        assertFalse(canClearTaskCreation(NetworkError.Server(503, "HOME_TASK_CREATE_RETIRED")))
    }

    @Test fun clear_requires_explicit_action_and_does_not_submit_or_create_another_task() =
        runTest {
            val c = terminal()
            assertTrue(c.canClear)
            assertNotNull(f.store.read(f.scope))
            c.clearRejectedRequest()
            assertNull(c.pending)
            assertNull(f.store.read(f.scope))
            assertTrue(runCatching { c.submit(f.payload) }.isFailure)
            coVerify(exactly = 1) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }

    @Test fun clear_failure_keeps_original_and_remains_retryable() =
        runTest {
            val c = terminal()
            val original = f.store.read(f.scope)
            f.store.clearFailure = true
            assertTrue(runCatching { c.clearRejectedRequest() }.isFailure)
            assertEquals(original, f.store.read(f.scope))
            assertEquals(original, c.pending)
            assertTrue(c.canClear)
            f.store.clearFailure = false
            c.clearRejectedRequest()
            assertNull(f.store.read(f.scope))
        }

    @Test fun current_account_session_and_exact_stored_request_are_required_to_clear() =
        runTest {
            val c = terminal()
            val original = f.store.read(f.scope)
            f.identity.storedToken = "replacement"
            assertTrue(runCatching { c.clearRejectedRequest() }.isFailure)
            assertEquals(original, f.store.read(f.scope))
        }

    @Test fun a_competing_command_cannot_be_removed_by_a_previous_terminal_result() =
        runTest {
            val c = terminal()
            val replacement = checkNotNull(c.pending).copy(request = f.payload.copy(title = "Other", requestId = CREATE_HOME))
            f.store.entries[f.scope] = replacement
            assertTrue(runCatching { c.clearRejectedRequest() }.isFailure)
            assertEquals(replacement, f.store.read(f.scope))
        }

    @Test fun prerequisite_read_errors_are_not_creation_rejection_proof() =
        runTest {
            val c = f.coordinator(lifetime)
            c.load()
            coEvery { f.repository.getHomeTasks(any(), any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(400, """{"code":"HOME_RECORD_INVALID"}"""),
                )
            assertTrue(runCatching { c.submit(f.payload) }.isFailure)
            assertFalse(c.canClear)
            assertTrue(runCatching { c.clearRejectedRequest() }.isFailure)
            coVerify(exactly = 0) { f.repository.createHomeTaskWithReceipt(any(), any(), any()) }
        }
}
