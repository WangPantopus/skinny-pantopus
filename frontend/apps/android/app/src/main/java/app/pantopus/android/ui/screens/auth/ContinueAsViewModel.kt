package app.pantopus.android.ui.screens.auth

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AccountHint
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.SessionEndReason
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * L2 "Continue as …" card (design §3 state **B**, §7.4, §9) over
 * [AuthRepository.State.Resumable]: Block Store remembers the account and
 * holds a resume grant, the device has an OS lock, and one gesture
 * (BiometricPrompt STRONG | DEVICE_CREDENTIAL, run inside
 * [AuthRepository.resume]) redeems the grant for a `restored` session.
 *
 * The view-model owns only the *card's* transient state — the resumable
 * hint itself and the session-end banner come straight from the
 * repository flows, so a state flip (SignedIn / SignedOut) is what
 * dismisses the card, never a local flag. Mirrors iOS
 * `ContinueAsViewModel`.
 */
@HiltViewModel
class ContinueAsViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        data class UiState(
            /** The remembered account the card shows; `null` once the state has moved on. */
            val hint: AccountHint? = null,
            /** `resume()` is in flight (prompt up or `/api/auth/resume` pending). */
            val isResuming: Boolean = false,
            /** "Not you? Remove" in flight. */
            val isRemoving: Boolean = false,
            /** Transient resume failure (offline / 5xx) — the user can retry. */
            val errorMessage: String? = null,
            /**
             * Why the previous session ended without the user asking, if it
             * did; shown once as the security / expiry banner.
             */
            val sessionEndReason: SessionEndReason? = null,
        ) {
            val displayName: String get() = hint?.displayName?.takeIf { it.isNotBlank() } ?: "you"
            val canAct: Boolean get() = !isResuming && !isRemoving
        }

        private data class Local(
            val isResuming: Boolean = false,
            val isRemoving: Boolean = false,
            val errorMessage: String? = null,
        )

        private val local = MutableStateFlow(Local())

        /** One-shot guard for the auto-shown prompt (design §3: "BiometricPrompt auto-shown"). */
        private var autoPrompted = false

        val uiState: StateFlow<UiState> =
            combine(authRepository.state, authRepository.sessionEndReason, local) { state, reason, local ->
                UiState(
                    hint = (state as? AuthRepository.State.Resumable)?.hint,
                    isResuming = local.isResuming,
                    isRemoving = local.isRemoving,
                    errorMessage = local.errorMessage,
                    sessionEndReason = reason,
                )
            }.stateIn(
                viewModelScope,
                SharingStarted.Eagerly,
                UiState(
                    hint = (authRepository.state.value as? AuthRepository.State.Resumable)?.hint,
                    sessionEndReason = authRepository.sessionEndReason.value,
                ),
            )

        /**
         * Auto-show the presence prompt the first time the card appears.
         * Exactly once per card instance: a cancelled prompt leaves the
         * user on the card with the explicit *Continue* button, it never
         * re-fires on recomposition / rotation.
         */
        fun autoContinue(activity: FragmentActivity?) {
            if (autoPrompted) return
            autoPrompted = true
            continueAs(activity)
        }

        /** *Continue* → presence gate → `POST /api/auth/resume` (all inside [AuthRepository.resume]). */
        fun continueAs(activity: FragmentActivity?) {
            if (!uiState.value.canAct) return
            if (activity == null) {
                local.update { it.copy(errorMessage = NO_ACTIVITY_MESSAGE) }
                return
            }
            local.update { it.copy(isResuming = true, errorMessage = null) }
            viewModelScope.launch {
                val outcome = authRepository.resume(activity)
                local.update { current ->
                    when (outcome) {
                        // State flipped to SignedIn — the host swaps the card out.
                        is AuthRepository.ResumeOutcome.Restored -> current.copy(isResuming = false)
                        // Stay on the card; the explicit button re-arms the prompt.
                        AuthRepository.ResumeOutcome.Cancelled -> current.copy(isResuming = false)
                        // State already moved to SignedOut (L3, prefilled login).
                        AuthRepository.ResumeOutcome.Unavailable,
                        AuthRepository.ResumeOutcome.GrantRejected,
                        -> current.copy(isResuming = false)
                        is AuthRepository.ResumeOutcome.Transient ->
                            current.copy(isResuming = false, errorMessage = outcome.message)
                    }
                }
            }
        }

        /** *Use a different account* — hint + grant are kept; the login screen takes over. */
        fun useDifferentAccount() {
            if (!uiState.value.canAct) return
            authRepository.useDifferentAccount()
        }

        /** *Not you? Remove* — forget this account on this device (Block Store entry + grant). */
        fun removeAccount() {
            if (!uiState.value.canAct) return
            val userId = uiState.value.hint?.userId
            local.update { it.copy(isRemoving = true, errorMessage = null) }
            viewModelScope.launch {
                authRepository.removeRememberedAccount(userId)
                local.update { it.copy(isRemoving = false) }
            }
        }

        /** The banner's dismiss affordance. */
        fun dismissSessionEndBanner() {
            authRepository.consumeSessionEndReason()
        }

        fun clearError() {
            local.update { it.copy(errorMessage = null) }
        }

        companion object {
            const val NO_ACTIVITY_MESSAGE = "We couldn't verify your identity. Please try again."
        }
    }
