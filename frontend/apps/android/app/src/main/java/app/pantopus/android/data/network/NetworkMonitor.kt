package app.pantopus.android.data.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps `ConnectivityManager.NetworkCallback` as a [StateFlow] so
 * Composables and ViewModels can observe online/offline transitions.
 *
 * Defaults [isOnline] to `true` so first-launch UI doesn't flicker
 * through an offline state before the OS reports.
 */
@Singleton
open class NetworkMonitor
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private val manager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        private val _isOnline = MutableStateFlow(initialState())
        open val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

        init {
            val request =
                NetworkRequest
                    .Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build()

            manager.registerNetworkCallback(
                request,
                object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        _isOnline.value = true
                    }

                    override fun onLost(network: Network) {
                        _isOnline.value = currentlyConnected()
                    }
                },
            )
        }

        private fun initialState(): Boolean = currentlyConnected()

        private fun currentlyConnected(): Boolean {
            val active = manager.activeNetwork ?: return false
            val caps = manager.getNetworkCapabilities(active) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }
    }
