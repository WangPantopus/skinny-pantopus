@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.AvailableSlotsResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.BookingResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RescheduleReassignViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() =
        RescheduleReassignViewModel(
            repo,
            errors,
            SavedStateHandle(mapOf(SchedulingRoutes.ARG_BOOKING_ID to "b1")),
        )

    private fun slot(
        start: String,
        local: String,
        hosts: List<String> = listOf("h1", "h2"),
    ) = SlotDto(start = start, end = start, startLocal = local, eligibleHosts = hosts)

    private fun bookingResponse() = BookingResponse(BookingDto(id = "b1", status = "confirmed"))

    private fun conflictBody() =
        """{"error":"SLOT_CONFLICT","alternatives":[""" +
            """{"start":"2999-06-19T17:00:00Z","end":"2999-06-19T17:30:00Z","startLocal":"2999-06-19T10:00:00"}]}"""

    private fun stubSlots(slots: List<SlotDto>) {
        coEvery {
            repo.getBookingAvailableSlots(any(), any(), any(), any(), any())
        } returns NetworkResult.Success(AvailableSlotsResponse(slots))
    }

    private fun openReschedule(vm: RescheduleReassignViewModel) =
        vm.open(
            SchedulingOwner.Personal,
            SchedulingPillar.Personal,
            "2999-06-14T17:00:00Z",
            "2999-06-14T17:30:00Z",
            allowReassign = true,
            reassignOnly = false,
        )

    @Test
    fun `open loads slots and derives member options from eligible hosts`() =
        runTest(dispatcher) {
            stubSlots(listOf(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00")))
            val vm = vm()
            openReschedule(vm)
            advanceUntilIdle()

            val state = vm.state.value
            assertNotNull(state)
            assertEquals(1, state?.slots?.size)
            assertEquals(setOf("h1", "h2"), state?.members?.map { it.id }?.toSet())
            assertTrue(state?.loading == false)
        }

    @Test
    fun `reschedule now commits and clears the sheet`() =
        runTest(dispatcher) {
            stubSlots(listOf(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00")))
            coEvery {
                repo.rescheduleBooking(any(), any(), any())
            } returns NetworkResult.Success(bookingResponse())
            val vm = vm()
            openReschedule(vm)
            advanceUntilIdle()
            vm.selectSlot(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00"))
            vm.confirm()
            advanceUntilIdle()

            assertNull(vm.state.value)
            assertTrue(vm.committed.value)
            coVerify { repo.rescheduleBooking(SchedulingOwner.Personal, "b1", any()) }
        }

    @Test
    fun `a 409 slot conflict routes into the alternatives sheet`() =
        runTest(dispatcher) {
            stubSlots(listOf(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00")))
            coEvery { repo.rescheduleBooking(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(409, conflictBody()))
            val vm = vm()
            openReschedule(vm)
            advanceUntilIdle()
            vm.selectSlot(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00"))
            vm.confirm()
            advanceUntilIdle()

            assertNotNull(vm.state.value?.conflict)
            assertEquals(1, vm.state.value?.conflict?.alternatives?.size)
        }

    @Test
    fun `propose-to-invitee shows the proposed success frame`() =
        runTest(dispatcher) {
            stubSlots(listOf(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00")))
            coEvery {
                repo.proposeReschedule(any(), any(), any())
            } returns NetworkResult.Success(bookingResponse())
            val vm = vm()
            openReschedule(vm)
            advanceUntilIdle()
            vm.selectSlot(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00"))
            vm.setAuthority(RescheduleAuthority.Propose)
            vm.confirm()
            advanceUntilIdle()

            assertTrue(vm.state.value?.proposed == true)
        }

    @Test
    fun `reassign-only sends the host and commits`() =
        runTest(dispatcher) {
            stubSlots(listOf(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00")))
            coEvery {
                repo.reassignBooking(any(), any(), any())
            } returns NetworkResult.Success(bookingResponse())
            val vm = vm()
            vm.open(
                SchedulingOwner.Business("biz"),
                SchedulingPillar.Business,
                "2999-06-14T17:00:00Z",
                "2999-06-14T17:30:00Z",
                allowReassign = true,
                reassignOnly = true,
            )
            advanceUntilIdle()
            vm.selectMember("h2")
            vm.confirm()
            advanceUntilIdle()

            assertTrue(vm.committed.value)
            coVerify { repo.reassignBooking(SchedulingOwner.Business("biz"), "b1", any()) }
        }

    @Test
    fun `invalid host on reassign surfaces an inline error`() =
        runTest(dispatcher) {
            stubSlots(listOf(slot("2999-06-18T17:00:00Z", "2999-06-18T10:00:00")))
            coEvery { repo.reassignBooking(any(), any(), any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(409, """{"error":"INVALID_HOST","message":"x"}"""),
                )
            val vm = vm()
            vm.open(
                SchedulingOwner.Business("biz"),
                SchedulingPillar.Business,
                "2999-06-14T17:00:00Z",
                "2999-06-14T17:30:00Z",
                allowReassign = true,
                reassignOnly = true,
            )
            advanceUntilIdle()
            vm.selectMember("h9")
            vm.confirm()
            advanceUntilIdle()

            assertEquals(false, vm.committed.value)
            assertNotNull(vm.state.value?.errorMessage)
        }
}
