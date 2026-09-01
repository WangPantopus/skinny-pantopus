package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.JsonClass

/**
 * Response payload for `POST /api/posts/:id/like`. Route:
 * `backend/routes/posts.js:2375`.
 */
@JsonClass(generateAdapter = true)
data class PostLikeResponse(
    val message: String? = null,
    val liked: Boolean,
    val likeCount: Int,
)

/**
 * UI-only reaction kinds. The design draws three, but only `Helpful`
 * maps to a backend route today; `Heart` and `Going` raise a "coming
 * soon" toast until multi-reaction support lands server-side.
 */
enum class PostReactionKind(val accessibilityLabel: String, val isBackendWired: Boolean) {
    Helpful(accessibilityLabel = "Helpful", isBackendWired = true),
    Heart(accessibilityLabel = "Loved", isBackendWired = false),
    Going(accessibilityLabel = "Going", isBackendWired = false),
}
