@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

@OptIn(ExperimentalCoroutinesApi::class)
class MaintenanceDetailViewModelTest {
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

    private fun makeVm(taskId: String = "task-1"): MaintenanceDetailViewModel =
        MaintenanceDetailViewModel(
            repo = repo,
            draftStore = store,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        MAINTENANCE_DETAIL_HOME_ID_KEY to "home-1",
                        MAINTENANCE_DETAIL_TASK_ID_KEY to taskId,
                    ),
                ),
        )

    private fun task(
        id: String,
        title: String = "Fall HVAC tune-up",
        vendor: String? = "Riverside HVAC",
        cost: BigDecimal? = BigDecimal("185"),
        recurrence: String = "yearly",
        dueDate: String? = "2026-11-01",
        status: String = "completed",
    ): MaintenanceTaskDto =
        MaintenanceTaskDto(
            id = id,
            homeId = "home-1",
            task = title,
            vendor = vendor,
            cost = cost,
            recurrence = recurrence,
            dueDate = dueDate,
            status = status,
        )

    // MARK: - Loaded states

    @Test
    fun `load returns Loaded for an existing task`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = listOf(task("task-1"))))
            val vm = makeVm("task-1")
            vm.load()
            val state = vm.state.value
            assertTrue(state is MaintenanceDetailUiState.Loaded)
            assertEquals("task-1", (state as MaintenanceDetailUiState.Loaded).task.id)
        }

    @Test
    fun `load merges draft store photos and receipt`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = listOf(task("task-2"))))
            store.upsert(
                "task-2",
                MaintenanceDraft(
                    category = MaintenanceCategory.Hvac,
                    performedBy = MaintenancePerformedBy.Contractor,
                    performerName = "Riverside HVAC",
                    notes = "Replaced filter, topped off coolant.",
                    photos =
                        listOf(
                            MaintenanceDraftFile(filename = "a.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(0)),
                            MaintenanceDraftFile(filename = "b.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(1)),
                        ),
                    receipt = MaintenanceDraftFile(filename = "receipt.pdf", mimeType = "application/pdf", bytes = byteArrayOf(2)),
                ),
            )
            val vm = makeVm("task-2")
            vm.load()
            val loaded = vm.state.value as MaintenanceDetailUiState.Loaded
            assertNotNull(loaded.draft)
            assertEquals(2, loaded.draft!!.photos.size)
            assertEquals("receipt.pdf", loaded.draft.receipt?.filename)
        }

    // MARK: - Error states

    @Test
    fun `load returns Error when task is missing`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = emptyList()))
            val vm = makeVm("missing")
            vm.load()
            val state = vm.state.value
            assertTrue(state is MaintenanceDetailUiState.Error)
            assertTrue((state as MaintenanceDetailUiState.Error).message.contains("no longer available"))
        }

    @Test
    fun `load returns Error when server fails`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm("task-3")
            vm.load()
            assertTrue(vm.state.value is MaintenanceDetailUiState.Error)
        }

    // MARK: - Delete

    @Test
    fun `delete clears draft store and emits Deleted event`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = listOf(task("task-3"))))
            coEvery { repo.deleteHomeMaintenance("home-1", "task-3") } returns
                NetworkResult.Success(Unit)
            store.upsert(
                "task-3",
                MaintenanceDraft(category = MaintenanceCategory.Pest, performerName = "Brooklyn Pest Co."),
            )
            val vm = makeVm("task-3")
            vm.load()
            assertNotNull(store.draft("task-3"))

            vm.delete()
            assertNull(store.draft("task-3"))
            assertEquals(MaintenanceDetailEvent.Deleted, vm.event.value)
            assertNull(vm.actionError.value)
        }

    @Test
    fun `delete surfaces server error and does not emit event`() =
        runTest {
            coEvery { repo.getHomeMaintenance("home-1", null) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = listOf(task("task-4"))))
            coEvery { repo.deleteHomeMaintenance("home-1", "task-4") } returns
                NetworkResult.Failure(NetworkError.Forbidden)
            val vm = makeVm("task-4")
            vm.load()
            vm.delete()
            assertNull(vm.event.value)
            assertEquals(NetworkError.Forbidden.message, vm.actionError.value)
        }
}
