@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row from `GET /api/ai/conversations` — conversation metadata only. A
 * conversation's turns come from `GET /api/ai/conversations/:id/messages`
 * ([AIConversationMessagesResponse]).
 */
@JsonClass(generateAdapter = true)
data class AIConversationDto(
    val id: String,
    val title: String? = null,
    @Json(name = "message_count") val messageCount: Int? = null,
    @Json(name = "last_message_at") val lastMessageAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** `GET /api/ai/conversations` envelope. */
@JsonClass(generateAdapter = true)
data class AIConversationsResponse(
    val conversations: List<AIConversationDto>,
)

/**
 * `GET /api/ai/conversations/:id/messages` (`backend/routes/ai.js:365`): a
 * conversation as the thread shows it after a relaunch — the person's
 * messages, the replies, and the drafts as cards.
 */
@JsonClass(generateAdapter = true)
data class AIConversationMessagesResponse(
    val conversationId: String,
    val title: String? = null,
    val messages: List<AIConversationMessageDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class AIConversationMessageDto(
    /** `user` or `assistant`. */
    val role: String,
    val text: String? = null,
    /** How many photos a person's message carried (they aren't kept). */
    val photos: Int? = null,
    /** How many documents (PDFs) a person's message carried; they aren't kept either (AI assistant phase 2). */
    val documents: Int? = null,
    val draft: AIConversationDraftDto? = null,
    /** The reply's buttons to screens of the app (AI assistant phase 1 contract, section 5). */
    val links: List<AIConversationLinkDto>? = null,
    /** The brief or nudge whose first item this is (AI assistant phase 2): `?nudge=<id>` scrolls to it. */
    val nudge: AIConversationNudgeDto? = null,
    /** The same notification id as a flat field, as an earlier draft of the server sent it. */
    @Json(name = "nudge_id") val nudgeId: String? = null,
    /** When it was said (ISO 8601). Older servers leave it out. */
    val at: String? = null,
    /**
     * An action card's state on the server, next to its [draft] (AI assistant phase 3 contract §4.3), for apps that
     * list `state` in `cards`. Null for a card the server has no record of: this phone's own record covers it.
     */
    val state: AICardStateDto? = null,
) {
    /** The notification id of the brief or nudge this item starts, if any. */
    val nudgeNotificationId: String? get() = nudge?.id ?: nudgeId
}

/** Where an action card stands on every phone of the person's (AI assistant phase 3 contract §4.3). */
@JsonClass(generateAdapter = true)
data class AICardStateDto(
    /** `open`, `done`, `dismissed` or `expired` (past its time with nothing done). */
    val status: String? = null,
    /** The buttons that went through, first report first. */
    val done: List<AICardDoneDto>? = null,
)

/** One button that went through on a card: [itemId] names its row, null for the card's own buttons. */
@JsonClass(generateAdapter = true)
data class AICardDoneDto(
    @Json(name = "item_id") val itemId: String? = null,
    @Json(name = "action_id") val actionId: String? = null,
    val at: String? = null,
    /** The done link the phone showed, filled in; null when it had none. */
    val link: String? = null,
)

/**
 * `POST /api/ai/cards/:cardId/state` (AI assistant phase 3 contract §4.2): `done` with the button that went through and
 * the link it showed, or `dismissed` for "Not now".
 */
@JsonClass(generateAdapter = true)
data class AICardStateReportBody(
    val status: String,
    @Json(name = "action_id") val actionId: String? = null,
    @Json(name = "item_id") val itemId: String? = null,
    val link: String? = null,
)

/** A brief or nudge Pantopus sent first: its notification's id and its kind (`brief`, `plan_weather`, …). */
@JsonClass(generateAdapter = true)
data class AIConversationNudgeDto(
    val id: String? = null,
    val kind: String? = null,
)

@JsonClass(generateAdapter = true)
data class AIConversationDraftDto(
    /** `post`, `support_train`, `pickup_schedule`, `action`, … */
    val type: String,
    val draft: Map<String, Any?> = emptyMap(),
)

@JsonClass(generateAdapter = true)
data class AIConversationLinkDto(
    val label: String? = null,
    val url: String? = null,
)
