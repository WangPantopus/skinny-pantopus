@file:Suppress("PackageNaming")

package app.pantopus.android.push

import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.DeviceIdentity
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.data.plans.PlansEvents
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.isConnectionNotice
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

    // Lazy: the auth graph is heavy and only needed on token rotation /
    // `session_revoked` — never on the hot notification path.
    @Inject lateinit var authRepository: dagger.Lazy<AuthRepository>

    @Inject lateinit var deviceIdentity: DeviceIdentity

    @Inject lateinit var plansRepository: dagger.Lazy<PlansRepository>

    @Inject lateinit var plansEvents: dagger.Lazy<PlansEvents>

    @Inject lateinit var screenStore: dagger.Lazy<ScreenStore>

    // FCM invokes Service callbacks on the main thread. Hop off it
    // before doing IO so the binder thread is freed quickly.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Timber.d("FCM token refreshed")
        scope.launch {
            // `deviceId` links the PushToken row to this trusted device
            // (CONTRACT §"Device descriptor"; backend notifications.js deviceIdFromRequest).
            val result =
                repository.registerPushToken(
                    token = token,
                    platform = "android",
                    deviceId = deviceIdentity.deviceId(),
                )
            if (result is app.pantopus.android.data.api.net.NetworkResult.Success) {
                ackStore.markAcked(token)
            } else {
                Timber.w("Push token registration failed — will retry on next app open")
            }
            // Persistent login: re-link the rotated token to this trusted
            // device (`POST /api/auth/devices/register`, fingerprint-gated,
            // no-op when signed out). CONTRACT §"Client behaviour".
            runCatching { authRepository.get().registerDevice() }
                .onFailure { Timber.w(it, "device re-registration after FCM rotation failed") }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Timber.d("FCM message received: ${message.messageId}")
        if (message.data["type"] == TYPE_SESSION_REVOKED) {
            // Design §7.7: the push is a hint, never the authority — the
            // repository probes the server and signs out only on a 401.
            scope.launch {
                runCatching { authRepository.get().confirmSessionRevoked() }
                    .onFailure { Timber.w(it, "session_revoked confirmation failed") }
            }
            return
        }
        val type = message.data["type"].orEmpty()
        // A connection request or acceptance: Connections reads its lists again, even when its socket was down.
        if (isConnectionNotice(type)) screenStore.get().markStale(StoreTopics.CONNECTIONS)
        // Nearby Plans: a plan push means the map, the lists, Today and an open plan page are out of date
        // (a "You're in" plays the reveal on the open page).
        if (type.startsWith("plan_")) {
            plansRepository.get().changed(message.data["plan_id"])
            plansRepository.get().changed()
            // That plan's page is on screen and shows the news itself: no system post for news without buttons.
            if (plansEvents.get().isShowingQuietly(type, message.data["plan_id"])) return
        }
        dispatcher.dispatch(message)
    }

    private companion object {
        /** `backend/services/authDeviceService.js` `sendToDevice(... data: { type: 'session_revoked' })`. */
        const val TYPE_SESSION_REVOKED = "session_revoked"
    }
}
