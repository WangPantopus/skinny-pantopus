@file:Suppress("MagicNumber", "TooManyFunctions", "LongParameterList", "LargeClass")

package app.pantopus.android.data.auth

import androidx.fragment.app.FragmentActivity
import app.pantopus.android.BuildConfig
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.auth.AuthErrorBody
import app.pantopus.android.data.api.models.auth.AuthErrorBodyParser
import app.pantopus.android.data.api.models.auth.AuthErrorCodes
import app.pantopus.android.data.api.models.auth.AuthenticatedUser
import app.pantopus.android.data.api.models.auth.ChallengeRequest
import app.pantopus.android.data.api.models.auth.DeviceDescriptorDto
import app.pantopus.android.data.api.models.auth.ForgotPasswordRequest
import app.pantopus.android.data.api.models.auth.LoginRequest
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.LogoutRequest
import app.pantopus.android.data.api.models.auth.OAuthCodeExchangeRequest
import app.pantopus.android.data.api.models.auth.OAuthNativeRequest
import app.pantopus.android.data.api.models.auth.OAuthTokenExchangeRequest
import app.pantopus.android.data.api.models.auth.RefreshRequest
import app.pantopus.android.data.api.models.auth.RegisterDeviceRequest
import app.pantopus.android.data.api.models.auth.RegisterRequest
import app.pantopus.android.data.api.models.auth.ResendVerificationRequest
import app.pantopus.android.data.api.models.auth.ResetPasswordRequest
import app.pantopus.android.data.api.models.auth.ResumeRequest
import app.pantopus.android.data.api.models.auth.StepUpKeyEnrolRequest
import app.pantopus.android.data.api.models.auth.StepUpRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailRequest
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.services.AuthApi
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.observability.Observability
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.push.FcmTokenProvider
import com.squareup.moshi.Moshi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import retrofit2.HttpException
import timber.log.Timber
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
 * Why a session ended without the user asking for it (CONTRACT §"Error
 * envelope"). [isSecurity] selects the *"You were signed out for security.
 * Sign in again."* banner over the plain expiry copy; the display hint is
 * kept in both cases so the login screen can prefill. Mirrors iOS
 * `SessionEndReason`.
 */
data class SessionEndReason(
    /** Backend `code`, or `null` when the 401 carried none. */
    val code: String?,
    val isSecurity: Boolean,
) {
    val message: String
        get() =
            if (isSecurity) {
                // Pinned by CONTRACT §"Error envelope" — do not reword.
                "You were signed out for security. Sign in again."
            } else {
                // Parity with iOS `SessionEndReason.message`.
                "Your session has expired. Please sign in again."
            }

    companion object {
        fun expired(code: String? = null): SessionEndReason = SessionEndReason(code, isSecurity = false)

        fun fromCode(code: String?): SessionEndReason =
            SessionEndReason(code, isSecurity = code != null && code in AuthErrorCodes.SECURITY_SIGN_OUT)
    }
}

/**
 * Session state + login / logout orchestration.
 *
 * Exposes [state] as a StateFlow so any ViewModel can collect it. Tokens are
 * persisted via [TokenStorage]; see its docstring for the encryption caveat.
 *
 * Persistent login (design docs/persistent-login §3, §7, §9): cold start
 * walks **L1 → L2 → L3** — a live token set on the same install is restored
 * silently (with a proactive DPoP refresh when it is about to expire); a
 * reinstall with a Block Store resume grant surfaces [State.Resumable] so
 * the UI shows *"Continue as Ying"* behind BiometricPrompt and calls
 * [resume]; anything else lands on the login screen prefilled from
 * [rememberedAccounts]. Every credential-issuing call carries the device
 * descriptor + a DPoP proof from the Keystore device key so the server binds
 * the session at issuance; `/refresh` proves possession of that same key.
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
        // The same client carries the unauthenticated /resume, /challenge and
        // the proof-carrying /logout, which must never be silently replayed.
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
        private val deviceIdentity: DeviceIdentity,
        private val deviceKeyStore: DeviceKeyStore,
        private val stepUpKeyStore: StepUpKeyStore,
        private val dpop: DPoPProofBuilder,
        private val deviceDescriptors: DeviceDescriptorProvider,
        private val accountHints: AccountHintStore,
        private val presenceVerifier: PresenceVerifier,
        private val fcmTokenProvider: FcmTokenProvider,
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

            /** Refresh refused; [reason] carries the backend `code` (if any). */
            data class AuthRejected(
                val reason: SessionEndReason = SessionEndReason.expired(),
            ) : RefreshOutcome

            data object Transient : RefreshOutcome
        }

        /** Session state for the current user. */
        sealed interface State {
            /** Initial state before [restore] runs. */
            data object Unknown : State

            /** No session token; user must sign in. */
            data object SignedOut : State

            /**
             * L2: no tokens, but Block Store holds a resume grant for [hint]
             * and the device has an OS lock. UI shows "Continue as …" and
             * calls [resume].
             */
            data class Resumable(
                val hint: AccountHint,
            ) : State

            /** Session restored or freshly signed in. */
            data class SignedIn(
                val user: UserDto,
            ) : State
        }

        /** Result of [resume]. */
        sealed interface ResumeOutcome {
            data class Restored(
                val user: UserDto,
            ) : ResumeOutcome

            /** The user dismissed the presence prompt — still [State.Resumable]. */
            data object Cancelled : ResumeOutcome

            /** No OS lock / no grant — state moved to [State.SignedOut] (L3, prefilled). */
            data object Unavailable : ResumeOutcome

            /** Server refused the grant (401 `RESUME_GRANT_INVALID` etc.) — grant cleared, L3. */
            data object GrantRejected : ResumeOutcome

            /** Network / server hiccup — still [State.Resumable]; show [message] and let the user retry. */
            data class Transient(
                val message: String,
            ) : ResumeOutcome
        }

        /** Result of a step-up attempt. */
        sealed interface StepUpResult {
            data class Token(
                val stepUpToken: String,
            ) : StepUpResult

            data object Cancelled : StepUpResult

            /** Method not usable (no key enrolled / restored session / biometrics changed). */
            data object Unavailable : StepUpResult

            data class Failed(
                val error: AuthError,
            ) : StepUpResult
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

        /**
         * Set when the session ended without the user asking (refresh
         * refused, `SESSION_REVOKED`, …). The login / continue-as screen shows
         * [SessionEndReason.message] once and calls [consumeSessionEndReason].
         */
        private val _sessionEndReason = MutableStateFlow<SessionEndReason?>(null)
        val sessionEndReason: StateFlow<SessionEndReason?> = _sessionEndReason.asStateFlow()

        /**
         * Non-secret remembered accounts, most recent first (max 3). L3
         * prefill: `rememberedAccounts.value.firstOrNull()`.
         */
        private val _rememberedAccounts = MutableStateFlow<List<AccountHint>>(emptyList())
        val rememberedAccounts: StateFlow<List<AccountHint>> = _rememberedAccounts.asStateFlow()

        private val userAdapter = Moshi.Builder().build().adapter(UserDto::class.java)

        /** Single-flight guard for the network refresh (see [refreshTokens]). */
        private val refreshMutex = Mutex()

        init {
            // Workstream 1.4 — DeepLinkRouter is a process singleton; bind
            // signed-in state so signed-out content links can be deferred.
            DeepLinkRouter.bindSignedInProvider { _state.value is State.SignedIn }
        }

        // ── Cold start: L1 → L2 → L3 ──────────────────────────────────────

        /** Called once at app start to hydrate session from persisted tokens. */
        suspend fun restore() {
            val token = tokenStorage.accessToken()
            if (token.isNullOrBlank()) {
                restoreFromHints()
                return
            }
            val cached = loadCachedUser()
            // L1 proactive refresh: no 401 tax on cold start when the access
            // token is about to expire (CONTRACT §"Client behaviour").
            when (val proactive = refreshIfExpiringSoon()) {
                is RefreshOutcome.AuthRejected -> {
                    signOut(reason = proactive.reason)
                    return
                }
                else -> Unit
            }
            try {
                // A 401 here is recovered transparently by TokenAuthenticator's
                // silent refresh; we only land in catch if even refresh failed.
                val profile = api.me().user
                val user = profile.toSessionUser()
                persistCachedUser(user)
                finishSignedIn(user, tokenStorage.accessToken() ?: token)
                rememberAccount(user, method = null)
                observability.track("auth.session_restore_ok")
                // App update / FCM rotation re-registration (CONTRACT §"Client
                // behaviour") — a no-op when the fingerprint is unchanged.
                registerDevice()
            } catch (e: CancellationException) {
                throw e
            } catch (e: HttpException) {
                // Only a 401 means the token itself is rejected. A 403 is an
                // authorization decision on a VALID token (backend verifyToken
                // emits 401 for token problems, 403 for forbidden actions), so
                // 403 must NOT wipe the session. Mirrors iOS.
                if (e.code() == 401) {
                    // Token genuinely rejected and refresh couldn't renew it —
                    // clear and require a fresh sign-in. TokenAuthenticator may
                    // already have signed us out with the backend code; keep it.
                    val reason = _sessionEndReason.value ?: SessionEndReason.fromCode(AuthErrorBodyParser.code(e.errorBodyString()))
                    signOut(reason = reason)
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

        /**
         * L2 / L3 decision when no tokens exist: a Block Store payload with a
         * grant AND an OS lock → [State.Resumable]; a hint without grant (or
         * no lock) → [State.SignedOut] with [rememberedAccounts] prefilled;
         * nothing → plain [State.SignedOut].
         */
        private suspend fun restoreFromHints() {
            val payload = runCatching { accountHints.read() }.getOrNull()
            _rememberedAccounts.value = payload?.accounts.orEmpty()
            val grantAccount = payload?.grantAccount
            _state.value =
                if (grantAccount != null && presenceVerifier.canVerify()) {
                    State.Resumable(grantAccount)
                } else {
                    State.SignedOut
                }
        }

        /**
         * L2 "Continue as …": presence gate → server challenge → device key →
         * `POST /api/auth/resume { grant, device }` + DPoP → persist the
         * (`restored`) session → rewrite the Block Store entry with the next
         * grant. Only valid from [State.Resumable].
         */
        @Suppress("ReturnCount")
        suspend fun resume(activity: FragmentActivity): ResumeOutcome {
            val resumable = _state.value as? State.Resumable ?: return ResumeOutcome.Unavailable
            val hint = resumable.hint
            val payload = runCatching { accountHints.read() }.getOrNull()
            val grant = payload?.resumeGrant?.takeIf { payload.grantUserId == hint.userId }
            if (grant.isNullOrBlank()) {
                _state.value = State.SignedOut
                return ResumeOutcome.Unavailable
            }
            when (val presence = presenceVerifier.verifyPresence(activity, title = "Continue as ${hint.displayName ?: "you"}")) {
                PresenceVerifier.Outcome.Verified -> Unit
                PresenceVerifier.Outcome.Cancelled -> {
                    observability.track("auth.session_resume_cancel")
                    return ResumeOutcome.Cancelled
                }
                PresenceVerifier.Outcome.Unavailable -> {
                    _state.value = State.SignedOut
                    return ResumeOutcome.Unavailable
                }
                is PresenceVerifier.Outcome.Failed -> return ResumeOutcome.Transient(presence.message)
            }
            return try {
                val challenge =
                    runCatching { refreshApi.challenge(ChallengeRequest(purpose = CHALLENGE_RESUME)) }
                        .getOrNull()
                        ?.challenge
                        ?.let { raw -> runCatching { EcKeyCodec.base64UrlDecode(raw) }.getOrNull() }
                val key = deviceKeyStore.getOrCreate(challenge)
                val device = deviceDescriptors.descriptor(key.keyBacking)
                val proof = dpop.build(key, htm = "POST", htu = htu(PATH_RESUME))
                val response = refreshApi.resume(ResumeRequest(grant = grant, device = device), proof)
                val user = persistLoginResponse(response, method = AccountHint.METHOD_RESUME, interactive = false)
                observability.track("auth.session_resume_ok")
                ResumeOutcome.Restored(user)
            } catch (e: CancellationException) {
                throw e
            } catch (e: HttpException) {
                val status = e.code()
                if (status in 400..499 && status != 429) {
                    // RESUME_GRANT_INVALID / DPOP_* / forbidden: the grant is dead.
                    runCatching { accountHints.clearGrant() }
                    _sessionEndReason.value = SessionEndReason.fromCode(AuthErrorBodyParser.code(e.errorBodyString()))
                    _state.value = State.SignedOut
                    observability.track("auth.session_resume_invalid", mapOf("status" to status.toString()))
                    ResumeOutcome.GrantRejected
                } else {
                    ResumeOutcome.Transient(AuthError.ServerError("Server error $status.").message)
                }
            } catch (_: IOException) {
                ResumeOutcome.Transient(AuthError.NetworkError.message)
            } catch (t: Throwable) {
                observability.capture(t)
                ResumeOutcome.Transient(AuthError.Unknown.message)
            }
        }

        /** "Use a different account" from the continue-as card: keep the hint + grant, show login. */
        fun useDifferentAccount() {
            if (_state.value is State.Resumable) _state.value = State.SignedOut
        }

        /**
         * "Not you? Remove": forget [userId] (default: the primary remembered
         * account) — drops its grant, and deletes the Block Store entry when
         * no account remains. Never touches tokens of a live session.
         */
        suspend fun removeRememberedAccount(userId: String? = null) {
            val target = userId ?: _rememberedAccounts.value.firstOrNull()?.userId ?: (_state.value as? State.Resumable)?.hint?.userId
            if (target != null) runCatching { accountHints.removeAccount(target) }
            _rememberedAccounts.value = runCatching { accountHints.read() }.getOrNull()?.accounts.orEmpty()
            if ((_state.value as? State.Resumable)?.hint?.userId == target) _state.value = State.SignedOut
        }

        /** Acknowledge [sessionEndReason] after showing it once. */
        fun consumeSessionEndReason() {
            _sessionEndReason.value = null
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

        // ── Interactive sign-in ───────────────────────────────────────────

        /** Sign the user in against `POST /api/users/login` (+ `device` + `DPoP`). */
        suspend fun signIn(
            email: String,
            password: String,
        ): Result<UserDto> =
            runCatching {
                val (device, proof) = issuanceProof(PATH_LOGIN)
                val response = authApi.login(LoginRequest(email = email, password = password, device = device), proof)
                persistLoginResponse(response, method = AccountHint.METHOD_PASSWORD)
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
        suspend fun exchangeOAuthCode(
            code: String,
            provider: OAuthProvider? = null,
        ): UserDto =
            mappingAuthFailures {
                val (device, proof) = issuanceProof(PATH_OAUTH_CALLBACK)
                persistLoginResponse(
                    authApi.exchangeOAuthCode(OAuthCodeExchangeRequest(code, device), proof),
                    method = provider.hintMethod(),
                )
            }

        /**
         * Legacy fragment-token path via `POST /api/users/oauth/token`
         * (route `backend/routes/users.js:3792`).
         */
        suspend fun exchangeOAuthTokens(
            accessToken: String,
            refreshToken: String,
            provider: OAuthProvider? = null,
        ): UserDto =
            mappingAuthFailures {
                val (device, proof) = issuanceProof(PATH_OAUTH_TOKEN)
                persistLoginResponse(
                    authApi.exchangeOAuthToken(
                        OAuthTokenExchangeRequest(
                            accessToken = accessToken,
                            refreshToken = refreshToken,
                            device = device,
                        ),
                        proof,
                    ),
                    method = provider.hintMethod(),
                )
            }

        /**
         * Native id-token sign-in (`POST /api/users/oauth/native`) — Sign in
         * with Google via Credential Manager / Sign in with Apple. The client
         * launcher lands in a later phase; the exchange is wired now.
         */
        suspend fun signInWithNativeIdToken(
            provider: OAuthProvider,
            idToken: String,
            nonce: String? = null,
            accessToken: String? = null,
        ): UserDto =
            mappingAuthFailures {
                val (device, proof) = issuanceProof(PATH_OAUTH_NATIVE)
                persistLoginResponse(
                    authApi.oauthNative(
                        OAuthNativeRequest(
                            provider = provider.apiValue,
                            idToken = idToken,
                            nonce = nonce,
                            accessToken = accessToken,
                            device = device,
                        ),
                        proof,
                    ),
                    method = provider.hintMethod(),
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

        /**
         * `device` descriptor + DPoP proof for a credential-issuing call —
         * the ONLY place a binding may be created (design §2.3). Never blocks
         * sign-in: a Keystore failure yields `(null, null)` and the server
         * issues a legacy (unbound) session.
         */
        private fun issuanceProof(path: String): Pair<DeviceDescriptorDto?, String?> =
            runCatching {
                val key = deviceKeyStore.getOrCreate()
                deviceDescriptors.descriptor(key.keyBacking) to dpop.build(key, htm = "POST", htu = htu(path))
            }.onFailure { Timber.w(it, "device key unavailable — signing in unbound") }
                .getOrElse { null to null }

        private suspend fun persistLoginResponse(
            response: LoginResponse,
            method: String?,
            interactive: Boolean = true,
        ): UserDto {
            val access = response.accessToken?.takeIf { it.isNotBlank() } ?: throw AuthError.Unknown
            val user = response.user.toSessionUser()
            val context = response.session?.context ?: if (interactive) SESSION_CONTEXT_INTERACTIVE else SESSION_CONTEXT_RESTORED
            tokenStorage.save(
                accessToken = access,
                refreshToken = response.refreshToken,
                userId = response.user.id,
                expiresAt = response.expiresAt,
                sessionId = response.sessionId ?: response.session?.id,
                sessionContext = context,
            )
            persistCachedUser(user)
            // Every interactive entry point (email/password + both OAuth
            // exchanges) funnels through here; `restore()` and `resume()`
            // deliberately do not stamp the interactive marker.
            if (interactive) _lastInteractiveSignInAt.value = System.currentTimeMillis()
            _sessionEndReason.value = null
            finishSignedIn(user, access)
            observability.track("auth.signed_in", mapOf("context" to context))
            // Non-secret hint first so the grant below attaches to a known account.
            rememberAccount(user, method)
            response.resumeGrant?.let { grant -> runCatching { accountHints.setGrant(grant, user.id) } }
            // Registry: link push token + (Android) obtain the resume grant.
            registerDevice(force = true)
            if (interactive) enrolStepUpKeyIfPossible(user.id)
            return user
        }

        /** Merge the display hint for [user] into the remembered-accounts list (best-effort). */
        private suspend fun rememberAccount(
            user: UserDto,
            method: String?,
        ) {
            runCatching {
                val existing = accountHints.read()?.accounts?.firstOrNull { it.userId == user.id }
                val hint =
                    AccountHint(
                        userId = user.id,
                        displayName = user.displayName ?: existing?.displayName,
                        avatarUrl = user.avatarUrl ?: existing?.avatarUrl,
                        maskedEmail = AccountHint.maskEmail(user.email) ?: existing?.maskedEmail,
                        lastMethod = method ?: existing?.lastMethod,
                        lastSeenAt = System.currentTimeMillis(),
                    )
                accountHints.upsertAccount(hint)
                _rememberedAccounts.value = accountHints.read()?.accounts ?: listOf(hint)
            }.onFailure { Timber.w(it, "account hint write failed") }
        }

        // ── Device registry ───────────────────────────────────────────────

        /**
         * `POST /api/auth/devices/register` — metadata + FCM token linkage
         * (+ the Android resume grant). Idempotent server-side; the client
         * skips it when `(user, appVersion, pushToken)` already registered
         * unless [force]. Called after login / resume, and by the push layer
         * on FCM rotation / app update. Best-effort: never throws.
         */
        suspend fun registerDevice(force: Boolean = false): Boolean {
            if (tokenStorage.accessToken().isNullOrBlank()) return false
            val key = deviceKeyStore.existing() ?: return false
            val userId = tokenStorage.userId()
            val pushToken = withTimeoutOrNull(FCM_TOKEN_TIMEOUT_MS) { fcmTokenProvider.currentToken() }?.takeIf { it.isNotBlank() }
            val fingerprint = "${userId.orEmpty()}|${deviceDescriptors.appVersion()}|${pushToken.orEmpty()}"
            if (!force && deviceIdentity.lastRegistrationFingerprint() == fingerprint) return true
            return try {
                val response =
                    authApi.registerDevice(
                        RegisterDeviceRequest(
                            device = deviceDescriptors.descriptor(key.keyBacking),
                            pushToken = pushToken,
                            pushProvider = pushToken?.let { PUSH_PROVIDER_FCM },
                        ),
                        dpop.build(key, htm = "POST", htu = htu(PATH_DEVICES_REGISTER)),
                    )
                deviceIdentity.markRegistered(fingerprint)
                val grant = response.resumeGrant
                if (grant != null && userId != null) runCatching { accountHints.setGrant(grant, userId) }
                true
            } catch (e: CancellationException) {
                throw e
            } catch (t: Throwable) {
                Timber.w(t, "device registration failed")
                false
            }
        }

        /**
         * Enrol the biometry-bound step-up key (`POST /api/auth/step-up-key`)
         * after an *interactive* login when class-3 biometrics are available.
         * Best-effort — a failure only means step-up falls back to password.
         */
        private suspend fun enrolStepUpKeyIfPossible(userId: String) {
            runCatching { enrolStepUpKey() }
                .onFailure {
                    if (it is CancellationException) throw it
                    Timber.w(it, "step-up key enrolment failed for %s", userId)
                }
        }

        /**
         * Enrol (or re-enrol) the biometry-bound step-up key for the current
         * user: `POST /api/auth/step-up-key { publicKeyJwk, keyBacking }` +
         * DPoP from the device key. The server only accepts it from an
         * *interactive* session (CONTRACT); restored sessions get a 403 and
         * we simply stay un-enrolled. Returns `true` when the server stored
         * the key. Safe to call from a settings toggle later.
         */
        suspend fun enrolStepUpKey(): Boolean {
            val userId = tokenStorage.userId()
            val eligible =
                userId != null &&
                    tokenStorage.sessionContext() == SESSION_CONTEXT_INTERACTIVE &&
                    stepUpKeyStore.isBiometricStrongAvailable()
            if (!eligible) return false
            val deviceKey = deviceKeyStore.existing() ?: return false
            val public = stepUpKeyStore.publicKey() ?: stepUpKeyStore.enrol() ?: return false
            authApi.enrolStepUpKey(
                StepUpKeyEnrolRequest(publicKeyJwk = public.jwk, keyBacking = public.keyBacking),
                dpop.build(deviceKey, htm = "POST", htu = htu(PATH_STEP_UP_KEY)),
            )
            deviceIdentity.markStepUpEnrolled(requireNotNull(userId))
            return true
        }

        // ── Step-up (destructive actions) ─────────────────────────────────

        /**
         * `device_key` step-up is only accepted for a key enrolled by an
         * interactive session AND while the current session is interactive
         * (design §2.6, §7.10). Restored sessions must present a password.
         */
        suspend fun canStepUpWithDeviceKey(): Boolean =
            stepUpKeyStore.isEnrolled() &&
                deviceIdentity.stepUpEnrolledFor() == tokenStorage.userId() &&
                tokenStorage.sessionContext() == SESSION_CONTEXT_INTERACTIVE

        /** `POST /api/auth/step-up { method: "password" }` → step-up token. */
        suspend fun stepUpWithPassword(
            purpose: String,
            password: String,
        ): StepUpResult =
            try {
                val request = StepUpRequest(purpose = purpose, method = STEP_UP_METHOD_PASSWORD, password = password)
                StepUpResult.Token(authApi.stepUp(request).stepUpToken)
            } catch (e: CancellationException) {
                throw e
            } catch (t: Throwable) {
                StepUpResult.Failed(AuthErrorMapper.generic(t))
            }

        /**
         * `POST /api/auth/challenge { step_up }` → sign the raw challenge with
         * the biometry-bound key behind the caller's BiometricPrompt →
         * `POST /api/auth/step-up { method: "device_key", challengeId, signature }`.
         */
        suspend fun stepUpWithDeviceKey(
            purpose: String,
            launcher: StepUpKeyStore.PromptLauncher,
        ): StepUpResult {
            if (!canStepUpWithDeviceKey()) return StepUpResult.Unavailable
            return try {
                val challenge = authApi.challenge(ChallengeRequest(purpose = CHALLENGE_STEP_UP))
                val bytes = EcKeyCodec.base64UrlDecode(challenge.challenge)
                when (val signed = stepUpKeyStore.sign(bytes, launcher)) {
                    is StepUpKeyStore.SignResult.Signed -> {
                        val response =
                            authApi.stepUp(
                                StepUpRequest(
                                    purpose = purpose,
                                    method = STEP_UP_METHOD_DEVICE_KEY,
                                    challengeId = challenge.challengeId,
                                    signature = EcKeyCodec.base64Url(signed.rawSignature),
                                ),
                            )
                        StepUpResult.Token(response.stepUpToken)
                    }
                    is StepUpKeyStore.SignResult.Failed ->
                        when (signed.failure) {
                            StepUpKeyStore.SignFailure.Cancelled -> StepUpResult.Cancelled
                            StepUpKeyStore.SignFailure.NotEnrolled,
                            StepUpKeyStore.SignFailure.Invalidated,
                            -> {
                                deviceIdentity.markStepUpEnrolled(null)
                                StepUpResult.Unavailable
                            }
                            is StepUpKeyStore.SignFailure.Error -> StepUpResult.Failed(AuthError.Unknown)
                        }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: HttpException) {
                // 403 `STEP_UP_REQUIRED` = the server will not take `device_key`
                // for this purpose / session (password-first purpose such as
                // `delete_account`, restored session, key not enrolled
                // server-side) — the UI falls back to the password method.
                if (e.code() == 403) StepUpResult.Unavailable else StepUpResult.Failed(AuthErrorMapper.generic(e))
            } catch (t: Throwable) {
                StepUpResult.Failed(AuthErrorMapper.generic(t))
            }
        }

        // ── Other devices / sessions (step-up gated) ──────────────────────

        /**
         * `POST /api/auth/sessions/revoke-others` — "Sign out of all other
         * devices". [stepUpToken] comes from [stepUpWithPassword] /
         * [stepUpWithDeviceKey] with purpose `revoke_sessions`. Returns the
         * number of sessions revoked. Throws [AuthError] on failure.
         */
        suspend fun revokeOtherSessions(stepUpToken: String): Int =
            mappingAuthFailures {
                val revoked = authApi.revokeOtherSessions(stepUpToken).revoked ?: 0
                observability.track("auth.sessions_revoke_others", mapOf("revoked" to revoked.toString()))
                revoked
            }

        /**
         * `POST /api/auth/sessions/revoke-all` ("Lockdown") — every session,
         * device and resume grant of the account, this one included. On
         * success the client signs itself out locally (the server already
         * revoked this session, so no `/logout` proof is sent) and keeps
         * the display hint. Throws [AuthError] on failure.
         */
        suspend fun revokeAllSessions(stepUpToken: String) {
            mappingAuthFailures { authApi.revokeAllSessions(stepUpToken) }
            observability.track("auth.sessions_revoke_all")
            signOut(reason = SessionEndReason.expired(code = REASON_LOCKDOWN))
            _sessionEndReason.value = null
        }

        /**
         * `DELETE /api/auth/devices/:id` — remove one trusted device
         * (purpose `revoke_device`). Revoking the *current* device makes the
         * server answer the next request with 401 `SESSION_REVOKED`, which
         * the normal 401 path turns into a security sign-out.
         */
        suspend fun revokeDevice(
            deviceRowId: String,
            stepUpToken: String,
        ) {
            mappingAuthFailures { authApi.revokeDevice(deviceRowId, stepUpToken) }
            observability.track("auth.device_revoked")
        }

        /**
         * Silent `session_revoked` push (design §7.7): the push is NEVER the
         * authority — probe `/refresh` (with DPoP) and sign out only when the
         * server confirms with a 401 (`SESSION_REVOKED`, `DEVICE_REVOKED`, …).
         * A transient failure or a successful rotation changes nothing.
         */
        suspend fun confirmSessionRevoked() {
            if (_state.value !is State.SignedIn) return
            when (val outcome = refreshTokens()) {
                is RefreshOutcome.AuthRejected -> signOut(reason = outcome.reason)
                else -> Unit
            }
        }

        // ── Registration / password / verification (unchanged contracts) ──

        /**
         * `POST /api/users/register` (route `backend/routes/users.js:1177`).
         *
         * Does not sign the user in — caller routes to verify-email or to
         * login per the Q4 soft-gate decision. Throws [AuthError] on failure.
         */
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

        // ── Refresh ───────────────────────────────────────────────────────

        /**
         * `POST /api/users/refresh` (route `backend/routes/users.js:1910`) via
         * the DEDICATED [refreshApi] client, with `{ refreshToken, deviceId,
         * sessionId }` and a `DPoP` proof carrying `rth` (CONTRACT). On
         * success rotates the stored access (+ optional refresh) token,
         * `expiresAt` and `sessionId` in place and reconnects the socket. The
         * stored userId is never touched. Classifies the result so the caller
         * can tell a genuine auth rejection (sign out) from a transient
         * failure (keep the session). This is what [TokenAuthenticator] and
         * the pre-flight [refreshIfExpiringSoon] call.
         *
         * Single-flight: callers that raced on the mutex and find the refresh
         * token already rotated return [RefreshOutcome.Rotated] with the new
         * access token instead of spending a second rotation.
         */
        suspend fun refreshTokens(): RefreshOutcome {
            val seen = tokenStorage.refreshToken()
            if (seen.isNullOrBlank()) return RefreshOutcome.AuthRejected()
            return refreshMutex.withLock {
                val stored = tokenStorage.refreshToken()
                if (stored.isNullOrBlank()) return@withLock RefreshOutcome.AuthRejected()
                if (stored != seen) {
                    val access = tokenStorage.accessToken()
                    if (!access.isNullOrBlank()) return@withLock RefreshOutcome.Rotated(access)
                }
                performRefresh(stored)
            }
        }

        private suspend fun performRefresh(stored: String): RefreshOutcome {
            return try {
                val proof =
                    runCatching {
                        dpop.build(deviceKeyStore.getOrCreate(), htm = "POST", htu = htu(PATH_REFRESH), refreshToken = stored)
                    }.onFailure { Timber.w(it, "refresh without DPoP: device key unavailable") }.getOrNull()
                val response =
                    refreshApi.refresh(
                        RefreshRequest(
                            refreshToken = stored,
                            deviceId = deviceIdentity.deviceId(),
                            sessionId = tokenStorage.sessionId(),
                        ),
                        proof,
                    )
                val newAccess = response.accessToken
                if (newAccess.isNullOrBlank()) {
                    RefreshOutcome.AuthRejected()
                } else {
                    tokenStorage.updateTokens(
                        accessToken = newAccess,
                        refreshToken = response.refreshToken,
                        expiresAt = response.expiresAt,
                        sessionId = response.sessionId ?: response.session?.id,
                    )
                    socketManager.connect(newAccess)
                    RefreshOutcome.Rotated(newAccess)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: HttpException) {
                // Refresh token expired / replayed (TOKEN_REUSE) / device or
                // session revoked / malformed (401, 400) is the only case that
                // justifies a sign-out; the body `code` says why. Routine expiry
                // lands here too — do NOT report it to Sentry as an error. Any
                // other status (403/429/5xx) is a server hiccup — keep the session.
                if (e.code() == 401 || e.code() == 400) {
                    val code = AuthErrorBodyParser.code(e.errorBodyString())
                    observability.track("auth.session_invalidated", mapOf("code" to code.orEmpty()))
                    RefreshOutcome.AuthRejected(SessionEndReason.fromCode(code))
                } else {
                    RefreshOutcome.Transient
                }
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
         * Proactive refresh when `expiresAt - now < 120 s` (CONTRACT §"Client
         * behaviour"). Returns `null` when no refresh was needed / possible,
         * else the [RefreshOutcome]. Callers decide what an [RefreshOutcome.AuthRejected]
         * means ([restore] signs out; the OkHttp pre-flight lets the request
         * proceed and the 401 path handle it).
         */
        suspend fun refreshIfExpiringSoon(nowMillis: Long = System.currentTimeMillis()): RefreshOutcome? {
            if (tokenStorage.accessToken().isNullOrBlank()) return null
            // `expiresAt` unknown (legacy session persisted before the field
            // existed, or a bogus 0) => no proactive refresh; the 401 path rules.
            val expiresAt = tokenStorage.expiresAt()?.takeIf { it > 0 } ?: return null
            if (expiresAt - nowMillis / MILLIS_PER_SECOND >= PROACTIVE_REFRESH_WINDOW_SECONDS) return null
            return refreshTokens()
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
            when (val outcome = refreshTokens()) {
                is RefreshOutcome.Rotated -> Unit
                is RefreshOutcome.AuthRejected -> {
                    signOut(reason = outcome.reason)
                    throw AuthError.InvalidCredentials
                }
                RefreshOutcome.Transient -> {
                    signOut(reason = SessionEndReason.expired())
                    throw AuthError.InvalidCredentials
                }
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

        // ── Sign-out ──────────────────────────────────────────────────────

        /**
         * End the session on this device.
         *
         * - Explicit sign-out (`reason == null`): best-effort
         *   `POST /api/users/logout { scope: "local", deviceId, refreshToken }`
         *   with Bearer + DPoP(`rth`) proof so the server revokes the session
         *   row, unlinks push tokens and revokes this device's resume grants.
         * - Server-initiated (`reason != null`, e.g. `TOKEN_REUSE`): no
         *   network call — the session is already dead; [sessionEndReason]
         *   is published for the UI banner.
         *
         * Either way tokens / expiresAt / sessionId are wiped, the Block Store
         * grant is cleared, and the non-secret account hints are KEPT so the
         * login screen can prefill (design §2.9).
         */
        suspend fun signOut(reason: SessionEndReason? = null) {
            val access = tokenStorage.accessToken()
            val refresh = tokenStorage.refreshToken()
            if (reason == null && !(access.isNullOrBlank() && refresh.isNullOrBlank())) {
                revokeOnServer(access, refresh)
            }
            tokenStorage.clear()
            socketManager.disconnect()
            observability.identify(userId = null)
            Analytics.identify(userId = null)
            observability.track("auth.signed_out", mapOf("reason" to (reason?.code ?: "user")))
            // Workstream 1.4 — never resume a prior user's deferred destination.
            PendingDeepLinkStore.clear()
            DeepLinkRouter.clearPending()
            feedModeration.clear()
            runCatching { accountHints.clearGrant() }
            _rememberedAccounts.value = runCatching { accountHints.read() }.getOrNull()?.accounts.orEmpty()
            _lastInteractiveSignInAt.value = null
            if (reason != null) _sessionEndReason.value = reason
            _state.value = State.SignedOut
        }

        /** Best-effort, bounded `POST /logout` with proof (never throws). */
        private suspend fun revokeOnServer(
            access: String?,
            refresh: String?,
        ) {
            val proof =
                deviceKeyStore.existing()?.let { key ->
                    runCatching { dpop.build(key, htm = "POST", htu = htu(PATH_LOGOUT), refreshToken = refresh) }.getOrNull()
                }
            runCatching {
                withTimeoutOrNull(LOGOUT_TIMEOUT_MS) {
                    refreshApi.logout(
                        LogoutRequest(scope = LOGOUT_SCOPE_LOCAL, deviceId = deviceIdentity.deviceId(), refreshToken = refresh),
                        authorization = access?.takeIf { it.isNotBlank() }?.let { "Bearer $it" },
                        dpop = proof,
                    )
                }
            }.onFailure {
                if (it is CancellationException) throw it
                Timber.w(it, "server logout failed (local sign-out proceeds)")
            }
        }

        /**
         * Account deletion / "forget this device": sign out (no server call —
         * the account is gone) and erase every local trace including the
         * remembered accounts, the Block Store entry and both Keystore keys.
         */
        suspend fun eraseAllLocalState() {
            signOut(reason = SessionEndReason.expired(code = "ACCOUNT_DELETED"))
            runCatching { accountHints.delete() }
            _rememberedAccounts.value = emptyList()
            runCatching { deviceKeyStore.delete() }
            runCatching { stepUpKeyStore.delete() }
            deviceIdentity.markStepUpEnrolled(null)
            _sessionEndReason.value = null
        }

        private fun htu(path: String): String = DPoPProofBuilder.htu(BuildConfig.PANTOPUS_API_BASE_URL, path)

        private fun OAuthProvider?.hintMethod(): String? =
            when (this) {
                OAuthProvider.Google -> AccountHint.METHOD_GOOGLE
                OAuthProvider.Apple -> AccountHint.METHOD_APPLE
                null -> null
            }

        private companion object {
            const val PROACTIVE_REFRESH_WINDOW_SECONDS = 120L
            const val MILLIS_PER_SECOND = 1000L
            const val FCM_TOKEN_TIMEOUT_MS = 5_000L
            const val LOGOUT_TIMEOUT_MS = 5_000L

            const val PATH_LOGIN = "/api/users/login"
            const val PATH_OAUTH_CALLBACK = "/api/users/oauth/callback"
            const val PATH_OAUTH_TOKEN = "/api/users/oauth/token"
            const val PATH_OAUTH_NATIVE = "/api/users/oauth/native"
            const val PATH_REFRESH = "/api/users/refresh"
            const val PATH_LOGOUT = "/api/users/logout"
            const val PATH_RESUME = "/api/auth/resume"
            const val PATH_DEVICES_REGISTER = "/api/auth/devices/register"
            const val PATH_STEP_UP_KEY = "/api/auth/step-up-key"

            const val CHALLENGE_RESUME = "resume"
            const val CHALLENGE_STEP_UP = "step_up"
            const val STEP_UP_METHOD_PASSWORD = "password"
            const val STEP_UP_METHOD_DEVICE_KEY = "device_key"
            const val LOGOUT_SCOPE_LOCAL = "local"
            const val PUSH_PROVIDER_FCM = "fcm"
            const val SESSION_CONTEXT_INTERACTIVE = "interactive"
            const val SESSION_CONTEXT_RESTORED = "restored"
            const val REASON_LOCKDOWN = "LOCKDOWN"
        }
    }

/** Read (and consume) the error body of a Retrofit [HttpException]; `null` when absent. */
private fun HttpException.errorBodyString(): String? = runCatching { response()?.errorBody()?.string() }.getOrNull()

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
