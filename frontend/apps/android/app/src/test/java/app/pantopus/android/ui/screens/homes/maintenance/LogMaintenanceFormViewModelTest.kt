@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.CreateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.HomeEventResponse
import app.pantopus.android.data.api.models.homes.HomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
import java.math.BigDecimal
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class LogMaintenanceFormViewModelTest {
    private val repo: HomesRepository = mockk(relaxUnitFun = true)
    private val store = MaintenanceDraftStore()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        store.clear()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeCreateVm(): LogMaintenanceFormViewModel =
        LogMaintenanceFormViewModel(
            repo = repo,
            draftStore = store,
            savedStateHandle = SavedStateHandle(mapOf(LOG_MAINTENANCE_HOME_ID_KEY to "home-1")),
        )

    private fun makeEditVm(taskId: String): LogMaintenanceFormViewModel =
        LogMaintenanceFormViewModel(
            repo = repo,
            draftStore = store,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        LOG_MAINTENANCE_HOME_ID_KEY to "home-1",
                        LOG_MAINTENANCE_TASK_ID_KEY to taskId,
                    ),
                ),
        )

    // MARK: - Minimal state

    @Test
    fun `minimal initial state disables submit and is not dirty`() {
        val vm = makeCreateVm()
        assertEquals("", vm.form.value.title)
        assertFalse(vm.form.value.canSubmit)
        assertFalse(vm.isDirty.value)
        assertEquals("Log maintenance", vm.screenTitle)
        assertEquals("Log", vm.submitLabel)
        assertEquals(LogMaintenanceFormState.MAX_PHOTOS, vm.form.value.photoSlots().size)
    }

    @Test
    fun `typing title enables submit and marks dirty`() {
        val vm = makeCreateVm()
        vm.updateTitle("Fall HVAC tune-up")
        assertTrue(vm.form.value.canSubmit)
        assertTrue(vm.isDirty.value)
    }

    // MARK: - Full submit

    @Test
    fun `full submit posts maintenance and calendar event then emits Created`() =
        runTest {
            val maintenanceRequest = slot<CreateMaintenanceRequest>()
            val eventRequest = slot<CreateHomeEventRequest>()
            coEvery { repo.createHomeMaintenance("home-1", capture(maintenanceRequest)) } returns
                NetworkResult.Success(
                    HomeMaintenanceResponse(
                        task = makeTask(id = "task-new", taskTitle = "Fall HVAC tune-up"),
                    ),
                )
            coEvery { repo.createHomeEvent("home-1", capture(eventRequest)) } returns
                NetworkResult.Success(
                    HomeEventResponse(
                        event =
                            CalendarEventDto(
                                id = "ev-1",
                                homeId = "home-1",
                                eventType = "maintenance",
                                title = "Fall HVAC tune-up",
                                startAt = "2026-11-01T00:00:00Z",
                            ),
                    ),
                )
            val vm = makeCreateVm()
            vm.updateCategory(MaintenanceCategory.Hvac)
            vm.updateTitle("Fall HVAC tune-up")
            vm.updatePerformedBy(MaintenancePerformedBy.Contractor)
            vm.updatePerformerName("Riverside HVAC")
            vm.updatePerformerContact("555-0142")
            vm.updateCost("185")
            vm.updateNotes("Replaced filter, topped off coolant.")
            vm.toggleNextDue(true)
            vm.updateNextDueDate(Instant.parse("2026-11-01T00:00:00Z"))
            vm.updateRecurrence(MaintenanceRecurrence.Yearly)
            assertTrue(vm.form.value.canSubmit)

            vm.submit()

            val event = vm.event.value
            assertTrue(event is LogMaintenanceFormEvent.Created)
            assertEquals("task-new", (event as LogMaintenanceFormEvent.Created).taskId)
            assertEquals(BigDecimal("185"), maintenanceRequest.captured.cost)
            assertEquals("yearly", maintenanceRequest.captured.recurrence)
            assertEquals("completed", maintenanceRequest.captured.status)
            assertEquals("2026-11-01", maintenanceRequest.captured.dueDate)
            assertEquals("maintenance", eventRequest.captured.eventType)
            // Local draft was persisted with the extras that backend doesn't store.
            val draft = store.draft("task-new")
            assertNotNull(draft)
            assertEquals(MaintenanceCategory.Hvac, draft!!.category)
            assertEquals(MaintenancePerformedBy.Contractor, draft.performedBy)
            assertEquals("Riverside HVAC", draft.performerName)
            assertEquals("555-0142", draft.performerContact)
            assertEquals("Replaced filter, topped off coolant.", draft.notes)
        }

    @Test
    fun `submit surfaces server error and does not emit Created`() =
        runTest {
            coEvery { repo.createHomeMaintenance(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeCreateVm()
            vm.updateTitle("Fall HVAC tune-up")
            vm.submit()
            assertNull(vm.event.value)
            // `NetworkError.Server.message` is "Server error 500. Please try again."
            assertNotNull(vm.form.value.submitError)
        }

    // MARK: - With photos

    @Test
    fun `addPhoto caps photos at four and respects remove`() {
        val vm = makeCreateVm()
        repeat(5) { i ->
            vm.addPhoto(MaintenanceDraftFile(filename = "p$i.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(i.toByte())))
        }
        assertEquals(LogMaintenanceFormState.MAX_PHOTOS, vm.form.value.photos.size)
        val removeId = vm.form.value.photos.first().id
        vm.removePhoto(removeId)
        assertEquals(3, vm.form.value.photos.size)
    }

    // MARK: - With next-due (calendar reminder)

    @Test
    fun `submit without next-due does not call calendar endpoint`() =
        runTest {
            coEvery { repo.createHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(
                    HomeMaintenanceResponse(task = makeTask(id = "task-2", taskTitle = "Filter swap")),
                )
            val vm = makeCreateVm()
            vm.updateTitle("Filter swap")
            vm.toggleNextDue(false)
            vm.submit()
            coVerify(exactly = 0) { repo.createHomeEvent(any(), any()) }
        }

    // MARK: - Edit mode

    @Test
    fun `edit mode loadIfNeeded pre-fills fields from existing task`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Success(
                    GetHomeMaintenanceResponse(
                        tasks =
                            listOf(
                                makeTask(
                                    id = "task-edit",
                                    taskTitle = "Quarterly pest treatment",
                                    vendor = "Brooklyn Pest Co.",
                                    cost = BigDecimal("120"),
                                    recurrence = "quarterly",
                                    dueDate = "2026-08-01",
                                    status = "scheduled",
                                ),
                            ),
                    ),
                )
            val vm = makeEditVm("task-edit")
            assertEquals("Edit maintenance", vm.screenTitle)
            assertEquals("Save", vm.submitLabel)
            vm.loadIfNeeded()
            assertEquals("Quarterly pest treatment", vm.form.value.title)
            assertEquals("Brooklyn Pest Co.", vm.form.value.performerName)
            assertEquals(MaintenanceRecurrence.Quarterly, vm.form.value.recurrence)
            assertTrue(vm.form.value.nextDueEnabled)
            // Loading an existing task isn't a dirty edit.
            assertFalse(vm.isDirty.value)
        }

    // MARK: - Cost parsing helpers

    @Test
    fun `parseCost handles empty decimals and currency chars`() {
        assertNull(LogMaintenanceFormViewModel.parseCost(""))
        assertNull(LogMaintenanceFormViewModel.parseCost("   "))
        assertEquals(BigDecimal("185"), LogMaintenanceFormViewModel.parseCost("185"))
        assertEquals(BigDecimal("185"), LogMaintenanceFormViewModel.parseCost("$185"))
        assertEquals(BigDecimal("1250.75"), LogMaintenanceFormViewModel.parseCost("1,250.75"))
    }

    @Test
    fun `formatDay returns ISO yyyy-MM-dd`() {
        val day = LogMaintenanceFormViewModel.formatDay(Instant.parse("2026-11-01T08:00:00Z"))
        assertEquals("2026-11-01", day)
    }

    // MARK: - Helpers

    private fun makeTask(
        id: String,
        taskTitle: String,
        vendor: String? = null,
        cost: BigDecimal? = null,
        recurrence: String = "one_time",
        dueDate: String? = null,
        status: String = "completed",
    ): MaintenanceTaskDto =
        MaintenanceTaskDto(
            id = id,
            homeId = "home-1",
            task = taskTitle,
            vendor = vendor,
            cost = cost,
            recurrence = recurrence,
            dueDate = dueDate,
            status = status,
        )
}
