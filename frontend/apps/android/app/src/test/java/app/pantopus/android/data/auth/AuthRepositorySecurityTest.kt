package app.pantopus.android.data.auth

import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.auth.ChallengeResponse
import app.pantopus.android.data.api.models.auth.OkResponse
import app.pantopus.android.data.api.models.auth.RefreshResponse
import app.pantopus.android.data.api.models.auth.RevokedCountResponse
import app.pantopus.android.data.api.models.auth.StepUpResponse
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.services.AuthApi
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException
import java.util.Base64

/**
 * The step-up / revoke / silent-push half of the persistent-login repository:
 *  - `device_key` step-up only for an interactive-enrolled key AND an
 *    interactive session (design §2.6, §7.10); password step-up always
 *  - `revoke-others` returns the count; `revoke-all` (Lockdown) also signs
 *    this device out locally, keeping the display hint
 *  - `session_revoked` push: the push is never the authority — only a 401
 *    from `/refresh` signs out
 *  - step-up key enrolment is refused for restored sessions client-side
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthRepositorySecurityTest {
    private val userAdapter = Moshi.Builder().build().adapter(UserDto::class.java)

    private val sessionUser =
        UserDto(id = "u_1", email = "a@b.com", displayName = "Alice", avatarUrl = null, username = "alice")

    private val profile =
        UserProfile(
            id = "u_1",
            email = "a@b.com",
            username = "alice",
            firstName = "Alice",
            middleName = null,
            lastName = "Doe",
            name = "Alice Doe",
            phoneNumber = null,
            dateOfBirth = null,
            address = null,
            city = null,
            state = null,
            zipcode = null,
            accountType = "personal",
            role = "member",
            verified = true,
            residency = null,
            avatarUrl = null,
            profilePictureUrl = null,
            profilePicture = null,
            bio = null,
            tagline = null,
            socialLinks = null,
            skills = null,
            followersCount = null,
            averageRating = null,
            gigsPosted = null,
            gigsCompleted = null,
            profileVisibility = null,
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = "2025-01-01T00:00:00Z",
        )

    private fun httpException(
        code: Int,
        body: String,
    ): HttpException = HttpException(Response.error<Any>(code, body.toResponseBody("application/json".toMediaTypeOrNull())))

    /** Storage holding a live session with the given [context]. */
    private suspend fun signedInStorage(context: String = "interactive"): TokenStorage =
        AuthTestSupport.tokenStorage().apply {
            save("at", "rt", "u_1", expiresAt = 4_000_000_000, sessionId = "sid", sessionContext = context)
            saveUserJson(userAdapter.toJson(sessionUser))
        }

    /** Repository restored into [AuthRepository.State.SignedIn] from [storage]. */
    private suspend fun signedInRepo(
        storage: TokenStorage,
        authApi: AuthApi,
        stepUpKeyStore: StepUpKeyStore = mockk(relaxed = true),
        deviceIdentity: DeviceIdentity = AuthTestSupport.deviceIdentity(),
        hints: AccountHintStore = AuthTestSupport.FakeAccountHintStore(),
    ): AuthRepository {
        val api = mockk<ApiService>()
        coEvery { api.me() } returns ProfileResponse(user = profile, inviteProgress = null)
        val repo =
            AuthTestSupport.repository(
                api = api,
                authApi = authApi,
                storage = storage,
                stepUpKeyStore = stepUpKeyStore,
                deviceIdentity = deviceIdentity,
                descriptors = AuthTestSupport.descriptors(deviceIdentity),
                accountHints = hints,
            )
        repo.restore()
        assertTrue(repo.state.value is AuthRepository.State.SignedIn)
        return repo
    }

    // ── device_key step-up gating ──────────────────────────────────────

    @Test
    fun `device_key step-up needs an enrolled key, the same user and an interactive session`() =
        runTest {
            val identity = AuthTestSupport.deviceIdentity()
            val stepUpKeys = mockk<StepUpKeyStore>(relaxed = true)
            every { stepUpKeys.isEnrolled() } returns true
            val authApi = mockk<AuthApi>(relaxed = true)

            // Interactive session, key enrolled for this user → allowed.
            identity.markStepUpEnrolled("u_1")
            val interactive = signedInRepo(signedInStorage("interactive"), authApi, stepUpKeys, identity)
            assertTrue(interactive.canStepUpWithDeviceKey())

            // Restored session → refused even though the key exists.
            val restored = signedInRepo(signedInStorage("restored"), authApi, stepUpKeys, identity)
            assertFalse(restored.canStepUpWithDeviceKey())
            assertEquals(
                AuthRepository.StepUpResult.Unavailable,
                restored.stepUpWithDeviceKey("delete_account") { null },
            )
            coVerify(exactly = 0) { authApi.challenge(any()) }

            // Key enrolled by another account on this device → refused.
            identity.markStepUpEnrolled("someone_else")
            assertFalse(interactive.canStepUpWithDeviceKey())
        }

    @Test
    fun `device_key step-up signs the raw challenge and posts challengeId + base64url signature`() =
        runTest {
            val identity = AuthTestSupport.deviceIdentity().apply { markStepUpEnrolled("u_1") }
            val stepUpKeys = mockk<StepUpKeyStore>(relaxed = true)
            every { stepUpKeys.isEnrolled() } returns true
            val challengeBytes = ByteArray(32) { (it * 3).toByte() }
            val signature = ByteArray(64) { 7 }
            coEvery { stepUpKeys.sign(any(), any()) } answers {
                assertTrue(firstArg<ByteArray>().contentEquals(challengeBytes))
                StepUpKeyStore.SignResult.Signed(signature)
            }
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.challenge(match { it.purpose == "step_up" }) } returns
                ChallengeResponse(
                    challengeId = "c-9",
                    challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes),
                    expiresAt = null,
                )
            coEvery { authApi.stepUp(any()) } returns
                StepUpResponse(stepUpToken = "sut", expiresAt = null, purpose = "revoke_device")

            val repo = signedInRepo(signedInStorage(), authApi, stepUpKeys, identity)
            val result = repo.stepUpWithDeviceKey("revoke_device") { null }

            assertEquals(AuthRepository.StepUpResult.Token("sut"), result)
            coVerify {
                authApi.stepUp(
                    match {
                        it.purpose == "revoke_device" &&
                            it.method == "device_key" &&
                            it.challengeId == "c-9" &&
                            it.signature == Base64.getUrlEncoder().withoutPadding().encodeToString(signature) &&
                            it.password == null
                    },
                )
            }
        }

    @Test
    fun `device_key step-up cancelled or invalidated maps to Cancelled or Unavailable`() =
        runTest {
            val identity = AuthTestSupport.deviceIdentity().apply { markStepUpEnrolled("u_1") }
            val stepUpKeys = mockk<StepUpKeyStore>(relaxed = true)
            every { stepUpKeys.isEnrolled() } returns true
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.challenge(any()) } returns ChallengeResponse("c", "AAAA", null)

            coEvery { stepUpKeys.sign(any(), any()) } returns
                StepUpKeyStore.SignResult.Failed(StepUpKeyStore.SignFailure.Cancelled)
            val repo = signedInRepo(signedInStorage(), authApi, stepUpKeys, identity)
            assertEquals(AuthRepository.StepUpResult.Cancelled, repo.stepUpWithDeviceKey("delete_account") { null })

            coEvery { stepUpKeys.sign(any(), any()) } returns
                StepUpKeyStore.SignResult.Failed(StepUpKeyStore.SignFailure.Invalidated)
            assertEquals(AuthRepository.StepUpResult.Unavailable, repo.stepUpWithDeviceKey("delete_account") { null })
            // Enrolment marker dropped so the next attempt goes straight to password.
            assertNull(identity.stepUpEnrolledFor())
        }

    @Test
    fun `password step-up posts method password and maps a 401 to InvalidCredentials`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.stepUp(any()) } returns
                StepUpResponse(stepUpToken = "sut", expiresAt = null, purpose = "generic")
            val repo = signedInRepo(signedInStorage(), authApi)

            assertEquals(AuthRepository.StepUpResult.Token("sut"), repo.stepUpWithPassword("delete_account", "pw"))
            coVerify {
                authApi.stepUp(match { it.method == "password" && it.password == "pw" && it.purpose == "delete_account" })
            }

            coEvery { authApi.stepUp(any()) } throws httpException(401, "{\"error\":\"Invalid password\"}")
            val failed = repo.stepUpWithPassword("delete_account", "wrong")
            assertTrue(failed is AuthRepository.StepUpResult.Failed)
            assertEquals(AuthError.InvalidCredentials, (failed as AuthRepository.StepUpResult.Failed).error)
        }

    // ── revoke helpers ─────────────────────────────────────────────────

    @Test
    fun `revokeOtherSessions sends X-Step-Up and returns the count`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.revokeOtherSessions("sut") } returns RevokedCountResponse(revoked = 3)
            val repo = signedInRepo(signedInStorage(), authApi)

            assertEquals(3, repo.revokeOtherSessions("sut"))
            assertTrue(repo.state.value is AuthRepository.State.SignedIn)
        }

    @Test
    fun `revokeAllSessions signs this device out locally without a logout call and keeps the hint`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.revokeAllSessions("sut") } returns OkResponse(ok = true)
            val storage = signedInStorage()
            val hints =
                AuthTestSupport.FakeAccountHintStore(
                    payload =
                        AccountHintPayload(
                            accounts = listOf(AccountHint(userId = "u_1", displayName = "Alice")),
                            resumeGrant = "g",
                            grantUserId = "u_1",
                        ),
                )
            val repo = signedInRepo(storage, authApi, hints = hints)

            repo.revokeAllSessions("sut")

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertNull(storage.accessToken())
            assertNull(storage.refreshToken())
            // Server already revoked everything: no proof-carrying /logout.
            coVerify(exactly = 0) { authApi.logout(any(), any(), any(), any()) }
            assertNull(hints.payload?.resumeGrant)
            assertEquals("u_1", hints.payload?.accounts?.single()?.userId)
            // Explicit user action — no "signed out" banner.
            assertNull(repo.sessionEndReason.value)
        }

    @Test
    fun `revokeAllSessions failure keeps the session and surfaces an AuthError`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.revokeAllSessions(any()) } throws IOException("offline")
            val repo = signedInRepo(signedInStorage(), authApi)

            val thrown = runCatching { repo.revokeAllSessions("sut") }.exceptionOrNull()

            assertEquals(AuthError.NetworkError, thrown)
            assertTrue(repo.state.value is AuthRepository.State.SignedIn)
        }

    // ── silent session_revoked push ────────────────────────────────────

    @Test
    fun `confirmSessionRevoked signs out only when the server confirms with a 401`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            val storage = signedInStorage()
            val repo = signedInRepo(storage, authApi)

            // Transient: nothing changes.
            coEvery { authApi.refresh(any(), any()) } throws IOException("offline")
            repo.confirmSessionRevoked()
            assertTrue(repo.state.value is AuthRepository.State.SignedIn)
            assertEquals("at", storage.accessToken())

            // Rotated: still signed in, token updated.
            coEvery { authApi.refresh(any(), any()) } returns
                RefreshResponse(ok = true, accessToken = "at2", refreshToken = "rt2", expiresIn = 3600, expiresAt = 4_000_000_100)
            repo.confirmSessionRevoked()
            assertTrue(repo.state.value is AuthRepository.State.SignedIn)
            assertEquals("at2", storage.accessToken())

            // Confirmed: security sign-out with the code.
            coEvery { authApi.refresh(any(), any()) } throws
                httpException(401, "{\"error\":\"Session revoked\",\"code\":\"SESSION_REVOKED\"}")
            repo.confirmSessionRevoked()
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertNull(storage.accessToken())
            assertEquals("SESSION_REVOKED", repo.sessionEndReason.value?.code)
            assertEquals(true, repo.sessionEndReason.value?.isSecurity)
        }

    @Test
    fun `confirmSessionRevoked is a no-op when not signed in`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            val repo = AuthTestSupport.repository(authApi = authApi, storage = AuthTestSupport.tokenStorage())
            repo.confirmSessionRevoked()
            coVerify(exactly = 0) { authApi.refresh(any(), any()) }
        }

    // ── step-up key enrolment ──────────────────────────────────────────

    @Test
    fun `enrolStepUpKey posts the public JWK with DPoP for interactive sessions only`() =
        runTest {
            val identity = AuthTestSupport.deviceIdentity()
            val stepUpKeys = mockk<StepUpKeyStore>(relaxed = true)
            every { stepUpKeys.isBiometricStrongAvailable() } returns true
            every { stepUpKeys.publicKey() } returns null
            every { stepUpKeys.enrol() } returns
                StepUpKeyStore.PublicStepUpKey(
                    jwk = mapOf("kty" to "EC", "crv" to "P-256", "x" to "x", "y" to "y"),
                    keyBacking = "strongbox",
                )
            val authApi = mockk<AuthApi>(relaxed = true)
            coEvery { authApi.enrolStepUpKey(any(), any()) } returns OkResponse(ok = true)

            val restored = signedInRepo(signedInStorage("restored"), authApi, stepUpKeys, identity)
            assertFalse(restored.enrolStepUpKey())
            coVerify(exactly = 0) { authApi.enrolStepUpKey(any(), any()) }
            assertNull(identity.stepUpEnrolledFor())

            val interactive = signedInRepo(signedInStorage("interactive"), authApi, stepUpKeys, identity)
            assertTrue(interactive.enrolStepUpKey())
            coVerify {
                authApi.enrolStepUpKey(
                    match { it.publicKeyJwk["x"] == "x" && it.keyBacking == "strongbox" },
                    match { it.split(".").size == 3 },
                )
            }
            assertEquals("u_1", identity.stepUpEnrolledFor())
        }
}
