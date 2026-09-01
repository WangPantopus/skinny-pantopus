@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.core.notifications.GigActiveNotifier
import app.pantopus.android.data.api.models.gigs.GigBidsResponse
import app.pantopus.android.data.api.models.gigs.GigDetailResponse
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigMyBidResponse
import app.pantopus.android.data.api.models.gigs.GigPaymentResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionsResponse
import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.payments.TipRefreshStatusResponse
import app.pantopus.android.data.api.models.payments.TipResponse
import app.pantopus.android.data.api.models.reviews.MyPendingReviewsResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigReassignmentRepository
import app.pantopus.android.data.gigs.GigViewerBidRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.reviews.ReviewsRepository
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Block 3D — tipping a gig worker. The poster, on a completed + owner-confirmed
 * gig, tips via PaymentSheet. Mirrors iOS `GigTipTests`: the gate, the "Send a
 * tip" dock, and the send-tip event + outcome handling.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigTipViewModelTest {
    private val repo: GigsRepository = mockk()
    private val extrasRepo: app.pantopus.android.data.gigs.GigExtrasRepository = mockk()
    private val reassignmentRepo: GigReassignmentRepository = mockk()
    private val viewerBidRepo: GigViewerBidRepository = mockk()
    private val ownerActionsRepo: app.pantopus.android.data.gigs.GigOwnerActionsRepository = mockk()
    private val offersRepo: OffersRepository = mockk()
    private val authRepo: AuthRepository = mockk()
    private val filesRepo: FilesRepository = mockk()
    private val paymentsRepo: PaymentsRepository = mockk()
    private val reviewsRepo: ReviewsRepository = mockk()
    private val gigsV2Repo: app.pantopus.android.data.gigs.GigsV2Repository = mockk(relaxed = true)
    private val socket: SocketManager = mockk(relaxed = true)
    private val activeNotifier: GigActiveNotifier = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val signed =
            AuthRepository.State.SignedIn(
                user = UserDto(id = "owner-1", email = "o@example.com", displayName = "Owner", avatarUrl = null),
            )
        every { authRepo.state } returns MutableStateFlow<AuthRepository.State>(signed)
        // Bidder-side lookup — the viewer here is the poster, so this never
        // fires, but the mock must still answer if the gate ever changes.
        coEvery { viewerBidRepo.myBid(any()) } returns NetworkResult.Success(GigMyBidResponse(bid = null))
        coEvery { offersRepo.myBids(any()) } returns NetworkResult.Success(MyBidsResponse(bids = emptyList()))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun completedConfirmedGig() =
        GigDto(
            id = "g1",
            title = "Patio cleanup",
            userId = "owner-1",
            status = "completed",
            acceptedBy = "worker-1",
            ownerConfirmedAt = "2026-06-01T00:00:00Z",
        )

    private fun vmWithLoadedTip(): GigDetailViewModel {
        coEvery { repo.detail("g1") } returns NetworkResult.Success(GigDetailResponse(gig = completedConfirmedGig()))
        coEvery { repo.bids("g1") } returns NetworkResult.Success(GigBidsResponse(bids = emptyList()))
        coEvery { repo.questions("g1") } returns NetworkResult.Success(GigQuestionsResponse(questions = emptyList()))
        coEvery { reviewsRepo.myPending() } returns NetworkResult.Success(MyPendingReviewsResponse(pending = emptyList()))
        // Phase 5b — the owner of an assigned+ gig fetches the payment card.
        coEvery { repo.gigPayment("g1") } returns NetworkResult.Success(GigPaymentResponse())
        return GigDetailViewModel(
            repo,
            extrasRepo,
            reassignmentRepo,
            viewerBidRepo,
            ownerActionsRepo,
            offersRepo,
            authRepo,
            filesRepo,
            paymentsRepo,
            reviewsRepo,
            socket,
            activeNotifier,
            gigsV2Repo,
            SavedStateHandle(mapOf(GigDetailViewModel.GIG_ID_KEY to "g1")),
        )
    }

    // MARK: - Gate

    @Test
    fun tip_gate() {
        val gig = completedConfirmedGig()
        assertTrue(GigDetailViewModel.viewerCanTip(gig, "owner-1"))
        assertFalse("Only the poster can tip", GigDetailViewModel.viewerCanTip(gig, "worker-1"))
        assertFalse(
            "Must be owner-confirmed",
            GigDetailViewModel.viewerCanTip(gig.copy(ownerConfirmedAt = null), "owner-1"),
        )
        assertFalse(
            "Must be completed",
            GigDetailViewModel.viewerCanTip(gig.copy(status = "in_progress"), "owner-1"),
        )
    }

    // MARK: - Projection

    @Test
    fun load_sets_can_tip_and_send_tip_dock() =
        runTest {
            val vm = vmWithLoadedTip()
            vm.load()
            assertTrue(vm.canTip())
            val content = (vm.state.value as ContentDetailUiState.Loaded).content
            assertEquals("Send a tip", content.dock.primary.label)
        }

    // MARK: - Send tip

    // tip.affordance → tip.amount → tip.paymentSheet
    @Test
    fun send_tip_emits_present_event() =
        runTest {
            coEvery { paymentsRepo.tip(any()) } returns
                NetworkResult.Success(
                    TipResponse(success = true, clientSecret = "pi_tip", paymentId = "pay-tip-1", customer = "cus", ephemeralKey = "ek"),
                )
            val vm = vmWithLoadedTip()
            vm.load()
            vm.events.test {
                vm.sendTip(1000)
                val event = awaitItem()
                assertTrue(event is GigTipEvent.PresentTipSheet)
                assertEquals("pi_tip", (event as GigTipEvent.PresentTipSheet).params.clientSecret)
                cancelAndIgnoreRemainingEvents()
            }
            assertEquals(TipStatus.Sending, vm.tipStatus.value)
            coVerify { paymentsRepo.tip(match { it.gigId == "g1" && it.amount == 1000 }) }
        }

    // tip.success — completed sheet reconciles + refreshes
    @Test
    fun tip_outcome_paid_reconciles_and_succeeds() =
        runTest {
            coEvery { paymentsRepo.tip(any()) } returns
                NetworkResult.Success(TipResponse(success = true, clientSecret = "pi_tip", paymentId = "pay-tip-1"))
            coEvery { paymentsRepo.tipRefreshStatus("pay-tip-1") } returns
                NetworkResult.Success(TipRefreshStatusResponse(paymentStatus = "captured"))
            val vm = vmWithLoadedTip()
            vm.load()
            vm.sendTip(1000)
            vm.onTipOutcome(CheckoutOutcome.Paid)
            assertEquals(TipStatus.Succeeded, vm.tipStatus.value)
            coVerify { paymentsRepo.tipRefreshStatus("pay-tip-1") }
        }

    @Test
    fun tip_outcome_declined_fails() =
        runTest {
            val vm = vmWithLoadedTip()
            vm.load()
            vm.onTipOutcome(CheckoutOutcome.Declined("Your card was declined."))
            assertTrue(vm.tipStatus.value is TipStatus.Failed)
        }

    @Test
    fun send_tip_api_failure_marks_failed() =
        runTest {
            coEvery { paymentsRepo.tip(any()) } returns
                NetworkResult.Failure(NetworkError.Server(400, "Maximum 3 tips per gig reached"))
            val vm = vmWithLoadedTip()
            vm.load()
            vm.sendTip(1000)
            assertTrue(vm.tipStatus.value is TipStatus.Failed)
        }
}
