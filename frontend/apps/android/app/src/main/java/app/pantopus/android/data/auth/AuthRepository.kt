@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.data.auth

import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.auth.AuthErrorBody
import app.pantopus.android.data.api.models.auth.AuthenticatedUser
import app.pantopus.android.data.api.models.auth.ForgotPasswordRequest
import app.pantopus.android.data.api.models.auth.LoginRequest
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.OAuthCodeExchangeRequest
import app.pantopus.android.data.api.models.auth.OAuthTokenExchangeRequest
import app.pantopus.android.data.api.models.auth.RefreshRequest
import app.pantopus.android.data.api.models.auth.RegisterRequest
import app.pantopus.android.data.api.models.auth.ResendVerificationRequest
import app.pantopus.android.data.api.models.auth.ResetPasswordRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailRequest
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.services.AuthApi
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.observability.Observability
import app.pantopus.android.data.realtime.SocketManager
import com.squareup.moshi.Moshi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlin.coroutines.cancellation.CancellationException

/**
 * Account type chosen at registration. Maps to the backend `account_type`
 * column. Persisted as `"individual"` (personal) or `"business"` per
 * `registerSchema` at `backend/routes/users.js:723`.
 */
enum class AccountType(val backendValue: String) {
    Personal("individual"),
    Business("business"),
}

/**
 * Typed error surface for the auth flows. Mapping rules mirror iOS
 * `AuthError`:
 *
 * - [InvalidCredentials] — login 401 (wrong email/password).
 * - [EmailAlreadyExists] — register 400 whose error message references
 *   "Email already registered" or "already registered".
 * - [WeakPassword] — register 400 whose error message references the
 *   password length policy.
 * - [NetworkError] — transport-level failure: offline, timeout, DNS.
 * - [RateLimited] — 429 from any auth endpoint.
 * - [ServerError] — 5xx or otherwise unrecoverable server reply; carries
 *   the backend's `error` field for diagnostics.
 * - [Unknown] — any other failure.
 */
sealed class AuthError(
    override val message: String,
    override val cause: Throwable? = null,
) : Throwable(message, cause) {
    data object InvalidCredentials : AuthError("Invalid email or password.")

    data object EmailAlreadyExists : AuthError("An account with this email already exists.")

    data object WeakPassword : AuthError("Choose a stronger password.")

    data object NetworkError : AuthError("Can't reach Pantopus. Check your connection.")

    data object RateLimited : AuthError("Too many attempts. Try again in a moment.")

    data class ServerError(
        val detail: String,
    ) : AuthError(detail)

    data object Unknown : AuthError("Something went wrong. Please try again.")
}

/**
 * Result of a successful `signUp` call. Carries the created user plus the
 * verify-email gating flag (Q4 soft-gate decision).
 */
data class SignUpResult(
    val user: AuthenticatedUser,
    val requiresEmailVerification: Boolean,
)

/**
 * Session state + login / logout orchestration.
 *
 * Exposes [state] as a StateFlow so any ViewModel can collect it. Tokens are
 * persisted via [TokenStorage]; see its docstring for the encryption caveat.
 */
