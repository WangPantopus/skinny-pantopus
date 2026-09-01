@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import app.pantopus.android.data.api.models.scheduling.ManageBookingDetail
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.ManagePayment
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PaymentRetryViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = PaymentRetryViewModel(repo, flags)

    private fun manage(
        status: String = "pending",
        paymentStatus: String?,
    ) = ManageBookingResponse(
        booking = ManageBookingDetail(id = "bk", status = status, startAt = "2026-06-17T16:30:00Z", endAt = "2026-06-17T17:00:00Z"),
        payment = ManagePayment(amountTotal = 4800, currency = "USD", paymentStatus = paymentStatus),
    )

    @Test
    fun declined_when_payment_failed() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage(paymentStatus = "requires_payment_method"))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            assertTrue(vm.state.value is PaymentRetryViewModel.PaymentRetryUiState.Declined)
        }

    @Test
    fun succeeded_when_paid() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage(paymentStatus = "succeeded"))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            val s = vm.state.value as PaymentRetryViewModel.PaymentRetryUiState.Succeeded
            assertFalse(s.processing)
        }

    @Test
    fun processing_when_settlement_deferred() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage(paymentStatus = "processing"))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            val s = vm.state.value as PaymentRetryViewModel.PaymentRetryUiState.Succeeded
            assertTrue(s.processing)
        }

    @Test
    fun hold_expired_when_booking_cancelled() =
        runTest(dispatcher) {
            coEvery {
                repo.publicGetManageBooking("t")
            } returns NetworkResult.Success(manage(status = "cancelled", paymentStatus = "requires_payment_method"))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            assertEquals(PaymentRetryViewModel.PaymentRetryUiState.HoldExpired, vm.state.value)
        }
}
