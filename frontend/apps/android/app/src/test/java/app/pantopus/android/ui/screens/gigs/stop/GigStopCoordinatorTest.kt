@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.gigs.stop

import app.pantopus.android.data.api.models.gigs.GigStopCommand
import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopProgress
import app.pantopus.android.data.api.models.gigs.GigStopReceipt
import app.pantopus.android.data.api.models.gigs.GigStopRequest
import app.pantopus.android.data.api.models.gigs.GigStopTerms
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigStopRecoveryChanged
import app.pantopus.android.data.gigs.GigStopRepository
import app.pantopus.android.data.gigs.PendingGigStopStore
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GigStopCoordinatorTest {
    private val actor = "11111111-1111-4111-8111-111111111111"
    private val worker = "22222222-2222-4222-8222-222222222222"
    private val gig = "33333333-3333-4333-8333-333333333333"
    private val payment = "44444444-4444-4444-8444-444444444444"
    private val requestId = "55555555-5555-4555-8555-555555555555"
    private val session = "a".repeat(64)
    private val repo = mockk<GigStopRepository>()
    private var identity: GigStopIdentity? = GigStopIdentity(actor, "session", "https://api.example.invalid/")
    private val terms = GigStopTerms(gig, actor, worker, payment, 1000, "usd", "assigned", null, null, "flexible", 0)
    private val store = MemoryStore()
    private var completed = 0
    private var command: GigStopCommand? = null

    private fun preview(action: String = "cancel") = GigStopPreview(actor, session, action, terms, true, null, "release", null)

    private fun saved(action: String = "cancel") = GigStopRequest(requestId, gig, actor, action, terms, "other", null, "release")

    private fun pending(request: GigStopRequest = saved()) =
        GigStopProgress(actor, session, request.requestId, request.action, "pending", "release_pending", true, request, null)

    private fun receipt(request: GigStopRequest = saved()): GigStopProgress =
        pending(request).copy(
            status = "completed",
            financialStatus = "released",
            canRetry = false,
            receipt =
                GigStopReceipt(
                    request.requestId, gig, payment, actor, worker, 1000, "usd", request.action,
                    if (request.action in setOf("worker_release", "reopen_bidding")) "open" else "cancelled", "released",
                ),
        )

    private fun TestScope.coordinator(): GigStopCoordinator {
        coEvery { repo.preview(gig, any()) } answers { NetworkResult.Success(preview(secondArg())) }
        coEvery { repo.request(gig, any()) } returns NetworkResult.Failure(NetworkError.NotFound)
        coEvery { repo.submit(gig, any()) } coAnswers {
            command = secondArg()
            val sent = checkNotNull(command)
            val request =
                GigStopRequest(
                    sent.requestId, gig, actor, sent.action, sent.expectedTerms, sent.reason, sent.rollbackMode, "release",
                )
            NetworkResult.Success(pending(request).copy(sessionScope = sent.expectedSessionScope))
        }
        return GigStopCoordinator(
            repo,
            store,
            this,
            { identity },
            Moshi.Builder().build(),
            scopeMarker = { identity?.toString() },
            onCompleted = { completed++ },
        )
    }

    @Test fun `opening is read only and explicit confirmation saves original terms before POST`() =
        runTest {
            val c = coordinator()
            c.open(gig)
            advanceUntilIdle()
            assertTrue(c.state.value.maySubmit)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
            c.submit("other")
            advanceUntilIdle()
            assertEquals(store.request?.requestId, command?.requestId)
            assertEquals(terms, command?.expectedTerms)
            assertEquals(session, command?.expectedSessionScope)
            assertEquals(actor, command?.expectedActorId)
            assertEquals("pending", c.state.value.progress?.status)
            assertEquals(0, completed)
        }

    @Test fun `unknown POST survives close cold recreation and retries only same UUID reason and terms`() =
        runTest {
            val c = coordinator()
            coEvery { repo.submit(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
            c.open(gig)
            advanceUntilIdle()
            c.submit("emergency")
            advanceUntilIdle()
            val original = checkNotNull(store.request)
            c.close()
            val cold = coordinator()
            cold.probeRecovery(gig)
            cold.open(gig)
            advanceUntilIdle()
            assertTrue(cold.state.value.recoveryAvailable)
            assertTrue(cold.state.value.canRetry)
            coVerify(exactly = 1) { repo.submit(any(), any()) }
            cold.submit("other")
            advanceUntilIdle()
            assertEquals(original.requestId, command?.requestId)
            assertEquals("emergency", command?.reason)
            assertEquals(original.terms, command?.expectedTerms)
        }

    @Test fun `changed terms after negative status preserve unknown operation without retry`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            coEvery { repo.preview(gig, any()) } returns NetworkResult.Success(preview().copy(terms = terms.copy(amountCents = 1200)))
            c.open(gig)
            advanceUntilIdle()
            c.submit()
            assertFalse(c.state.value.canRetry)
            assertEquals(saved(), store.request)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
        }

    @Test fun `changed server session never rebinds an opened action`() =
        runTest {
            val c = coordinator()
            c.open(gig)
            advanceUntilIdle()
            coEvery { repo.preview(gig, any()) } returns NetworkResult.Success(preview().copy(sessionScope = "b".repeat(64)))
            c.checkStatus()
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertFalse(c.state.value.maySubmit)
            assertTrue(c.state.value.invalidated)
            assertNotNull(c.state.value.error)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
        }

    @Test fun `current same actor new screen can recover original UUID under fresh server session`() =
        runTest {
            store.request = saved()
            identity = identity?.copy(sessionId = "new-session")
            val c = coordinator()
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending().copy(sessionScope = "b".repeat(64)))
            c.open(gig)
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertEquals(requestId, command?.requestId)
            assertEquals("b".repeat(64), command?.expectedSessionScope)
        }

    @Test fun `server canRetry false prevents mutation but retains GET recovery`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending().copy(canRetry = false))
            c.open(gig)
            advanceUntilIdle()
            c.submit()
            c.checkStatus()
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.submit(any(), any()) }
            coVerify(exactly = 2) { repo.request(gig, requestId) }
        }

    @Test fun `completed exact receipt alone clears storage and publishes once`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(receipt())
            c.open(gig)
            advanceUntilIdle()
            c.checkStatus()
            advanceUntilIdle()
            assertNull(store.request)
            assertEquals(1, completed)
            assertEquals("completed", c.state.value.progress?.status)
        }

    @Test fun `wrong exact receipt payment or amount never completes`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            val wrong = receipt().copy(receipt = receipt().receipt?.copy(amountCents = 1))
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(wrong)
            c.open(gig)
            advanceUntilIdle()
            assertEquals(0, completed)
            assertEquals(saved(), store.request)
            assertNotNull(c.state.value.error)
            assertNull(c.state.value.progress)
        }

    @Test fun `only STOP_ACTIVE may replace original unknown request after verified exact GET`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            val other = saved().copy(requestId = "66666666-6666-4666-8666-666666666666")
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending())
            coEvery { repo.request(gig, other.requestId) } returns NetworkResult.Success(pending(other))
            coEvery {
                repo.submit(any(), any())
            } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(409, "{\"code\":\"TERMS_CHANGED\",\"activeRequestId\":\"${other.requestId}\"}"),
                )
            c.open(gig)
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertEquals(saved(), store.request)
            coVerify(exactly = 0) { repo.request(gig, other.requestId) }
            c.checkStatus()
            advanceUntilIdle()
            coEvery {
                repo.submit(any(), any())
            } returns NetworkResult.Failure(activeConflict(other.requestId))
            c.submit()
            advanceUntilIdle()
            assertEquals(other, store.request)
        }

    @Test fun `failed active receipt read does not erase local UUID`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending())
            coEvery {
                repo.submit(any(), any())
            } returns NetworkResult.Failure(activeConflict("66666666-6666-4666-8666-666666666666"))
            c.open(gig)
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertEquals(saved(), store.request)
        }

    @Test fun `foreign original actor history cannot be retried or stored as this actor`() =
        runTest {
            val c = coordinator()
            val foreign = saved().copy(actorId = worker)
            coEvery { repo.preview(gig, any()) } returns
                NetworkResult.Success(
                    preview().copy(eligible = false, activeRequestId = requestId),
                )
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending(foreign).copy(canRetry = false))
            c.open(gig)
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertEquals(foreign, c.state.value.request)
            assertNull(store.request)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
        }

    @Test fun `storage failure is visible and cannot issue a provider-affecting command`() =
        runTest {
            val c = coordinator()
            c.open(gig)
            advanceUntilIdle()
            store.writeFailure = true
            c.submit()
            advanceUntilIdle()
            assertNotNull(c.state.value.error)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
            store.readFailure = true
            c.close()
            c.probeRecovery(gig)
            advanceUntilIdle()
            assertTrue(c.state.value.recoveryAvailable)
            assertNotNull(c.state.value.recoveryError)
        }

    @Test fun `dismiss during preflight and during POST retires late response effects`() =
        runTest {
            val c = coordinator()
            val read = CompletableDeferred<NetworkResult<GigStopPreview>>()
            coEvery { repo.preview(gig, any()) } coAnswers { read.await() }
            c.open(gig)
            runCurrent()
            c.close()
            read.complete(NetworkResult.Success(preview()))
            advanceUntilIdle()
            assertFalse(c.state.value.visible)
            assertNull(c.state.value.preview)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
            val next = coordinator()
            store.request = saved()
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending())
            val post = CompletableDeferred<NetworkResult<GigStopProgress>>()
            coEvery { repo.submit(gig, any()) } coAnswers { post.await() }
            next.open(gig)
            advanceUntilIdle()
            next.submit()
            runCurrent()
            next.close()
            post.complete(NetworkResult.Success(receipt()))
            advanceUntilIdle()
            assertEquals(0, completed)
            assertEquals(saved(), store.request)
            assertFalse(next.state.value.visible)
        }

    @Test fun `unused and dismissed old screens cannot start under another account session or API`() =
        runTest {
            val c = coordinator()
            identity = identity?.copy(sessionId = "replacement")
            c.open(gig)
            advanceUntilIdle()
            assertTrue(c.state.value.invalidated)
            coVerify(exactly = 0) { repo.preview(any(), any()) }
            val fresh = coordinator()
            fresh.open(gig)
            advanceUntilIdle()
            fresh.close()
            identity = identity?.copy(apiOrigin = "https://other.example.invalid/")
            fresh.open(gig)
            advanceUntilIdle()
            assertTrue(fresh.state.value.invalidated)
        }

    @Test fun `identity change after durable save rejects before POST`() =
        runTest {
            val c = coordinator()
            c.open(gig)
            advanceUntilIdle()
            store.afterWrite = { identity = identity?.copy(actorId = worker) }
            c.submit()
            advanceUntilIdle()
            assertTrue(c.state.value.invalidated)
            assertNotNull(store.request)
            coVerify(exactly = 0) { repo.submit(any(), any()) }
        }

    @Test fun `invalid replacement target clears prior target and cannot reread old history`() =
        runTest {
            val c = coordinator()
            c.open(gig)
            advanceUntilIdle()
            c.close()
            c.open("invalid")
            advanceUntilIdle()
            c.checkStatus()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.preview(any(), any()) }
            assertNull(c.state.value.preview)
        }

    @Test fun `saved status entry cannot become a new action when its saved request disappears`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            c.probeRecovery(gig)
            advanceUntilIdle()
            assertTrue(c.state.value.recoveryAvailable)
            store.request = null
            c.openRecovery(gig)
            advanceUntilIdle()
            c.checkStatus()
            advanceUntilIdle()
            c.submit("other")
            advanceUntilIdle()
            assertTrue(c.state.value.recoveryOnly)
            assertFalse(c.state.value.maySubmit)
            assertNotNull(c.state.value.error)
            coVerify(exactly = 0) { repo.preview(any(), any()) }
            coVerify(exactly = 0) { repo.submit(any(), any()) }
        }

    @Test fun `competing saved request cannot be hidden by an older completed receipt`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            val other = saved().copy(requestId = "66666666-6666-4666-8666-666666666666")
            coEvery { repo.request(gig, requestId) } coAnswers {
                store.request = other
                NetworkResult.Success(receipt())
            }
            coEvery { repo.request(gig, other.requestId) } returns NetworkResult.Success(pending(other))
            c.openRecovery(gig)
            advanceUntilIdle()
            assertEquals(other, store.request)
            assertEquals(0, completed)
            assertNull(c.state.value.progress)
            assertTrue(c.state.value.recoveryAvailable)
            assertFalse(c.state.value.canRetry)
            assertNotNull(c.state.value.error)
            c.checkStatus()
            advanceUntilIdle()
            assertEquals(other, c.state.value.request)
            assertTrue(c.state.value.canRetry)
        }

    @Test fun `verified conflict cannot overwrite a different saved request created during its GET`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            val active = saved().copy(requestId = "66666666-6666-4666-8666-666666666666")
            val competing = saved().copy(requestId = "77777777-7777-4777-8777-777777777777")
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending())
            coEvery { repo.submit(gig, any()) } returns NetworkResult.Failure(activeConflict(active.requestId))
            coEvery { repo.request(gig, active.requestId) } coAnswers {
                store.request = competing
                NetworkResult.Success(pending(active))
            }
            c.openRecovery(gig)
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertEquals(competing, store.request)
            assertNull(c.state.value.progress)
            assertNull(c.state.value.request)
            assertTrue(c.state.value.recoveryAvailable)
            assertFalse(c.state.value.canRetry)
            assertEquals(0, completed)
        }

    @Test fun `GET and POST access failures retire all controls while preserving durable recovery`() =
        runTest {
            val errors =
                listOf(
                    NetworkError.Unauthorized,
                    NetworkError.Forbidden,
                    NetworkError.ClientError(409, "{\"code\":\"SESSION_SCOPE_CHANGED\"}"),
                )
            errors.forEach { error ->
                store.request = null
                val deniedRead = coordinator()
                coEvery { repo.preview(gig, any()) } returns NetworkResult.Failure(error)
                deniedRead.open(gig)
                advanceUntilIdle()
                assertTrue(deniedRead.state.value.invalidated)
                deniedRead.submit()
                advanceUntilIdle()
                assertNull(store.request)

                val deniedWrite = coordinator()
                deniedWrite.open(gig)
                advanceUntilIdle()
                coEvery { repo.submit(gig, any()) } returns NetworkResult.Failure(error)
                deniedWrite.submit("other")
                advanceUntilIdle()
                assertTrue(deniedWrite.state.value.invalidated)
                assertFalse(deniedWrite.state.value.canRetry)
                assertNull(deniedWrite.state.value.preview)
                assertNotNull(store.request)
                deniedWrite.checkStatus()
                deniedWrite.submit()
                advanceUntilIdle()
            }
            coVerify(exactly = 3) { repo.submit(any(), any()) }
            assertEquals(0, completed)
        }

    @Test fun `changed session in a POST receipt retires controls and retains original UUID`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(pending())
            coEvery { repo.submit(gig, any()) } returns NetworkResult.Success(receipt().copy(sessionScope = "b".repeat(64)))
            c.openRecovery(gig)
            advanceUntilIdle()
            c.submit()
            advanceUntilIdle()
            assertTrue(c.state.value.invalidated)
            assertEquals(saved(), store.request)
            assertEquals(0, completed)
            assertNull(c.state.value.progress)
        }

    private fun activeConflict(activeId: String) =
        NetworkError.ClientError(409, "{\"code\":\"STOP_ACTIVE\",\"activeRequestId\":\"$activeId\"}")

    @Test fun `dismiss while terminal storage is queued preserves recovery without hidden completion`() =
        runTest {
            val c = coordinator()
            store.request = saved()
            val gate = CompletableDeferred<Unit>()
            store.beforeComplete = { withContext(NonCancellable) { gate.await() } }
            coEvery { repo.request(gig, requestId) } returns NetworkResult.Success(receipt())
            c.openRecovery(gig)
            runCurrent()
            assertTrue(c.state.value.busy)
            c.close()
            gate.complete(Unit)
            advanceUntilIdle()
            assertEquals(saved(), store.request)
            assertEquals(0, completed)
            assertFalse(c.state.value.visible)
            assertNull(c.state.value.progress)
            assertTrue(c.state.value.recoveryAvailable)
        }

    private class MemoryStore : PendingGigStopStore {
        var request: GigStopRequest? = null
        var readFailure = false
        var writeFailure = false
        var afterWrite: (() -> Unit)? = null
        var beforeComplete: (suspend () -> Unit)? = null

        override suspend fun read(key: String): GigStopRequest? {
            check(!readFailure) { "Storage unreadable" }
            return request
        }

        override suspend fun retain(
            key: String,
            request: GigStopRequest,
            replacing: GigStopRequest?,
            canCommit: () -> Boolean,
        ) {
            check(!writeFailure) { "Storage unavailable" }
            if (this.request != null && this.request != request && this.request != replacing) throw GigStopRecoveryChanged()
            if (!canCommit()) throw CancellationException("Retired")
            this.request = request
            afterWrite?.invoke()
        }

        override suspend fun complete(
            key: String,
            request: GigStopRequest,
            canCommit: () -> Boolean,
        ) {
            beforeComplete?.invoke()
            if (!canCommit()) throw CancellationException("Retired")
            if (this.request != null && this.request != request) throw GigStopRecoveryChanged()
            if (this.request == request) this.request = null
        }
    }
}
