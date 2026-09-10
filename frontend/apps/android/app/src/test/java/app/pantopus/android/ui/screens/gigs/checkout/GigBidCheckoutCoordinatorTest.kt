@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.gigs.checkout

import app.pantopus.android.data.api.models.gigs.GigBidAcceptResponse
import app.pantopus.android.data.api.models.gigs.GigBidDto
import app.pantopus.android.data.api.models.gigs.GigBidsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GigBidCheckoutCoordinatorTest {
    private val repo = mockk<GigsRepository>()
    private var identity: GigCheckoutIdentity? = GigCheckoutIdentity("payer", "session", "https://api.example.invalid")
    private var acceptedCount = 0
    private val admission = GigBidCheckoutAdmission()

    private fun receipt(
        status: String = "pending_payment",
        ready: Boolean = false,
    ) = GigBidAcceptResponse(
        bid = GigBidDto(id = "bid", gigId = "gig", status = status, bidAmount = 12.5),
        amountCents = 1250, currency = "usd", authorizationReady = ready,
        paymentStatus = if (ready) "authorized" else "authorize_pending",
        providerStatus = if (ready) "requires_capture" else "requires_payment_method",
        clientSecret = if (ready) null else "pi_one_secret_synthetic", paymentIntentId = "pi_one", paymentId = "payment",
    )

    private fun TestScope.coordinator(identityReader: suspend () -> GigCheckoutIdentity? = { identity }): GigBidCheckoutCoordinator {
        coEvery { repo.bids("gig") } returns NetworkResult.Success(GigBidsResponse(emptyList()))
        coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Success(receipt())
        coEvery { repo.finalizeAcceptBid("gig", "bid") } returns NetworkResult.Success(receipt("accepted"))
        coEvery { repo.abortAcceptBid("gig", "bid") } returns NetworkResult.Success(receipt("pending"))
        return GigBidCheckoutCoordinator(
            repo,
            this,
            identityReader,
            { identity?.toString() },
            { identity == null },
            { _, _ -> acceptedCount++ },
            admission = admission,
        )
    }

    @Test fun suspendedScopeCheckCannotUndoPermanentRetirement() =
        runTest {
            val opening = identity
            val waiting = CompletableDeferred<GigCheckoutIdentity?>()
            var reads = 0
            val c = coordinator { if (++reads == 2) waiting.await() else identity }
            val inFlight = async { c.isCurrentReadScope() }
            runCurrent()
            identity = identity?.copy(sessionId = "replacement")
            assertFalse(c.isCurrentReadScope())
            identity = opening
            waiting.complete(opening)
            assertFalse(inFlight.await())
            assertFalse(c.isCurrentReadScope())
        }

    @Test fun delayed_first_identity_cannot_bind_a_replacement_actor_or_session() =
        runTest {
            val opening = checkNotNull(identity)
            for (replacement in listOf(opening.copy(userId = "other"), opening.copy(sessionId = "new-session"))) {
                identity = opening
                val deferred = CompletableDeferred<GigCheckoutIdentity?>()
                val c = coordinator { deferred.await() }
                identity = replacement
                c.start("gig", "bid")
                deferred.complete(replacement)
                advanceUntilIdle()
                assertFalse(c.isCurrentReadScope())
                assertFalse(c.isCurrentIdentity())
                assertEquals(GigBidCheckoutPhase.Idle, c.state.value.phase)
                assertEquals(0, acceptedCount)
            }
            coVerify(exactly = 0) { repo.acceptBid(any(), any()) }
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun anonymous_and_legacy_read_scopes_remain_stable_but_cannot_start_payment() =
        runTest {
            for (initial in listOf(null, checkNotNull(identity).copy(sessionId = null))) {
                identity = initial
                val coordinator = coordinator()
                assertTrue(coordinator.isCurrentReadScope())
                assertFalse(coordinator.isCurrentIdentity())
                coordinator.start("gig", "bid")
                advanceUntilIdle()
                assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
                identity = GigCheckoutIdentity("new", "session", "https://api.example.invalid")
                assertFalse(coordinator.isCurrentReadScope())
            }
            coVerify(exactly = 0) { repo.acceptBid(any(), any()) }
        }

    @Test fun unused_old_screen_cannot_adopt_a_new_account_on_first_start() =
        runTest {
            val coordinator = coordinator()
            assertTrue(coordinator.isCurrentIdentity())
            identity = identity?.copy(userId = "other")
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
            coVerify(exactly = 0) { repo.acceptBid(any(), any()) }
        }

    @Test fun dismiss_does_not_rebind_a_screen_to_a_new_login() =
        runTest {
            val coordinator = coordinator()
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            coordinator.dismiss()
            identity = identity?.copy(sessionId = "new")
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
            coVerify(exactly = 1) { repo.acceptBid(any(), any()) }
        }

    @Test fun delayed_list_from_the_initial_account_cannot_restore_into_a_new_account() =
        runTest {
            val coordinator = coordinator()
            assertTrue(coordinator.isCurrentIdentity())
            identity = identity?.copy(userId = "other")
            coordinator.restore("gig", listOf(checkNotNull(receipt().bid)))
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
            coVerify(exactly = 0) { repo.acceptBid(any(), any()) }
        }

    @Test fun retired_identity_keeps_existing_sdk_admission_until_original_callback() =
        runTest {
            val opening = identity
            val first = coordinator()
            first.start("gig", "bid")
            advanceUntilIdle()
            val oldToken = checkNotNull(first.state.value.presentation).token
            assertTrue(first.claimPresentation(oldToken))
            identity = identity?.copy(sessionId = "replacement")
            assertFalse(first.isCurrentReadScope())
            identity = opening
            assertFalse(first.isCurrentReadScope())
            val second = coordinator()
            second.start("gig", "bid")
            advanceUntilIdle()
            assertFalse(second.claimPresentation(checkNotNull(second.state.value.presentation).token))
            first.onSheetResult(oldToken, CheckoutOutcome.Paid)
            advanceUntilIdle()
            second.retry()
            advanceUntilIdle()
            assertTrue(second.claimPresentation(checkNotNull(second.state.value.presentation).token))
            assertEquals(0, acceptedCount)
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun another_screen_cannot_launch_the_same_gig_sheet_until_old_sdk_callback_returns() =
        runTest {
            val first = coordinator()
            val second = coordinator()
            first.start("gig", "bid")
            second.start("gig", "bid")
            advanceUntilIdle()
            val firstToken = checkNotNull(first.state.value.presentation).token
            val secondToken = checkNotNull(second.state.value.presentation).token
            assertTrue(first.claimPresentation(firstToken))
            assertFalse(second.claimPresentation(secondToken))
            assertEquals(GigBidCheckoutPhase.RetryAccept, second.state.value.phase)
            first.dismiss()
            second.retry()
            advanceUntilIdle()
            assertFalse(second.claimPresentation(checkNotNull(second.state.value.presentation).token))
            first.onSheetResult(firstToken, CheckoutOutcome.Paid)
            advanceUntilIdle()
            second.retry()
            advanceUntilIdle()
            assertTrue(second.claimPresentation(checkNotNull(second.state.value.presentation).token))
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun cancel_after_lost_committed_finalization_recovers_assignment_instead_of_claiming_canceled() =
        runTest {
            val coordinator = coordinator()
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            coEvery { repo.abortAcceptBid("gig", "bid") } returns NetworkResult.Failure(NetworkError.Server(409, null))
            coEvery { repo.bids("gig") } returns NetworkResult.Success(GigBidsResponse(listOf(checkNotNull(receipt("accepted").bid))))
            coordinator.cancel()
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Accepted, coordinator.state.value.phase)
            assertEquals(1, acceptedCount)
            coVerify(exactly = 1) { repo.finalizeAcceptBid("gig", "bid") }
        }

    @Test fun cold_retry_after_committed_finalization_gets_exact_final_receipt_without_sdk() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Failure(NetworkError.Server(409, null))
            coEvery { repo.bids("gig") } returns NetworkResult.Success(GigBidsResponse(listOf(checkNotNull(receipt("accepted").bid))))
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Accepted, coordinator.state.value.phase)
            assertNull(coordinator.state.value.presentation)
            coVerify(exactly = 1) { repo.finalizeAcceptBid("gig", "bid") }
        }

    @Test fun accepted_list_row_alone_cannot_claim_assignment_without_final_receipt() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Failure(NetworkError.Server(409, null))
            coEvery { repo.bids("gig") } returns NetworkResult.Success(GigBidsResponse(listOf(checkNotNull(receipt("accepted").bid))))
            coEvery { repo.finalizeAcceptBid("gig", "bid") } returns NetworkResult.Failure(NetworkError.Server(503, null))
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.RetryFinalize, coordinator.state.value.phase)
            assertEquals(0, acceptedCount)
        }

    @Test fun exact_authorized_hold_skips_sheet_and_requires_matching_final_receipt() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Success(receipt(ready = true))
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Accepted, coordinator.state.value.phase)
            assertEquals(1250, coordinator.state.value.amountCents)
            assertNull(coordinator.state.value.presentation)
            assertEquals(1, acceptedCount)
            coVerify(exactly = 1) { repo.finalizeAcceptBid("gig", "bid") }
        }

    @Test fun sdk_success_with_lost_finalization_retains_exact_bid_for_confirmation_retry() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.finalizeAcceptBid("gig", "bid") } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)), NetworkResult.Success(receipt("accepted")),
                )
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            val token = checkNotNull(coordinator.state.value.presentation).token
            coordinator.onSheetResult(token, CheckoutOutcome.Paid)
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.RetryFinalize, coordinator.state.value.phase)
            assertEquals(0, acceptedCount)
            coordinator.retry()
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Accepted, coordinator.state.value.phase)
            coVerify(exactly = 1) { repo.acceptBid("gig", "bid") }
            coVerify(exactly = 2) { repo.finalizeAcceptBid("gig", "bid") }
        }

    @Test fun unknown_cancellation_retains_a_retry_and_never_claims_completion() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.abortAcceptBid("gig", "bid") } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)), NetworkResult.Success(receipt("pending")),
                )
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            coordinator.onSheetResult(checkNotNull(coordinator.state.value.presentation).token, CheckoutOutcome.Canceled)
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.RetryCancel, coordinator.state.value.phase)
            assertEquals(0, acceptedCount)
            coordinator.retry()
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Canceled, coordinator.state.value.phase)
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun foreign_or_incomplete_http_receipts_never_report_success() =
        runTest {
            val patches =
                listOf(
                    receipt().copy(bid = GigBidDto("other", gigId = "gig", status = "pending_payment")),
                    receipt().copy(bid = GigBidDto("bid", gigId = "other", status = "pending_payment")),
                    receipt().copy(amountCents = null),
                    receipt().copy(amountCents = 0),
                    receipt().copy(currency = "eur"),
                    receipt().copy(paymentIntentId = null),
                    receipt().copy(isSetupIntent = true),
                    receipt(ready = true).copy(paymentStatus = "authorize_pending"),
                )
            for (patch in patches) {
                val coordinator = coordinator()
                coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Success(patch)
                coordinator.start("gig", "bid")
                advanceUntilIdle()
                assertEquals(GigBidCheckoutPhase.RetryAccept, coordinator.state.value.phase)
                assertNull(coordinator.state.value.presentation)
            }
            assertEquals(0, acceptedCount)
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun failed_or_wrong_finalization_receipt_preserves_confirmation_retry() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Success(receipt(ready = true))
            coEvery { repo.finalizeAcceptBid("gig", "bid") } returns NetworkResult.Success(receipt("pending_payment"))
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.RetryFinalize, coordinator.state.value.phase)
            assertEquals(0, acceptedCount)
        }

    @Test fun free_acceptance_also_requires_exact_accepted_bid() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Success(receipt("accepted").copy(amountCents = 0))
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            assertEquals(1, acceptedCount)
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun duplicate_taps_and_duplicate_sdk_callbacks_do_not_repeat_assignment() =
        runTest {
            val coordinator = coordinator()
            coordinator.start("gig", "bid")
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            val token = checkNotNull(coordinator.state.value.presentation).token
            coordinator.onSheetResult(token, CheckoutOutcome.Paid)
            coordinator.onSheetResult(token, CheckoutOutcome.Paid)
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.acceptBid(any(), any()) }
            coVerify(exactly = 1) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun delayed_accept_response_after_account_or_session_or_api_change_never_presents() =
        runTest {
            val original = checkNotNull(identity)
            for (changed in listOf(
                original.copy(userId = "other"),
                original.copy(sessionId = "new"),
                original.copy(apiOrigin = "https://other.invalid"),
                null,
            )) {
                identity = original
                val coordinator = coordinator()
                val response = CompletableDeferred<NetworkResult<GigBidAcceptResponse>>()
                coEvery { repo.acceptBid("gig", "bid") } coAnswers { response.await() }
                coordinator.start("gig", "bid")
                advanceUntilIdle()
                identity = changed
                response.complete(NetworkResult.Success(receipt()))
                advanceUntilIdle()
                assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
                assertNull(coordinator.state.value.presentation)
            }
        }

    @Test fun old_sdk_result_cannot_finalize_or_cancel_after_account_changes() =
        runTest {
            val coordinator = coordinator()
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            val token = checkNotNull(coordinator.state.value.presentation).token
            identity = identity?.copy(sessionId = "new-session")
            coordinator.onSheetResult(token, CheckoutOutcome.Paid)
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
            coVerify(exactly = 0) { repo.abortAcceptBid(any(), any()) }
        }

    @Test fun old_sdk_result_after_dismissal_and_a_new_sheet_is_ignored() =
        runTest {
            val coordinator = coordinator()
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            val old = checkNotNull(coordinator.state.value.presentation).token
            coordinator.dismiss()
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            val current = checkNotNull(coordinator.state.value.presentation).token
            coordinator.onSheetResult(old, CheckoutOutcome.Canceled)
            advanceUntilIdle()
            assertEquals(current, coordinator.state.value.presentation?.token)
            coVerify(exactly = 0) { repo.abortAcceptBid(any(), any()) }
        }

    @Test fun cold_restore_keeps_one_server_pending_bid_and_never_guesses_between_two() =
        runTest {
            val coordinator = coordinator()
            val pending = GigBidDto("bid", gigId = "gig", status = "pending_payment")
            coordinator.restore("gig", listOf(pending, pending.copy(id = "other")))
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
            coordinator.restore("gig", listOf(pending))
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.RetryAccept, coordinator.state.value.phase)
            assertEquals("bid", coordinator.state.value.bidId)
            coVerify(exactly = 0) { repo.acceptBid(any(), any()) }
            coordinator.retry()
            advanceUntilIdle()
            assertNotNull(coordinator.state.value.presentation)
        }

    @Test fun presentation_claim_checks_current_identity_and_is_not_replayed_on_rotation() =
        runTest {
            val coordinator = coordinator()
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            val token = checkNotNull(coordinator.state.value.presentation).token
            assertTrue(coordinator.claimPresentation(token))
            assertFalse(coordinator.claimPresentation(token))
            identity = identity?.copy(userId = "other")
            assertFalse(coordinator.claimPresentation(token))
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
        }

    @Test fun a_new_identity_cannot_adopt_the_previous_retry_selection() =
        runTest {
            val coordinator = coordinator()
            coEvery { repo.acceptBid("gig", "bid") } returns NetworkResult.Failure(NetworkError.Server(503, null))
            coordinator.start("gig", "bid")
            advanceUntilIdle()
            identity = identity?.copy(userId = "other")
            coordinator.retry()
            advanceUntilIdle()
            assertEquals(GigBidCheckoutPhase.Idle, coordinator.state.value.phase)
            coVerify(exactly = 1) { repo.acceptBid(any(), any()) }
        }
}
