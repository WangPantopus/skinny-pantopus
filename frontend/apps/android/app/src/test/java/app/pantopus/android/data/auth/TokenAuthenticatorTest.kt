package app.pantopus.android.data.auth

import app.pantopus.android.data.api.net.NonRetriableIOException
import dagger.Lazy
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TokenAuthenticatorTest {
    private val storage = mockk<TokenStorage>(relaxed = true)
    private val repo = mockk<AuthRepository>(relaxed = true)
    private val lazyRepo =
        mockk<Lazy<AuthRepository>>().also { every { it.get() } returns repo }

    private fun authenticator() = TokenAuthenticator(storage, lazyRepo)

    private fun response401(
        url: String,
        bearer: String?,
        prior: Response? = null,
    ): Response {
        val request =
            Request
                .Builder()
                .url(url)
                .apply { if (bearer != null) header("Authorization", "Bearer $bearer") }
                .build()
        // No body: `authenticate` never reads it, and OkHttp forbids a
        // priorResponse that carries a body.
        return Response
            .Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .apply { if (prior != null) priorResponse(prior) }
            .build()
    }

    @Test
    fun `refreshes and replays the request with the new bearer on 401`() {
        coEvery { storage.accessToken() } returns "old-at"
        coEvery { repo.refreshTokens() } returns AuthRepository.RefreshOutcome.Rotated("new-at")

        val retry = authenticator().authenticate(null, response401("https://x/api/hub", "old-at"))

        assertEquals("Bearer new-at", retry?.header("Authorization"))
        coVerify { repo.refreshTokens() }
    }

    @Test
    fun `replays with the already-rotated token without refreshing again`() {
        // Another concurrent request already refreshed; stored token moved on.
        coEvery { storage.accessToken() } returns "fresh-at"

        val retry = authenticator().authenticate(null, response401("https://x/api/hub", "old-at"))

        assertEquals("Bearer fresh-at", retry?.header("Authorization"))
        coVerify(exactly = 0) { repo.refreshTokens() }
    }

    @Test
    fun `signs out and gives up when refresh is auth-rejected`() {
        coEvery { storage.accessToken() } returns "old-at"
        coEvery { repo.refreshTokens() } returns AuthRepository.RefreshOutcome.AuthRejected

        val retry = authenticator().authenticate(null, response401("https://x/api/hub", "old-at"))

        assertNull(retry)
        coVerify { repo.signOut() }
    }

    @Test
    fun `throws (no sign-out) when refresh fails transiently`() {
        coEvery { storage.accessToken() } returns "old-at"
        coEvery { repo.refreshTokens() } returns AuthRepository.RefreshOutcome.Transient

        // A transient refresh failure must surface as a NON-RETRIABLE network
        // error — NOT a sign-out — so the session survives a flaky network and
        // RetryInterceptor doesn't re-drive the refresh.
        assertThrows(NonRetriableIOException::class.java) {
            authenticator().authenticate(null, response401("https://x/api/hub", "old-at"))
        }
        coVerify(exactly = 0) { repo.signOut() }
    }

    @Test
    fun `never tries to refresh the refresh endpoint itself`() {
        val retry = authenticator().authenticate(null, response401("https://x/api/users/refresh", "old-at"))

        assertNull(retry)
        coVerify(exactly = 0) { repo.refreshTokens() }
        coVerify(exactly = 0) { repo.signOut() }
    }

    @Test
    fun `ignores 401s for requests that carried no token`() {
        val retry = authenticator().authenticate(null, response401("https://x/api/hub", bearer = null))

        assertNull(retry)
        coVerify(exactly = 0) { repo.refreshTokens() }
        coVerify(exactly = 0) { repo.signOut() }
    }

    @Test
    fun `gives up and signs out after the replayed request still 401s`() {
        coEvery { storage.accessToken() } returns "old-at"
        val first = response401("https://x/api/hub", "old-at")
        val second = response401("https://x/api/hub", "new-at", prior = first)

        val retry = authenticator().authenticate(null, second)

        assertNull(retry)
        coVerify { repo.signOut() }
        coVerify(exactly = 0) { repo.refreshTokens() }
    }
}
