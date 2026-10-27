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
    /** `"post"` when the person tapped Post: the answer adds [PostPrecheckResponse.findings]. */
    val stage: String? = null,
    val title: String? = null,
    val safetyAlertKind: String? = null,
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
    /**
     * What the kindness and safety check found (`stage: "post"` only), most
     * important first (AI phase 2 contract §6.6). Empty: post at once.
     */
    val findings: List<PostPrecheckFinding>? = null,
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

/**
 * One thing the check before posting found: [kind] is `heads_up_kind`, `tone`,
 * `phone` or `address`; [message] is the server's sentence.
 */
@JsonClass(generateAdapter = true)
data class PostPrecheckFinding(
    val kind: String,
    val message: String,
    val text: String? = null,
)

/** Response from `GET /api/posts/before-you-ask` (AI phase 2 contract §6.5). */
@JsonClass(generateAdapter = true)
data class BeforeYouAskResponse(
    val posts: List<EarlierPostDto> = emptyList(),
)

/** An earlier question or recommendation nearby, with its best reply. */
@JsonClass(generateAdapter = true)
data class EarlierPostDto(
    @Json(name = "post_id") val postId: String,
    /** `ask_local` or `recommendation`. */
    val type: String,
    val title: String? = null,
    val body: String? = null,
    val solved: Boolean? = null,
    @Json(name = "reply_count") val replyCount: Int? = null,
    @Json(name = "best_reply") val bestReply: EarlierReplyDto? = null,
)

/** The reply the asker marked Helpful, else the most liked one. */
@JsonClass(generateAdapter = true)
data class EarlierReplyDto(
    val text: String? = null,
    val helpful: Boolean? = null,
    val likes: Int? = null,
)
