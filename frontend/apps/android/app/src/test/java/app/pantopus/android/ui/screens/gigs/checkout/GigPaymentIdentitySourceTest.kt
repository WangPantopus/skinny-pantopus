@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.checkout

import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.gigs.GigsRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import java.io.IOException
import java.security.MessageDigest

@OptIn(ExperimentalCoroutinesApi::class)
class GigPaymentIdentitySourceTest {
    private val tokens = mockk<TokenStorage>()
    private val tokenFlow = MutableStateFlow<String?>("synthetic-opening")
    private val authState = MutableStateFlow<AuthRepository.State>(signedIn("payer"))

    private fun signedIn(id: String) = AuthRepository.State.SignedIn(UserDto(id, "test@example.invalid", "Test", null))

    private fun source(): GigPaymentIdentitySource {
        every { tokens.accessTokenFlow } returns tokenFlow
        every { tokens.accessTokenMarker() } answers {
            tokenFlow.value?.let { token ->
                MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
            }
        }
        return GigPaymentIdentitySource(
            tokens,
            mockk { every { state } returns authState },
            Retrofit.Builder().baseUrl("https://injected.example.invalid/").build(),
        )
    }

    @Test fun signedInCredentialDisagreementAndReadFailureNeverBecomeAnonymousReadPermission() =
        runTest {
            val source = source()
            val repository = mockk<GigsRepository>()
            val invalid =
                listOf(
                    TokenStorage.SessionCredentials("payer", "session", "synthetic-unpublished"),
                    TokenStorage.SessionCredentials("other", "session", "synthetic-opening"),
                    null,
                )
            for (credentials in invalid) {
                coEvery { tokens.sessionCredentials() } returns credentials
                val flow =
                    GigBidCheckoutCoordinator(
                        repository,
                        backgroundScope,
                        source::checkoutIdentity,
                        source::scopeMarker,
                        source::permitsAnonymousRead,
                        { _, _ -> error("Invalid credentials cannot finish checkout") },
                    )
                assertFalse(flow.isCurrentReadScope())
                assertFalse(flow.isCurrentIdentity())
            }
            coEvery { tokens.sessionCredentials() } throws IOException("Credential store unavailable")
            val unreadable =
                GigBidCheckoutCoordinator(
                    repository,
                    backgroundScope,
                    source::checkoutIdentity,
                    source::scopeMarker,
                    source::permitsAnonymousRead,
                    { _, _ -> error("Unreadable credentials cannot finish checkout") },
                )
            assertFalse(unreadable.isCurrentReadScope())
            coVerify(exactly = 0) { repository.bids(any()) }
        }

    @Test fun anonymousReadsRequireAffirmativeSignOutAndNoStoredRequestCredential() =
        runTest {
            authState.value = AuthRepository.State.SignedOut
            tokenFlow.value = null
            val source = source()
            for (storedToken in listOf(null, "synthetic-unpublished")) {
                coEvery { tokens.accessToken() } returns storedToken
                val flow =
                    GigBidCheckoutCoordinator(
                        mockk(),
                        backgroundScope,
                        source::checkoutIdentity,
                        source::scopeMarker,
                        source::permitsAnonymousRead,
                        { _, _ -> error("Anonymous reads cannot finish checkout") },
                    )
                assertEquals(storedToken == null, flow.isCurrentReadScope())
                assertFalse(flow.isCurrentIdentity())
            }
            coEvery { tokens.accessToken() } throws IOException("Credential store unavailable")
            val unreadable =
                GigBidCheckoutCoordinator(
                    mockk(),
                    backgroundScope,
                    source::checkoutIdentity,
                    source::scopeMarker,
                    source::permitsAnonymousRead,
                    { _, _ -> error("Unreadable credentials cannot finish checkout") },
                )
            assertFalse(unreadable.isCurrentReadScope())
            coVerify(exactly = 0) { tokens.sessionCredentials() }
        }

