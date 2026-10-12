package app.pantopus.android.data.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
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
 * Starts from the current default connection, then follows callback payloads.
 * Querying ConnectivityManager inside onLost can still report the network that just disappeared.
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
            manager.registerDefaultNetworkCallback(
                object : ConnectivityManager.NetworkCallback() {
                    private var defaultNetwork: Network? = manager.activeNetwork

                    override fun onAvailable(network: Network) {
                        defaultNetwork = network
                    }

                    override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                        if (network == defaultNetwork) {
                            _isOnline.value = capabilities.hasInternet()
                        }
                    }

                    override fun onLost(network: Network) {
                        if (network == defaultNetwork) {
                            defaultNetwork = null
                            _isOnline.value = false
                        }
                    }
                },
            )
        }

        private fun initialState(): Boolean = currentlyConnected()

        private fun currentlyConnected(): Boolean {
            val active = manager.activeNetwork ?: return false
            val caps = manager.getNetworkCapabilities(active) ?: return false
            return caps.hasInternet()
        }

        private fun NetworkCapabilities.hasInternet(): Boolean =
            hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
