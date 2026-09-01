@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookings

import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
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
class BookingsInboxViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk()
    private val auth: AuthRepository = mockk()
    private val relay = BookingsOwnerRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        // Personal-only owner set keeps the union deterministic.
        coEvery { homes.myHomes() } returns NetworkResult.Failure(NetworkError.NotFound)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        coEvery { repo.getEventTypes(any()) } returns
            NetworkResult.Success(
                GetEventTypesResponse(listOf(eventType("et1", "30-min intro call"))),
            )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun eventType(
        id: String,
        name: String,
    ) = EventTypeDto(id = id, name = name, slug = "intro", durations = listOf(30))

    private fun booking(
        id: String,
        status: String,
        start: String = "2999-06-18T17:00:00Z",
    ) = BookingDto(
        id = id,
        eventTypeId = "et1",
        status = status,
        startAt = start,
        endAt = "2999-06-18T17:30:00Z",
        inviteeName = "Dana Whitfield",
    )

    private fun stubBookings(byStatus: Map<String, List<BookingDto>>) {
        coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } answers {
            val status = secondArg<String?>()
            NetworkResult.Success(GetBookingsResponse(byStatus[status].orEmpty()))
        }
    }

    private fun newVm() = BookingsInboxViewModel(repo, homes, auth, relay)

    @Test
    fun `upcoming loads grouped content and resolves event-type names`() =
        runTest(dispatcher) {
            stubBookings(
                mapOf("upcoming" to listOf(booking("b1", "confirmed")), "pending" to emptyList()),
            )
            val vm = newVm()
            vm.start()
            advanceUntilIdle()

            val content = vm.state.value as BookingsInboxUiState.Content
            assertEquals(1, content.sections.sumOf { it.rows.size })
            assertEquals("30-min intro call", content.sections.first().rows.first().eventName)
        }

    @Test
    fun `empty segment surfaces the per-segment empty state`() =
        runTest(dispatcher) {
            stubBookings(mapOf("upcoming" to emptyList(), "pending" to emptyList()))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookingsInboxUiState.Empty)
        }

    @Test
    fun `pending badge counts pending regardless of the active segment`() =
        runTest(dispatcher) {
            stubBookings(
                mapOf(
                    "upcoming" to listOf(booking("b1", "confirmed")),
                    "pending" to listOf(booking("b2", "pending"), booking("b3", "pending")),
                ),
            )
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertEquals(2, vm.pendingBadge.value)
        }

    @Test
    fun `all-failure fetch surfaces the error state`() =
        runTest(dispatcher) {
            coEvery {
                repo.getBookings(any(), any(), any(), any(), any(), any())
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookingsInboxUiState.Error)
        }

    @Test
    fun `quick approve optimistically drops the row and calls approve`() =
        runTest(dispatcher) {
            stubBookings(mapOf("pending" to listOf(booking("b2", "pending"))))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.selectSegment(BookingSegment.Pending)
            advanceUntilIdle()
            assertTrue(vm.state.value is BookingsInboxUiState.Content)

            vm.approve("b2")
            // Optimistic: the only pending row leaves, so the segment reads empty immediately.
            assertTrue(vm.state.value is BookingsInboxUiState.Empty)
            advanceUntilIdle()
            coVerify { repo.approveBooking(SchedulingOwner.Personal, "b2") }
        }

    @Test
    fun `detailRoute stashes the row owner in the relay`() =
        runTest(dispatcher) {
            stubBookings(
                mapOf("upcoming" to listOf(booking("b1", "confirmed")), "pending" to emptyList()),
            )
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            val route = vm.detailRoute("b1")
            assertEquals("scheduling/bookings/b1", route)
            assertEquals(SchedulingOwner.Personal, relay.pending)
        }
}
