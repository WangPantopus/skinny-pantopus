package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * T5.3.3 — One row in `GET /api/posts/user/:userId` (route
 * `backend/routes/posts.js:3016`). Reuses the feed serializer on the
 * backend, so most fields mirror [app.pantopus.android.data.api.models.feed.FeedPost];
 * we add an optional [archivedAt] so the client can model the Archived-tab
 * state locally even though the current backend filters archived rows out
 * of the `/user/:id` response.
 */
@JsonClass(generateAdapter = true)
data class MyPostDto(
    val id: String,
    @Json(name = "user_id") val userId: String,
    val title: String? = null,
    val content: String? = null,
    @Json(name = "post_type") val postType: String? = null,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "like_count") val likeCount: Int = 0,
    @Json(name = "comment_count") val commentCount: Int = 0,
    @Json(name = "userHasLiked") val userHasLiked: Boolean = false,
    @Json(name = "location_name") val locationName: String? = null,
    @Json(name = "event_date") val eventDate: String? = null,
    @Json(name = "event_venue") val eventVenue: String? = null,
    @Json(name = "lost_found_type") val lostFoundType: String? = null,
    /**
     * Local mirror of `archived_at`. The current backend strips this from
     * the `/user/:id` response (the SELECT applies `archived_at IS NULL`),
     * so it always decodes as `null` over the wire today. When the future
     * `GET /api/posts/me?status=archived` lands, the decoder will start
     * populating this field automatically.
     */
    @Json(name = "archived_at") val archivedAt: String? = null,
)

/** Envelope for `GET /api/posts/user/:userId`. */
@JsonClass(generateAdapter = true)
data class MyPostsResponse(
    val posts: List<MyPostDto> = emptyList(),
)

/** Response for `POST /api/posts/:id/archive` and `/unarchive`. */
@JsonClass(generateAdapter = true)
data class PostArchiveResponse(
    val archived: Boolean,
    @Json(name = "archived_at") val archivedAt: String? = null,
)
