@file:Suppress("PackageNaming", "ktlint:standard:max-line-length")
@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.CreateBookingResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.PublicSlotsResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test

class ManualBookingViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>()
    private val errors = mockk<SchedulingErrorDecoder>()

    private val eventType =
        EventTypeDto(id = "et1", name = "Consult", slug = "consult", durations = listOf(30), defaultDuration = 30, locationMode = "video")
    private val slotA = SlotDto(start = "2026-06-20T17:00:00Z", end = "2026-06-20T17:30:00Z", startLocal = "2026-06-20T10:00:00")
    private val slotB = SlotDto(start = "2026-06-20T18:00:00Z", end = "2026-06-20T18:30:00Z", startLocal = "2026-06-20T11:00:00")

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p1", slug = "myslug")))
        coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(listOf(eventType)))
        coEvery {
            repo.publicGetSlots(any(), any(), any(), any(), any())
        } returns NetworkResult.Success(PublicSlotsResponse(slots = listOf(slotA, slotB)))
        coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = ManualBookingViewModel(
        repo,
        errors,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    @Test
    fun `loads active event types on start`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val state = vm.state.value
            assertFalse(state.loadingEventTypes)
            assertEquals(1, state.eventTypes.size)
            assertEquals("et1", state.eventTypes.first().id)
        }

    @Test
    fun `advancing the wizard loads slots for the chosen event type`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.selectEventType("et1")
            vm.next()
            advanceUntilIdle()
            val state = vm.state.value
            assertEquals(ManualStep.Time, state.step)
            assertFalse(state.loadingSlots)
            assert(state.days.isNotEmpty())
            assert(state.daySlots.isNotEmpty())
        }

    @Test
    fun `a 409 on create synthesises nearest alternatives and never dead-ends`() =
        runTest(dispatcher) {
            coEvery { repo.createBooking(any(), any()) } returns NetworkResult.Failure(NetworkError.ClientError(409, "{}"))
            every { errors.decode(any(), any()) } returns SchedulingError.Conflict("SLOT_TAKEN", emptyList())

            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.selectEventType("et1")
            vm.next() // -> Time, loads slots
            advanceUntilIdle()
            vm.selectSlot(slotA.start)
            vm.next() // -> Details
            vm.setName("Dana")
            vm.next() // -> Review
            vm.next() // -> create
            advanceUntilIdle()

            val state = vm.state.value
            assertNotNull(state.slotConflict)
            // alternatives are synthesised from the remaining open slot (slotB).
            assertEquals(1, state.slotConflict?.alternatives?.size)
            assertEquals(slotB.start, state.slotConflict?.alternatives?.first()?.start)
        }

    @Test
    fun `picking an alternative retries the create with the new slot`() =
        runTest(dispatcher) {
            coEvery { repo.createBooking(any(), any()) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.ClientError(409, "{}")),
                    NetworkResult.Success(CreateBookingResponse(booking = BookingDto(id = "b9"), manageToken = "mt")),
                )
            every { errors.decode(any(), any()) } returns SchedulingError.Conflict("SLOT_TAKEN", emptyList())

            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.selectEventType("et1")
            vm.next()
            advanceUntilIdle()
            vm.selectSlot(slotA.start)
            vm.next()
            vm.setName("Dana")
            vm.next()
            vm.next()
            advanceUntilIdle()

            vm.pickAlternative(slotB)
            advanceUntilIdle()

            val state = vm.state.value
            assertEquals(ManualStep.Created, state.step)
            assertEquals("b9", state.createdBookingId)
        }

    @Test
    fun `route owner args scope event types and create to the home owner`() =
        runTest(dispatcher) {
            coEvery { repo.createBooking(any(), any()) } returns
                NetworkResult.Success(CreateBookingResponse(booking = BookingDto(id = "b1"), manageToken = "mt"))
            val home = SchedulingOwner.Home("home-1")

            val vm = vm(ownerKind = "home", ownerId = "home-1")
            vm.start()
            advanceUntilIdle()
            assertEquals(app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar.Home, vm.state.value.pillar)
            coVerify { repo.getEventTypes(home) }

            vm.selectEventType("et1")
            vm.next()
            advanceUntilIdle()
            vm.selectSlot(slotA.start)
            vm.next()
            vm.setName("Dana")
            vm.next()
            vm.next()
            advanceUntilIdle()
            coVerify { repo.createBooking(home, any()) }
        }
}
