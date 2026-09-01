@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.BookingResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CancelRefundViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() =
        CancelRefundViewModel(
            repo,
            errors,
            flags,
            SavedStateHandle(mapOf(SchedulingRoutes.ARG_BOOKING_ID to "b1")),
        )

    private fun bookingResponse() = BookingResponse(BookingDto(id = "b1", status = "cancelled"))

    private fun open(
        vm: CancelRefundViewModel,
        hasPayment: Boolean,
    ) = vm.open(
        SchedulingOwner.Personal,
        SchedulingPillar.Personal,
        "Intro call · Dana · Thu",
        hasPayment,
    )

    @Test
    fun `paid booking shows the refund card behind the flag`() {
        val vm = vm()
        open(vm, hasPayment = true)
        assertTrue(vm.state.value?.showRefund == true)
    }

    @Test
    fun `free booking hides the refund card`() {
        val vm = vm()
        open(vm, hasPayment = false)
        assertEquals(false, vm.state.value?.showRefund)
    }

    @Test
    fun `cancel succeeds into the confirmation frame then commits on done`() =
        runTest(dispatcher) {
            coEvery {
                repo.cancelBooking(
                    any(),
                    any(),
                    any(),
                )
            } returns NetworkResult.Success(bookingResponse())
            val vm = vm()
            open(vm, hasPayment = false)
            vm.selectReason("Changed plans")
            vm.confirm()
            advanceUntilIdle()
            // Design frame 5: a successful cancel re-renders to the read-only
            // confirmation (sheet stays up) rather than dismissing immediately.
            assertTrue(vm.state.value?.succeeded == true)
            assertEquals(false, vm.committed.value)
            // The terminal "Done" closes the sheet and commits the detail refetch.
            vm.done()
            assertNull(vm.state.value)
            assertTrue(vm.committed.value)
        }

    @Test
    fun `past deadline surfaces inline and does not commit`() =
        runTest(dispatcher) {
            coEvery { repo.cancelBooking(any(), any(), any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(409, """{"error":"PAST_DEADLINE","message":"x"}"""),
                )
            val vm = vm()
            open(vm, hasPayment = false)
            vm.confirm()
            advanceUntilIdle()
            assertEquals(false, vm.committed.value)
            assertNotNull(vm.state.value?.errorMessage)
        }

    @Test
    fun `refund failed flips the CTA to retry`() =
        runTest(dispatcher) {
            coEvery { repo.cancelBooking(any(), any(), any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(409, """{"error":"REFUND_FAILED","message":"x"}"""),
                )
            val vm = vm()
            open(vm, hasPayment = true)
            vm.confirm()
            advanceUntilIdle()
            assertTrue(vm.state.value?.refundFailed == true)
        }
}
