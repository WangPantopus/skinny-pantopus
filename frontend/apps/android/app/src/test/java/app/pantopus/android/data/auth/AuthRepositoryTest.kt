@file:Suppress("LargeClass", "LongParameterList")

package app.pantopus.android.data.auth

import app.cash.turbine.test
import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.auth.AuthMessageResponse
import app.pantopus.android.data.api.models.auth.AuthenticatedUser
import app.pantopus.android.data.api.models.auth.ForgotPasswordRequest
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.RefreshResponse
import app.pantopus.android.data.api.models.auth.RegisterRequest
import app.pantopus.android.data.api.models.auth.RegisterResponse
import app.pantopus.android.data.api.models.auth.ResendVerificationRequest
import app.pantopus.android.data.api.models.auth.ResetPasswordRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailResponse
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.services.AuthApi
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.observability.Observability
import app.pantopus.android.data.realtime.SocketManager
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class AuthRepositoryTest {
    private val userAdapter = Moshi.Builder().build().adapter(UserDto::class.java)

    private val sessionUser =
        UserDto(
            id = "u_1",
            email = "a@b.com",
            displayName = "Alice Doe",
            avatarUrl = null,
            username = "alice",
        )

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

    private val loginResponse =
        LoginResponse(
            message = "ok",
            accessToken = "at",
            refreshToken = "rt",
            expiresIn = 3600,
            expiresAt = 1_800_000_000,
            user = authUser,
        )

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

    private fun buildRepo(
        api: ApiService = mockk(relaxed = true),
        authApi: AuthApi = mockk(relaxed = true),
        // Refresh uses the dedicated @Named("authRefresh") client in production;
        // default it to the same mock so existing `authApi.refresh` stubs apply.
        refreshApi: AuthApi = authApi,
        storage: TokenStorage = mockk(relaxed = true),
        obs: Observability = mockk(relaxed = true),
        socketManager: SocketManager = mockk(relaxed = true),
        feedModeration: FeedModerationStore = FeedModerationStore(),
        accountHints: AccountHintStore = AuthTestSupport.FakeAccountHintStore(),
        deviceKeyStore: DeviceKeyStore = AuthTestSupport.deviceKeyStore(),
    ) = AuthTestSupport.repository(
        api = api,
        authApi = authApi,
        refreshApi = refreshApi,
        storage = storage,
        obs = obs,
        socketManager = socketManager,
        feedModeration = feedModeration,
        accountHints = accountHints,
        deviceKeyStore = deviceKeyStore,
    )

    private fun httpException(
        code: Int,
        body: String,
    ): HttpException =
        HttpException(
            Response.error<Any>(code, body.toResponseBody("application/json".toMediaTypeOrNull())),
        )

    @Test
    fun `signIn success persists tokens, identifies user, flips to SignedIn`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            val obs = mockk<Observability>(relaxed = true)
            val socketManager = mockk<SocketManager>(relaxed = true)

            // Login carries the device descriptor + a DPoP proof (CONTRACT).
            coEvery {
                authApi.login(
                    match { it.email == "a@b.com" && it.password == "hunter22" && it.device != null },
                    match { it.split(".").size == 3 },
                )
            } returns loginResponse

            val repo = buildRepo(authApi = authApi, storage = storage, obs = obs, socketManager = socketManager)

            repo.state.test {
                assertEquals(AuthRepository.State.Unknown, awaitItem())

                val result = repo.signIn("a@b.com", "hunter22")
                assertTrue(result.isSuccess)
                assertEquals(AuthRepository.State.SignedIn(sessionUser), awaitItem())
            }

            coVerify {
                storage.save(
                    accessToken = "at",
                    refreshToken = "rt",
                    userId = "u_1",
                    expiresAt = 1_800_000_000,
                    sessionId = null,
                    sessionContext = "interactive",
                )
            }
            verify { socketManager.connect("at") }
            coVerify { obs.identify(userId = "u_1", email = "a@b.com") }
            coVerify { obs.track("auth.signed_in", any()) }
        }

    @Test
    fun `signIn failure captures error and keeps state Unknown`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val obs = mockk<Observability>(relaxed = true)
            coEvery { authApi.login(any(), any()) } throws IllegalStateException("boom")

            val repo = buildRepo(authApi = authApi, obs = obs)
            val result = repo.signIn("a@b.com", "hunter22")

            assertTrue(result.isFailure)
            coVerify { obs.capture(match<Throwable> { it.message == "boom" }) }
        }

    @Test
    fun `signOut clears storage and identity`() =
        runTest {
            val storage = mockk<TokenStorage>(relaxed = true)
            val obs = mockk<Observability>(relaxed = true)

            val repo = buildRepo(storage = storage, obs = obs)
            repo.signOut()

            coVerify { storage.clear() }
            coVerify { obs.identify(userId = null, email = null) }
            coVerify { obs.track("auth.signed_out", any()) }
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
        }

    @Test
    fun `restore with no token goes to SignedOut`() =
        runTest {
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.accessToken() } returns null

            val repo = buildRepo(storage = storage)
            repo.restore()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
        }

    @Test
    fun `restore with valid token hydrates user`() =
        runTest {
            val api = mockk<ApiService>()
            val storage = mockk<TokenStorage>(relaxed = true)
            val obs = mockk<Observability>(relaxed = true)

            coEvery { storage.accessToken() } returns "at"
            coEvery { api.me() } returns ProfileResponse(user = profile, inviteProgress = null)

            val repo = buildRepo(api = api, storage = storage, obs = obs)
            repo.restore()

            assertEquals(AuthRepository.State.SignedIn(sessionUser), repo.state.value)
            coVerify { obs.identify(userId = "u_1", email = "a@b.com") }
        }

    @Test
    fun `restore with invalid token clears storage and signs out`() =
        runTest {
            val api = mockk<ApiService>()
            val storage = mockk<TokenStorage>(relaxed = true)

            coEvery { storage.accessToken() } returns "expired"
            // A genuine 401 that even the silent refresh couldn't recover.
            coEvery { api.me() } throws httpException(401, "{\"error\":\"Invalid or expired token\"}")

            val repo = buildRepo(api = api, storage = storage)
            repo.restore()

            coVerify { storage.clear() }
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
        }

    @Test
    fun `restore while offline keeps the cached session instead of wiping it`() =
        runTest {
            val api = mockk<ApiService>()
            val storage = mockk<TokenStorage>(relaxed = true)
            val obs = mockk<Observability>(relaxed = true)

            coEvery { storage.accessToken() } returns "at"
            coEvery { storage.userJson() } returns userAdapter.toJson(sessionUser)
            // Network unreachable at launch — must NOT log the user out.
            coEvery { api.me() } throws IOException("offline")

            val repo = buildRepo(api = api, storage = storage, obs = obs)
            repo.restore()

            assertEquals(AuthRepository.State.SignedIn(sessionUser), repo.state.value)
            coVerify(exactly = 0) { storage.clear() }
        }

    @Test
    fun `restore while offline with no cached user preserves tokens and shows signed out`() =
        runTest {
            val api = mockk<ApiService>()
            val storage = mockk<TokenStorage>(relaxed = true)

            coEvery { storage.accessToken() } returns "at"
            coEvery { storage.userJson() } returns null
            coEvery { api.me() } throws IOException("offline")

            val repo = buildRepo(api = api, storage = storage)
            repo.restore()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            coVerify(exactly = 0) { storage.clear() }
        }

    // ───────────────────────── T6.1a additions ─────────────────────────

    @Test
    fun `signUp success returns SignUpResult with requiresEmailVerification`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val response =
                RegisterResponse(
                    message = "Registration successful.",
                    requiresEmailVerification = true,
                    user = authUser.copy(id = "u_new", verified = false),
                )
            coEvery { authApi.register(any()) } returns response

            val repo = buildRepo(authApi = authApi)
            val result =
                repo.signUp(
                    email = "new@example.com",
                    password = "strongpass123",
                    phoneNumber = null,
                    username = "newuser",
                    firstName = "New",
                    middleName = null,
                    lastName = "User",
                    dateOfBirth = null,
                    address = null,
                    city = null,
                    state = null,
                    zipcode = null,
                    accountType = AccountType.Personal,
                    inviteCode = null,
                )

            assertEquals("u_new", result.user.id)
            assertTrue(result.requiresEmailVerification)
            // Does not flip session state.
            assertEquals(AuthRepository.State.Unknown, repo.state.value)
            coVerify {
                authApi.register(
                    match<RegisterRequest> { it.accountType == "individual" && it.email == "new@example.com" },
                )
            }
        }

    @Test
    fun `signUp 400 with already registered maps to EmailAlreadyExists`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.register(any()) } throws
                httpException(400, "{\"error\":\"Email already registered\"}")

            val repo = buildRepo(authApi = authApi)
            try {
                repo.signUp(
                    email = "taken@example.com",
                    password = "strongpass123",
                    phoneNumber = null,
                    username = "u",
                    firstName = "T",
                    middleName = null,
                    lastName = "U",
                    dateOfBirth = null,
                    address = null,
                    city = null,
                    state = null,
                    zipcode = null,
                    accountType = AccountType.Personal,
                    inviteCode = null,
                )
                throw AssertionError("Expected throw")
            } catch (e: AuthError) {
                assertEquals(AuthError.EmailAlreadyExists, e)
            }
        }

    @Test
    fun `forgotPassword success returns Unit`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.forgotPassword(any()) } returns AuthMessageResponse(message = "ok")

            val repo = buildRepo(authApi = authApi)
            repo.forgotPassword("a@b.com")

            coVerify { authApi.forgotPassword(ForgotPasswordRequest(email = "a@b.com")) }
        }

    @Test
    fun `forgotPassword 5xx maps to ServerError`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.forgotPassword(any()) } throws
                httpException(503, "{\"error\":\"unavailable\"}")

            val repo = buildRepo(authApi = authApi)
            try {
                repo.forgotPassword("a@b.com")
                throw AssertionError("Expected throw")
            } catch (e: AuthError) {
                assertTrue("Expected ServerError, got $e", e is AuthError.ServerError)
            }
        }

    @Test
    fun `resetPassword 400 invalid token maps to ServerError`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.resetPassword(any()) } throws
                httpException(400, "{\"error\":\"Invalid or expired reset token\"}")

            val repo = buildRepo(authApi = authApi)
            try {
                repo.resetPassword("stale", "newstrong123")
                throw AssertionError("Expected throw")
            } catch (e: AuthError) {
                assertTrue("Expected ServerError, got $e", e is AuthError.ServerError)
                assertEquals("Invalid or expired reset token", (e as AuthError.ServerError).detail)
            }
        }

    @Test
    fun `resetPassword success calls API with token and newPassword`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.resetPassword(any()) } returns AuthMessageResponse(message = "ok")

            val repo = buildRepo(authApi = authApi)
            repo.resetPassword("hash", "newstrong123")

            coVerify { authApi.resetPassword(ResetPasswordRequest(token = "hash", newPassword = "newstrong123")) }
        }

    @Test
    fun `verifyEmail success`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.verifyEmail(any()) } returns
                VerifyEmailResponse(message = "ok", verified = true)

            val repo = buildRepo(authApi = authApi)
            repo.verifyEmail("hashed-token")

            coVerify { authApi.verifyEmail(VerifyEmailRequest(tokenHash = "hashed-token")) }
        }

    @Test
    fun `verifyEmail 400 maps to ServerError`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.verifyEmail(any()) } throws
                httpException(400, "{\"error\":\"Invalid or expired verification link/code\"}")

            val repo = buildRepo(authApi = authApi)
            try {
                repo.verifyEmail("bad")
                throw AssertionError("Expected throw")
            } catch (e: AuthError) {
                assertTrue("Expected ServerError, got $e", e is AuthError.ServerError)
            }
        }

    @Test
    fun `resendVerification success`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.resendVerification(any()) } returns AuthMessageResponse(message = "ok")

            val repo = buildRepo(authApi = authApi)
            repo.resendVerification("a@b.com")

            coVerify { authApi.resendVerification(ResendVerificationRequest(email = "a@b.com")) }
        }

    @Test
    fun `refreshSession success rotates tokens without touching userId`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt-current"
            coEvery { authApi.refresh(any(), any()) } returns
                RefreshResponse(
                    ok = true,
                    accessToken = "new-at",
                    refreshToken = "new-rt",
                    expiresIn = 3600,
                    expiresAt = 1_800_000_000,
                )

            val repo = buildRepo(authApi = authApi, storage = storage)
            repo.refreshSession()

            coVerify {
                authApi.refresh(
                    match { it.refreshToken == "rt-current" && it.deviceId != null },
                    match { it.split(".").size == 3 },
                )
            }
            coVerify { storage.updateTokens(accessToken = "new-at", refreshToken = "new-rt", expiresAt = 1_800_000_000, sessionId = null) }
        }

    @Test
    fun `refreshSession failure signs out and rethrows`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "stale"
            coEvery { authApi.refresh(any(), any()) } throws
                httpException(401, "{\"error\":\"Session expired\"}")

            val repo = buildRepo(authApi = authApi, storage = storage)
            try {
                repo.refreshSession()
                throw AssertionError("Expected throw")
            } catch (e: AuthError) {
                assertEquals(AuthError.InvalidCredentials, e)
            }
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            coVerify { storage.clear() }
        }

    @Test
    fun `refreshAccessToken returns rotated token and persists it`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt-current"
            coEvery { authApi.refresh(any(), any()) } returns
                RefreshResponse(
                    ok = true,
                    accessToken = "new-at",
                    refreshToken = "new-rt",
                    expiresIn = 3600,
                    expiresAt = 1_800_000_000,
                )

            val repo = buildRepo(authApi = authApi, storage = storage)
            val token = repo.refreshAccessToken()

            assertEquals("new-at", token)
            coVerify { storage.updateTokens(accessToken = "new-at", refreshToken = "new-rt", expiresAt = 1_800_000_000, sessionId = null) }
            // Must NOT sign out on the happy path.
            coVerify(exactly = 0) { storage.clear() }
        }

    @Test
    fun `refreshAccessToken returns null without signing out on failure`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "stale"
            coEvery { authApi.refresh(any(), any()) } throws httpException(401, "{\"error\":\"Session expired\"}")

            val repo = buildRepo(authApi = authApi, storage = storage)
            val token = repo.refreshAccessToken()

            assertEquals(null, token)
            // The caller (TokenAuthenticator) decides — refresh itself never wipes.
            coVerify(exactly = 0) { storage.clear() }
            coVerify(exactly = 0) { storage.updateTokens(any(), any(), any(), any()) }
        }

    @Test
    fun `refreshAccessToken returns null when no refresh token is stored`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns null

            val repo = buildRepo(authApi = authApi, storage = storage)
            val token = repo.refreshAccessToken()

            assertEquals(null, token)
            coVerify(exactly = 0) { authApi.refresh(any(), any()) }
        }

    @Test
    fun `refreshTokens classifies a 401 as AuthRejected`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "stale"
            coEvery { authApi.refresh(any(), any()) } throws httpException(401, "{\"error\":\"Session expired\"}")

            val repo = buildRepo(authApi = authApi, storage = storage)

            assertTrue(repo.refreshTokens() is AuthRepository.RefreshOutcome.AuthRejected)
            coVerify(exactly = 0) { storage.clear() }
            coVerify(exactly = 0) { storage.updateTokens(any(), any(), any(), any()) }
        }

    @Test
    fun `refreshTokens classifies a network error as Transient (no sign-out)`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt"
            coEvery { authApi.refresh(any(), any()) } throws IOException("timeout")

            val repo = buildRepo(authApi = authApi, storage = storage)

            assertEquals(AuthRepository.RefreshOutcome.Transient, repo.refreshTokens())
            // A flaky network must NOT wipe tokens or update them.
            coVerify(exactly = 0) { storage.clear() }
            coVerify(exactly = 0) { storage.updateTokens(any(), any(), any(), any()) }
        }

    @Test
    fun `refreshTokens classifies a 5xx as Transient`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt"
            coEvery { authApi.refresh(any(), any()) } throws httpException(503, "{\"error\":\"unavailable\"}")

            val repo = buildRepo(authApi = authApi, storage = storage)

            assertEquals(AuthRepository.RefreshOutcome.Transient, repo.refreshTokens())
            coVerify(exactly = 0) { storage.clear() }
        }

    @Test
    fun `refreshTokens returns Rotated and persists on success`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt-current"
            coEvery { authApi.refresh(any(), any()) } returns
                RefreshResponse(
                    ok = true,
                    accessToken = "new-at",
                    refreshToken = "new-rt",
                    expiresIn = 3600,
                    expiresAt = 1_800_000_000,
                )

            val repo = buildRepo(authApi = authApi, storage = storage)

            assertEquals(AuthRepository.RefreshOutcome.Rotated("new-at"), repo.refreshTokens())
            coVerify { storage.updateTokens(accessToken = "new-at", refreshToken = "new-rt", expiresAt = 1_800_000_000, sessionId = null) }
        }

    @Test
    fun `restore keeps the session on HTTP 403 (valid token, forbidden action)`() =
        runTest {
            val api = mockk<ApiService>()
            val storage = mockk<TokenStorage>(relaxed = true)

            coEvery { storage.accessToken() } returns "at"
            coEvery { storage.userJson() } returns userAdapter.toJson(sessionUser)
            // 403 = authorization decision on a still-valid token; must NOT wipe.
            coEvery { api.me() } throws httpException(403, "{\"error\":\"forbidden\"}")

            val repo = buildRepo(api = api, storage = storage)
            repo.restore()

            assertEquals(AuthRepository.State.SignedIn(sessionUser), repo.state.value)
            coVerify(exactly = 0) { storage.clear() }
        }

    // ───────────── Persistent login: logout proof, hints, refresh codes ─────────────

    @Test
    fun `signOut calls POST logout with scope local, refreshToken, bearer and DPoP(rth) proof`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            val storage = AuthTestSupport.tokenStorage()
            storage.save("at", "rt", "u_1", expiresAt = 1_800_000_000, sessionId = "sid", sessionContext = "interactive")
            val hints = AuthTestSupport.FakeAccountHintStore()
            hints.payload =
                AccountHintPayload(
                    accounts = listOf(AccountHint(userId = "u_1", displayName = "Alice", maskedEmail = "a•••@b.com")),
                    resumeGrant = "grant-1",
                    grantUserId = "u_1",
                )

            val repo = buildRepo(authApi = authApi, storage = storage, accountHints = hints)
            repo.signOut()

            coVerify {
                authApi.logout(
                    match { it.scope == "local" && it.refreshToken == "rt" && !it.deviceId.isNullOrBlank() },
                    authorization = "Bearer at",
                    dpop = match { proof -> proof.contains(".") && proof.split(".").size == 3 },
                    stepUp = null,
                )
            }
            assertEquals(null, storage.accessToken())
            assertEquals(null, storage.refreshToken())
            assertEquals(null, storage.expiresAt())
            assertEquals(null, storage.sessionId())
            // Grant is gone, the display hint stays (login screen prefill).
            assertEquals(null, hints.payload?.resumeGrant)
            assertEquals("u_1", hints.payload?.accounts?.single()?.userId)
            assertEquals("u_1", repo.rememberedAccounts.value.single().userId)
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
        }

    @Test
    fun `signOut with a server reason skips the network call, keeps hints, publishes the reason`() =
        runTest {
            val authApi = mockk<AuthApi>(relaxed = true)
            val storage = AuthTestSupport.tokenStorage()
            storage.save("at", "rt", "u_1")
            val hints = AuthTestSupport.FakeAccountHintStore()
            hints.payload = AccountHintPayload(accounts = listOf(AccountHint(userId = "u_1", displayName = "Alice")))

            val repo = buildRepo(authApi = authApi, storage = storage, accountHints = hints)
            repo.signOut(reason = SessionEndReason.fromCode("SESSION_REVOKED"))

            coVerify(exactly = 0) { authApi.logout(any(), any(), any(), any()) }
            assertEquals(null, storage.accessToken())
            assertEquals("u_1", hints.payload?.accounts?.single()?.userId)
            val reason = repo.sessionEndReason.value
            assertEquals("SESSION_REVOKED", reason?.code)
            assertEquals(true, reason?.isSecurity)
            repo.consumeSessionEndReason()
            assertEquals(null, repo.sessionEndReason.value)
        }

    @Test
    fun `signOut still wipes locally when the logout call fails`() =
        runTest {
            val authApi = mockk<AuthApi>()
            coEvery { authApi.logout(any(), any(), any(), any()) } throws IOException("offline")
            val storage = AuthTestSupport.tokenStorage()
            storage.save("at", "rt", "u_1")

            val repo = buildRepo(authApi = authApi, storage = storage)
            repo.signOut()

            assertEquals(null, storage.accessToken())
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
        }

    @Test
    fun `removeRememberedAccount forgets the hint and deletes the Block Store entry when empty`() =
        runTest {
            val hints = AuthTestSupport.FakeAccountHintStore()
            hints.payload =
                AccountHintPayload(
                    accounts = listOf(AccountHint(userId = "u_1", displayName = "Alice")),
                    resumeGrant = "g",
                    grantUserId = "u_1",
                )
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.accessToken() } returns null
            val repo = buildRepo(storage = storage, accountHints = hints)
            repo.restore()
            assertTrue(repo.state.value is AuthRepository.State.Resumable)

            repo.removeRememberedAccount()

            assertEquals(1, hints.deletes)
            assertEquals(null, hints.payload)
            assertTrue(repo.rememberedAccounts.value.isEmpty())
            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
        }

    @Test
    fun `refreshTokens maps the 401 body code to a security SessionEndReason`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt"
            coEvery { authApi.refresh(any(), any()) } throws
                httpException(401, "{\"error\":\"Refresh token reuse detected\",\"code\":\"TOKEN_REUSE\"}")

            val outcome = buildRepo(authApi = authApi, storage = storage).refreshTokens()

            val rejected = outcome as AuthRepository.RefreshOutcome.AuthRejected
            assertEquals("TOKEN_REUSE", rejected.reason.code)
            assertTrue(rejected.reason.isSecurity)
            assertEquals("You were signed out for security. Sign in again.", rejected.reason.message)
        }

    @Test
    fun `refreshTokens without a code is a plain expiry`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = mockk<TokenStorage>(relaxed = true)
            coEvery { storage.refreshToken() } returns "rt"
            coEvery { authApi.refresh(any(), any()) } throws httpException(401, "{\"error\":\"Session expired\"}")

            val rejected = buildRepo(authApi = authApi, storage = storage).refreshTokens() as AuthRepository.RefreshOutcome.AuthRejected
            assertEquals(null, rejected.reason.code)
            assertEquals(false, rejected.reason.isSecurity)
        }

    @Test
    fun `refreshTokens sends the DPoP proof with rth over the refresh token and persists expiresAt + sessionId`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = AuthTestSupport.tokenStorage()
            storage.save("at", "rt-current", "u_1", expiresAt = 1L, sessionId = "sid-1", sessionContext = "interactive")
            var proofSeen: String? = null
            coEvery { authApi.refresh(any(), any()) } answers {
                proofSeen = secondArg()
                RefreshResponse(
                    ok = true,
                    accessToken = "new-at",
                    refreshToken = "new-rt",
                    expiresIn = 3600,
                    expiresAt = 2L,
                    sessionId = "sid-1",
                )
            }

            val repo = buildRepo(authApi = authApi, storage = storage)
            assertEquals(AuthRepository.RefreshOutcome.Rotated("new-at"), repo.refreshTokens())

            val payload =
                java.util.Base64.getUrlDecoder().decode(proofSeen!!.split(".")[1]).toString(Charsets.UTF_8)
            assertTrue(payload.contains("\"rth\":\"" + DPoPProofBuilder.refreshTokenHash("rt-current") + "\""))
            assertTrue(payload.contains("/api/users/refresh"))
            assertEquals("new-rt", storage.refreshToken())
            assertEquals(2L, storage.expiresAt())
            assertEquals("sid-1", storage.sessionId())
            coVerify { authApi.refresh(match { it.refreshToken == "rt-current" && it.sessionId == "sid-1" }, any()) }
        }

    @Test
    fun `refreshIfExpiringSoon refreshes only inside the 120 s window`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = AuthTestSupport.tokenStorage()
            coEvery { authApi.refresh(any(), any()) } returns
                RefreshResponse(ok = true, accessToken = "new-at", refreshToken = "new-rt", expiresIn = 3600, expiresAt = 5_000L)
            val repo = buildRepo(authApi = authApi, storage = storage)

            // No expiresAt persisted -> never proactive.
            storage.save("at", "rt", "u_1")
            assertEquals(null, repo.refreshIfExpiringSoon(nowMillis = 1_000_000L))

            // 300 s left -> not yet.
            storage.save("at", "rt", "u_1", expiresAt = 1_300L)
            assertEquals(null, repo.refreshIfExpiringSoon(nowMillis = 1_000_000L))
            coVerify(exactly = 0) { authApi.refresh(any(), any()) }

            // 60 s left -> refresh.
            storage.save("at", "rt", "u_1", expiresAt = 1_060L)
            assertEquals(AuthRepository.RefreshOutcome.Rotated("new-at"), repo.refreshIfExpiringSoon(nowMillis = 1_000_000L))
            assertEquals(5_000L, storage.expiresAt())
        }

    @Test
    fun `restore proactively refreshes an about-to-expire token before hitting profile`() =
        runTest {
            val api = mockk<ApiService>()
            val authApi = mockk<AuthApi>()
            val storage = AuthTestSupport.tokenStorage()
            // Expires "now" -> inside the window.
            storage.save("at", "rt", "u_1", expiresAt = System.currentTimeMillis() / 1000 + 10)
            coEvery { authApi.refresh(any(), any()) } returns
                RefreshResponse(ok = true, accessToken = "new-at", refreshToken = "new-rt", expiresIn = 3600, expiresAt = 1_800_000_000)
            coEvery { api.me() } returns ProfileResponse(user = profile, inviteProgress = null)

            val repo = buildRepo(api = api, authApi = authApi, storage = storage)
            repo.restore()

            coVerify(exactly = 1) { authApi.refresh(any(), any()) }
            assertEquals("new-at", storage.accessToken())
            assertEquals(AuthRepository.State.SignedIn(sessionUser), repo.state.value)
        }

    @Test
    fun `restore signs out with the security reason when the proactive refresh is refused`() =
        runTest {
            val api = mockk<ApiService>(relaxed = true)
            val authApi = mockk<AuthApi>()
            val storage = AuthTestSupport.tokenStorage()
            storage.save("at", "rt", "u_1", expiresAt = System.currentTimeMillis() / 1000 + 10)
            coEvery { authApi.refresh(any(), any()) } throws
                httpException(401, "{\"error\":\"device revoked\",\"code\":\"DEVICE_REVOKED\"}")

            val repo = buildRepo(api = api, authApi = authApi, storage = storage)
            repo.restore()

            assertEquals(AuthRepository.State.SignedOut, repo.state.value)
            assertEquals("DEVICE_REVOKED", repo.sessionEndReason.value?.code)
            assertEquals(null, storage.accessToken())
            coVerify(exactly = 0) { api.me() }
        }

    @Test
    fun `interactive login registers the device with the FCM token and stores the returned grant`() =
        runTest {
            val authApi = mockk<AuthApi>()
            val storage = AuthTestSupport.tokenStorage()
            val hints = AuthTestSupport.FakeAccountHintStore()
            coEvery { authApi.login(any(), any()) } returns loginResponse.copy(sessionId = "sid-1")
            coEvery { authApi.registerDevice(any(), any()) } returns
                app.pantopus.android.data.api.models.auth.RegisterDeviceResponse(device = null, resumeGrant = "grant-1")

            val repo = buildRepo(authApi = authApi, storage = storage, accountHints = hints)
            assertTrue(repo.signIn("a@b.com", "hunter22").isSuccess)

            coVerify {
                authApi.registerDevice(
                    match { it.pushToken == "fcm-token" && it.pushProvider == "fcm" && it.device.deviceId.isNotBlank() },
                    match { it.split(".").size == 3 },
                )
            }
            assertEquals("sid-1", storage.sessionId())
            assertEquals("interactive", storage.sessionContext())
            assertEquals("grant-1", hints.payload?.resumeGrant)
            assertEquals("u_1", hints.payload?.grantUserId)
            val hint = hints.payload?.accounts?.single()
            assertEquals("Alice Doe", hint?.displayName)
            assertEquals("a•••@b.com", hint?.maskedEmail)
            assertEquals("password", hint?.lastMethod)
            assertEquals("u_1", repo.rememberedAccounts.value.single().userId)
        }
}
