@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.checkout

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PersistentPendingRefundStore
import app.pantopus.android.ui.screens.gigs.authorization.GigAssignedAuthorizationFactory
import app.pantopus.android.ui.screens.gigs.refunds.GigRefundFactory
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import java.security.MessageDigest

private class OpeningIdentityFixture {
    private val tokens = mockk<TokenStorage>()
    private val tokenFlow = MutableStateFlow<String?>("synthetic-opening")
    private val actorState = MutableStateFlow<AuthRepository.State>(signedIn("payer"))
    private val credentials = CompletableDeferred<TokenStorage.SessionCredentials?>()
    val source: GigPaymentIdentitySource

    init {
        every { tokens.accessTokenFlow } returns tokenFlow
        every { tokens.accessTokenMarker() } answers {
            tokenFlow.value?.let { token ->
                MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
            }
        }
        coEvery { tokens.sessionCredentials() } coAnswers { credentials.await() }
        source =
            GigPaymentIdentitySource(
                tokens,
                mockk { every { state } returns actorState },
                Retrofit.Builder().baseUrl("https://injected.example.invalid/").build(),
            )
    }

    fun replaceLogin(actor: String = "payer") {
        actorState.value = signedIn(actor)
        tokenFlow.value = "synthetic-replacement"
        credentials.complete(TokenStorage.SessionCredentials(actor, "replacement-session", "synthetic-replacement"))
    }

    private fun signedIn(id: String) = AuthRepository.State.SignedIn(UserDto(id, "test@example.invalid", "Test", null))
}

@OptIn(ExperimentalCoroutinesApi::class)
class GigPaymentOpeningTest {
    private val gigId = "11111111-1111-4111-8111-111111111111"
    private val paymentId = "22222222-2222-4222-8222-222222222222"

    @Test fun productionCheckoutIdentityCannotBindAReplacementLoginDuringItsFirstRead() =
        runTest {
            val opening = OpeningIdentityFixture()
            val repo = mockk<GigsRepository>()
            val flow =
                GigBidCheckoutCoordinator(
                    repo,
                    backgroundScope,
                    opening.source::checkoutIdentity,
                    opening.source::scopeMarker,
                    opening.source::permitsAnonymousRead,
                    { _, _ -> error("Retired screen cannot finish checkout") },
                )
            opening.replaceLogin()
            flow.start(gigId, "bid")
            runCurrent()
            assertFalse(flow.isCurrentReadScope())
            assertEquals(GigBidCheckoutPhase.Idle, flow.state.value.phase)
            coVerify(exactly = 0) { repo.acceptBid(any(), any()) }
            coVerify(exactly = 0) { repo.finalizeAcceptBid(any(), any()) }
        }

    @Test fun productionAssignedFactoryCannotBindReplacementCredentialsDuringItsFirstRead() =
        runTest {
            val opening = OpeningIdentityFixture()
            val repo = mockk<GigsRepository>()
            val flow =
                GigAssignedAuthorizationFactory(repo, opening.source).create(backgroundScope) {
                    error("Retired screen cannot confirm authorization")
                }
            opening.replaceLogin()
            flow.open(
                GigDto(gigId, "Task", price = 12.0, status = "assigned", userId = "payer", acceptedBy = "worker", paymentId = paymentId),
                GigPaymentDto(id = paymentId, gigId = gigId, payerId = "payer", payeeId = "worker", amountTotal = 1200, currency = "usd"),
            )
            runCurrent()
            flow.continueAuthorization()
            runCurrent()
            assertTrue(flow.state.value.invalidated)
            assertNull(flow.state.value.progress)
            assertNull(flow.state.value.presentation)
            coVerify(exactly = 0) { repo.assignedAuthorizationStatus(any()) }
            coVerify(exactly = 0) { repo.continueAssignedAuthorization(any(), any()) }
        }

    @Test fun productionRefundFactoryCannotReadOrChangeSavedRecoveryAfterOpeningSessionChanges() =
        runTest {
            val opening = OpeningIdentityFixture()
            val repo = mockk<PaymentsRepository>()
            val store = mockk<PersistentPendingRefundStore>()
            val flow =
                GigRefundFactory(repo, store, opening.source, Moshi.Builder().build()).create(backgroundScope) {
                    error("Retired screen cannot finish refund")
                }
            opening.replaceLogin()
            flow.open(gigId, GigPaymentDto(id = paymentId, gigId = gigId, payerId = "payer", amountTotal = 1200, currency = "usd"))
            runCurrent()
            flow.checkStatus()
            flow.retry()
            runCurrent()
            assertTrue(flow.state.value.invalidated)
            assertNull(flow.state.value.summary)
            coVerify(exactly = 0) { store.read(any()) }
            coVerify(exactly = 0) { store.clear(any()) }
            coVerify(exactly = 0) { repo.refunds(any()) }
            coVerify(exactly = 0) { repo.refund(any(), any()) }
        }
}
