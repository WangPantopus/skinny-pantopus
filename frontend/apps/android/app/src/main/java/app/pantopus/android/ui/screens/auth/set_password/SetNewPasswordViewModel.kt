@file:Suppress("PackageNaming", "MagicNumber", "SwallowedException", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.auth.set_password

import androidx.lifecycle.SavedStateHandle
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
import javax.inject.Inject

/**
 * §1B-1 — "Set a new password" view-model. Mirrors iOS
 * `SetNewPasswordViewModel`. Reads the hashed recovery token from
 * [SavedStateHandle] (populated by the NavHost's `{token}` path argument).
 * Submit is gated on the two passwords matching AND the new password
 * passing the same client-side strength rules as signup. On success the
 * screen flips to the bespoke "Password updated" confirmation.
 *
 * Reuses the existing `/api/users/reset-password` endpoint via
 * [AuthRepository.resetPassword] — no new networking.
 */
@HiltViewModel
class SetNewPasswordViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
        private val savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        sealed interface Phase {
            data object Form : Phase

            data object Success : Phase
        }

        /** Confirm-field match state, surfaced as the inline match hint. */
        enum class ConfirmMatch { None, Match, Mismatch }

        data class UiState(
            val token: String = "",
            val password: String = "",
            val confirmPassword: String = "",
            val phase: Phase = Phase.Form,
            val isLoading: Boolean = false,
            val errorMessage: AuthError? = null,
        ) {
            val passwordsMeetStrength: Boolean get() = AuthValidation.password(password) == null
            val passwordsMatch: Boolean
                get() = confirmPassword.isNotEmpty() && password == confirmPassword

            val canSubmit: Boolean
                get() = !isLoading && passwordsMeetStrength && passwordsMatch && token.isNotEmpty()

            val passwordStrength: Int get() = AuthValidation.passwordStrength(password)

            val passwordStrengthLabel: String
                get() =
                    when (passwordStrength) {
                        1 -> "Weak"
                        2 -> "Fair"
                        3 -> "Strong"
                        else -> ""
                    }

            /**
             * Helper line under the new-password field. Praise once the meter
             * reaches "Strong"; otherwise the guiding rule. Two-state per the
             * design (`Use 8+ …` → `Great — …`).
             */
            val strengthHint: String
                get() =
                    if (passwordStrength >= 3) {
                        "Great — long, with a number and a symbol."
                    } else {
                        "Use 8+ characters with a number and a symbol."
                    }

            val confirmMatch: ConfirmMatch
                get() =
                    when {
                        confirmPassword.isEmpty() -> ConfirmMatch.None
                        passwordsMatch -> ConfirmMatch.Match
                        else -> ConfirmMatch.Mismatch
                    }
        }

        private val _uiState =
            MutableStateFlow(UiState(token = savedStateHandle.get<String>(TOKEN_KEY).orEmpty()))
        val uiState: StateFlow<UiState> = _uiState.asStateFlow()

        fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value, errorMessage = null) }

        fun onConfirmPasswordChange(value: String) = _uiState.update { it.copy(confirmPassword = value, errorMessage = null) }

        fun clearError() = _uiState.update { it.copy(errorMessage = null) }

        /**
         * Submits the reset request to `POST /api/users/reset-password`. On
         * success flips [Phase.Success] so the screen renders the
         * "Password updated" confirmation.
         */
        fun submit() {
            val snapshot = _uiState.value
            if (!snapshot.canSubmit) return
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            viewModelScope.launch {
                try {
                    authRepository.resetPassword(snapshot.token, snapshot.password)
                    _uiState.update { it.copy(isLoading = false, phase = Phase.Success) }
                } catch (e: AuthError) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = e) }
                } catch (e: Throwable) {
                    _uiState.update { it.copy(isLoading = false, errorMessage = AuthError.Unknown) }
                }
            }
        }

        companion object {
            const val TOKEN_KEY = "token"
        }
    }
