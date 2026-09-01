package app.pantopus.android.data.api.models.mailbox

import app.pantopus.android.data.api.models.common.JsonArrayValue
import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Core mail row — shared between the list and detail responses. Route
 * citations: `backend/routes/mailbox.js:1306` (list), `:1466` (detail).
 */
@JsonClass(generateAdapter = true)
data class MailItem(
    val id: String,
    @Json(name = "recipient_user_id") val recipientUserId: String?,
    @Json(name = "recipient_home_id") val recipientHomeId: String?,
    @Json(name = "delivery_target_type") val deliveryTargetType: String?,
    @Json(name = "delivery_target_id") val deliveryTargetId: String?,
    @Json(name = "address_home_id") val addressHomeId: String?,
    @Json(name = "attn_user_id") val attnUserId: String?,
    @Json(name = "attn_label") val attnLabel: String?,
    @Json(name = "delivery_visibility") val deliveryVisibility: String?,
    @Json(name = "mail_type") val mailType: String?,
    @Json(name = "display_title") val displayTitle: String?,
    @Json(name = "preview_text") val previewText: String?,
    @Json(name = "primary_action") val primaryAction: String?,
    @Json(name = "action_required") val actionRequired: Boolean?,
    @Json(name = "ack_required") val ackRequired: Boolean?,
    @Json(name = "ack_status") val ackStatus: String?,
    val type: String,
    val subject: String?,
    val content: String?,
    @Json(name = "sender_user_id") val senderUserId: String?,
    @Json(name = "sender_business_name") val senderBusinessName: String?,
    @Json(name = "sender_address") val senderAddress: String?,
    val viewed: Boolean = false,
    @Json(name = "viewed_at") val viewedAt: String?,
    val archived: Boolean = false,
    val starred: Boolean = false,
    @Json(name = "payout_amount") val payoutAmount: Double?,
    @Json(name = "payout_status") val payoutStatus: String?,
    val category: String?,
    val tags: List<String> = emptyList(),
    val priority: String = "normal",
    val attachments: List<String>?,
    @Json(name = "expires_at") val expiresAt: String?,
    @Json(name = "created_at") val createdAt: String,
)

/** `GET /api/mailbox` envelope — route `backend/routes/mailbox.js:1306`. */
@JsonClass(generateAdapter = true)
data class MailboxListResponse(
    val mail: List<MailItem>,
    val count: Int,
)

/** `GET /api/mailbox/:id` envelope — route `backend/routes/mailbox.js:1466`. */
@JsonClass(generateAdapter = true)
data class MailDetailResponse(
    val mail: MailDetail,
)

/**
 * Detail payload returned by `GET /api/mailbox/:id`. The backend response
 * inlines every [MailItem] field plus the typed sender + object + links.
 * The DTO captures the per-detail extras explicitly; T6.5b adds the
 * full per-item field set so the generic A17.1 detail can wire every
 * shell slot without a second round-trip.
 */
@JsonClass(generateAdapter = true)
data class MailDetail(
    val id: String,
    val type: String,
    @Json(name = "mail_type") val mailType: String? = null,
    @Json(name = "display_title") val displayTitle: String? = null,
    @Json(name = "preview_text") val previewText: String? = null,
    val subject: String? = null,
    val content: String? = null,
    @Json(name = "sender_business_name") val senderBusinessName: String? = null,
    @Json(name = "sender_address") val senderAddress: String? = null,
    @Json(name = "sender_user_id") val senderUserId: String? = null,
    /**
     * `Mail.sender_trust` — `verified_gov` / `verified_utility` /
     * `verified_business` / `pantopus_user` / `unknown`
     * (`backend/database/schema.sql:7207`).
     */
    @Json(name = "sender_trust") val senderTrust: String? = null,
    /**
     * Free-text `Mail.category` (`bill` / `legal` / `notice` / `receipt` /
     * `community` / `promo` / `other`). Distinct from [mailType]; drives the
     * A17.1 per-category ACTIONS row.
     */
    val category: String? = null,
    @Json(name = "ack_required") val ackRequired: Boolean? = null,
    @Json(name = "ack_status") val ackStatus: String? = null,
    val viewed: Boolean = false,
    @Json(name = "viewed_at") val viewedAt: String? = null,
    val archived: Boolean = false,
    val attachments: List<String>? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "created_at") val createdAt: String,
    val sender: Sender?,
    val `object`: JsonValue?,
    @Json(name = "content_format") val contentFormat: String?,
    val links: JsonArrayValue = emptyList(),
    /**
     * `Mail.mail_extracted` (jsonb, `backend/database/schema.sql:7201`).
     * Compose writes the ceremonial metadata here at send time —
     * `stationeryTheme` / `inkSelection` / `voicePostscriptUri` /
     * `outcomes` (`backend/routes/mailbox.js:586-603`, persisted at `:2017`).
     * It is the V1 detail route's copy of the same values the V2 item route
     * exposes under `object_payload`, and the backend itself falls back to
     * it (`backend/routes/mailCompose.js:556`).
     */
    @Json(name = "mail_extracted") val mailExtracted: JsonValue? = null,
) {
    /**
     * Stationery theme when this mail came out of the Ceremonial Mail
     * compose flow — the signal RN uses to redirect the generic detail into
     * the ceremonial open experience (`src/app/mailbox/detail.tsx:43-49`).
     * Null for ordinary mail.
     */
    val stationeryTheme: String?
        get() = (mailExtracted?.get("stationeryTheme") as? String)?.takeIf { it.isNotEmpty() }

    @JsonClass(generateAdapter = true)
    data class Sender(
        val id: String,
        val username: String,
        val name: String,
    )
}

/** `PATCH /api/mailbox/:id/ack` response — route `backend/routes/mailbox.js:2702`. */
@JsonClass(generateAdapter = true)
data class AckResponse(
    val message: String,
    val ackStatus: String,
)
