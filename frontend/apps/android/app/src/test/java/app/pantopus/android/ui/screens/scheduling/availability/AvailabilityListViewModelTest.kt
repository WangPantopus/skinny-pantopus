@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.availability

import app.cash.turbine.test
import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityScheduleDto
import app.pantopus.android.data.api.models.scheduling.GetAvailabilityResponse
import app.pantopus.android.data.api.models.scheduling.ScheduleResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AvailabilityListViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<app.pantopus.android.data.scheduling.SchedulingRepository>(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = AvailabilityListViewModel(repo, errors)

    private fun schedule(
        id: String,
        name: String,
        isDefault: Boolean = false,
        tz: String = "America/Los_Angeles",
    ) = AvailabilityScheduleDto(id = id, name = name, timezone = tz, isDefault = isDefault)

    private fun weekRules(scheduleId: String) =
        (1..5).map { AvailabilityRuleDto(scheduleId = scheduleId, weekday = it, startTime = "09:00", endTime = "17:00") }

    @Test
    fun `load with no schedules yields Empty`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertEquals(AvailabilityListUiState.Empty, vm.state.value)
        }

    @Test
    fun `load builds rows with derived summary and timezone`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns
                NetworkResult.Success(
                    GetAvailabilityResponse(
                        schedules = listOf(schedule("s1", "Working hours", isDefault = true)),
                        rules = weekRules("s1"),
                    ),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val loaded = vm.state.value as AvailabilityListUiState.Loaded
            assertEquals(1, loaded.schedules.size)
            val row = loaded.schedules.first()
            assertEquals("Mon–Fri, 9:00 AM – 5:00 PM", row.summary)
            assertEquals("Los Angeles", row.timezone)
            assertTrue(row.isDefault)
        }

    @Test
    fun `load failure yields Error`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is AvailabilityListUiState.Error)
        }

    @Test
    fun `addSchedule creates and opens the editor`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            coEvery { repo.createSchedule(any()) } returns
                NetworkResult.Success(ScheduleResponse(schedule("new", "New schedule")))
            val vm = vm()
            vm.events.test {
                vm.addSchedule()
                advanceUntilIdle()
                assertEquals(AvailabilityListEvent.OpenEditor("new"), awaitItem())
            }
            coVerify { repo.createSchedule(any()) }
        }

    @Test
    fun `setAsDefault updates the schedule`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            coEvery { repo.updateSchedule(any(), any()) } returns
                NetworkResult.Success(ScheduleResponse(schedule("s2", "Evenings", isDefault = true)))
            val vm = vm()
            vm.setAsDefault("s2")
            advanceUntilIdle()
            coVerify { repo.updateSchedule("s2", match { it.isDefault == true }) }
        }

    @Test
    fun `delete default raises the reassign prompt`() =
        runTest(dispatcher) {
            coEvery { repo.deleteSchedule("s1") } returns
                NetworkResult.Failure(NetworkError.ClientError(409, """{"error":"CANNOT_DELETE_DEFAULT","message":"x"}"""))
            val vm = vm()
            vm.events.test {
                vm.delete("s1")
                advanceUntilIdle()
                assertEquals(AvailabilityListEvent.ReassignNeeded("s1"), awaitItem())
            }
        }

    @Test
    fun `delete success reloads`() =
        runTest(dispatcher) {
            coEvery { repo.deleteSchedule("s1") } returns NetworkResult.Success(SchedulingOkResponse())
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            val vm = vm()
            vm.delete("s1")
            advanceUntilIdle()
            coVerify { repo.deleteSchedule("s1") }
            coVerify { repo.getAvailability() }
        }
}
