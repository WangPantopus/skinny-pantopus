@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.payments.TipCheckout
import app.pantopus.android.data.api.models.payments.TipOriginal
import app.pantopus.android.data.api.models.payments.TipPreview
import app.pantopus.android.data.api.models.payments.TipReceipt
import app.pantopus.android.data.api.models.payments.TipRequest
import app.pantopus.android.data.api.models.payments.TipResponse
import app.pantopus.android.data.api.models.payments.TipTerms
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingGigTipStore
import app.pantopus.android.ui.screens.gigs.checkout.GigBidCheckoutAdmission
import app.pantopus.android.ui.screens.gigs.checkout.GigCheckoutIdentity
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GigTipRecoveryTest {
    private val gig = "11111111-1111-4111-8111-111111111111"
    private val actor = "22222222-2222-4222-8222-222222222222"
    private val worker = "33333333-3333-4333-8333-333333333333"
    private val requestId = "44444444-4444-4444-8444-444444444444"
    private val otherId = "55555555-5555-4555-8555-555555555555"
    private val session = "a".repeat(64)
    private val terms = TipTerms(gig, actor, worker, "2026-09-14T00:00:00Z")
    private val original = TipOriginal(requestId, requestId, gig, actor, worker, 500, "usd", terms)
    private val snapshot =
        GigDto(gig, "Existing task", userId = actor, status = "completed", acceptedBy = worker, ownerConfirmedAt = terms.ownerConfirmedAt)
    private val preview = TipPreview(actor, session, terms, true, null, null, null, 50, 99_999_999, 3)
    private val checkout = TipCheckout("pi_tip1", "pi_tip1_secret_fixture", "cus_payer", "ek_fixture", "pk_test_fixture")
    private val pending =
        TipResponse(actor, session, original, "pending", "pending", "requires_payment_method", "pi_tip1", false, true, null, checkout)
    private val receipt = TipReceipt(requestId, requestId, gig, actor, worker, 500, "usd", "succeeded", "pi_tip1", "ch_tip1", 500)
    private val succeeded =
        pending.copy(
            status = "succeeded",
            paymentStatus = "captured_hold",
            providerStatus = "succeeded",
            canCancel = false,
            receipt = receipt,
            checkout = null,
        )
    private val repository = mockk<PaymentsRepository>()
    private val store = MemoryStore()
    private val admission = GigBidCheckoutAdmission()
    private var currentIdentity = GigCheckoutIdentity(actor, "login1", "https://api.example.invalid/")
    private var marker = "login1"
    private val changes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    private inner class MemoryStore : PendingGigTipStore {
        var value: TipOriginal? = null
        var readFailure = false
        var writeFailure = false
        var clearFailure = false

        override suspend fun read(key: String): TipOriginal? {
            check(!readFailure)
            return value
        }

        override suspend fun replace(
            key: String,
            expected: TipOriginal?,
            next: TipOriginal?,
            canCommit: () -> Boolean,
        ) {
            check(!writeFailure && !(next == null && clearFailure) && value == expected && canCommit())
            value = next
        }
    }

    private fun TestScope.flow(): GigTipRecovery {
        coEvery { repository.tipPreview(gig) } returns NetworkResult.Success(preview)
        coEvery { repository.tipOriginal(requestId) } answers { NetworkResult.Success(pending.copy(request = original)) }
        coEvery { repository.tip(any()) } returns NetworkResult.Success(pending)
        return GigTipRecovery(gig, repository, store, backgroundScope, { currentIdentity }, { marker }, changes, admission, { requestId })
    }

    @Test fun firstSubmissionMustRetainExactOriginalBeforeCallingApi() =
        runTest {
            val flow = flow()
            coEvery { repository.tip(any()) } answers {
                assertEquals(original, store.value)
                val body = firstArg<TipRequest>()
                assertEquals(requestId, body.requestId)
                assertEquals(500, body.amount)
                assertEquals("resume", body.mode)
                assertEquals(session, body.expectedSessionScope)
                NetworkResult.Success(pending)
            }
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            assertEquals(original, store.value)
            assertNotNull(flow.state.value.presentation)
            assertNotEquals(TipStatus.Succeeded, flow.status.value)
        }

    @Test fun inaccessibleOrCorruptStorageNeverStartsPayment() =
        runTest {
            val flow = flow()
            store.readFailure = true
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            coVerify(exactly = 0) { repository.tip(any()) }
            assertNull(flow.state.value.presentation)
        }

    @Test fun failedRetentionNeverStartsPayment() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            store.writeFailure = true
            flow.send(500, snapshot)
            runCurrent()
            coVerify(exactly = 0) { repository.tip(any()) }
            assertNull(store.value)
        }

    @Test fun reopeningAfterLostReplyAnd404KeepsOneAmountAndUuid() =
        runTest {
            val first = flow()
            first.prepare()
            runCurrent()
            coEvery { repository.tip(any()) } returns NetworkResult.Failure(NetworkError.Transport(java.io.IOException("lost")))
            first.send(500, snapshot)
            runCurrent()
            first.retire()
            val reopened = flow()
            coEvery { repository.tipOriginal(requestId) } returns NetworkResult.Failure(NetworkError.NotFound)
            reopened.prepare()
            runCurrent()
            assertEquals(500, reopened.state.value.originalAmount)
            assertFalse(reopened.state.value.canChoose)
            reopened.send(1000, snapshot)
            runCurrent()
            coVerify(exactly = 1) { repository.tip(any()) }
            reopened.send(500, snapshot)
            runCurrent()
            coVerify(exactly = 2) { repository.tip(match { it.requestId == requestId && it.amount == 500 && it.mode == "resume" }) }
        }

    @Test fun retainedOnlyOpeningDoesNotRequestEligibilityForUnrelatedTasks() =
        runTest {
            val flow = flow()
            flow.prepare(retainedOnly = true)
            runCurrent()
            coVerify(exactly = 0) { repository.tipPreview(any()) }
            coVerify(exactly = 0) { repository.tip(any()) }
        }

    @Test fun retainedRequestRecoversWhenTaskWorkerAndConfirmationHaveDisappeared() =
        runTest {
            val flow = flow()
            store.value = original
            flow.prepare(retainedOnly = true)
            runCurrent()
            flow.send(500, snapshot.copy(acceptedBy = null, ownerConfirmedAt = null))
            runCurrent()
            coVerify { repository.tip(match { it.requestId == requestId && it.expectedTerms == terms && it.mode == "check" }) }
            val content = GigDetailViewModel.Projection.project(snapshot.copy(acceptedBy = null), emptyList(), viewerUserId = actor)
            val display = tipRecoveryDetailState(ContentDetailUiState.Loaded(content), flow.state.value) as ContentDetailUiState.Loaded
            assertEquals("Check tip status", display.content.dock.primary.label)
        }

    @Test fun changedCurrentWorkerOrConfirmationCannotAdmitNewTip() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot.copy(acceptedBy = actor))
            runCurrent()
            flow.send(500, snapshot.copy(ownerConfirmedAt = "2026-09-13T00:00:00Z"))
            runCurrent()
            coVerify(exactly = 0) { repository.tip(any()) }
            assertNull(store.value)
        }

    @Test fun equivalentIsoDateDoesNotBlockExistingTask() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot.copy(ownerConfirmedAt = "2026-09-14T00:00:00+00:00"))
            runCurrent()
            coVerify(exactly = 1) { repository.tip(any()) }
        }

    @Test fun legacyUnresolvedPaymentBlocksReplacement() =
        runTest {
            val flow = flow()
            coEvery { repository.tipPreview(gig) } returns NetworkResult.Success(preview.copy(eligible = false, legacyPaymentId = otherId))
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            assertFalse(flow.state.value.canChoose)
            coVerify(exactly = 0) { repository.tip(any()) }
        }

    @Test fun sdkPaidWithoutCommittedReceiptCannotReportSuccessOrClearOriginal() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            val token = checkNotNull(flow.state.value.presentation).token
            assertNotNull(flow.claimSheet(token))
            flow.onOutcome(token, CheckoutOutcome.Paid)
            runCurrent()
            assertNotEquals(TipStatus.Succeeded, flow.status.value)
            assertEquals(original, store.value)
        }

    @Test fun matchingReceiptAndSuccessfulCleanupAreRequiredForSuccess() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            val token = checkNotNull(flow.state.value.presentation).token
            assertNotNull(flow.claimSheet(token))
            coEvery { repository.tip(any()) } returns NetworkResult.Success(succeeded)
            flow.onOutcome(token, CheckoutOutcome.Paid)
            runCurrent()
            assertEquals(TipStatus.Succeeded, flow.status.value)
            assertNull(store.value)
        }

    @Test fun failedCleanupKeepsReceiptUnpublishedAndRecoverable() =
        runTest {
            val flow = flow()
            store.value = original
            store.clearFailure = true
            coEvery { repository.tipOriginal(requestId) } returns NetworkResult.Success(succeeded)
            flow.prepare()
            runCurrent()
            assertNotEquals(TipStatus.Succeeded, flow.status.value)
            assertEquals(original, store.value)
        }

    @Test fun sdkCanceledDoesNotCancelThePaymentImplicitly() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            val token = checkNotNull(flow.state.value.presentation).token
            assertNotNull(flow.claimSheet(token))
            flow.onOutcome(token, CheckoutOutcome.Canceled)
            runCurrent()
            coVerify(exactly = 0) { repository.tip(match { it.mode == "cancel" }) }
            assertEquals(original, store.value)
            assertNotEquals(TipStatus.Canceled, flow.status.value)
        }

    @Test fun explicitCancellationRequiresMatchingZeroChargeReceipt() =
        runTest {
            val flow = flow()
            store.value = original
            flow.prepare()
            runCurrent()
            val canceled =
                pending.copy(
                    status = "canceled",
                    paymentStatus = "canceled",
                    providerStatus = "canceled",
                    canCancel = false,
                    checkout = null,
                    receipt = receipt.copy(status = "canceled", chargeId = null, amountChargedCents = 0),
                )
            coEvery { repository.tip(any()) } returns NetworkResult.Success(canceled)
            flow.cancel()
            runCurrent()
            coVerify { repository.tip(match { it.mode == "cancel" && it.requestId == requestId }) }
            assertEquals(TipStatus.Canceled, flow.status.value)
            assertNull(store.value)
        }

    @Test fun wrongOrRepeatedSdkTicketCannotCheckOrCompleteAnotherAttempt() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            flow.onOutcome("wrong", CheckoutOutcome.Paid)
            runCurrent()
            coVerify(exactly = 1) { repository.tip(any()) }
            val token = checkNotNull(flow.state.value.presentation).token
            assertNotNull(flow.claimSheet(token))
            assertNull(flow.claimSheet(token))
            flow.onOutcome(token, CheckoutOutcome.Paid)
            runCurrent()
            flow.onOutcome(token, CheckoutOutcome.Paid)
            runCurrent()
            coVerify(exactly = 3) { repository.tip(any()) }
        }

    @Test fun changedIntentBeforeSdkPresentationKeepsOriginalWithoutLaunching() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            val token = checkNotNull(flow.state.value.presentation).token
            coEvery {
                repository.tip(any())
            } returns
                NetworkResult.Success(
                    pending.copy(
                        paymentIntentId = "pi_other",
                        checkout =
                            checkout.copy(
                                paymentIntentId = "pi_other", clientSecret = "pi_other_secret_fixture",
                            ),
                    ),
                )
            assertNull(flow.claimSheet(token))
            assertNull(flow.state.value.presentation)
            assertEquals(original, store.value)
        }

    @Test fun retiredScreenAndLateReceiptCannotClearRetainedOriginal() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            val reply = CompletableDeferred<NetworkResult<TipResponse>>()
            coEvery { repository.tip(any()) } coAnswers { reply.await() }
            flow.send(500, snapshot)
            runCurrent()
            flow.retire()
            reply.complete(NetworkResult.Success(succeeded))
            runCurrent()
            assertEquals(original, store.value)
            assertTrue(flow.state.value.invalidated)
            assertEquals(TipStatus.Idle, flow.status.value)
        }

    @Test fun changedAccountSessionOrOriginCannotLaunchOldCheckout() =
        runTest {
            val flow = flow()
            flow.prepare()
            runCurrent()
            flow.send(500, snapshot)
            runCurrent()
            val token = checkNotNull(flow.state.value.presentation).token
            currentIdentity = currentIdentity.copy(apiOrigin = "https://another.example.invalid/")
            assertNull(flow.claimSheet(token))
            assertTrue(flow.state.value.invalidated)
            assertEquals(original, store.value)
        }

    @Test fun markerChangeWhileReadIsPendingRetiresOldState() =
        runTest {
            val flow = flow()
            store.value = original
            val reply = CompletableDeferred<NetworkResult<TipResponse>>()
            coEvery { repository.tipOriginal(requestId) } coAnswers { reply.await() }
            flow.prepare()
            runCurrent()
            marker = "login2"
            changes.tryEmit(Unit)
            runCurrent()
            reply.complete(NetworkResult.Success(succeeded))
            runCurrent()
            assertTrue(flow.state.value.invalidated)
            assertEquals(original, store.value)
        }

    @Test fun secondScreenCannotPresentWhileFirstOwnsSdkAndCanRecoverAfterRetirement() =
        runTest {
            val first = flow()
            first.prepare()
            runCurrent()
            first.send(500, snapshot)
            runCurrent()
            val second = flow()
            second.prepare()
            runCurrent()
            assertNull(second.state.value.presentation)
            coVerify(exactly = 1) { repository.tip(any()) }
            first.retire()
            second.prepare()
            runCurrent()
            second.send(500, snapshot)
            runCurrent()
            assertNotNull(second.state.value.presentation)
            coVerify(exactly = 2) { repository.tip(any()) }
        }

    @Test fun conflictingServerOriginalNeedsExplicitVerifiedAdoption() =
        runTest {
            val flow = flow()
            store.value = original
            val other = original.copy(requestId = otherId, paymentId = otherId, amountCents = 1000)
            coEvery { repository.tipOriginal(requestId) } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { repository.tipPreview(gig) } returns NetworkResult.Success(preview.copy(eligible = false, activeRequestId = otherId))
            coEvery { repository.tipOriginal(otherId) } returns NetworkResult.Success(pending.copy(request = other))
            flow.prepare()
            runCurrent()
            assertEquals(original, store.value)
            flow.send(500, snapshot)
            runCurrent()
            assertEquals(other, store.value)
            coVerify(exactly = 0) { repository.tip(any()) }
        }

    @Test fun staleAdoptionCannotReplaceAnotherScreenOriginal() =
        runTest {
            val flow = flow()
            store.value = original
            flow.prepare()
            runCurrent()
            store.value = original.copy(requestId = otherId, paymentId = otherId)
            flow.send(500, snapshot)
            runCurrent()
            coVerify(exactly = 0) { repository.tip(any()) }
            assertEquals(otherId, store.value?.requestId)
        }

    @Test fun mismatchedReceiptsCannotSucceedOrClearOriginal() =
        runTest {
            val variants =
                listOf(
                    receipt.copy(requestId = otherId), receipt.copy(paymentId = otherId), receipt.copy(gigId = otherId),
                    receipt.copy(payerId = worker), receipt.copy(payeeId = actor), receipt.copy(amountCents = 1000),
                    receipt.copy(currency = "eur"), receipt.copy(status = "canceled"), receipt.copy(paymentIntentId = "pi_other"),
                    receipt.copy(chargeId = null), receipt.copy(amountChargedCents = 0),
                )
            for (candidate in variants) {
                val flow = flow()
                store.value = original
                coEvery { repository.tipOriginal(requestId) } returns NetworkResult.Success(succeeded.copy(receipt = candidate))
                flow.prepare()
                runCurrent()
                assertNotEquals(TipStatus.Succeeded, flow.status.value)
                assertEquals(original, store.value)
                flow.retire()
            }
        }

    @Test fun refundOrDisputeReceiptDoesNotAnnounceANewTip() =
        runTest {
            val flow = flow()
            store.value = original
            coEvery { repository.tipOriginal(requestId) } returns NetworkResult.Success(succeeded.copy(paymentStatus = "disputed"))
            flow.prepare()
            runCurrent()
            assertTrue(flow.status.value is TipStatus.Failed)
            assertNull(store.value)
        }

    @Test fun inputRejectsNonfiniteAndOutOfRangeAmounts() {
        for (amount in listOf("NaN", "Infinity", "1e100", "-1", "0.49", "1000000")) assertNull(tipAmountCents(amount))
        assertEquals(50, tipAmountCents(".50"))
        assertEquals(500, tipAmountCents("$5.00"))
        assertEquals(99_999_999, tipAmountCents("999,999.99"))
    }

    @Test fun nonActiveConflictCannotOfferAnotherOriginalForAdoption() =
        runTest {
            val flow = flow()
            store.value = original
            flow.prepare()
            runCurrent()
            coEvery { repository.tip(any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        409, "{\"code\":\"TIP_TERMS_CHANGED\",\"activeRequestId\":\"$otherId\"}",
                    ),
                )
            flow.send(500, snapshot)
            runCurrent()
            assertEquals(original, store.value)
            assertNotEquals("View pending tip", flow.state.value.actionTitle)
            coVerify(exactly = 0) { repository.tipPreview(any()) }
        }

    @Test fun onlyVerifiedActiveConflictMayOfferExplicitAdoption() =
        runTest {
            val flow = flow()
            store.value = original
            flow.prepare()
            runCurrent()
            val other = original.copy(requestId = otherId, paymentId = otherId, amountCents = 1000)
            coEvery { repository.tip(any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        409, "{\"code\":\"TIP_ACTIVE\",\"activeRequestId\":\"$otherId\"}",
                    ),
                )
            coEvery { repository.tipPreview(gig) } returns NetworkResult.Success(preview.copy(eligible = false, activeRequestId = otherId))
            coEvery { repository.tipOriginal(otherId) } returns NetworkResult.Success(pending.copy(request = other))
            flow.send(500, snapshot)
            runCurrent()
            assertEquals("View pending tip", flow.state.value.actionTitle)
            assertEquals(original, store.value)
            flow.send(500, snapshot)
            runCurrent()
            assertEquals(other, store.value)
        }
}
