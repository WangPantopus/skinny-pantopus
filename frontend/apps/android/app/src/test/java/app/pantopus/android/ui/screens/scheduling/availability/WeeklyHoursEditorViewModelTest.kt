@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityScheduleDto
import app.pantopus.android.data.api.models.scheduling.GetAvailabilityResponse
import app.pantopus.android.data.api.models.scheduling.RulesResponse
import app.pantopus.android.data.api.models.scheduling.ScheduleResponse
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
class WeeklyHoursEditorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(scheduleId: String = "s1") =
        WeeklyHoursEditorViewModel(repo, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_SCHEDULE_ID to scheduleId)))

    private fun loadedResponse() =
        NetworkResult.Success(
            GetAvailabilityResponse(
                schedules =
                    listOf(
                        AvailabilityScheduleDto(id = "s1", name = "Working hours", timezone = "America/Los_Angeles", isDefault = true),
                    ),
                rules = listOf(AvailabilityRuleDto(scheduleId = "s1", weekday = 1, startTime = "09:00", endTime = "17:00")),
            ),
        )

    @Test
    fun `load builds the weekday grid from rules`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns loadedResponse()
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val form = (vm.state.value as WeeklyHoursUiState.Content).form
            assertEquals("Working hours", form.name)
            assertEquals(7, form.days.size)
            val monday = form.days.first { it.weekday == 1 }
            assertTrue(monday.enabled)
            assertEquals(TimeRange("09:00", "17:00"), monday.blocks.single())
            assertFalse(form.allDaysOff)
        }

    @Test
    fun `toggleDay off disables the day`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns loadedResponse()
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggleDay(1, false)
            val monday = (vm.state.value as WeeklyHoursUiState.Content).form.days.first { it.weekday == 1 }
            assertFalse(monday.enabled)
        }

    @Test
    fun `useQuickDefault sets Mon-Fri nine to five`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns loadedResponse()
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.useQuickDefault()
            val days = (vm.state.value as WeeklyHoursUiState.Content).form.days
            assertTrue(days.filter { it.weekday in 1..5 }.all { it.enabled && it.blocks.single() == TimeRange("09:00", "17:00") })
            assertTrue(days.filter { it.weekday == 0 || it.weekday == 6 }.none { it.enabled })
        }

    @Test
    fun `save replaces rules and updates the schedule`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns loadedResponse()
            coEvery { repo.setRules(any(), any()) } returns NetworkResult.Success(RulesResponse())
            coEvery { repo.updateSchedule(any(), any()) } returns
                NetworkResult.Success(ScheduleResponse(AvailabilityScheduleDto(id = "s1", name = "Working hours")))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(WeeklyHoursEvent.Saved, awaitItem())
            }
            coVerify {
                repo.setRules(
                    "s1",
                    match { req -> req.rules.any { it.weekday == 1 && it.startTime == "09:00" && it.endTime == "17:00" } },
                )
            }
            coVerify { repo.updateSchedule("s1", match { it.timezone == "America/Los_Angeles" }) }
        }

    @Test
    fun `an inverted range invalidates the form and blocks save`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns loadedResponse()
            val vm = vm()
            vm.load()
            advanceUntilIdle()

            vm.updateBlock(1, 0, "17:00", "09:00")
            val form = (vm.state.value as WeeklyHoursUiState.Content).form
            assertFalse(form.days.first { it.weekday == 1 }.blocks.single().isValid)
            assertFalse(form.isValid)

            vm.save()
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.setRules(any(), any()) }
        }

    @Test
    fun `fixing the inverted range re-validates the form`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns loadedResponse()
            val vm = vm()
            vm.load()
            advanceUntilIdle()

            vm.updateBlock(1, 0, "17:00", "09:00")
            assertFalse((vm.state.value as WeeklyHoursUiState.Content).form.isValid)
            vm.updateBlock(1, 0, "09:00", "17:00")
            assertTrue((vm.state.value as WeeklyHoursUiState.Content).form.isValid)
        }
}
