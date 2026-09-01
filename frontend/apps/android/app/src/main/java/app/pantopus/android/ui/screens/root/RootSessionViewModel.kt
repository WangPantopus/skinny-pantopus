package app.pantopus.android.ui.screens.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * P6.6 — surfaces the signed-in user's handle so [RootTabScreen] can open
 * the public-profile setup (privacy handshake) for "Set up Public Profile".
 */
@HiltViewModel
class RootSessionViewModel
    @Inject
    constructor(
        authRepository: AuthRepository,
    ) : ViewModel() {
        val currentHandle: StateFlow<String> =
            authRepository.state
                .map { (it as? AuthRepository.State.SignedIn)?.user?.username.orEmpty() }
                .stateIn(viewModelScope, SharingStarted.Eagerly, "")
    }
