@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.models.payments.PaymentRefundAttempt
import app.pantopus.android.data.api.models.payments.PaymentRefundConflictDto
import app.pantopus.android.data.api.models.payments.PaymentRefundHistoryDto
import app.pantopus.android.data.api.models.payments.PaymentRefundRequestDto
import app.pantopus.android.data.api.models.payments.PaymentRefundResultDto
import app.pantopus.android.data.api.models.payments.RefundPaymentSummary
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingRefundStore
import app.pantopus.android.data.payments.RefundValidation
import com.squareup.moshi.Moshi
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
import java.io.IOException

private class MemoryRefundStore : PendingRefundStore {
    val values = mutableMapOf<String, PaymentRefundAttempt>()
    var failSave = false
    var beforeSave: suspend () -> Unit = {}

    override suspend fun read(scope: String): PaymentRefundAttempt? = values[scope]

    override suspend fun save(
        scope: String,
        attempt: PaymentRefundAttempt,
    ) {
        beforeSave()
        if (failSave) throw IOException("Could not save recovery details.")
        if (attempt.description == null) values[scope] = attempt
    }

    override suspend fun clear(scope: String) {
        values.remove(scope)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class GigRefundCoordinatorTest {
    private val paymentId = "11111111-1111-4111-8111-111111111111"
    private val requestId = "22222222-2222-4222-8222-222222222222"
    private val repo = mockk<PaymentsRepository>()
    private val store = MemoryRefundStore()
    private val moshi = Moshi.Builder().build()
    private var identity: GigRefundIdentity? = GigRefundIdentity("payer", "session", "https://api.example.invalid")
    private var changed = 0
    private val posts = mutableListOf<PaymentRefundAttempt>()
    private val payment = GigPaymentDto(id = paymentId, gigId = "gig", payerId = "payer", amountTotal = 1000, currency = "usd")

    private fun summary(
        status: String = "captured_hold",
        refunded: Int = 0,
        release: String = "held",
    ) = RefundPaymentSummary(
        paymentId,
        status,
        1000,
        refunded,
        "usd",
        if (status == "authorized") null else "2026-09-10T00:00:00Z",
        release,
    )

    private fun receipt(
        attempt: PaymentRefundAttempt,
        status: String = "pending",
        canRetry: Boolean = true,
        operation: String = "refund",
    ) = PaymentRefundRequestDto(
        attempt.requestId, paymentId, operation, attempt.requestedAmountCents ?: 1000,
        "usd", status, canRetry, attempt.requestedAmountCents, attempt.reason, attempt.description,
    )

    private fun TestScope.coordinator(identityReader: suspend () -> GigRefundIdentity? = { identity }): GigRefundCoordinator {
        coEvery { repo.refunds(paymentId) } returns NetworkResult.Success(PaymentRefundHistoryDto(emptyList(), summary()))
        coEvery { repo.refund(paymentId, any()) } coAnswers {
            val attempt = secondArg<PaymentRefundAttempt>()
            assertEquals(attempt, store.values.values.single())
            posts += attempt
            NetworkResult.Failure(NetworkError.Server(503, null))
        }
        return GigRefundCoordinator(repo, store, this, identityReader, moshi, { identity?.toString() }, onChanged = { changed++ })
    }

    @Test fun suspendedScopeCheckCannotUndoPermanentRetirement() =
        runTest {
            val opening = identity
            val waiting = CompletableDeferred<GigRefundIdentity?>()
            var reads = 0
            val c = coordinator { if (++reads == 2) waiting.await() else identity }
            val inFlight = async { c.isCurrentIdentity() }
            runCurrent()
            identity = identity?.copy(session = "replacement")
            assertFalse(c.isCurrentIdentity())
            identity = opening
            waiting.complete(opening)
            assertFalse(inFlight.await())
            assertFalse(c.isCurrentIdentity())
        }

    @Test fun delayedOpeningIdentityCannotAdoptReplacementActorOrSession() =
        runTest {
            val opening = checkNotNull(identity)
            val saved = PaymentRefundAttempt(requestId, null, "requested_by_customer")
            store.values["${opening.apiOrigin}|${opening.actorId}|$paymentId"] = saved
            for (replacement in listOf(opening.copy(actorId = "other"), opening.copy(session = "new-session"))) {
                identity = opening
                val deferred = CompletableDeferred<GigRefundIdentity?>()
                val c = coordinator { deferred.await() }
                c.open("gig", payment)
                identity = replacement
                deferred.complete(replacement)
                advanceUntilIdle()
                c.retry()
                c.checkStatus()
                advanceUntilIdle()
                assertTrue(c.state.value.invalidated)
                assertFalse(c.state.value.mayRequest)
                assertFalse(c.state.value.mayRetry)
                assertNull(c.state.value.summary)
                assertEquals(saved, store.values.values.single())
                assertEquals(0, changed)
            }
            coVerify(exactly = 0) { repo.refunds(any()) }
            coVerify(exactly = 0) { repo.refund(any(), any()) }
        }

    @Test fun unknownResultSurvivesRestartAndRetriesOriginalTerms() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            assertTrue(flow.state.value.mayRequest)
            flow.submit("3.00", "work_not_completed")
            advanceUntilIdle()
            val saved = store.values.values.single()
            assertEquals(300, saved.requestedAmountCents)
            flow.close()
            val restarted = coordinator()
            restarted.open("gig", payment)
            advanceUntilIdle()
            assertTrue(restarted.state.value.mayRetry)
            assertFalse(restarted.state.value.mayRequest)
            coEvery { repo.refund(paymentId, saved) } coAnswers {
                posts += saved
                NetworkResult.Success(PaymentRefundResultDto(receipt(saved, "succeeded"), summary("refunded_partial", 300)))
            }
            restarted.retry()
            advanceUntilIdle()
            assertEquals(listOf(saved, saved), posts)
            assertTrue(store.values.isEmpty())
            assertEquals(700, restarted.state.value.summary?.remaining)
            assertEquals("succeeded", restarted.state.value.requests.single().status)
            assertEquals(1, changed)
        }

    @Test fun completedHistoryUsesGetOnlyAndClearsExactLocalOperation() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            flow.submit("", "requested_by_customer")
            advanceUntilIdle()
            val saved = store.values.values.single()
            assertNull(saved.requestedAmountCents)
            coEvery {
                repo.refunds(paymentId)
            } returns NetworkResult.Success(PaymentRefundHistoryDto(listOf(receipt(saved, "succeeded")), summary("refunded_full", 1000)))
            flow.checkStatus()
            advanceUntilIdle()
            assertTrue(store.values.isEmpty())
            assertFalse(flow.state.value.mayRequest)
            assertEquals(1, posts.size)
            coVerify(exactly = 2) { repo.refunds(paymentId) }
        }

