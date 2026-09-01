@file:Suppress("PackageNaming", "MagicNumber", "SwallowedException", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.auth.forgot_password

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.ui.screens.auth.AuthValidation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock
import javax.inject.Inject

/**
 * T6.1c P5 — Forgot password view-model. Mirrors iOS
 * `ForgotPasswordViewModel` (`Features/Auth/Screens/ForgotPasswordView.swift`).
 * Owns the form vs. sent transition and the local resend cooldown that
 * sits above the backend's `forgotPasswordLimiter`.
 */
@HiltViewModel
class ForgotPasswordViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        /** Wall-clock source — replaced in tests with a fake clock. */
        var clock: Clock = Clock.systemUTC()

        sealed interface Phase {
            data object Form : Phase

            data class Sent(val email: String) : Phase
        }

        data class UiState(
            val email: String = "",
            val phase: Phase = Phase.Form,
            val isLoading: Boolean = false,
            val errorMessage: AuthError? = null,
            /**
             * Earliest epoch-millis the user may resend at. Drives the
             * client-side cooldown label and rejects redundant taps.
             */
            val resendCooldownUntilEpochMs: Long? = null,
        ) {
            val canSubmit: Boolean
                get() = !isLoading && AuthValidation.email(email) == null
        }

        private val _uiState = MutableStateFlow(UiState())
        val uiState: StateFlow<UiState> = _uiState.asStateFlow()

        fun onEmailChange(value: String) = _uiState.update { it.copy(email = value, errorMessage = null) }

        fun clearError() = _uiState.update { it.copy(errorMessage = null) }

        /**
         * Submits the initial `/forgot-password` request. On success
         * transitions to [Phase.Sent] and starts the resend cooldown.
         */
        fun submit() {
            val snapshot = _uiState.value
            if (!snapshot.canSubmit) return
            val target = snapshot.email.trim().lowercase()
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            viewModelScope.launch {
                try {
                    authRepository.forgotPassword(target)
                    val nextCooldown = clock.millis() + RESEND_COOLDOWN_MS
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            phase = Phase.Sent(target),
                            resendCooldownUntilEpochMs = nextCooldown,
                        )
                    }
                } catch (e: AuthError) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = e) }
                } catch (e: Throwable) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = AuthError.Unknown) }
                }
            }
        }

        /**
         * Resend from the status screen. Honours the local cooldown so
         * a frustrated tap doesn't pile on the backend rate limiter.
         */
        fun resend() {
            val snapshot = _uiState.value
            val phase = snapshot.phase as? Phase.Sent ?: return
            val now = clock.millis()
            val until = snapshot.resendCooldownUntilEpochMs
            if (until != null && until > now) return
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            viewModelScope.launch {
                try {
                    authRepository.forgotPassword(phase.email)
                    val nextCooldown = clock.millis() + RESEND_COOLDOWN_MS
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            resendCooldownUntilEpochMs = nextCooldown,
                        )
                    }
                } catch (e: AuthError) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = e) }
                } catch (e: Throwable) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = AuthError.Unknown) }
                }
            }
        }

        companion object {
            /** 30 s, matching the web's cooldown. */
            const val RESEND_COOLDOWN_MS: Long = 30_000
        }
    }
