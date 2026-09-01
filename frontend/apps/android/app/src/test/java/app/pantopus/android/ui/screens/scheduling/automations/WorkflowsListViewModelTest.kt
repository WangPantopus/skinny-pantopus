@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.GetWorkflowsResponse
import app.pantopus.android.data.api.models.scheduling.WorkflowDto
import app.pantopus.android.data.api.models.scheduling.WorkflowResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
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
class WorkflowsListViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = WorkflowsListViewModel(
        repo,
        errors,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    private val page = BookingPageResponse(BookingPageDto(id = "p1", reminderMinutes = listOf(1440, 60)))

    @Test
    fun `route owner args flow into the editor route builders`() {
        val vm = vm(ownerKind = "business", ownerId = "biz-1")
        assertEquals("scheduling/workflows/new?ownerKind=business&ownerId=biz-1", vm.createWorkflowRoute())
        assertEquals("scheduling/workflows/w1?ownerKind=business&ownerId=biz-1", vm.workflowRoute("w1"))
    }

    @Test
    fun `load empty keeps the reminders summary`() =
        runTest(dispatcher) {
            coEvery { repo.getWorkflows(any()) } returns NetworkResult.Success(GetWorkflowsResponse(emptyList()))
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page)
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val loaded = vm.state.value as WorkflowsListUiState.Loaded
            assertTrue(loaded.visible(WorkflowsListViewModel.Scope.Global).isEmpty())
            assertEquals("1 day + 1 hour before · Push", loaded.remindersSummary)
        }

    @Test
    fun `load splits global and event-type scope`() =
        runTest(dispatcher) {
            coEvery { repo.getWorkflows(any()) } returns
                NetworkResult.Success(
                    GetWorkflowsResponse(
                        listOf(
                            WorkflowDto(
                                id = "w1",
                                name = "Email attendees",
                                trigger = "booking_created",
                                action = "email",
                                offsetMinutes = 0,
                                isActive = true,
                                eventTypeId = null,
                            ),
                            WorkflowDto(
                                id = "w2",
                                name = "Reminder",
                                trigger = "before_start",
                                action = "push",
                                offsetMinutes = 60,
                                isActive = false,
                                eventTypeId = "et1",
                            ),
                        ),
                    ),
                )
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page)
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val loaded = vm.state.value as WorkflowsListUiState.Loaded
            assertEquals(1, loaded.globalWorkflows.size)
            assertEquals(1, loaded.scopedWorkflows.size)
            assertEquals("w1", loaded.visible(WorkflowsListViewModel.Scope.Global).first().id)
        }

    @Test
    fun `forbidden load gates`() =
        runTest(dispatcher) {
            coEvery { repo.getWorkflows(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val error = vm.state.value as WorkflowsListUiState.Error
            assertTrue(error.gated)
        }

    @Test
    fun `toggle active flips the row`() =
        runTest(dispatcher) {
            val active =
                WorkflowDto(
                    id = "w1",
                    name = "Email",
                    trigger = "booking_created",
                    action = "email",
                    offsetMinutes = 0,
                    isActive = true,
                    eventTypeId = null,
                )
            coEvery { repo.getWorkflows(any()) } returns NetworkResult.Success(GetWorkflowsResponse(listOf(active)))
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page)
            coEvery { repo.updateWorkflow(any(), any(), any()) } returns
                NetworkResult.Success(WorkflowResponse(active.copy(isActive = false)))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val row = (vm.state.value as WorkflowsListUiState.Loaded).visible(WorkflowsListViewModel.Scope.Global).first()
            assertTrue((vm.state.value as WorkflowsListUiState.Loaded).isActive(row))
            vm.toggleActive(row)
            advanceUntilIdle()
            val updated = (vm.state.value as WorkflowsListUiState.Loaded).visible(WorkflowsListViewModel.Scope.Global).first()
            assertFalse((vm.state.value as WorkflowsListUiState.Loaded).isActive(updated))
        }
}
