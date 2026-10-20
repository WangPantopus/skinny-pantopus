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
