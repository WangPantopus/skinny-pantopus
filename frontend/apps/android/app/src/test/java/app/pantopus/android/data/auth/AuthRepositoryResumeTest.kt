package app.pantopus.android.data.auth

import app.pantopus.android.data.api.models.auth.AuthenticatedUser
import app.pantopus.android.data.api.models.auth.ChallengeResponse
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.RegisterDeviceResponse
import app.pantopus.android.data.api.models.auth.SessionInfoDto
import app.pantopus.android.data.api.services.AuthApi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException
import java.util.Base64

/**
 * Cold start L1 → L2 → L3 (design §3, §7.4) and `AuthRepository.resume()`:
 *  - no tokens + Block Store grant + OS lock → [AuthRepository.State.Resumable]
 *  - hint without grant / no OS lock / no hint → SignedOut (prefilled)
 *  - resume ok → `restored` session persisted, hint rewritten with the new grant
 *  - grant rejected → grant cleared, hints kept, SignedOut with a reason
 *  - presence cancelled / transient → still Resumable
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthRepositoryResumeTest {
    private val hint = AccountHint(userId = "u_1", displayName = "Alice", maskedEmail = "a•••@b.com", lastMethod = "password")

    private val authUser =
        AuthenticatedUser(
            id = "u_1",
            email = "a@b.com",
            username = "alice",
            name = "Alice Doe",
            firstName = "Alice",
            middleName = null,
            lastName = "Doe",
            phoneNumber = null,
            address = null,
            city = null,
            state = null,
            zipcode = null,
            accountType = "personal",
            role = "member",
            verified = true,
            createdAt = "2025-01-01T00:00:00Z",
        )

    private val resumeResponse =
        LoginResponse(
            message = "ok",
            accessToken = "at-restored",
            refreshToken = "rt-restored",
            expiresIn = 3600,
            expiresAt = 1_800_000_000,
            user = authUser,
            sessionId = "sid-restored",
            session = SessionInfoDto(id = "sid-restored", context = "restored"),
            resumeGrant = "grant-2",
        )

    private fun payloadWithGrant(grant: String? = "grant-1") =
        AccountHintPayload(accounts = listOf(hint), resumeGrant = grant, grantUserId = grant?.let { "u_1" })

    private fun httpException(
        code: Int,
        body: String,
    ): HttpException = HttpException(Response.error<Any>(code, body.toResponseBody("application/json".toMediaTypeOrNull())))

    private fun emptyStorage(): TokenStorage = AuthTestSupport.tokenStorage()

    // ── restore(): L2 / L3 decision ────────────────────────────────────

    @Test
    fun `no tokens + grant + OS lock goes Resumable with the grant account`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            val repo = AuthTestSupport.repository(storage = emptyStorage(), accountHints = hints)

            repo.restore()

            assertEquals(AuthRepository.State.Resumable(hint), repo.state.value)
            assertEquals(listOf(hint), repo.rememberedAccounts.value)
        }

    @Test
    fun `hint without grant (explicit sign-out) lands on SignedOut with prefill`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant(grant = null))
            val repo = AuthTestSupport.repository(storage = emptyStorage(), accountHints = hints)

            repo.restore()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertEquals(listOf(hint), repo.rememberedAccounts.value)
        }

    @Test
    fun `no OS lock means no one-tap resume even with a grant`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            val presence = AuthTestSupport.FakePresenceVerifier(canVerify = false)
            val repo = AuthTestSupport.repository(storage = emptyStorage(), accountHints = hints, presenceVerifier = presence)

            repo.restore()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertEquals(listOf(hint), repo.rememberedAccounts.value)
        }

    @Test
    fun `no hint (GMS-less or fresh device) is a plain SignedOut`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore(available = false, payload = payloadWithGrant())
            val repo = AuthTestSupport.repository(storage = emptyStorage(), accountHints = hints)

            repo.restore()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertTrue(repo.rememberedAccounts.value.isEmpty())
        }

    // ── resume() ───────────────────────────────────────────────────────

    @Test
    fun `resume ok redeems the grant behind presence and persists a restored session`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = emptyStorage()
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            val presence = AuthTestSupport.FakePresenceVerifier()
            val challengeBytes = ByteArray(32) { it.toByte() }
            coEvery { authApi.challenge(match { it.purpose == "resume" }) } returns
                ChallengeResponse(
                    challengeId = "c1",
                    challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes),
                    expiresAt = null,
                )
            var proofSeen: String? = null
            coEvery { authApi.resume(any(), any()) } answers {
                proofSeen = secondArg()
                resumeResponse
            }
            coEvery { authApi.registerDevice(any(), any()) } returns RegisterDeviceResponse(device = null, resumeGrant = "grant-3")

            val repo =
                AuthTestSupport.repository(
                    authApi = authApi,
                    storage = storage,
                    accountHints = hints,
                    presenceVerifier = presence,
                )
            repo.restore()
            assertTrue(repo.state.value is AuthRepository.State.Resumable)

            val outcome = repo.resume(AuthTestSupport.activity())

            assertTrue(outcome is AuthRepository.ResumeOutcome.Restored)
            assertEquals(1, presence.prompts)
            coVerify {
                authApi.resume(
                    match { it.grant == "grant-1" && it.device.deviceId.isNotBlank() && it.device.keyBacking == "tee" },
                    any(),
                )
            }
            val payload = String(Base64.getUrlDecoder().decode(proofSeen!!.split(".")[1]), Charsets.UTF_8)
            assertTrue(payload.contains("/api/auth/resume"))
            assertTrue(payload.contains("\"htm\":\"POST\""))
            // Session persisted as `restored`; never stamps the interactive marker.
            assertEquals("at-restored", storage.accessToken())
            assertEquals("rt-restored", storage.refreshToken())
            assertEquals("sid-restored", storage.sessionId())
            assertEquals("restored", storage.sessionContext())
            assertEquals(1_800_000_000L, storage.expiresAt())
            assertNull(repo.lastInteractiveSignInAt.value)
            assertTrue(repo.state.value is AuthRepository.State.SignedIn)
            // Block Store rewritten: register's grant supersedes the resume grant.
            assertEquals("grant-3", hints.payload?.resumeGrant)
            assertEquals("u_1", hints.payload?.grantUserId)
            assertEquals("resume", hints.payload?.accounts?.single()?.lastMethod)
            coVerify { authApi.registerDevice(any(), any()) }
        }

    @Test
    fun `resume still proceeds when the challenge endpoint fails`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            coEvery { authApi.challenge(any()) } throws IOException("offline")
            coEvery { authApi.resume(any(), any()) } returns resumeResponse
            coEvery { authApi.registerDevice(any(), any()) } returns RegisterDeviceResponse(device = null, resumeGrant = null)

            val repo = AuthTestSupport.repository(authApi = authApi, storage = emptyStorage(), accountHints = hints)
            repo.restore()

            assertTrue(repo.resume(AuthTestSupport.activity()) is AuthRepository.ResumeOutcome.Restored)
            // Resume's own grant kept when register brings none.
            assertEquals("grant-2", hints.payload?.resumeGrant)
        }

    @Test
    fun `grant rejected clears the grant, keeps the hint, signs out with the reason`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            coEvery { authApi.challenge(any()) } throws IOException("offline")
            coEvery { authApi.resume(any(), any()) } throws
                httpException(401, "{\"error\":\"grant invalid\",\"code\":\"RESUME_GRANT_INVALID\"}")

            val repo = AuthTestSupport.repository(authApi = authApi, storage = emptyStorage(), accountHints = hints)
            repo.restore()

            val outcome = repo.resume(AuthTestSupport.activity())

            assertEquals(AuthRepository.ResumeOutcome.GrantRejected, outcome)
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertNull(hints.payload?.resumeGrant)
            assertEquals(listOf(hint), hints.payload?.accounts)
            assertEquals("RESUME_GRANT_INVALID", repo.sessionEndReason.value?.code)
        }

    @Test
    fun `presence cancelled keeps the Resumable card and makes no network call`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            val presence = AuthTestSupport.FakePresenceVerifier(outcome = PresenceVerifier.Outcome.Cancelled)

            val repo =
                AuthTestSupport.repository(
                    authApi = authApi,
                    storage = emptyStorage(),
                    accountHints = hints,
                    presenceVerifier = presence,
                )
            repo.restore()

            assertEquals(AuthRepository.ResumeOutcome.Cancelled, repo.resume(AuthTestSupport.activity()))
            assertEquals(AuthRepository.State.Resumable(hint), repo.state.value)
            coVerify(exactly = 0) { authApi.resume(any(), any()) }
            assertEquals("grant-1", hints.payload?.resumeGrant)
        }

    @Test
    fun `presence unavailable at prompt time drops to the login screen`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            val presence = AuthTestSupport.FakePresenceVerifier(outcome = PresenceVerifier.Outcome.Unavailable)

            val repo = AuthTestSupport.repository(storage = emptyStorage(), accountHints = hints, presenceVerifier = presence)
            repo.restore()

            assertEquals(AuthRepository.ResumeOutcome.Unavailable, repo.resume(AuthTestSupport.activity()))
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertEquals(listOf(hint), repo.rememberedAccounts.value)
        }

    @Test
    fun `transient failure keeps the grant and the Resumable card`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            coEvery { authApi.challenge(any()) } throws IOException("offline")
            coEvery { authApi.resume(any(), any()) } throws IOException("offline")

            val repo = AuthTestSupport.repository(authApi = authApi, storage = emptyStorage(), accountHints = hints)
            repo.restore()

            assertTrue(repo.resume(AuthTestSupport.activity()) is AuthRepository.ResumeOutcome.Transient)
            assertEquals(AuthRepository.State.Resumable(hint), repo.state.value)
            assertEquals("grant-1", hints.payload?.resumeGrant)
        }

    @Test
    fun `useDifferentAccount keeps the grant and shows login`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore(payload = payloadWithGrant())
            val repo = AuthTestSupport.repository(storage = emptyStorage(), accountHints = hints)
            repo.restore()

            repo.useDifferentAccount()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertEquals("grant-1", hints.payload?.resumeGrant)
        }
}
