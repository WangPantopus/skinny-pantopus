package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/posts/precheck`
 * (`backend/routes/posts.js:709` destructures exactly these keys).
 */
@JsonClass(generateAdapter = true)
data class PostPrecheckRequest(
    val content: String,
    val postType: String? = null,
    val purpose: String? = null,
    val surface: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/**
 * Response from `POST /api/posts/precheck`
 * (`backend/routes/posts.js:809-816`).
 */
@JsonClass(generateAdapter = true)
data class PostPrecheckResponse(
    val ok: Boolean? = null,
    /**
     * False only while a `cooldown_1h` / `cooldown_24h` restriction is
     * live (`backend/routes/posts.js:811`).
     */
    val canPost: Boolean? = null,
    val cooldown: PostPrecheckCooldown? = null,
    val flags: List<PostPrecheckFlag>? = null,
    val suggestions: List<PostPrecheckSuggestion>? = null,
    val isVisitor: Boolean? = null,
) {
    /**
     * RN surfaces the first suggestion, then the first flag —
     * `usePostComposer.ts:186`.
     */
    val primaryNudge: String?
        get() =
            suggestions?.firstOrNull { !it.message.isNullOrBlank() }?.message
                ?: flags?.firstOrNull { !it.message.isNullOrBlank() }?.message
}

/** Active posting restriction row from `UserPostingCooldown`. */
@JsonClass(generateAdapter = true)
data class PostPrecheckCooldown(
    @Json(name = "restriction_level") val restrictionLevel: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    val reason: String? = null,
)

/** Hard signal (`cooldown`, `callout_risk`). */
@JsonClass(generateAdapter = true)
data class PostPrecheckFlag(
    val type: String? = null,
    val level: String? = null,
    val message: String? = null,
    val suggestedAction: String? = null,
    val expiresAt: String? = null,
)

/**
 * Soft nudge (`tone_check`, `politics_in_nearby`, `intent_mismatch`,
 * `visitor_context`).
 */
@JsonClass(generateAdapter = true)
data class PostPrecheckSuggestion(
    val type: String? = null,
    val message: String? = null,
    val suggestedAction: String? = null,
    val suggestedIntents: List<String>? = null,
)
