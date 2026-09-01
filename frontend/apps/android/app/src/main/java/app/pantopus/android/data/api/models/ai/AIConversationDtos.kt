@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row from `GET /api/ai/conversations` — conversation metadata only.
 * The backend persists no message bodies (continuity rides the OpenAI
 * `response_id` server-side, `backend/services/ai/agentService.js:1003`),
 * so there is no per-conversation messages payload to mirror.
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
