@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.gigs.authorization

import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationBody
import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationDto
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.checkout.GigBidCheckoutAdmission
import app.pantopus.android.ui.screens.gigs.checkout.GigCheckoutIdentity
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
class GigAssignedAuthorizationCoordinatorTest {
    private val payer = "11111111-1111-4111-8111-111111111111"
    private val worker = "22222222-2222-4222-8222-222222222222"
    private val paymentId = "33333333-3333-4333-8333-333333333333"
    private val gigId = "44444444-4444-4444-8444-444444444444"
    private val repo = mockk<GigsRepository>()
    private val admission = GigBidCheckoutAdmission()
    private var identity: GigCheckoutIdentity? = GigCheckoutIdentity(payer, "session", "https://api.example.invalid/")
    private var readyCalls = 0
    private val fingerprint = "a".repeat(64)
    private val gig = GigDto(gigId, "Task", price = 12.0, status = "assigned", userId = payer, acceptedBy = worker, paymentId = paymentId)
    private val payment =
        GigPaymentDto(
            id = paymentId,
            gigId = gigId,
            payerId = payer,
            payeeId = worker,
            amountTotal = 1200,
            currency = "USD",
            paymentStatus = "authorization_failed",
        )

    private fun receipt() =
        GigAssignedAuthorizationDto(
            gigId, paymentId, identity?.userId, payer, worker, fingerprint,
            "attempt", "pi_exact", 1200, "usd", "authorization_failed", "requires_action", false, false,
            "action_required", true, false, null, "pi_exact_secret_transient",
        )

    private fun ready() =
        receipt().copy(
            paymentStatus = "authorized",
            providerStatus = "requires_capture",
            authorizationReady = true,
            alreadyAuthorized = true,
            recoveryState = "ready",
            canRetry = false,
            clientSecret = null,
        )

