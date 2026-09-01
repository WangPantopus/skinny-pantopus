@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.scheduling.AvailabilityOverrideDto
import app.pantopus.android.data.api.models.scheduling.GetAvailabilityResponse
import app.pantopus.android.data.api.models.scheduling.OverridesResponse
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class DateOverridesViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(scheduleId: String = "s1") =
        DateOverridesViewModel(repo, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_SCHEDULE_ID to scheduleId)))

    @Test
    fun `load filters overrides to the schedule`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns
                NetworkResult.Success(
                    GetAvailabilityResponse(
                        overrides =
                            listOf(
                                AvailabilityOverrideDto(scheduleId = "s1", date = "2026-07-04", isUnavailable = true),
                                AvailabilityOverrideDto(scheduleId = "other", date = "2026-08-01", isUnavailable = true),
                            ),
                    ),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val form = (vm.state.value as DateOverridesUiState.Content).form
            assertEquals(1, form.overrides.size)
            assertEquals("2026-07-04", form.overrides.single().date)
        }

    @Test
    fun `applySelected adds an unavailable override`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.selectDate(LocalDate.of(2026, 12, 25))
            vm.setChoice(OverrideChoice.Unavailable)
            vm.applySelected()
            val overrides = (vm.state.value as DateOverridesUiState.Content).form.overrides
            assertTrue(overrides.any { it.date == "2026-12-25" && it.isUnavailable })
        }

    @Test
    fun `toggleHolidaySet adds the full holiday set`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggleHolidaySet(true)
            val form = (vm.state.value as DateOverridesUiState.Content).form
            assertTrue(form.holidaySetOn)
            assertEquals(11, form.overrides.count { it.isUnavailable })
        }

    @Test
    fun `save replaces the override set`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
            coEvery { repo.setOverrides(any(), any()) } returns NetworkResult.Success(OverridesResponse())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(DateOverridesEvent.Saved, awaitItem())
            }
            coVerify { repo.setOverrides("s1", any()) }
        }
}
