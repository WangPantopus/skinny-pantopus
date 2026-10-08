package app.pantopus.android.core.identity

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Emits after the signed-in person's name or username is saved (the one-time name dialog, the share-profile
 * username sheet, Edit Profile), so screens that show them (the Hub greeting, Me) load them again. Mirrors iOS
 * `Notification.Name.pantopusProfileDidChange`.
 */
object ProfileChanges {
    private val _events = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val events: SharedFlow<Unit> = _events.asSharedFlow()

    fun notifyChanged() {
        _events.tryEmit(Unit)
    }
}
