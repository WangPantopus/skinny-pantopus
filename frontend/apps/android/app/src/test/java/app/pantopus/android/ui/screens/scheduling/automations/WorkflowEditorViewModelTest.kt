@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.GetWorkflowsResponse
import app.pantopus.android.data.api.models.scheduling.WorkflowDto
import app.pantopus.android.data.api.models.scheduling.WorkflowResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WorkflowEditorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(id: String) = WorkflowEditorViewModel(SavedStateHandle(mapOf(SchedulingRoutes.ARG_WORKFLOW_ID to id)), repo, errors)

    private fun loaded(vm: WorkflowEditorViewModel) = vm.state.value as WorkflowEditorUiState.Loaded

    @Test
    fun `new has sensible preset and blocks save until message`() =
        runTest(dispatcher) {
            val vm = vm("new")
            vm.start()
            advanceUntilIdle()
            val l = loaded(vm)
            assertEquals(WorkflowTrigger.BeforeStart, l.form.trigger)
            assertEquals(60, l.form.offsetMinutes)
            assertEquals(WorkflowChannel.Email, l.form.channel)
            assertFalse(l.canSave)

            vm.save()
            advanceUntilIdle()
            assertFalse(vm.saved.value)
            assertTrue(loaded(vm).didAttemptSave)
        }

    @Test
    fun `save new posts workflow`() =
        runTest(dispatcher) {
            coEvery { repo.createWorkflow(any(), any()) } returns
                NetworkResult.Success(
                    WorkflowResponse(
                        WorkflowDto(
                            id = "w9",
                            name = "Email attendees",
                            trigger = "before_start",
                            action = "email",
                            offsetMinutes = 60,
                            isActive = true,
                        ),
                    ),
                )
            val vm = vm("new")
            vm.start()
            advanceUntilIdle()
            vm.onMessage("Hi {{attendee_name}}, see you soon.")
            assertTrue(loaded(vm).canSave)

            vm.save()
            advanceUntilIdle()
            assertTrue(vm.saved.value)
            coVerify { repo.createWorkflow(any(), any()) }
        }

    @Test
    fun `load existing populates fields`() =
        runTest(dispatcher) {
            coEvery { repo.getWorkflows(any()) } returns
                NetworkResult.Success(
                    GetWorkflowsResponse(
                        listOf(
                            WorkflowDto(
                                id = "w1", name = "Thanks", trigger = "after_end", action = "email",
                                offsetMinutes = 120, messageTemplate = "Thanks!", isActive = false, eventTypeId = null,
                            ),
                        ),
                    ),
                )
            val vm = vm("w1")
            vm.start()
            advanceUntilIdle()
            val form = loaded(vm).form
            assertEquals(WorkflowTrigger.AfterEnd, form.trigger)
            assertEquals(120, form.offsetMinutes)
            assertEquals("Thanks!", form.message)
            assertFalse(form.isActive)
        }

    @Test
    fun `load missing workflow errors`() =
        runTest(dispatcher) {
            coEvery { repo.getWorkflows(any()) } returns NetworkResult.Success(GetWorkflowsResponse(emptyList()))
            val vm = vm("nope")
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is WorkflowEditorUiState.Error)
        }
}
