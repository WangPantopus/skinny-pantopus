@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.RecurringBookingsResponse
import app.pantopus.android.data.api.models.scheduling.RecurringFailure
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RecurringSetupViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = RecurringSetupViewModel(repo)

    private fun eventType() =
        EventTypeDto(
            id = "e1",
            name = "Intro call",
            slug = "intro",
            durations = listOf(30),
            defaultDuration = 30,
            locationMode = "video",
            isActive = true,
        )

    @Test
    fun empty_when_no_event_types() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertEquals(RecurringLoadState.Empty, vm.load.value)
        }

    @Test
    fun generates_occurrences_for_default_count() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType())))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.load.value is RecurringLoadState.Loaded)
            assertEquals(6, vm.occurrences.value.size)
        }

    @Test
    fun set_count_regenerates_occurrences() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType())))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.setCount(8)
            assertEquals(8, vm.occurrences.value.size)
        }

    @Test
    fun confirm_all_open_reports_full_success() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType())))
            coEvery {
                repo.createRecurringBookings(
                    any(),
                    any(),
                )
            } returns NetworkResult.Success(RecurringBookingsResponse(failed = emptyList()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.confirm()
            advanceUntilIdle()
            val result = vm.submit.value as RecurringSubmitState.Result
            assertEquals(6, result.created)
            assertTrue(result.failed.isEmpty())
        }

    @Test
    fun confirm_with_conflicts_reports_partial() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType())))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val firstStart = vm.occurrences.value.first().startUtc
            coEvery { repo.createRecurringBookings(any(), any()) } returns
                NetworkResult.Success(
                    RecurringBookingsResponse(failed = listOf(RecurringFailure(start = firstStart, error = "SLOT_CONFLICT"))),
                )
            vm.confirm()
            advanceUntilIdle()
            val result = vm.submit.value as RecurringSubmitState.Result
            assertEquals(1, result.failed.size)
            assertEquals(5, result.created)
        }

    @Test
    fun error_when_event_types_fail() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.load.value is RecurringLoadState.Error)
        }
}
