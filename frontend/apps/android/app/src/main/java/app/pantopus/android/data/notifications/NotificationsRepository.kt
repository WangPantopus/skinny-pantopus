package app.pantopus.android.data.notifications

import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.feed.RegisterPushTokenRequest
import app.pantopus.android.data.api.models.notifications.MarkAllNotificationsReadBody
import app.pantopus.android.data.api.models.notifications.NotificationActionEcho
import app.pantopus.android.data.api.models.notifications.NotificationUnreadCountResponse
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.NotificationsApi
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

        suspend fun unreadCount(): NetworkResult<NotificationUnreadCountResponse> = safeApiCall { api.unreadCount() }

        suspend fun markRead(id: String): NetworkResult<NotificationActionEcho> = safeApiCall { api.markRead(id) }

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
            }

        /** `DELETE /api/notifications/:id` — route `backend/routes/notifications.js:452`. */
        suspend fun delete(id: String): NetworkResult<NotificationActionEcho> = safeApiCall { api.delete(id) }

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
        ): NetworkResult<Unit> =
            safeApiCall {
                legacyApi.registerPushToken(RegisterPushTokenRequest(token = token, platform = platform))
            }
    }
