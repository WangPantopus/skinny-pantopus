package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.notifications.MarkAllNotificationsReadBody
import app.pantopus.android.data.api.models.notifications.NotificationActionEcho
import app.pantopus.android.data.api.models.notifications.NotificationUnreadCountResponse
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** T4.1 notifications routes from `backend/routes/notifications.js`. */
interface NotificationsApi {
    /**
     * `GET /api/notifications` — route `backend/routes/notifications.js:85`.
     *
     * `context` is the P2.3 identity-firewall filter, validated server-side
     * against `all | personal | audience | platform`
     * (`backend/routes/notifications.js:21-22, 97-104`) — a typo 400s, so
     * only pass a `NotificationContext` value.
     */
    @GET("api/notifications")
    suspend fun list(
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
        @Query("unread") unreadOnly: Boolean? = null,
        @Query("context") context: String? = null,
    ): NotificationsListResponse

    /**
     * `GET /api/notifications/unread-count` — route
     * `backend/routes/notifications.js:160`. Drives the bell badge.
     */
    @GET("api/notifications/unread-count")
    suspend fun unreadCount(): NotificationUnreadCountResponse

    /**
     * `PATCH /api/notifications/:id/read` — route
     * `backend/routes/notifications.js:330`. Marks one row as read.
     */
    @PATCH("api/notifications/{id}/read")
    suspend fun markRead(
        @Path("id") id: String,
    ): NotificationActionEcho

    /**
     * `POST /api/notifications/read-all` — route
     * `backend/routes/notifications.js:412`. Sweeps every unread row
     * for the current user, across every firewall zone.
     */
    @POST("api/notifications/read-all")
    suspend fun markAllRead(): NotificationActionEcho

    /**
     * `POST /api/notifications/read-all` scoped to one or more firewall
     * contexts — route `backend/routes/notifications.js:412`, body parsed
     * by `parseFirewallFilter(req, allowMultiple)` at
     * `backend/routes/notifications.js:25-44`. Keeps "Mark all read" in
     * the Personal zone from clearing the Beacon stream.
     */
    @POST("api/notifications/read-all")
    suspend fun markAllReadInContexts(
        @Body body: MarkAllNotificationsReadBody,
    ): NotificationActionEcho

    /**
     * `DELETE /api/notifications/:id` — route
     * `backend/routes/notifications.js:452`. Deletes one notification
     * owned by the current user.
     */
    @DELETE("api/notifications/{id}")
    suspend fun delete(
        @Path("id") id: String,
    ): NotificationActionEcho
}
