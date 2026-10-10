package app.pantopus.android.ui.screens.root

import android.content.Context
import android.net.ConnectivityManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.identity.MadeUpUsername
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.neighborhood.NeighborhoodRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.ui.screens.place.today.primaryHomeId
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
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
        private val homes: HomesRepository,
        private val place: PlaceRepository,
        private val nearby: NeighborhoodRepository,
        private val chats: ChatRepository,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        init {
            viewModelScope.launch {
                // A sign-out or account change cancels the old account's warm-up, including its child requests.
                authRepository.state.map { (it as? AuthRepository.State.SignedIn)?.user?.id }
                    .distinctUntilChanged().collectLatest { account ->
                        if (account == null) return@collectLatest
                        // Give the initial Place read the first turn; the store joins any reads the user starts meanwhile.
                        delay(PREFETCH_DELAY_MS)
                        if (mayPrefetch()) warmTabs()
                    }
            }
        }

        private fun mayPrefetch(): Boolean = runCatching {
            val network = context.getSystemService(ConnectivityManager::class.java)
            network.activeNetwork != null && !network.isActiveNetworkMetered &&
                network.restrictBackgroundStatus == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_DISABLED
        }.getOrDefault(false)

        private suspend fun warmTabs() = coroutineScope {
            launch {
                val response = homes.myHomesStored().data ?: return@launch
                val homeId = primaryHomeId(response) ?: return@launch
                if (mayPrefetch()) place.todayStored(homeId)
            }
            launch { if (mayPrefetch()) nearby.meterStored() }
            launch { if (mayPrefetch()) nearby.cellsStored() }
            launch { if (mayPrefetch()) chats.conversationsStored() }
        }

        /** The drawer's "<name> · Your profile": the person's name, or a username they chose; never a made-up one. */
        val currentHandle: StateFlow<String> =
            authRepository.state
                .map { state ->
                    val user = (state as? AuthRepository.State.SignedIn)?.user
                    user?.displayName?.takeIf { it.isNotBlank() } ?: MadeUpUsername.chosen(user?.username).orEmpty()
                }.stateIn(viewModelScope, SharingStarted.Eagerly, "")

        private companion object {
            const val PREFETCH_DELAY_MS = 1_000L
        }
    }