    private fun TestScope.coordinator(
        identityReader: suspend () -> GigCheckoutIdentity? = { identity },
    ): GigAssignedAuthorizationCoordinator {
        coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(receipt())
        coEvery { repo.continueAssignedAuthorization(gigId, any()) } returns NetworkResult.Success(receipt())
        return GigAssignedAuthorizationCoordinator(
            repo,
            this,
            identityReader,
            { identity?.toString() },
            onReady = { readyCalls++ },
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

    @Test fun `delayed opening identity cannot adopt replacement actor or session`() =
        runTest {
            val opening = checkNotNull(identity)
            for (replacement in listOf(opening.copy(userId = "other"), opening.copy(sessionId = "new-session"))) {
                identity = opening
                val deferred = CompletableDeferred<GigCheckoutIdentity?>()
                val c = coordinator { deferred.await() }
                c.open(gig, payment)
                identity = replacement
                deferred.complete(replacement)
                advanceUntilIdle()
                c.continueAuthorization()
                c.checkStatus()
                advanceUntilIdle()
                assertTrue(c.state.value.invalidated)
                assertNull(c.state.value.progress)
                assertNull(c.state.value.presentation)
                assertEquals(0, readyCalls)
            }
            coVerify(exactly = 0) { repo.assignedAuthorizationStatus(any()) }
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `cold opening only checks exact status and retains no secret in visible receipt`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            assertEquals(1200, c.state.value.progress?.amountCents)
            assertTrue(c.state.value.mayContinue)
            assertNull(c.state.value.progress?.clientSecret)
            assertNull(c.state.value.presentation)
            coVerify(exactly = 1) { repo.assignedAuthorizationStatus(gigId) }
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `explicit continuation sends frozen actor session payer and exact money before SDK`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            coVerify {
                repo.continueAssignedAuthorization(
                    gigId,
                    GigAssignedAuthorizationBody(payer, fingerprint, paymentId, payer, worker, 1200),
                )
            }
            assertNotNull(c.state.value.presentation)
            assertEquals(0, readyCalls)
        }

    @Test fun `SDK completion alone never confirms a hold and a later exact read recovers it`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            val token = checkNotNull(c.state.value.presentation).token
            assertTrue(c.claimPresentation(token))
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Failure(NetworkError.Server(503, null))
            c.onSheetResult(token, CheckoutOutcome.Paid)
            advanceUntilIdle()
            assertEquals(0, readyCalls)
            assertNull(c.state.value.progress)
            assertFalse(c.state.value.mayContinue)
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(ready())
            c.checkStatus()
            advanceUntilIdle()
            assertEquals(1, readyCalls)
            assertTrue(c.state.value.progress?.authorizationReady == true)
        }

    @Test fun `already authorized same payment bypasses another SDK and repeated reads do not reload`() =
        runTest {
            val c = coordinator()
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(ready())
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            c.checkStatus()
            advanceUntilIdle()
            assertEquals(1, readyCalls)
            assertNull(c.state.value.presentation)
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `missing secret and contradictory readiness cannot imply success`() =
        runTest {
            val c = coordinator()
            for (bad in listOf(
                receipt().copy(clientSecret = null),
                receipt().copy(authorizationReady = true, alreadyAuthorized = true),
                ready().copy(amountCents = 1199),
            )) {
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(bad)
                c.open(gig, payment)
                advanceUntilIdle()
                assertNull(c.state.value.progress)
                assertEquals(0, readyCalls)
                c.close()
            }
        }

    @Test fun `changed payment actor payer worker currency and amount reject the response`() =
        runTest {
            val c = coordinator()
            for (bad in listOf(
                receipt().copy(paymentId = "other"),
                receipt().copy(gigId = "other"),
                receipt().copy(actorId = worker),
                receipt().copy(payerId = worker),
                receipt().copy(payeeId = payer),
                receipt().copy(currency = "eur"),
                receipt().copy(amountCents = 1300),
            )) {
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(bad)
                c.open(gig, payment)
                advanceUntilIdle()
                assertNull(c.state.value.progress)
                c.close()
            }
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `verified business manager freezes payer separately from actor`() =
        runTest {
            identity = identity?.copy(userId = "delegate")
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            coVerify {
                repo.continueAssignedAuthorization(
                    gigId,
                    GigAssignedAuthorizationBody("delegate", fingerprint, paymentId, payer, worker, 1200),
                )
            }
            assertNotNull(c.state.value.presentation)
        }

    @Test fun `worker never reaches payer recovery`() =
        runTest {
            identity = identity?.copy(userId = worker)
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.assignedAuthorizationStatus(any()) }
            assertFalse(c.state.value.mayContinue)
        }

    @Test fun `server session replacement before delayed device signal prevents SDK and next mutation`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            coEvery {
                repo.continueAssignedAuthorization(gigId, any())
            } returns NetworkResult.Failure(NetworkError.ClientError(409, "SESSION_SCOPE_CHANGED"))
            c.continueAuthorization()
            advanceUntilIdle()
            assertNull(c.state.value.presentation)
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(receipt().copy(sessionScope = "b".repeat(64)))
            c.checkStatus()
            advanceUntilIdle()
            assertNull(c.state.value.progress)
            assertFalse(c.state.value.mayContinue)
            c.continueAuthorization()
            coVerify(exactly = 1) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `old unused or dismissed screen cannot start under a new account session or API`() =
        runTest {
            val first = checkNotNull(identity)
            for (replacement in listOf(
                first.copy(userId = worker),
                first.copy(sessionId = "new"),
                first.copy(apiOrigin = "https://other.invalid/"),
            )) {
                identity = first
                val c = coordinator()
                c.close()
                identity = replacement
                c.open(gig, payment)
                advanceUntilIdle()
                assertTrue(c.state.value.invalidated)
                assertNull(c.state.value.progress)
            }
            coVerify(exactly = 0) { repo.assignedAuthorizationStatus(any()) }
        }

    @Test fun `late status response after account change cannot reveal previous payment`() =
        runTest {
            val c = coordinator()
            val delayed = CompletableDeferred<NetworkResult<GigAssignedAuthorizationDto>>()
            coEvery { repo.assignedAuthorizationStatus(gigId) } coAnswers { delayed.await() }
            c.open(gig, payment)
            runCurrent()
            identity = identity?.copy(sessionId = "replacement")
            delayed.complete(NetworkResult.Success(ready()))
            advanceUntilIdle()
            assertTrue(c.state.value.invalidated)
            assertNull(c.state.value.progress)
            assertEquals(0, readyCalls)
        }

    @Test fun `late SDK callback cannot operate after close and reopen`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            val old = checkNotNull(c.state.value.presentation).token
            assertTrue(c.claimPresentation(old))
            c.close()
            c.open(gig, payment)
            advanceUntilIdle()
            c.onSheetResult(old, CheckoutOutcome.Paid)
            advanceUntilIdle()
            coVerify(exactly = 3) { repo.assignedAuthorizationStatus(gigId) }
            assertEquals(0, readyCalls)
        }

    @Test fun `same gig screens admit one SDK and closing releases its lease`() =
        runTest {
            val a = coordinator()
            val b = coordinator()
            a.open(gig, payment)
            b.open(gig, payment)
            advanceUntilIdle()
            a.continueAuthorization()
            b.continueAuthorization()
            advanceUntilIdle()
            assertTrue(a.claimPresentation(checkNotNull(a.state.value.presentation).token))
            assertFalse(b.claimPresentation(checkNotNull(b.state.value.presentation).token))
            assertNotNull(b.state.value.message)
            a.close()
            b.continueAuthorization()
            advanceUntilIdle()
            assertTrue(b.claimPresentation(checkNotNull(b.state.value.presentation).token))
            b.close()
        }

    @Test fun `cancel pending and scheduled future receipts offer check without provider mutation`() =
        runTest {
            val c = coordinator()
            for (waiting in listOf(
                receipt().copy(recoveryState = "pending", canRetry = false, cancellationPending = true, clientSecret = null),
                receipt().copy(
                    recoveryState = "pending",
                    canRetry = false,
                    authorizationAvailableAt = "2026-10-10T01:00:00Z",
                    clientSecret = null,
                ),
            )) {
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(waiting)
                c.open(gig, payment)
                advanceUntilIdle()
                assertNotNull(c.state.value.progress)
                assertFalse(c.state.value.mayContinue)
                c.continueAuthorization()
                c.close()
            }
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `unknown continuation recovers same server payment on cold reopening without auto retry`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            coEvery { repo.continueAssignedAuthorization(gigId, any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
            c.continueAuthorization()
            advanceUntilIdle()
            assertNull(c.state.value.progress)
            c.close()
            val resumed = coordinator()
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(ready())
            resumed.open(gig, payment)
            advanceUntilIdle()
            assertEquals(1, readyCalls)
            coVerify(exactly = 1) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `invalid reopen clears old target before any check status`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.open(gig.copy(paymentId = "replacement"), payment)
            advanceUntilIdle()
            c.checkStatus()
            advanceUntilIdle()
            assertNull(c.state.value.progress)
            coVerify(exactly = 1) { repo.assignedAuthorizationStatus(gigId) }
        }

    @Test fun `SDK cancellation and presentation failure stay unconfirmed and release admission`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            val token = checkNotNull(c.state.value.presentation).token
            assertTrue(c.claimPresentation(token))
            c.onSheetResult(token, CheckoutOutcome.Canceled)
            advanceUntilIdle()
            assertNull(c.state.value.progress)
            assertEquals(0, readyCalls)
            c.checkStatus()
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            val next = checkNotNull(c.state.value.presentation).token
            assertTrue(c.claimPresentation(next))
            c.presentationFailed(next)
            advanceUntilIdle()
            assertNull(c.state.value.presentation)
            assertEquals(0, readyCalls)
        }

    @Test fun `anonymous screen cannot read or mutate payment while public gig scope is separate`() =
        runTest {
            identity = null
            val c = coordinator()
            assertFalse(c.isCurrentReadScope())
            c.open(gig, payment)
            advanceUntilIdle()
            assertTrue(c.state.value.invalidated)
            coVerify(exactly = 0) { repo.assignedAuthorizationStatus(any()) }
        }

    @Test fun `closing during continuation retires its later SDK result`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            val delayed = CompletableDeferred<NetworkResult<GigAssignedAuthorizationDto>>()
            coEvery { repo.continueAssignedAuthorization(gigId, any()) } coAnswers { delayed.await() }
            c.continueAuthorization()
            runCurrent()
            c.close()
            delayed.complete(NetworkResult.Success(receipt()))
            advanceUntilIdle()
            assertFalse(c.state.value.visible)
            assertNull(c.state.value.presentation)
            assertEquals(0, readyCalls)
        }

    @Test fun `revoked manager read cannot admit continuation`() =
        runTest {
            identity = identity?.copy(userId = "delegate")
            val c = coordinator()
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Failure(NetworkError.Forbidden)
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            assertFalse(c.state.value.mayContinue)
            assertNull(c.state.value.presentation)
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun `changed attempt or intent before SDK blocks the launch`() =
        runTest {
            val c = coordinator()
            for (changed in listOf(
                receipt().copy(authorizationAttemptId = "other"),
                receipt().copy(paymentIntentId = "pi_other"),
                receipt().copy(sessionScope = "b".repeat(64)),
            )) {
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(receipt())
                c.open(gig, payment)
                advanceUntilIdle()
                c.continueAuthorization()
                advanceUntilIdle()
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(changed)
                assertFalse(c.claimPresentation(checkNotNull(c.state.value.presentation).token))
                assertNull(c.state.value.presentation)
                assertEquals(0, readyCalls)
                c.close()
            }
        }

    @Test fun `fresh ready or pending proof prevents redundant SDK presentation`() =
        runTest {
            val c = coordinator()
            for (current in listOf(ready(), receipt().copy(recoveryState = "pending", providerStatus = "processing", canRetry = false))) {
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(receipt())
                c.open(gig, payment)
                advanceUntilIdle()
                c.continueAuthorization()
                advanceUntilIdle()
                coEvery { repo.assignedAuthorizationStatus(gigId) } returns NetworkResult.Success(current)
                assertFalse(c.claimPresentation(checkNotNull(c.state.value.presentation).token))
                assertNull(c.state.value.presentation)
                c.close()
            }
            assertEquals(1, readyCalls)
        }

    @Test fun `post SDK replacement receipt cannot confirm the original operation`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            val token = checkNotNull(c.state.value.presentation).token
            assertTrue(c.claimPresentation(token))
            coEvery { repo.assignedAuthorizationStatus(gigId) } returns
                NetworkResult.Success(
                    ready().copy(authorizationAttemptId = "replacement", paymentIntentId = "pi_replacement"),
                )
            c.onSheetResult(token, CheckoutOutcome.Paid)
            advanceUntilIdle()
            assertEquals(0, readyCalls)
            assertNull(c.state.value.progress)
            c.checkStatus()
            advanceUntilIdle()
            assertEquals(1, readyCalls)
        }

    @Test fun `closing during readonly SDK preflight prevents its late launcher`() =
        runTest {
            val c = coordinator()
            c.open(gig, payment)
            advanceUntilIdle()
            c.continueAuthorization()
            advanceUntilIdle()
            val token = checkNotNull(c.state.value.presentation).token
            val delayed = CompletableDeferred<NetworkResult<GigAssignedAuthorizationDto>>()
            coEvery { repo.assignedAuthorizationStatus(gigId) } coAnswers { delayed.await() }
            val claim = async { c.claimPresentation(token) }
            runCurrent()
            c.close()
            delayed.complete(NetworkResult.Success(receipt()))
            advanceUntilIdle()
            assertFalse(claim.await())
            assertNull(c.state.value.presentation)
            assertFalse(c.state.value.visible)
        }
}
