@file:Suppress("PackageNaming", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import app.pantopus.android.data.api.models.scheduling.ManageActions
import app.pantopus.android.data.api.models.scheduling.ManageBookingDetail
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.ManagePayment
import app.pantopus.android.data.api.models.scheduling.PublicBookingMutationResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingRef
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTerminalState
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RescheduleCancelPolicyViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = RescheduleCancelPolicyViewModel(repo, errors)

    private fun manage(
        canReschedule: Boolean = true,
        canCancel: Boolean = true,
        status: String = "confirmed",
        payment: ManagePayment? = null,
        refundCents: Int? = null,
    ) = ManageBookingResponse(
        booking =
            ManageBookingDetail(
                id = "bk-1",
                status = status,
                startAt = "2026-06-17T16:30:00Z",
                endAt = "2026-06-17T17:00:00Z",
                inviteeTimezone = "America/Los_Angeles",
            ),
        actions =
            ManageActions(
                canCancel = canCancel,
                canReschedule = canReschedule,
                inviteeCancelAllowed = true,
                inviteeRescheduleAllowed = true,
                refundEstimateCents = refundCents,
            ),
        payment = payment,
        eventType = PublicEventTypeView(name = "Intro call"),
        page = PublicPageView(title = "Maria", ownerType = "user"),
    )

    @Test
    fun free_to_change_when_both_allowed() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage())
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            val loaded = vm.state.value as ManageUiState.Loaded
            assertEquals(ManagePolicyMode.FreeToChange, loaded.mode)
            assertTrue(loaded.view.canReschedule && loaded.view.canCancel)
        }

    @Test
    fun reschedule_closed_when_reschedule_blocked() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage(canReschedule = false, canCancel = true))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            assertEquals(ManagePolicyMode.RescheduleClosed, (vm.state.value as ManageUiState.Loaded).mode)
        }

    @Test
    fun partial_refund_mode_when_refund_is_partial() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns
                NetworkResult.Success(
                    manage(
                        canReschedule = false,
                        canCancel = true,
                        payment = ManagePayment(amountTotal = 4800, currency = "USD", paymentStatus = "succeeded"),
                        refundCents = 2400,
                    ),
                )
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            assertEquals(ManagePolicyMode.PartialRefund, (vm.state.value as ManageUiState.Loaded).mode)
        }

    @Test
    fun expired_token_is_terminal() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            assertEquals(SchedulingTerminalState.Expired, (vm.state.value as ManageUiState.Terminal).state)
        }

    @Test
    fun cancel_success_moves_to_cancelled_terminal() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage())
            coEvery {
                repo.publicCancel("t", any())
            } returns NetworkResult.Success(PublicBookingMutationResponse(PublicBookingRef(id = "bk-1", status = "cancelled")))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            vm.openCancel()
            vm.confirmCancel("changed plans")
            advanceUntilIdle()
            assertEquals(SchedulingTerminalState.Cancelled, (vm.state.value as ManageUiState.Terminal).state)
        }

    @Test
    fun reschedule_conflict_surfaces_alternatives() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage())
            coEvery { repo.publicReschedule("t", any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        409,
                        """{"error":"SLOT_TAKEN","alternatives":[{"start":"2026-06-20T18:00:00Z","end":"2026-06-20T18:30:00Z","startLocal":"2026-06-20T11:00:00"}]}""",
                    ),
                )
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            vm.confirmReschedule(SlotDto(start = "2026-06-19T16:30:00Z"))
            advanceUntilIdle()
            val conflict = vm.reschedule.value as RescheduleSheetState.Conflict
            assertEquals(1, conflict.alternatives.size)
        }

    @Test
    fun reschedule_success_reloads() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("t") } returns NetworkResult.Success(manage())
            coEvery {
                repo.publicReschedule("t", any())
            } returns NetworkResult.Success(PublicBookingMutationResponse(PublicBookingRef(id = "bk-1", status = "confirmed")))
            val vm = vm()
            vm.start("t")
            advanceUntilIdle()
            vm.confirmReschedule(SlotDto(start = "2026-06-19T16:30:00Z"))
            advanceUntilIdle()
            assertEquals(RescheduleSheetState.Hidden, vm.reschedule.value)
            assertTrue(vm.state.value is ManageUiState.Loaded)
        }
}
