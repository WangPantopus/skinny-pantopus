package app.pantopus.android.data.notifications

import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.feed.RegisterPushTokenRequest
import app.pantopus.android.data.api.models.notifications.MarkAllNotificationsReadBody
import app.pantopus.android.data.api.models.notifications.NotificationActionEcho
import app.pantopus.android.data.api.models.notifications.NotificationUnreadCountResponse
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.NotificationsApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [NotificationsApi] returning the typed
 * [NetworkResult] taxonomy. Optimistic mark-read / read-all bookkeeping
 * lives in the VM; the repository just relays.
 */
@Singleton
class NotificationsRepository
    @Inject
    constructor(
        private val api: NotificationsApi,
        private val legacyApi: ApiService,
        private val store: ScreenStore,
    ) {
        /**
         * `GET /api/notifications` — route `backend/routes/notifications.js:85`.
         * `context` scopes to one identity-firewall zone.
         */
        suspend fun list(
            limit: Int,
            offset: Int,
            unreadOnly: Boolean? = null,
            context: String? = null,
        ): NetworkResult<NotificationsListResponse> =
            safeApiCall {
                api.list(limit = limit, offset = offset, unreadOnly = unreadOnly, context = context)
            }

        /**
         * The bell's unread count through the screens' store (fresh 30 seconds): the Place header, the Hub and the
         * list share it. Reading, marking all read or deleting a notification marks it out of date.
         */
        suspend fun unreadCount(): NetworkResult<NotificationUnreadCountResponse> {
            val stored =
                store.read(StoreKeys.notificationsUnreadCount) { etag -> conditionalApiCall { api.unreadCountConditional(etag) } }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        /** The stored unread count as it is now (a screen's first frame), without a request. */
        fun unreadCountCopy(): NotificationUnreadCountResponse? = store.peek(StoreKeys.notificationsUnreadCount).data

        /** One zone's first page through the screens' store (fresh 30 seconds; [force] reads now). Later pages use [list]. */
        suspend fun firstPageStored(
            limit: Int,
            unreadOnly: Boolean?,
            context: String?,
            force: Boolean,
        ): Stored<NotificationsListResponse> =
            store.read(StoreKeys.notificationsFirstPage(limit, unreadOnly, context), force) { etag ->
                conditionalApiCall { api.listConditional(limit, 0, unreadOnly, context, etag) }
            }

        /** That first page as it is stored now, without a request. */
        fun firstPageCopy(
            limit: Int,
            unreadOnly: Boolean?,
            context: String?,
        ): NotificationsListResponse? = store.peek(StoreKeys.notificationsFirstPage(limit, unreadOnly, context)).data

        /** An own edit to the notifications (read, all read, deleted): the lists and the bell read again. */
        private fun <T> NetworkResult<T>.notificationsChanged(): NetworkResult<T> =
            also { if (it is NetworkResult.Success) store.markStale(StoreTopics.NOTIFICATIONS) }

        suspend fun markRead(id: String): NetworkResult<NotificationActionEcho> = safeApiCall { api.markRead(id) }.notificationsChanged()

        /**
         * `POST /api/notifications/read-all` — route
         * `backend/routes/notifications.js:412`. Pass `contexts` to keep the
         * sweep inside the zone the user is looking at; null clears all.
         */
        suspend fun markAllRead(contexts: List<String>? = null): NetworkResult<NotificationActionEcho> =
            safeApiCall {
                if (contexts.isNullOrEmpty()) {
                    api.markAllRead()
                } else {
                    api.markAllReadInContexts(MarkAllNotificationsReadBody(contexts = contexts))
                }
            }.notificationsChanged()

        /** `DELETE /api/notifications/:id` — route `backend/routes/notifications.js:452`. */
        suspend fun delete(id: String): NetworkResult<NotificationActionEcho> = safeApiCall { api.delete(id) }.notificationsChanged()

        /**
         * Register the device's FCM token with the backend. Mirrors
         * `APIClient.shared.registerPushToken(_:platform:)` on iOS —
         * fire-and-forget from the caller's perspective; failures stay
         * inside the returned [NetworkResult] so the syncer can retry.
         *
         * Route backend/routes/notifications.js:269
         */
        suspend fun registerPushToken(
            token: String,
            platform: String,
            deviceId: String? = null,
        ): NetworkResult<Unit> =
            safeApiCall {
                legacyApi.registerPushToken(RegisterPushTokenRequest(token = token, platform = platform, deviceId = deviceId))
            }
    }
