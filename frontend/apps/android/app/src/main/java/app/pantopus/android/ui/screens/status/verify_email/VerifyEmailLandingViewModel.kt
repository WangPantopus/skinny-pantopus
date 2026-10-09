@file:Suppress("PackageNaming", "MagicNumber", "SwallowedException", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.status.verify_email

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock
import javax.inject.Inject

/**
 * §1B-2 — Verify email deep-link LANDING view-model. Mirrors iOS
 * `VerifyEmailLandingViewModel` (`Features/Status/`). The screen the app
 * opens when the user taps the link in their verification email — distinct
 * from A18.1 "Verify Email Sent" ([VerifyEmailViewModel]).
 *
 * Reads `email` + `token` from [SavedStateHandle]. On first attach it POSTs
 * the token to the existing verify-email endpoint and walks three phases:
 *
 *   Verifying → Success      (token accepted)
 *   Verifying → Expired      (token rejected / missing)
 *   Verifying → Unavailable  (offline, rate-limited or Pantopus busy: the
 *                             link wasn't checked and still works → Try again)
 *
 * The Expired phase offers a Resend (re-using the resend-verification
 * endpoint, honouring the same 30s cooldown as A18.1).
 */
@HiltViewModel
class VerifyEmailLandingViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /** Wall-clock source — replaced in tests with a fake clock. */
        var clock: Clock = Clock.systemUTC()

        /** The post-tap outcomes; Unavailable offers the same link again. */
        enum class Phase { Verifying, Success, Expired, Unavailable }

        /** Transient confirmation surfaced after a Resend tap. */
        data class ResendToast(
            val message: String,
            val isError: Boolean,
        )

        data class UiState(
            val email: String? = null,
            val token: String? = null,
            val phase: Phase = Phase.Verifying,
            /** Why the link couldn't be checked ([Phase.Unavailable]), in the person's terms. */
            val unavailableMessage: String = "",
            val isResending: Boolean = false,
            val toast: ResendToast? = null,
            val resendCooldownUntilEpochMs: Long? = null,
        ) {
            /** Recipient surfaced in the body copy + targeted by Resend. */
            val recipient: String
                get() = email ?: "your email"

            val canResend: Boolean
                get() = !isResending && !email.isNullOrEmpty() && resendCooldownUntilEpochMs == null

            fun cooldownRemaining(nowEpochMs: Long): Long? {
                val until = resendCooldownUntilEpochMs ?: return null
                val delta = until - nowEpochMs
                return if (delta > 0) delta else null
            }
        }

        private var hasVerified: Boolean = false

        private val _uiState =
            MutableStateFlow(
                UiState(
                    email = savedStateHandle.get<String>(EMAIL_KEY)?.takeIf { it.isNotEmpty() },
                    token = savedStateHandle.get<String>(TOKEN_KEY)?.takeIf { it.isNotEmpty() },
                ),
            )
        val uiState: StateFlow<UiState> = _uiState.asStateFlow()

        /**
         * Fired once from the screen's `LaunchedEffect`. POSTs the link's
         * token and resolves the terminal phase. A missing token (defensive
         * — the deep link always carries one) lands straight on Expired.
         */
        fun verifyOnAppearIfNeeded() {
            if (hasVerified) return
            hasVerified = true
            val token = _uiState.value.token
            if (token.isNullOrEmpty()) {
                _uiState.update { it.copy(phase = Phase.Expired) }
                return
            }
            _uiState.update { it.copy(phase = Phase.Verifying) }
            viewModelScope.launch {
                try {
                    authRepository.verifyEmail(token)
                    _uiState.update { it.copy(phase = Phase.Success) }
                } catch (e: Throwable) {
                    // Offline / busy → the link still works: Try again. A refused
                    // link → the expired frame, which offers Resend + change-email.
                    val unavailable = unavailableMessage(e)
                    _uiState.update {
                        if (unavailable != null) {
                            it.copy(phase = Phase.Unavailable, unavailableMessage = unavailable)
                        } else {
                            it.copy(phase = Phase.Expired)
                        }
                    }
                }
            }
        }

        /** "Try again" from the unavailable frame: checks the same link once more. */
        fun retry() {
            if (_uiState.value.phase != Phase.Unavailable) return
            hasVerified = false
            verifyOnAppearIfNeeded()
        }

        /**
         * Re-sends the verification email, honouring the local cooldown so a
         * frustrated double-tap doesn't pile on the backend rate limiter.
         * Surfaces a confirmation toast on success and the error copy on
         * failure.
         */
        fun resend() {
            val snapshot = _uiState.value
            // Time-based cooldown guard (mirrors iOS `cooldownRemaining(now:)`)
            // so a frustrated double-tap inside the 30s window short-circuits
            // without piling on the backend rate limiter.
            if (snapshot.isResending || snapshot.cooldownRemaining(clock.millis()) != null) return
            val email = snapshot.email ?: return
            _uiState.update { it.copy(isResending = true, toast = null) }
            viewModelScope.launch {
                try {
                    authRepository.resendVerification(email)
                    val nextCooldown = clock.millis() + RESEND_COOLDOWN_MS
                    _uiState.update {
                        it.copy(
                            isResending = false,
                            resendCooldownUntilEpochMs = nextCooldown,
                            toast = ResendToast("Verification link requested.", isError = false),
                        )
                    }
                } catch (e: AuthError) {
                    _uiState.update { it.copy(isResending = false, toast = ResendToast(e.message, isError = true)) }
                } catch (e: Throwable) {
                    _uiState.update {
                        it.copy(isResending = false, toast = ResendToast(AuthError.Unknown.message, isError = true))
                    }
                }
            }
        }

        fun clearToast() = _uiState.update { it.copy(toast = null) }

        companion object {
            const val EMAIL_KEY = "email"
            const val TOKEN_KEY = "token"
            const val RESEND_COOLDOWN_MS: Long = 30_000

            /** Copy for a failure that left the link unused (offline, rate-limited, busy); null when the link was refused. */
            fun unavailableMessage(error: Throwable): String? =
                when (error) {
                    is AuthError.NetworkError ->
                        "Can't reach Pantopus. Check your connection, then try again. Your link still works."
                    is AuthError.RateLimited ->
                        "Too many tries for now. Wait a minute, then try again. Your link still works."
                    is AuthError.TemporarilyUnavailable -> error.detail
                    else -> null
                }
        }
    }
