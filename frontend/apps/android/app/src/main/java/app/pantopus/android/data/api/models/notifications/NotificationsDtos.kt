package app.pantopus.android.data.api.models.notifications

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Single row from `/api/notifications`. */
@JsonClass(generateAdapter = true)
data class NotificationDto(
    val id: String,
    @Json(name = "user_id") val userId: String?,
    val type: String?,
    val title: String?,
    val body: String?,
    val icon: String?,
    /**
     * Backend-emitted deep link path, e.g. `/post/abc-123`,
     * `/homes/h_1/dashboard`. DeepLinkRouter parses this.
     */
    val link: String?,
    @Json(name = "is_read") val isRead: Boolean?,
    @Json(name = "created_at") val createdAt: String?,
    val context: String? = null,
)

/** `GET /api/notifications` envelope — route `backend/routes/notifications.js:84`. */
@JsonClass(generateAdapter = true)
data class NotificationsListResponse(
    val notifications: List<NotificationDto> = emptyList(),
    val unreadCount: Int? = null,
    val hasMore: Boolean? = null,
)

/**
 * Per-firewall unread breakdown returned by
 * `GET /api/notifications/unread-count`
 * (`backend/routes/notifications.js:187-193`).
 */
@JsonClass(generateAdapter = true)
data class NotificationContextCounts(
    val personal: Int = 0,
    val audience: Int = 0,
    val platform: Int = 0,
)

/** `GET /api/notifications/unread-count` envelope — route `backend/routes/notifications.js:161`. */
@JsonClass(generateAdapter = true)
data class NotificationUnreadCountResponse(
    val count: Int,
    /** P2.3 split — null on deployments that only returned `count`. */
    val byContext: NotificationContextCounts? = null,
)

/**
 * `POST /api/notifications/read-all` body. The handler accepts
 * `context` / `contexts` / `firewall`; we always send the plural form so
 * the Personal zone (`personal` + `platform`) sweeps in one call — see
 * `backend/routes/notifications.js:26-29`.
 */
@JsonClass(generateAdapter = true)
data class MarkAllNotificationsReadBody(
    val contexts: List<String>,
)

/** Echo of a write call (`/read` / `/read-all`). Both `ok` and `count` are optional on success. */
@JsonClass(generateAdapter = true)
data class NotificationActionEcho(
    val ok: Boolean? = null,
    val count: Int? = null,
)
