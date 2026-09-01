package app.pantopus.android.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.auth.AuthRepository
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
    ) : ViewModel() {
        val authState: StateFlow<AuthRepository.State> = authRepository.state

        /**
         * Stamp of the last *interactive* sign-in — drives the one-time
         * post-login app-lock offer. `null` after a silent session restore,
         * which must never raise it. Mirrors iOS
         * `AuthManager.lastInteractiveSignInAt`.
         */
        val lastInteractiveSignInAt: StateFlow<Long?> = authRepository.lastInteractiveSignInAt

        init {
            viewModelScope.launch { authRepository.restore() }
        }

        fun syncAppLock(state: AuthRepository.State) {
            when (state) {
                is AuthRepository.State.SignedIn -> appLockManager.configure(state.user.id)
                AuthRepository.State.SignedOut -> appLockManager.configure(null)
                AuthRepository.State.Unknown -> Unit
            }
        }

        suspend fun signOutFromAppLock() {
            appLockManager.clearTransientState()
            authRepository.signOut()
        }
    }
