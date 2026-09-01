@file:Suppress("PackageNaming")
@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.GetWaitlistResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.models.scheduling.WaitlistEntryDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
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

class WaitlistViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>()
    private val homes = mockk<HomesRepository>(relaxed = true)
    private val auth = mockk<AuthRepository>(relaxed = true)

    private val eventType = EventTypeDto(id = "et1", name = "Group class", slug = "group", durations = listOf(60), seatCap = 10)
    private val entries =
        listOf(
            WaitlistEntryDto(id = "w1", inviteeName = "Rosa", status = "waiting", createdAt = "2026-06-11T12:00:00Z"),
            WaitlistEntryDto(id = "w2", inviteeName = "Sam", status = "waiting", createdAt = "2026-06-12T12:00:00Z"),
        )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loads the waitlist for the first event type`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType)))
            coEvery { repo.getWaitlist(any(), any()) } returns NetworkResult.Success(GetWaitlistResponse(entries))

            val vm = WaitlistViewModel(repo, homes, auth)
            vm.start()
            advanceUntilIdle()

            val state = vm.state.value as WaitlistUiState.Loaded
            assertEquals("et1", state.data.selectedId)
            assertEquals(10, state.data.seatTotal)
            assertEquals(2, state.data.entries.size)
            assertTrue(state.data.entries.first().meta.startsWith("#1 ·"))
        }

    @Test
    fun `empty state when there are no event types`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))

            val vm = WaitlistViewModel(repo, homes, auth)
            vm.start()
            advanceUntilIdle()

            assertTrue(vm.state.value is WaitlistUiState.Empty)
        }

    @Test
    fun `promote calls the repository and refreshes the waitlist`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType)))
            coEvery { repo.getWaitlist(any(), any()) } returns NetworkResult.Success(GetWaitlistResponse(entries))
            coEvery { repo.promoteWaitlist(any(), any()) } returns NetworkResult.Success(SchedulingOkResponse())

            val vm = WaitlistViewModel(repo, homes, auth)
            vm.start()
            advanceUntilIdle()
            vm.promote("w1")
            advanceUntilIdle()

            coVerify { repo.promoteWaitlist(any(), "w1") }
            assertTrue(vm.state.value is WaitlistUiState.Loaded)
        }
}
