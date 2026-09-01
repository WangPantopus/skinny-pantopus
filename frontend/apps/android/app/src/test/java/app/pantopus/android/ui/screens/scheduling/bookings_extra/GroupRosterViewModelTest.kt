@file:Suppress("PackageNaming", "ktlint:standard:max-line-length")
@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingDetailResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.BookingEventTypeRef
import app.pantopus.android.data.api.models.scheduling.BookingResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetWaitlistResponse
import app.pantopus.android.data.api.models.scheduling.WaitlistEntryDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
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
import org.junit.Before
import org.junit.Test

class GroupRosterViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>()
    private val homes = mockk<HomesRepository>(relaxed = true)
    private val auth = mockk<AuthRepository>(relaxed = true)
    private val errors = mockk<SchedulingErrorDecoder>(relaxed = true)

    private val start = "2020-01-01T10:00:00Z"
    private val anchor = BookingDto(id = "b1", eventTypeId = "et1", startAt = start, status = "confirmed", inviteeName = "Ada")
    private val siblings =
        listOf(
            anchor,
            BookingDto(id = "b2", eventTypeId = "et1", startAt = start, status = "confirmed", inviteeName = "Bo"),
            BookingDto(id = "b3", eventTypeId = "et1", startAt = start, status = "pending", inviteeName = "Cy"),
        )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        coEvery { repo.getBooking(any(), any()) } returns
            NetworkResult.Success(BookingDetailResponse(booking = anchor, attendees = emptyList(), eventType = BookingEventTypeRef(id = "et1", name = "Coffee chat")))
        coEvery { repo.getEventType(any(), any()) } returns
            NetworkResult.Success(EventTypeDetailResponse(eventType = EventTypeDto(id = "et1", name = "Coffee chat", slug = "coffee", durations = listOf(30), seatCap = 16)))
        coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Success(GetBookingsResponse(siblings))
        coEvery { repo.getWaitlist(any(), any()) } returns
            NetworkResult.Success(GetWaitlistResponse(listOf(WaitlistEntryDto(id = "w1", inviteeName = "Di", status = "waiting", createdAt = start))))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm() = GroupRosterViewModel(repo, homes, auth, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_BOOKING_ID to "b1")))

    @Test
    fun `composes the roster from sibling bookings and the waitlist`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val state = vm.state.value as GroupRosterUiState.Loaded
            assertEquals(16, state.data.seatTotal)
            assertEquals(3, state.data.seated.size)
            assertEquals(2, state.data.confirmed)
            assertEquals(1, state.data.pending)
            assertEquals(1, state.data.waiting)
        }

    @Test
    fun `confirming a group no-show marks each selected booking`() =
        runTest(dispatcher) {
            coEvery { repo.markNoShow(any(), any()) } returns NetworkResult.Success(BookingResponse(anchor.copy(status = "no_show")))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.openNoShow()
            vm.confirmNoShow()
            advanceUntilIdle()
            coVerify { repo.markNoShow(any(), "b1") }
            coVerify { repo.markNoShow(any(), "b2") }
        }

    @Test
    fun `a partial no-show failure keeps only the failed ids selected for retry`() =
        runTest(dispatcher) {
            coEvery { repo.markNoShow(any(), "b1") } returns NetworkResult.Success(BookingResponse(anchor.copy(status = "no_show")))
            coEvery { repo.markNoShow(any(), "b2") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            every { errors.decode(any(), any()) } returns SchedulingError.Generic(code = null, message = "boom")
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.openNoShow()
            vm.confirmNoShow()
            advanceUntilIdle()
            val sheet = vm.noShow.value
            assertEquals(setOf("b2"), sheet?.selectedIds)
        }

    @Test
    fun `an already-terminal BAD_STATE counts as done, not a retry`() =
        runTest(dispatcher) {
            coEvery { repo.markNoShow(any(), "b1") } returns NetworkResult.Success(BookingResponse(anchor.copy(status = "no_show")))
            coEvery { repo.markNoShow(any(), "b2") } returns NetworkResult.Failure(NetworkError.ClientError(409, "{}"))
            every { errors.decode(any(), any()) } returns SchedulingError.Generic(code = "BAD_STATE", message = "terminal")
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.openNoShow()
            vm.confirmNoShow()
            advanceUntilIdle()
            assertEquals(null, vm.noShow.value) // sheet dismissed — nothing left to retry
        }
}
