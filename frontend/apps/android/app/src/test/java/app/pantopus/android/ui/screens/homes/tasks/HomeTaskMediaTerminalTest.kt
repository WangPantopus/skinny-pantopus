@file:Suppress("MagicNumber")

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
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskMediaTerminalTest {
    private val f = HomeTaskMediaFixture()
    private lateinit var scope: CoroutineScope
    private lateinit var controller: HomeTaskMediaController
    private val retired = NetworkError.ClientError(409, """{"code":"HOME_TASK_UPLOAD_RETIRED"}""")

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
        controller.picked("chosen.txt", "text/plain", f.bytes, ticket)
        return checkNotNull(controller.state.value.pending).id
    }

    private fun removed(): String {
        val id = choose()
        coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Failure(retired)
        controller.upload(id)
        assertTrue(controller.state.value.mayAcknowledge)
        return id
    }

    @Test fun explicit_retirement_acknowledgement_clears_only_local_original_without_post_or_delete() =
        runTest {
            val id = removed()
            controller.acknowledgeRemovedUpload(f.home)
            assertEquals(id, controller.state.value.pending?.id)
            controller.acknowledgeRemovedUpload(id)
            assertNull(controller.state.value.pending)
            assertNull(controller.state.value.removedUploadId)
            assertTrue(controller.state.value.mayChoose)
            coVerify(exactly = 1) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
            coVerify(exactly = 0) { f.repository.remove(any(), any(), any()) }
        }

    @Test fun queued_old_upload_clear_and_discard_cannot_act_on_next_explicit_selection() =
        runTest {
            val old = removed()
            controller.acknowledgeRemovedUpload(old)
            val next = choose()
            assertNotEquals(old, next)
            controller.upload(old)
            controller.discardUnsent(old)
            controller.acknowledgeRemovedUpload(old)
            assertEquals(next, controller.state.value.pending?.id)
            coVerify(exactly = 1) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        }

    @Test fun unknown_or_mismatched_error_keeps_the_original_non_discardable() =
        runTest {
            val id = choose()
            for (error in listOf(
                NetworkError.Server(503, """{"code":"HOME_TASK_UPLOAD_RETIRED"}"""),
                NetworkError.ClientError(409, """{"code":"HOME_TASK_UPLOAD_CONFLICT"}"""),
                NetworkError.ClientError(408, "timeout"),
                NetworkError.ClientError(429, "rate limited"),
                NetworkError.Decoding(IllegalArgumentException("bad receipt")),
            )) {
                coEvery { f.repository.upload(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Failure(error)
                controller.upload(id)
                assertFalse(controller.state.value.mayAcknowledge)
                controller.acknowledgeRemovedUpload(id)
                controller.discardUnsent(id)
                assertEquals(id, controller.state.value.pending?.id)
            }
        }

    @Test fun an_error_from_prerequisite_get_cannot_acknowledge_a_never_sent_upload() =
        runTest {
            val id = choose()
            coEvery { f.repository.list(any(), any()) } returns NetworkResult.Failure(retired)
            controller.upload(id)
            assertFalse(controller.state.value.mayAcknowledge)
            assertNotNull(controller.state.value.pending)
            coVerify(exactly = 0) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
        }

    @Test fun acknowledgement_needs_visible_current_stored_session() =
        runTest {
            val id = removed()
            controller.close()
            controller.acknowledgeRemovedUpload(id)
            assertEquals(id, controller.state.value.pending?.id)
            controller.show()
            f.identity.storedToken = "replacement"
            controller.acknowledgeRemovedUpload(id)
            runCurrent()
            assertFalse(controller.state.value.active)
            coVerify(exactly = 1) { f.repository.upload(any(), any(), any(), any(), any(), any()) }
            coVerify(exactly = 0) { f.repository.remove(any(), any(), any()) }
        }
}
