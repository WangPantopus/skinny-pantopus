@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Mail-Day triage DTOs (A11 "mail day").
 *
 * The triage list comes from `GET /api/mailbox/v2/pending`
 * (`backend/routes/mailboxV2.js:612`), which returns unresolved
 * `MailRoutingQueue` rows with the related `Mail` row embedded under the
 * `Mail` key (`select('*, Mail!inner(*)')`). Routing actions go through
 * `POST /route` (`mailboxV2.js:488`), `POST /resolve` (reused from
 * [ResolveRoutingRequest]), and `POST /event` (`mailboxV2.js:1007`).
 */

/** Envelope for `GET /api/mailbox/v2/pending`. */
@JsonClass(generateAdapter = true)
data class PendingResponse(
    val pending: List<PendingItemDto> = emptyList(),
)

/** One unresolved `MailRoutingQueue` row + its embedded `Mail`. */
@JsonClass(generateAdapter = true)
data class PendingItemDto(
    @Json(name = "mail_id") val mailId: String,
    @Json(name = "recipient_name_raw") val recipientNameRaw: String? = null,
    @Json(name = "best_match_user_id") val bestMatchUserId: String? = null,
    @Json(name = "best_match_confidence") val bestMatchConfidence: Double? = null,
    @Json(name = "Mail") val mail: PendingMailDto? = null,
)

/**
 * The subset of the embedded `Mail` row the triage card renders. Moshi
 * ignores the other `Mail.*` columns returned by the `*` projection.
 */
@JsonClass(generateAdapter = true)
data class PendingMailDto(
    val subject: String? = null,
    val content: String? = null,
    @Json(name = "preview_text") val previewText: String? = null,
    @Json(name = "sender_display") val senderDisplay: String? = null,
    @Json(name = "sender_business_name") val senderBusinessName: String? = null,
    val category: String? = null,
    @Json(name = "mail_object_type") val mailObjectType: String? = null,
)

/** Body for `POST /api/mailbox/v2/route` (`mailboxV2.js:488`). */
@JsonClass(generateAdapter = true)
data class RouteMailRequest(
    val mailId: String,
)

/**
 * Response for `POST /api/mailbox/v2/route`. Auto-route returns
 * `routed=true` with `drawer`; a disambiguation-needed result returns
 * `routed=false` with the best-match hints.
 */
@JsonClass(generateAdapter = true)
data class RouteMailResponse(
    val routed: Boolean = false,
    val drawer: String? = null,
    val confidence: Double? = null,
    val method: String? = null,
    val bestMatchUserId: String? = null,
    val bestMatchName: String? = null,
)

/** Body for `POST /api/mailbox/v2/event` (`mailboxV2.js:1007`). */
@JsonClass(generateAdapter = true)
data class LogEventRequest(
    val eventType: String,
    val mailId: String? = null,
    val metadata: Map<String, String>? = null,
)

/** Response for `POST /api/mailbox/v2/event` (`{ logged: true }`). */
@JsonClass(generateAdapter = true)
data class LogEventResponse(
    val logged: Boolean = false,
)
