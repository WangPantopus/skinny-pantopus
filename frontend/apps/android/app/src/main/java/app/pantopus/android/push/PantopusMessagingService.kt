@file:Suppress("PackageNaming")

package app.pantopus.android.push

import app.pantopus.android.data.notifications.NotificationsRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * FCM bridge — registered in `AndroidManifest.xml` against the
 * `com.google.firebase.MESSAGING_EVENT` intent-filter.
 *
 * Mirrors the iOS half (`AppDelegate.application(_:didRegister…)` and
 * `AppDelegate.userNotificationCenter(_:didReceive:)`) — see
 * `frontend/apps/ios/Pantopus/App/AppDelegate.swift`.
 *
 * `@AndroidEntryPoint` lets Hilt inject the repo + dispatcher into a
 * framework-instantiated Service. The service itself stays thin: token
 * rotation calls into [NotificationsRepository] and message routing is
 * delegated to [NotificationDispatcher].
 */
@AndroidEntryPoint
class PantopusMessagingService : FirebaseMessagingService() {
    @Inject lateinit var repository: NotificationsRepository

    @Inject lateinit var dispatcher: NotificationDispatcher

    @Inject lateinit var ackStore: PushTokenAckStore

    // FCM invokes Service callbacks on the main thread. Hop off it
    // before doing IO so the binder thread is freed quickly.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Timber.d("FCM token refreshed")
        scope.launch {
            val result = repository.registerPushToken(token = token, platform = "android")
            if (result is app.pantopus.android.data.api.net.NetworkResult.Success) {
                ackStore.markAcked(token)
            } else {
                Timber.w("Push token registration failed — will retry on next app open")
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Timber.d("FCM message received: ${message.messageId}")
        dispatcher.dispatch(message)
    }
}
