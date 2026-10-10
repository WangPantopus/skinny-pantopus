package app.pantopus.android.ui.components

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import app.pantopus.android.data.store.ScreenStoreEntryPoint
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.drop

/** One signal often names several topics: they are read once. */
private const val CHANGE_DEBOUNCE_MS = 250L

/**
 * Instant Screens contract §8: while this screen is on show, a change signal (another person or device changed
 * something, the socket reconnected, the app came back after 15 minutes) runs [onRead], the screen's quiet read. Entries
 * nobody marked answer without a request, so only what changed is fetched. A screen coming back reads on its own.
 */
@OptIn(FlowPreview::class)
@Composable
fun RefreshOnStoreChange(onRead: () -> Unit) {
    val context = LocalContext.current
    val changes = remember(context) { storeChanges(context) } ?: return
    val read by rememberUpdatedState(onRead)
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(changes, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            changes.drop(1).debounce(CHANGE_DEBOUNCE_MS).collect { read() }
        }
    }
}

/** Null outside the app (previews and snapshot tests have no Hilt graph). */
private fun storeChanges(context: Context): StateFlow<Long>? =
    runCatching {
        EntryPointAccessors.fromApplication(context.applicationContext, ScreenStoreEntryPoint::class.java).screenStore().changes
    }.getOrNull()
