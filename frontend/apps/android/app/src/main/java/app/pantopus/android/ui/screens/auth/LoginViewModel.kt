@file:Suppress("MagicNumber", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.OAuthBrowserCommand
import app.pantopus.android.data.auth.OAuthProvider
import app.pantopus.android.data.auth.OAuthSessionStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException
import java.util.UUID
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class LoginViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        data class UiState(
            val email: String = "",
            val password: String = "",
            val isLoading: Boolean = false,
            /**
             * Typed error so the redesigned banner can render its own
             * headline + body. `null` when no error is currently surfaced.
             */
            val errorMessage: AuthError? = null,
            /**
             * Neutral confirmation shown after a successful resend — the
             * backend's anti-enumeration copy (`backend/routes/users.js:3060`).
             */
            val infoMessage: String? = null,
            /** True while `POST /api/users/resend-verification` is in flight. */
            val isResendingVerification: Boolean = false,
        ) {
            val canSubmit: Boolean
                get() = !isLoading && AuthValidation.email(email) == null && password.length >= 6

            /**
             * The backend blocks an unverified sign-in with 403 "Please verify
             * your email before signing in." (`backend/routes/users.js:1528`),
             * which [mapLoginError] turns into `AuthError.ServerError`. RN
             * reveals its resend link on the same signal — any login error
             * whose copy mentions "verify"
             * (`pantopus/frontend/apps/mobile/src/app/(auth)/login.tsx:58`).
             */
            val canResendVerification: Boolean
                get() = errorMessage?.message?.contains("verify", ignoreCase = true) == true
        }

        private val _uiState = MutableStateFlow(UiState())
        val uiState: StateFlow<UiState> = _uiState.asStateFlow()

        private val _browserAuth = Channel<OAuthBrowserCommand>(Channel.BUFFERED)
        val browserAuth = _browserAuth.receiveAsFlow()

        private var oauthOwnerId: String? = null
        private var awaitingResumeAfterBrowser: Boolean = false

        /**
         * The host actually left the foreground after the browser command
         * was issued. Custom Tabs (and the `ACTION_VIEW` fallback) always
         * pause the host before covering it, so a resume that was *not*
         * preceded by a pause is never the user backing out of the browser
         * — it is the host being re-attached, and a `LifecycleEventObserver`
         * added while the owner is already RESUMED replays ON_RESUME
         * synchronously. Cancelling on that would consume the pending
         * session and silently drop the real redirect.
         */
        private var hostLeftForeground: Boolean = false
        private var cancelJob: Job? = null

        fun onEmailChange(value: String) = _uiState.update { it.copy(email = value, errorMessage = null, infoMessage = null) }

        fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value, errorMessage = null, infoMessage = null) }

        fun clearError() = _uiState.update { it.copy(errorMessage = null, infoMessage = null) }

        /**
         * `POST /api/users/resend-verification` (route
         * `backend/routes/users.js:3049`) — mirrors RN
         * `(auth)/login.tsx:60`. Requires an email in the field; the response
         * is always the same generic message whether or not the account
         * exists, so the confirmation copy is anti-enumeration safe.
         */
        fun resendVerification() {
            val snapshot = _uiState.value
            if (snapshot.isResendingVerification) return
            val email = snapshot.email.trim()
            if (email.isEmpty()) {
                _uiState.update {
                    it.copy(errorMessage = AuthError.ServerError("Enter your email first to resend verification."))
                }
                return
            }
            _uiState.update { it.copy(isResendingVerification = true, infoMessage = null) }
            viewModelScope.launch {
                try {
                    authRepository.resendVerification(email.lowercase())
                    _uiState.update {
                        it.copy(
                            isResendingVerification = false,
                            infoMessage = "If that email exists, a verification email has been sent.",
                        )
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (t: Throwable) {
                    _uiState.update {
                        it.copy(
                            isResendingVerification = false,
                            errorMessage =
                                (t as? AuthError)
                                    ?: AuthError.ServerError("Could not resend verification email."),
                        )
                    }
                }
            }
        }

        fun signIn() {
            val snapshot = _uiState.value
            if (!snapshot.canSubmit) return
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            viewModelScope.launch {
                authRepository
                    .signIn(snapshot.email.trim().lowercase(), snapshot.password)
                    .onFailure { e ->
                        _uiState.update { it.copy(isLoading = false, errorMessage = mapLoginError(e)) }
                    }.onSuccess {
                        _uiState.update { it.copy(isLoading = false) }
                    }
            }
        }

        fun signInWithOAuth(provider: OAuthProvider) {
            if (_uiState.value.isLoading) return
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            viewModelScope.launch {
                val ownerId = UUID.randomUUID().toString()
                oauthOwnerId = ownerId
                val nonce = OAuthSessionStore.begin(ownerId)
                try {
                    val url = authRepository.oauthAuthorizationUrl(provider, nonce)
                    awaitingResumeAfterBrowser = true
                    _browserAuth.send(OAuthBrowserCommand.Open(url))
                    val callback =
                        OAuthSessionStore.callback
                            .filterNotNull()
                            .first { it.ownerId == ownerId }
                    if (!OAuthSessionStore.claim(ownerId, callback)) {
                        _uiState.update { it.copy(isLoading = false) }
                        return@launch
                    }
                    when (callback) {
                        is OAuthSessionStore.Callback.Cancelled -> Unit
                        // Mirrors iOS `OAuthWebAuthenticationError.unableToStart`.
                        is OAuthSessionStore.Callback.Malformed,
                        is OAuthSessionStore.Callback.BrowserUnavailable,
                        ->
                            _uiState.update { it.copy(errorMessage = AuthError.Unknown) }
                        // Attempt ended after a forged / unverifiable callback —
                        // no code was ever exchanged. Mirrors the iOS
                        // `rejectedCallback` -> `AuthError.serverError` mapping.
                        is OAuthSessionStore.Callback.Rejected ->
                            _uiState.update {
                                it.copy(errorMessage = AuthError.ServerError(OAuthSessionStore.REJECTED_MESSAGE))
                            }
                        is OAuthSessionStore.Callback.Code ->
                            authRepository.exchangeOAuthCode(callback.value)
                        is OAuthSessionStore.Callback.Tokens ->
                            authRepository.exchangeOAuthTokens(
                                accessToken = callback.accessToken,
                                refreshToken = callback.refreshToken,
                            )
                    }
                    _uiState.update { it.copy(isLoading = false) }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: AuthError) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = e) }
                } catch (t: Throwable) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = mapLoginError(t)) }
                } finally {
                    awaitingResumeAfterBrowser = false
                    hostLeftForeground = false
                    cancelJob?.cancel()
                    OAuthSessionStore.clear(ownerId)
                    if (oauthOwnerId == ownerId) oauthOwnerId = null
                }
            }
        }

        /**
         * Called when the host screen leaves the foreground — the browser
         * is now in front. Arms [onHostResumed]'s back-out heuristic.
         */
        fun onHostPaused() {
            if (!awaitingResumeAfterBrowser) return
            hostLeftForeground = true
        }

        /**
         * Called when the host screen resumes. After Custom Tabs returns
         * without a callback, silently clear the loading state. Only a
         * resume that follows a real [onHostPaused] counts — see
         * [hostLeftForeground].
         */
        fun onHostResumed() {
            if (!awaitingResumeAfterBrowser) return
            if (!hostLeftForeground) return
            hostLeftForeground = false
            val owner = oauthOwnerId ?: return
            cancelJob?.cancel()
            cancelJob =
                viewModelScope.launch {
                    delay(400)
                    if (OAuthSessionStore.cancelIfAwaiting(owner)) {
                        awaitingResumeAfterBrowser = false
                    }
                }
        }

        /**
         * `AuthRepository.signIn` returns a generic `Result<UserDto>` — we
         * map the raw failure to a typed [AuthError] here so the screen
         * banner can render headline + body. Mirrors the iOS
         * `AuthManager.mapSignInError`.
         */
        private fun mapLoginError(error: Throwable): AuthError =
            when {
                error is AuthError -> error
                error is HttpException && error.code() == 401 -> AuthError.InvalidCredentials
                error is HttpException && error.code() == 403 ->
                    AuthError.ServerError(
                        "Please verify your email before signing in.",
                    )
                error is HttpException && error.code() == 429 -> AuthError.RateLimited
                error is HttpException && error.code() in 500..599 ->
                    AuthError.ServerError("Server error ${error.code()}.")
                error is IOException -> AuthError.NetworkError
                else -> AuthError.Unknown
            }
    }
