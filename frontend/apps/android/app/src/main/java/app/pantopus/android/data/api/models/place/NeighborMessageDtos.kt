package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `/api/neighbor-messages/[*]` — verified-only (T4),
 * template-only neighbor heads-ups. Route:
 * `backend/routes/neighborMessages.js`. Mirrors
 * `frontend/packages/api/src/endpoints/neighborMessages.ts` and the iOS
 * `NeighborMessageDTOs.swift`.
 *
 * Trust-and-safety model (baked into the API): the template catalog is
 * the single source of truth (no free text anywhere); the recipient
 * never learns the sender ("a verified neighbor nearby"); reply is
 * templated; report / not-helpful / block never notify the sender.
 */

/** An outbound, pre-written note. `icon` maps to a lucide icon name. */
@JsonClass(generateAdapter = true)
data class NeighborMessageTemplate(
    val id: String,
    val icon: String,
    val category: String,
    val body: String,
)

/** A templated quick-reply (anonymous both ways). */
@JsonClass(generateAdapter = true)
data class NeighborReplyTemplate(
    val id: String,
    val body: String,
)

/** `GET /api/neighbor-messages/templates` response. */
@JsonClass(generateAdapter = true)
data class NeighborMessageTemplates(
    val templates: List<NeighborMessageTemplate> = emptyList(),
    val replies: List<NeighborReplyTemplate> = emptyList(),
)

/** The anonymized sender label — never an identity. */
@JsonClass(generateAdapter = true)
data class NeighborMessageSender(
    val label: String,
    @Json(name = "block_label") val blockLabel: String,
    val verified: Boolean,
)

@JsonClass(generateAdapter = true)
data class NeighborMessageReply(
    @Json(name = "template_id") val templateId: String,
    val body: String,
    @Json(name = "replied_at") val repliedAt: String? = null,
)

/** Recipient-facing view of a received message. No sender identity. */
@JsonClass(generateAdapter = true)
data class ReceivedNeighborMessage(
    val id: String,
    val category: String,
    val body: String,
    @Json(name = "created_at") val createdAt: String,
    val sender: NeighborMessageSender,
    val reply: NeighborMessageReply? = null,
    @Json(name = "can_reply") val canReply: Boolean,
    @Json(name = "not_helpful") val notHelpful: Boolean,
    val reported: Boolean,
    @Json(name = "read_at") val readAt: String? = null,
)

/** `GET /api/neighbor-messages/received` envelope. */
@JsonClass(generateAdapter = true)
data class ReceivedNeighborMessagesResponse(
    val messages: List<ReceivedNeighborMessage> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class SentNeighborMessageRecipient(
    val label: String,
    @Json(name = "block_label") val blockLabel: String,
)

/** Sender-facing confirmation after a successful send. */
@JsonClass(generateAdapter = true)
data class SentNeighborMessage(
    val id: String? = null,
    @Json(name = "template_id") val templateId: String,
    val category: String,
    val body: String,
    @Json(name = "created_at") val createdAt: String,
    /** Always "sent". */
    val status: String,
    val recipient: SentNeighborMessageRecipient,
)

/** `POST /api/neighbor-messages` body. */
@JsonClass(generateAdapter = true)
data class SendNeighborMessageRequest(
    @Json(name = "sender_home_id") val senderHomeId: String,
    @Json(name = "recipient_home_id") val recipientHomeId: String,
    @Json(name = "template_id") val templateId: String,
)

/** `POST /api/neighbor-messages/:id/reply` body. */
@JsonClass(generateAdapter = true)
data class ReplyNeighborMessageRequest(
    @Json(name = "reply_template_id") val replyTemplateId: String,
)

/** `POST /api/neighbor-messages/:id/report` body. */
@JsonClass(generateAdapter = true)
data class ReportNeighborMessageRequest(
    val reason: String? = null,
)

/** `{ success: true }` acknowledgements (not-helpful / report / block). */
@JsonClass(generateAdapter = true)
data class NeighborMessageAck(
    val success: Boolean,
)