@Singleton
class AuthRepository
    @Inject
    constructor(
        private val api: ApiService,
        private val authApi: AuthApi,
        // Refresh runs on a DEDICATED OkHttp client (its own dispatcher, no
        // AuthInterceptor / TokenAuthenticator). This is critical: the
        // authenticator calls refresh from inside an OkHttp dispatcher thread,
        // and using the main client there can deadlock — a burst of >=5
        // concurrent same-host 401s pins every per-host slot, so a refresh on
        // the same client could never get a slot. See TokenAuthenticator.
        @Named("authRefresh") private val refreshApi: AuthApi,
        private val tokenStorage: TokenStorage,
        private val observability: Observability,
        private val socketManager: SocketManager,
        /**
         * Session-scoped client-side mute / hide layer — dropped on sign-out
         * so one account's mutes never filter the next account's feed (RN
         * drops the provider state the same way).
         */
        private val feedModeration: FeedModerationStore,
    ) {
        /**
         * Outcome of a token refresh. The distinction matters: only
         * [AuthRejected] should ever sign the user out — a [Transient] failure
         * (offline/timeout/5xx) must keep the session so a flaky network can't
         * log the user out (parity with YouTube/Gmail).
         */
        sealed interface RefreshOutcome {
            data class Rotated(
                val accessToken: String,
            ) : RefreshOutcome

            data object AuthRejected : RefreshOutcome

            data object Transient : RefreshOutcome
        }

        /** Session state for the current user. */
        sealed interface State {
            /** Initial state before [restore] runs. */
            data object Unknown : State

            /** No session token; user must sign in. */
            data object SignedOut : State

            /** Session restored or freshly signed in. */
            data class SignedIn(
                val user: UserDto,
            ) : State
        }

        private val _state = MutableStateFlow<State>(State.Unknown)
        val state: StateFlow<State> = _state.asStateFlow()

        /**
         * When the user last signed in *interactively* (email/password or
         * OAuth) — never stamped by a silent token restore. The post-login
         * app-lock offer keys off this so it is made once per real sign-in and
         * never on a cold launch into an existing session. Mirrors RN
         * `AuthContext.lastInteractiveSignInAt` (`AuthContext.tsx:28`) and iOS
         * `AuthManager.lastInteractiveSignInAt`.
         */
        private val _lastInteractiveSignInAt = MutableStateFlow<Long?>(null)
        val lastInteractiveSignInAt: StateFlow<Long?> = _lastInteractiveSignInAt.asStateFlow()

        private val userAdapter = Moshi.Builder().build().adapter(UserDto::class.java)

        init {
            // Workstream 1.4 — DeepLinkRouter is a process singleton; bind
            // signed-in state so signed-out content links can be deferred.
            DeepLinkRouter.bindSignedInProvider { _state.value is State.SignedIn }
        }

        /** Called once at app start to hydrate session from persisted tokens. */
        suspend fun restore() {
            val token = tokenStorage.accessToken()
            if (token.isNullOrBlank()) {
                _state.value = State.SignedOut
                return
            }
            val cached = loadCachedUser()
            try {
                // A 401 here is recovered transparently by TokenAuthenticator's
                // silent refresh; we only land in catch if even refresh failed.
                val profile = api.me().user
                val user = profile.toSessionUser()
                persistCachedUser(user)
                finishSignedIn(user, tokenStorage.accessToken() ?: token)
            } catch (e: CancellationException) {
                throw e
            } catch (e: HttpException) {
                // Only a 401 means the token itself is rejected. A 403 is an
                // authorization decision on a VALID token (backend verifyToken
                // emits 401 for token problems, 403 for forbidden actions), so
                // 403 must NOT wipe the session. Mirrors iOS.
                if (e.code() == 401) {
                    // Token genuinely rejected and refresh couldn't renew it —
                    // clear and require a fresh sign-in.
                    tokenStorage.clear()
                    socketManager.disconnect()
                    _state.value = State.SignedOut
                } else if (cached != null) {
                    // 403/5xx on a valid token — keep the cached session.
                    finishSignedIn(cached, token)
                } else {
                    _state.value = State.SignedOut
                }
            } catch (t: Throwable) {
                // Transient/offline error (IOException, etc.) — never wipe a
                // session over a flaky connection; keep the cached identity.
                if (cached != null) {
                    finishSignedIn(cached, token)
                } else {
                    _state.value = State.SignedOut
                }
            }
        }

        /** Publish a confirmed signed-in session + its side effects. */
        private fun finishSignedIn(
            user: UserDto,
            token: String,
        ) {
            observability.identify(userId = user.id, email = user.email)
            Analytics.identify(userId = user.id)
            socketManager.connect(token)
            _state.value = State.SignedIn(user)
        }

        private suspend fun persistCachedUser(user: UserDto) {
            runCatching { tokenStorage.saveUserJson(userAdapter.toJson(user)) }
        }

        private suspend fun loadCachedUser(): UserDto? =
            tokenStorage.userJson()?.let { json ->
                runCatching { userAdapter.fromJson(json) }.getOrNull()
            }

        /** Sign the user in against `POST /api/users/login`. */
        suspend fun signIn(
            email: String,
            password: String,
        ): Result<UserDto> =
            runCatching {
                val response = api.login(LoginRequest(email = email, password = password))
                persistLoginResponse(response)
            }.onFailure { t ->
                if (t !is kotlin.coroutines.cancellation.CancellationException) observability.capture(t)
            }

        /**
         * Fetch the provider authorization URL from `GET /api/users/oauth/:provider`.
         * Route: `backend/routes/users.js:3715`.
         *
         * [nonce] is the per-attempt CSRF value from `OAuthSessionStore.begin`;
         * it rides on `redirectTo` and must come back on the callback.
         */
        suspend fun oauthAuthorizationUrl(
            provider: OAuthProvider,
            nonce: String,
        ): String =
            mappingAuthFailures {
                authApi.oauthUrl(provider.apiValue, OAuthSessionStore.redirectUri(nonce)).url
            }

        /**
         * Exchange the browser callback code through
         * `POST /api/users/oauth/callback` (route
         * `backend/routes/users.js:3862`) and apply the same encrypted token
         * persistence + signed-in transition as email login.
         */
        suspend fun exchangeOAuthCode(code: String): UserDto =
            mappingAuthFailures {
                persistLoginResponse(authApi.exchangeOAuthCode(OAuthCodeExchangeRequest(code)))
            }

        /**
         * Legacy fragment-token path via `POST /api/users/oauth/token`
         * (route `backend/routes/users.js:3792`).
         */
        suspend fun exchangeOAuthTokens(
            accessToken: String,
            refreshToken: String,
        ): UserDto =
            mappingAuthFailures {
                persistLoginResponse(
                    authApi.exchangeOAuthToken(
                        OAuthTokenExchangeRequest(
                            accessToken = accessToken,
                            refreshToken = refreshToken,
                        ),
                    ),
                )
            }

        /**
         * Runs [block], letting coroutine cancellation propagate untouched and
         * projecting every other failure through [AuthErrorMapper.generic] (an
         * [AuthError] thrown from inside passes through unchanged). Keeps the
         * three OAuth entry points to a single error contract.
         */
        private suspend fun <T> mappingAuthFailures(block: suspend () -> T): T {
            try {
                return block()
            } catch (e: CancellationException) {
                throw e
            } catch (t: Throwable) {
                throw AuthErrorMapper.generic(t)
            }
        }

        private suspend fun persistLoginResponse(response: LoginResponse): UserDto {
            val access = response.accessToken?.takeIf { it.isNotBlank() } ?: throw AuthError.Unknown
            val user = response.user.toSessionUser()
            tokenStorage.save(
                accessToken = access,
                refreshToken = response.refreshToken,
                userId = response.user.id,
            )
            persistCachedUser(user)
            // Every interactive entry point (email/password + both OAuth
            // exchanges) funnels through here; `restore()` deliberately
            // does not.
            _lastInteractiveSignInAt.value = System.currentTimeMillis()
            finishSignedIn(user, access)
            observability.track("auth.signed_in")
            return user
        }

        /**
         * `POST /api/users/register` (route `backend/routes/users.js:1177`).
         *
         * Does not sign the user in — caller routes to verify-email or to
         * login per the Q4 soft-gate decision. Throws [AuthError] on failure.
         */
        @Suppress("LongParameterList")
        suspend fun signUp(
            email: String,
            password: String,
            phoneNumber: String?,
            username: String,
            firstName: String,
            middleName: String?,
            lastName: String,
            dateOfBirth: String?,
            address: String?,
            city: String?,
            state: String?,
            zipcode: String?,
            accountType: AccountType,
            inviteCode: String?,
        ): SignUpResult {
            try {
                val response =
                    authApi.register(
                        RegisterRequest(
                            email = email,
                            password = password,
                            phoneNumber = phoneNumber,
                            username = username,
                            firstName = firstName,
                            middleName = middleName,
                            lastName = lastName,
                            dateOfBirth = dateOfBirth,
                            address = address,
                            city = city,
                            state = state,
                            zipcode = zipcode,
                            accountType = accountType.backendValue,
                            inviteCode = inviteCode,
                        ),
                    )
                observability.track("auth.signed_up")
                return SignUpResult(
                    user = response.user,
                    requiresEmailVerification = response.requiresEmailVerification ?: true,
                )
            } catch (t: Throwable) {
                throw AuthErrorMapper.register(t)
            }
        }

        /**
         * `POST /api/users/forgot-password` (route `backend/routes/users.js:3197`).
         * Backend always replies 200 with a generic message to prevent
         * email enumeration.
         */
        suspend fun forgotPassword(email: String) {
            try {
                authApi.forgotPassword(ForgotPasswordRequest(email = email))
                observability.track("auth.forgot_password_requested")
            } catch (t: Throwable) {
                throw AuthErrorMapper.generic(t)
            }
        }

        /**
         * `POST /api/users/reset-password` (route `backend/routes/users.js:3247`).
         * `token` is the hashed recovery token carried by the email link.
         */
        suspend fun resetPassword(
            token: String,
            newPassword: String,
        ) {
            try {
                authApi.resetPassword(ResetPasswordRequest(token = token, newPassword = newPassword))
                observability.track("auth.password_reset")
            } catch (t: Throwable) {
                throw AuthErrorMapper.resetPassword(t)
            }
        }

        /**
         * `POST /api/users/verify-email` (route `backend/routes/users.js:3115`).
         * Sends the hashed Supabase OTP. Backend revokes the just-issued
         * session — verifying does NOT sign the user in.
         */
        suspend fun verifyEmail(token: String) {
            try {
                authApi.verifyEmail(VerifyEmailRequest(tokenHash = token))
                observability.track("auth.email_verified")
            } catch (t: Throwable) {
                throw AuthErrorMapper.verifyEmail(t)
            }
        }

        /**
         * `POST /api/users/resend-verification` (route `backend/routes/users.js:3049`).
         * Like forgot-password, always 200 with a generic message.
         */
        suspend fun resendVerification(email: String) {
            try {
                authApi.resendVerification(ResendVerificationRequest(email = email))
                observability.track("auth.verification_resent")
            } catch (t: Throwable) {
                throw AuthErrorMapper.generic(t)
            }
        }

        /**
         * `POST /api/users/refresh` (route `backend/routes/users.js:1910`) via
         * the DEDICATED [refreshApi] client. On success rotates the stored
         * access (+ optional refresh) token in place and reconnects the socket.
         * The stored userId is never touched. Classifies the result so the
         * caller can tell a genuine auth rejection (sign out) from a transient
         * failure (keep the session). This is what [TokenAuthenticator] calls.
         */
        suspend fun refreshTokens(): RefreshOutcome {
            val stored = tokenStorage.refreshToken()
            if (stored.isNullOrBlank()) return RefreshOutcome.AuthRejected
            return try {
                val response = refreshApi.refresh(RefreshRequest(refreshToken = stored))
                val newAccess = response.accessToken
                if (newAccess.isNullOrBlank()) {
                    RefreshOutcome.AuthRejected
                } else {
                    tokenStorage.updateTokens(
                        accessToken = newAccess,
                        refreshToken = response.refreshToken,
                    )
                    socketManager.connect(newAccess)
                    RefreshOutcome.Rotated(newAccess)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: HttpException) {
                // Refresh token expired / replayed (TOKEN_REUSE) / malformed (401,
                // 400) is the only case that justifies a sign-out. Routine 7-day
                // expiry lands here; do NOT report it to Sentry as an error. Any
                // other status (403/429/5xx) is a server hiccup — keep the session.
                if (e.code() == 401 || e.code() == 400) RefreshOutcome.AuthRejected else RefreshOutcome.Transient
            } catch (ignored: IOException) {
                // Offline / timeout / DNS — transient, keep the session.
                RefreshOutcome.Transient
            } catch (t: Throwable) {
                // Genuinely unexpected (e.g. decode bug). Log it but keep the
                // session rather than punishing the user for our bug.
                observability.capture(t)
                RefreshOutcome.Transient
            }
        }

        /**
         * Thin wrapper returning just the rotated access token (or null on any
         * non-rotation). Used by tests and any caller that only needs the token.
         */
        suspend fun refreshAccessToken(): String? = (refreshTokens() as? RefreshOutcome.Rotated)?.accessToken

        /**
         * Imperative refresh for call sites that treat a failed refresh as a
         * hard sign-out. Delegates to [refreshTokens].
         */
        suspend fun refreshSession() {
            if (refreshTokens() !is RefreshOutcome.Rotated) {
                signOut()
                throw AuthError.InvalidCredentials
            }
        }

        /**
         * Re-fetch `GET /api/users/profile` and re-publish the session user
         * so a mutation made elsewhere (avatar upload, profile PATCH) shows
         * up app-wide immediately. Mirrors RN's `AuthContext.refreshUser()`
         * and iOS `AuthManager.refreshCurrentUser()`.
         *
         * Deliberately skips the [finishSignedIn] side effects — the socket
         * is already connected and analytics already identified. A failure
         * is swallowed: the caller surfaces its own error and a stale avatar
         * beats dropping the session.
         */
        suspend fun refreshSessionUser(): UserDto? {
            if (_state.value !is State.SignedIn) return null
            return try {
                val user = api.me().user.toSessionUser()
                persistCachedUser(user)
                _state.value = State.SignedIn(user)
                user
            } catch (e: CancellationException) {
                throw e
            } catch (_: Throwable) {
                null
            }
        }

        /** Clear local tokens and flip state to signed-out. */
        suspend fun signOut() {
            tokenStorage.clear()
            socketManager.disconnect()
            observability.identify(userId = null)
            Analytics.identify(userId = null)
            observability.track("auth.signed_out")
            // Workstream 1.4 — never resume a prior user's deferred destination.
            PendingDeepLinkStore.clear()
            DeepLinkRouter.clearPending()
            feedModeration.clear()
            _lastInteractiveSignInAt.value = null
            _state.value = State.SignedOut
        }
    }

/**
 * `Throwable` -> [AuthError] projection for every auth request. Lives beside
 * the repository (rather than inside it) so the class body stays focused on
 * the request flows. Mirrors the iOS `AuthManager.map*Error` helpers.
 */
private object AuthErrorMapper {
    private val errorBodyAdapter = Moshi.Builder().build().adapter(AuthErrorBody::class.java)

    fun register(t: Throwable): AuthError {
        return when (t) {
            is IOException -> AuthError.NetworkError
            is HttpException -> {
                val status = t.code()
                if (status == 429) return AuthError.RateLimited
                val raw = t.response()?.errorBody()?.string().orEmpty()
                val message = extractMessage(raw) ?: raw
                when {
                    message.contains("already registered", ignoreCase = true) ||
                        message.contains("Email already", ignoreCase = true) -> AuthError.EmailAlreadyExists
                    message.contains("password", ignoreCase = true) -> AuthError.WeakPassword
                    status >= 500 -> AuthError.ServerError(message.ifBlank { "Server error $status." })
                    else -> AuthError.ServerError(message.ifBlank { "Request failed ($status)." })
                }
            }
            else -> AuthError.Unknown
        }
    }

    fun resetPassword(t: Throwable): AuthError {
        return when (t) {
            is IOException -> AuthError.NetworkError
            is HttpException -> {
                val status = t.code()
                if (status == 429) return AuthError.RateLimited
                val raw = t.response()?.errorBody()?.string().orEmpty()
                val message = extractMessage(raw) ?: raw
                when {
                    message.contains("password", ignoreCase = true) &&
                        !message.contains("Invalid or expired", ignoreCase = true) -> AuthError.WeakPassword
                    status >= 500 -> AuthError.ServerError(message.ifBlank { "Server error $status." })
                    else -> AuthError.ServerError(message.ifBlank { "Request failed ($status)." })
                }
            }
            else -> AuthError.Unknown
        }
    }

    fun verifyEmail(t: Throwable): AuthError {
        return when (t) {
            is IOException -> AuthError.NetworkError
            is HttpException -> {
                val status = t.code()
                if (status == 429) return AuthError.RateLimited
                val raw = t.response()?.errorBody()?.string().orEmpty()
                val message = extractMessage(raw) ?: raw
                if (status >= 500) {
                    AuthError.ServerError(message.ifBlank { "Server error $status." })
                } else {
                    AuthError.ServerError(message.ifBlank { "Request failed ($status)." })
                }
            }
            else -> AuthError.Unknown
        }
    }

    fun generic(t: Throwable): AuthError {
        return when (t) {
            // Already typed by a lower layer (e.g. a login response with no
            // access token) — keep the specific error rather than flattening.
            is AuthError -> t
            is IOException -> AuthError.NetworkError
            is HttpException -> {
                val status = t.code()
                val raw = t.response()?.errorBody()?.string().orEmpty()
                val message = extractMessage(raw) ?: raw
                when {
                    status == 401 -> AuthError.InvalidCredentials
                    status == 429 -> AuthError.RateLimited
                    status >= 500 -> AuthError.ServerError(message.ifBlank { "Server error $status." })
                    else -> AuthError.ServerError(message.ifBlank { "Request failed ($status)." })
                }
            }
            else -> AuthError.Unknown
        }
    }

    private fun extractMessage(body: String): String? {
        if (body.isBlank()) return null
        return runCatching { errorBodyAdapter.fromJson(body)?.error }.getOrNull()
    }
}

/** Projection of [AuthenticatedUser] → the compact [UserDto] used in session state. */
private fun AuthenticatedUser.toSessionUser(): UserDto =
    UserDto(
        id = id,
        email = email,
        displayName = name.takeIf { it.isNotEmpty() },
        avatarUrl = null,
        isAdmin = role == "admin",
        username = username,
    )

/** Projection of [UserProfile] → the compact [UserDto] used in session state. */
private fun UserProfile.toSessionUser(): UserDto =
    UserDto(
        id = id,
        email = email,
        displayName = name.takeIf { it.isNotEmpty() },
        avatarUrl = avatarUrl ?: profilePictureUrl,
        isAdmin = role == "admin",
        username = username,
    )
