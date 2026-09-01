package app.pantopus.android.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.StepUpCoordinator
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.SessionEndReason
import app.pantopus.android.data.realtime.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RootViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
        val appLockManager: AppLockManager,
        /** Mounted by `StepUpHost` in the signed-in branch (persistent login, design §2.5). */
        val stepUpCoordinator: StepUpCoordinator,
        private val socketManager: SocketManager,
    ) : ViewModel() {
        val authState: StateFlow<AuthRepository.State> = authRepository.state

        /**
         * Why the last session ended without the user asking (security code /
         * expiry). Non-null ⇒ the signed-out front door opens straight on the
         * login screen so the banner is seen (design §7.2, CONTRACT §"Error
         * envelope"); the login / continue-as screen consumes it.
         */
        val sessionEndReason: StateFlow<SessionEndReason?> = authRepository.sessionEndReason

        /**
         * Stamp of the last *interactive* sign-in — drives the one-time
         * post-login app-lock offer. `null` after a silent session restore,
         * which must never raise it. Mirrors iOS
         * `AuthManager.lastInteractiveSignInAt`.
         */
        val lastInteractiveSignInAt: StateFlow<Long?> = authRepository.lastInteractiveSignInAt

        init {
            viewModelScope.launch { authRepository.restore() }
            // `auth:session_revoked` from the socket (design §7.7, CONTRACT
            // §"Error envelope"): the push is never the authority, so confirm
            // with a `/refresh` probe and sign out only on a 401. Parity with
            // iOS `SocketClient` → `confirmSessionAfterRevocationSignal()`.
            viewModelScope.launch {
                socketManager.sessionRevoked.collect { authRepository.confirmSessionRevoked() }
            }
        }

        /**
         * `ON_START` — proactive DPoP refresh when the access token is inside
         * the 120 s pre-expiry window (design §7.2 "scenePhase .active /
         * ON_START: refresh if < 120 s left"). No-op unless signed in.
         *
         * Unlike the OkHttp pre-flight (which defers to the 401 path so there
         * is a single sign-out decision point per request), this is a
         * foreground *session* check with no request behind it: a refusal here
         * (`TOKEN_REUSE`, `SESSION_REVOKED`, `DEVICE_REVOKED`, …) is the
         * server telling us the session is gone, so we sign out immediately
         * and publish the banner (CONTRACT §"Error envelope") instead of
         * leaving a dead session on screen until the next request 401s. A
         * transient (offline / 5xx) outcome changes nothing.
         */
        fun onAppStart() {
            if (authState.value !is AuthRepository.State.SignedIn) return
            viewModelScope.launch {
                val outcome = authRepository.refreshIfExpiringSoon()
                if (outcome is AuthRepository.RefreshOutcome.AuthRejected) {
                    authRepository.signOut(reason = outcome.reason)
                }
            }
        }

        fun syncAppLock(state: AuthRepository.State) {
            when (state) {
                is AuthRepository.State.SignedIn -> appLockManager.configure(state.user.id)
                AuthRepository.State.SignedOut -> appLockManager.configure(null)
                // L2 "Continue as …" — no live session yet, so no app lock.
                is AuthRepository.State.Resumable -> appLockManager.configure(null)
                AuthRepository.State.Unknown -> Unit
            }
        }

        suspend fun signOutFromAppLock() {
            appLockManager.clearTransientState()
            authRepository.signOut()
        }
    }
