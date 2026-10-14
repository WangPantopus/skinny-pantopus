package app.pantopus.android.ui.screens.homes

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.components.OfflineBannerHost
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
internal interface HomeNetworkEntryPoint {
    fun networkMonitor(): NetworkMonitor
}

/** Reuse the app's dismissible offline strip without changing the shared shells or each Home view model. */
@Composable
internal fun HomeOfflineContent(
    modifier: Modifier = Modifier.fillMaxSize(),
    content: @Composable BoxScope.() -> Unit,
) {
    val context = LocalContext.current
    val onlineFlow =
        remember(context) {
            // Previews and snapshot tests do not have the application's Hilt graph.
            runCatching {
                EntryPointAccessors.fromApplication(context.applicationContext, HomeNetworkEntryPoint::class.java)
                    .networkMonitor().isOnline
            }.getOrNull()
        }
    val online = onlineFlow?.collectAsStateWithLifecycle()?.value ?: true
    OfflineBannerHost(isOffline = !online, modifier = modifier) {
        Box(modifier = Modifier.fillMaxSize(), content = content)
    }
}