    @Test fun anUnresolvedOpeningPrincipalCannotAdoptLaterAnonymousProof() =
        runTest {
            authState.value = AuthRepository.State.Unknown
            tokenFlow.value = null
            coEvery { tokens.accessToken() } returns null
            val source = source()
            val flow =
                GigBidCheckoutCoordinator(
                    mockk(),
                    backgroundScope,
                    source::checkoutIdentity,
                    source::scopeMarker,
                    source::permitsAnonymousRead,
                    { _, _ -> error("Unresolved opening cannot finish checkout") },
                )
            authState.value = AuthRepository.State.SignedOut
            assertFalse(flow.isCurrentReadScope())
            assertTrue(source.permitsAnonymousRead())
        }

    @Test fun currentAtomicCredentialsUseActualInjectedOrigin() =
        runTest {
            coEvery { tokens.sessionCredentials() } returns TokenStorage.SessionCredentials("payer", "session", "synthetic-opening")
            val source = source()
            val expected = GigCheckoutIdentity("payer", "session", "https://injected.example.invalid/")
            assertEquals(expected, source.checkoutIdentity())
            assertEquals(expected, source.paymentIdentity())
            coVerify(exactly = 0) { tokens.sessionIdentity() }
            coVerify(exactly = 0) { tokens.accessToken() }
        }

    @Test fun legacySessionsKeepReadScopeAndExistingRefundAuthorizationAdmission() =
        runTest {
            coEvery { tokens.sessionCredentials() } returns TokenStorage.SessionCredentials("payer", null, "synthetic-opening")
            val source = source()
            assertNull(source.checkoutIdentity()?.sessionId)
            val payment = checkNotNull(source.paymentIdentity())
            assertEquals("payer", payment.userId)
            assertEquals(tokens.accessTokenMarker(), payment.sessionId)
            assertEquals("https://injected.example.invalid/", payment.apiOrigin)
            val flow =
                GigBidCheckoutCoordinator(
                    mockk(),
                    backgroundScope,
                    source::checkoutIdentity,
                    source::scopeMarker,
                    source::permitsAnonymousRead,
                    { _, _ -> error("Legacy read admission cannot finish checkout") },
                )
            assertTrue(flow.isCurrentReadScope())
            assertFalse(flow.isCurrentIdentity())
        }

    @Test fun stableAnonymousReadsDoNotLoadStoredCredentials() =
        runTest {
            authState.value = AuthRepository.State.SignedOut
            tokenFlow.value = null
            val source = source()
            assertNull(source.checkoutIdentity())
            assertNull(source.paymentIdentity())
            coVerify(exactly = 0) { tokens.sessionCredentials() }
        }

    @Test fun contradictoryPublishedActorOrTokenRejectsPaymentIdentity() =
        runTest {
            val source = source()
            for (credentials in listOf(
                TokenStorage.SessionCredentials("other", "session", "synthetic-opening"),
                TokenStorage.SessionCredentials("payer", "session", "synthetic-unpublished"),
            )) {
                coEvery { tokens.sessionCredentials() } returns credentials
                assertNull(source.checkoutIdentity())
                assertNull(source.paymentIdentity())
            }
        }

    @Test fun delayedAtomicReadCannotReturnAnotherActorAndOpeningMarkerRetainsSessionChange() =
        runTest {
            val source = source()
            val opening = source.scopeMarker()
            val deferred = CompletableDeferred<TokenStorage.SessionCredentials?>()
            coEvery { tokens.sessionCredentials() } coAnswers { deferred.await() }
            val reading = async { source.paymentIdentity() }
            runCurrent()
            authState.value = signedIn("other")
            tokenFlow.value = "synthetic-new"
            deferred.complete(TokenStorage.SessionCredentials("other", "new-session", "synthetic-new"))
            assertNull(reading.await())
            assertNotEquals(opening, source.scopeMarker())
            authState.value = signedIn("payer")
            assertNotEquals(opening, source.scopeMarker())
        }
}
