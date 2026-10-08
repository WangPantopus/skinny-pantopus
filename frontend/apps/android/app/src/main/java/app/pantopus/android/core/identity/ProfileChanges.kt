package app.pantopus.android.core.identity

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Goes up by one after the signed-in person's name or username is saved (the one-time name dialog, the
 * share-profile username sheet, Edit Profile). Screens that show them (the Hub greeting, Me) read the profile
 * again when the version moved since their last read: right away while they're on screen, or when they come
 * back from Edit Profile. Mirrors iOS `Notification.Name.pantopusProfileDidChange`.
 */
object ProfileChanges {
    private val _version = MutableStateFlow(0)
    val version: StateFlow<Int> = _version.asStateFlow()

    fun notifyChanged() {
        _version.update { it + 1 }
    }
}
