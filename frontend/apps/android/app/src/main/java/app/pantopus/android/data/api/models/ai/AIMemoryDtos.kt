@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/ai/memory` (AI assistant phase 3 contract §5.4): what the person asked Pantopus to remember, newest first.
 * Only they see it. [reviewDueAt] is when the yearly "Still right?" comes due (null with no items).
 */
@JsonClass(generateAdapter = true)
data class AIMemoryListResponse(
    val items: List<AIMemoryItemDto> = emptyList(),
    val count: Int? = null,
    val limit: Int? = null,
    @Json(name = "review_due_at") val reviewDueAt: String? = null,
)

/** One remembered thing: a fact in the person's words, or a "Plans you'd like" alert (`kind: plan_alert`). */
@JsonClass(generateAdapter = true)
data class AIMemoryItemDto(
    val id: String,
    val fact: String,
    /** `you`, `household`, `home`, `plans`, `nearby` or `other`. */
    val topic: String? = null,
    /** `fact` (its words can be edited) or `plan_alert`. */
    val kind: String? = null,
    /** Health, children, money and the like: used only when a question is about it. */
    val sensitive: Boolean? = null,
    val home: AIMemoryHomeDto? = null,
    /** False once the person can no longer see the item's home: it isn't used until they delete it. */
    @Json(name = "in_use") val inUse: Boolean? = null,
    /** The chat it was saved from; null once that conversation is deleted. */
    val from: AIMemorySourceDto? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** The home an item is about: its name, else its city. */
@JsonClass(generateAdapter = true)
data class AIMemoryHomeDto(
    val id: String? = null,
    val label: String? = null,
)

@JsonClass(generateAdapter = true)
data class AIMemorySourceDto(
    @Json(name = "conversation_id") val conversationId: String? = null,
    val at: String? = null,
)

/** `PATCH /api/ai/memory/:id`'s answer. */
@JsonClass(generateAdapter = true)
data class AIMemoryItemResponse(
    val item: AIMemoryItemDto,
)

/** `PATCH /api/ai/memory/:id`: a fact item's new words. */
@JsonClass(generateAdapter = true)
data class AIMemoryEditBody(
    val fact: String,
)

/** `DELETE /api/ai/memory` (Forget everything): how many items went. */
@JsonClass(generateAdapter = true)
data class AIMemoryForgetAllResponse(
    val deleted: Int? = null,
)

/** `POST /api/ai/memory/reviewed` ("Looks right"): when the next review comes due. */
@JsonClass(generateAdapter = true)
data class AIMemoryReviewedResponse(
    @Json(name = "review_due_at") val reviewDueAt: String? = null,
)
