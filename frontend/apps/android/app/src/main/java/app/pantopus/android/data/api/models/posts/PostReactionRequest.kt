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
 * A post's one reaction (the like above, counted in `like_count`), named for what it means on that kind of post, the
 * same on web, iPhone and Android and in the author's notice (`backend/utils/postReaction.js`): Going on an event,
 * Celebrate on a win, Helpful on every other kind.
 */
enum class PostReactionKind(
    val key: String,
    /** The button: "Helpful", "Going", "Celebrate". */
    val label: String,
) {
    Helpful(key = "helpful", label = "Helpful"),
    Going(key = "going", label = "Going"),
    Celebrate(key = "celebrate", label = "Celebrate"),
    ;

    /** The count in words: "3 helpful", "2 going", "4 celebrated". */
    fun countText(count: Int): String =
        when (this) {
            Helpful -> "$count helpful"
            Going -> "$count going"
            Celebrate -> "$count celebrated"
        }

    companion object {
        fun fromPostType(postType: String?): PostReactionKind =
            when (postType) {
                "event" -> Going
                "neighborhood_win", "progress_wins" -> Celebrate
                else -> Helpful
            }
    }
}
