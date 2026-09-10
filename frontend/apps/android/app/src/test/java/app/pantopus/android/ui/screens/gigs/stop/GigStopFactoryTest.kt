@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.gigs.stop

import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopTerms
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.gigs.GigStopRepository
import app.pantopus.android.data.gigs.PersistentPendingGigStopStore
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import java.security.MessageDigest

@OptIn(ExperimentalCoroutinesApi::class)
class GigStopFactoryTest {
    private val actor = "11111111-1111-4111-8111-111111111111"
    private val other = "22222222-2222-4222-8222-222222222222"
    private val gig = "33333333-3333-4333-8333-333333333333"
    private val repository = mockk<GigStopRepository>()
    private val store = mockk<PersistentPendingGigStopStore>()
    private val tokens = mockk<TokenStorage>()
    private val tokenFlow = MutableStateFlow<String?>("synthetic-opening")
    private val authState = MutableStateFlow<AuthRepository.State>(signedIn(actor))

    private fun signedIn(id: String) =
        AuthRepository.State.SignedIn(
            UserDto(id, "test@example.invalid", "Test", null),
        )

    private fun factory(): GigStopFactory {
        every { tokens.accessTokenFlow } returns tokenFlow
        every { tokens.accessTokenMarker() } answers {
            tokenFlow.value?.let { token ->
                MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
            }
        }
        coEvery { store.read(any()) } returns null
        return GigStopFactory(
            repository,
            store,
            tokens,
            mockk { every { state } returns authState },
            Retrofit.Builder().baseUrl("https://api.example.invalid/").build(),
            Moshi.Builder().build(),
        )
    }

    @Test fun delayedFirstCredentialsCannotBindReplacementActorOrSameActorSession() =
        runTest {
            listOf(actor, other).forEach { replacement ->
                tokenFlow.value = "synthetic-opening"
                authState.value = signedIn(actor)
                val deferred = CompletableDeferred<TokenStorage.SessionCredentials?>()
                coEvery { tokens.sessionCredentials() } coAnswers { deferred.await() }
                val c = factory().create(backgroundScope) {}
                c.open(gig)
                tokenFlow.value = "synthetic-replacement"
                authState.value = signedIn(replacement)
                runCurrent()
                assertTrue(c.state.value.invalidated)
                deferred.complete(TokenStorage.SessionCredentials(replacement, "new-session", "synthetic-replacement"))
                runCurrent()
                c.submit()
                c.checkStatus()
                runCurrent()
                assertFalse(c.state.value.maySubmit)
            }
            coVerify(exactly = 0) { repository.preview(any(), any()) }
            coVerify(exactly = 0) { repository.submit(any(), any()) }
        }

    @Test fun credentialsAheadOfPublishedTokenCannotRebindOpeningScope() =
        runTest {
            coEvery { tokens.sessionCredentials() } returns TokenStorage.SessionCredentials(actor, "new-session", "synthetic-new")
            val c = factory().create(backgroundScope) {}
            c.open(gig)
            runCurrent()
            assertTrue(c.state.value.invalidated)
            coVerify(exactly = 0) { repository.preview(any(), any()) }
        }

    @Test fun screenWithoutOpeningCredentialsCannotAdoptLaterLogin() =
        runTest {
            tokenFlow.value = null
            val deferred = CompletableDeferred<TokenStorage.SessionCredentials?>()
            coEvery { tokens.sessionCredentials() } coAnswers { deferred.await() }
            val c = factory().create(backgroundScope) {}
            tokenFlow.value = "synthetic-replacement"
            deferred.complete(TokenStorage.SessionCredentials(actor, "new-session", "synthetic-replacement"))
            c.open(gig)
            runCurrent()
            assertTrue(c.state.value.invalidated)
            coVerify(exactly = 0) { repository.preview(any(), any()) }
        }

    @Test fun publishedStableLegacyCredentialsStillAllowReadonlyPreview() =
        runTest {
            coEvery { tokens.sessionCredentials() } returns TokenStorage.SessionCredentials(actor, null, "synthetic-opening")
            coEvery { repository.preview(gig, "close") } returns
                NetworkResult.Success(
                    GigStopPreview(
                        actor, "a".repeat(64), "close",
                        GigStopTerms(gig, actor, null, null, 0, "usd", "open", null, null, "standard", 0),
                        true, null, "none", null,
                    ),
                )
            val c = factory().create(backgroundScope) {}
            c.open(gig, "close")
            runCurrent()
            assertTrue(c.state.value.maySubmit)
            assertFalse(c.state.value.invalidated)
            coVerify(exactly = 1) { repository.preview(gig, "close") }
            coVerify(exactly = 0) { repository.submit(any(), any()) }
        }
}