    @Test fun releaseUsesNullAmountAndShowsReleaseReceiptInsteadOfRefund() =
        runTest {
            val flow = coordinator()
            coEvery { repo.refunds(paymentId) } returns NetworkResult.Success(PaymentRefundHistoryDto(emptyList(), summary("authorized")))
            flow.open("gig", payment)
            advanceUntilIdle()
            flow.submit("2.00", "requested_by_customer")
            advanceUntilIdle()
            val attempt = store.values.values.single()
            assertNull(attempt.requestedAmountCents)
            coEvery {
                repo.refunds(paymentId)
            } returns
                NetworkResult.Success(
                    PaymentRefundHistoryDto(listOf(receipt(attempt, "succeeded", operation = "release")), summary("canceled")),
                )
            flow.checkStatus()
            advanceUntilIdle()
            assertTrue(RefundValidation.receiptMessage(flow.state.value.requests.single()).contains("No captured charge"))
            assertEquals(1, posts.size)
        }

    @Test fun storageFailurePreventsPostAndCanBeRetriedAfterRead() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            store.failSave = true
            flow.submit("3", "duplicate")
            advanceUntilIdle()
            assertTrue(posts.isEmpty())
            assertNotNull(flow.state.value.error)
            store.failSave = false
            flow.checkStatus()
            advanceUntilIdle()
            assertTrue(flow.state.value.mayRequest)
        }

    @Test fun currentServerRetryPermissionControlsHistoricalRequestsAndDescriptionsStayOffDisk() =
        runTest {
            val flow = coordinator()
            val attempt = PaymentRefundAttempt(requestId, 25, "other", "From another client")
            coEvery {
                repo.refunds(paymentId)
            } returns NetworkResult.Success(PaymentRefundHistoryDto(listOf(receipt(attempt, canRetry = false)), summary()))
            flow.open("gig", payment)
            advanceUntilIdle()
            flow.retry()
            advanceUntilIdle()
            assertFalse(flow.state.value.mayRetry)
            assertFalse(flow.state.value.mayRequest)
            assertTrue(store.values.isEmpty())
            assertTrue(posts.isEmpty())
        }

    @Test fun foreignPaymentOrChangedOriginalTermsCannotClearSavedOperation() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            flow.submit("3", "other")
            advanceUntilIdle()
            val original = store.values.values.single()
            for (history in listOf(
                PaymentRefundHistoryDto(listOf(receipt(original.copy(reason = "duplicate"), "succeeded")), summary()),
                PaymentRefundHistoryDto(listOf(receipt(original, "succeeded")), summary().copy(id = requestId)),
            )) {
                coEvery { repo.refunds(paymentId) } returns NetworkResult.Success(history)
                flow.checkStatus()
                advanceUntilIdle()
                assertEquals(original, store.values.values.single())
                assertFalse(flow.state.value.mayRetry)
                assertTrue(flow.state.value.requests.isEmpty())
            }
        }

    @Test fun malformedSuccessReceiptNeverClaimsCompletion() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            coEvery { repo.refund(paymentId, any()) } coAnswers {
                val attempt = secondArg<PaymentRefundAttempt>()
                NetworkResult.Success(PaymentRefundResultDto(receipt(attempt.copy(requestId = requestId), "succeeded"), summary()))
            }
            flow.submit("3", "duplicate")
            advanceUntilIdle()
            assertTrue(flow.state.value.requests.isEmpty())
            assertNotNull(flow.state.value.attempt)
            assertEquals(0, changed)
        }

    @Test fun onlyExplicitActiveConflictCanReplaceUnknownLocalIdentity() =
        runTest {
            for (code in listOf("REQUEST_CONFLICT", "REFUND_ACTIVE")) {
                store.values.clear()
                val flow = coordinator()
                flow.open("gig", payment)
                advanceUntilIdle()
                val other = PaymentRefundAttempt(requestId, null, "requested_by_customer")
                val body = moshi.adapter(PaymentRefundConflictDto::class.java).toJson(PaymentRefundConflictDto(code, receipt(other)))
                coEvery { repo.refund(paymentId, any()) } returns NetworkResult.Failure(NetworkError.ClientError(409, body))
                flow.submit("3", "duplicate")
                advanceUntilIdle()
                if (code == "REFUND_ACTIVE") {
                    assertEquals(other, flow.state.value.attempt)
                    assertTrue(store.values.isEmpty())
                } else {
                    assertEquals(store.values.values.single(), flow.state.value.attempt)
                    assertFalse(flow.state.value.attempt?.requestId == requestId)
                }
                assertFalse(flow.state.value.ready)
                flow.close()
            }
        }

    @Test fun newRequestsStopAfterWorkerReleaseButHistoryStillLoads() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            for (release in listOf("wallet_credited", "external_transfer", "unknown")) {
                coEvery { repo.refunds(paymentId) } returns
                    NetworkResult.Success(
                        PaymentRefundHistoryDto(emptyList(), summary(release = release)),
                    )
                flow.checkStatus()
                advanceUntilIdle()
                flow.submit("3", "other")
                advanceUntilIdle()
                assertFalse(flow.state.value.mayRequest)
                assertNotNull(RefundValidation.releaseMessage(checkNotNull(flow.state.value.summary)))
            }
            assertTrue(posts.isEmpty())
            coVerify(exactly = 4) { repo.refunds(paymentId) }
        }

    @Test fun oldUnusedScreenAndDismissedScreenCannotAdoptReplacementSession() =
        runTest {
            val flow = coordinator()
            identity = identity?.copy(session = "replacement")
            flow.open("gig", payment)
            advanceUntilIdle()
            assertTrue(flow.state.value.invalidated)
            flow.close()
            identity = identity?.copy(session = "session")
            flow.open("gig", payment)
            advanceUntilIdle()
            assertTrue(flow.state.value.invalidated)
            coVerify(exactly = 0) { repo.refunds(any()) }
        }

    @Test fun identityChangeDuringStoragePreventsPostAndPreservesScopedRecovery() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            val saving = CompletableDeferred<Unit>()
            store.beforeSave = { saving.await() }
            flow.submit("3", "other")
            runCurrent()
            identity = identity?.copy(actorId = "other")
            saving.complete(Unit)
            advanceUntilIdle()
            assertTrue(posts.isEmpty())
            assertEquals(1, store.values.size)
            assertTrue(store.values.keys.single().contains("|payer|"))
            assertTrue(flow.state.value.invalidated)
            assertNull(flow.state.value.summary)
        }

    @Test fun delayedPostAfterOriginChangeCannotShowSuccessOrRunCallbacks() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            val response = CompletableDeferred<Unit>()
            coEvery { repo.refund(paymentId, any()) } coAnswers {
                response.await()
                NetworkResult.Success(PaymentRefundResultDto(receipt(secondArg(), "succeeded"), summary("refunded_partial", 300)))
            }
            flow.submit("3", "other")
            runCurrent()
            identity = identity?.copy(apiOrigin = "https://other.example.invalid")
            response.complete(Unit)
            advanceUntilIdle()
            assertTrue(flow.state.value.invalidated)
            assertTrue(flow.state.value.requests.isEmpty())
            assertEquals(1, store.values.size)
            assertEquals(0, changed)
        }

    @Test fun anotherScreenCannotPostUntilOriginalOperationReleasesLease() =
        runTest {
            val first = coordinator()
            val second = coordinator()
            first.open("gig", payment)
            second.open("gig", payment)
            advanceUntilIdle()
            val response = CompletableDeferred<Unit>()
            coEvery { repo.refund(paymentId, any()) } coAnswers {
                posts += secondArg<PaymentRefundAttempt>()
                response.await()
                NetworkResult.Failure(NetworkError.Server(503, null))
            }
            first.submit("3", "other")
            runCurrent()
            second.submit("3", "other")
            runCurrent()
            assertEquals(1, posts.size)
            response.complete(Unit)
            advanceUntilIdle()
            second.checkStatus()
            advanceUntilIdle()
            assertEquals(posts.single(), second.state.value.attempt)
            assertTrue(second.state.value.mayRetry)
        }

    @Test fun invalidReopenCannotReuseThePreviousPaymentTarget() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            assertNotNull(flow.state.value.summary)
            flow.open("other-gig", payment)
            advanceUntilIdle()
            assertNull(flow.state.value.summary)
            assertNotNull(flow.state.value.error)
            flow.checkStatus()
            advanceUntilIdle()
            assertNull(flow.state.value.summary)
            assertTrue(flow.state.value.requests.isEmpty())
            coVerify(exactly = 1) { repo.refunds(any()) }
            coVerify(exactly = 0) { repo.refund(any(), any()) }
        }

    @Test fun amountValidationAndExactPayerTargetBlockInvalidActions() =
        runTest {
            val flow = coordinator()
            flow.open("gig", payment)
            advanceUntilIdle()
            for (amount in listOf("0.49", "10.01", "x", "3.001", "-1", "99999999999999999999999")) {
                flow.submit(amount, "other")
                advanceUntilIdle()
                assertTrue(posts.isEmpty())
            }
            assertFalse(GigRefundCoordinator.validTarget("gig", payment, "worker"))
            assertFalse(GigRefundCoordinator.validTarget("other", payment, "payer"))
            assertFalse(GigRefundCoordinator.validTarget("gig", payment.copy(currency = "eur"), "payer"))
            flow.submit(".50", "other")
            advanceUntilIdle()
            assertTrue(posts.isEmpty())
            flow.submit("0.50", "other")
            advanceUntilIdle()
            assertEquals(50, posts.single().requestedAmountCents)
        }
}
