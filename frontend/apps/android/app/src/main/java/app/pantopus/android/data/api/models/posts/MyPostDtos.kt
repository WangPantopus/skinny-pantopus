package app.pantopus.android.data.api.models.posts

import app.pantopus.android.data.api.models.feed.FeedPagination
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * T5.3.3 — One row in `GET /api/posts/user/:userId` (route
 * `backend/routes/posts.js:3016`). Reuses the feed serializer on the
 * backend, so most fields mirror [app.pantopus.android.data.api.models.feed.FeedPost];
 * [archivedAt] splits the rows into the Active and Archived tabs (My posts
 * asks for its archived posts with `include_archived=true`).
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
    /** `archived_at`; set on the owner's archived posts (`include_archived=true`). */
    @Json(name = "archived_at") val archivedAt: String? = null,
    /** Who wrote it; the Saved tab's rows (other people's posts) name the author. */
    val author: PostAuthorBriefDto? = null,
)

/** The author field a saved-post row shows (`author.displayName` on `GET /api/posts/saved`). */
@JsonClass(generateAdapter = true)
data class PostAuthorBriefDto(
    val displayName: String? = null,
)

/** Offset paging of `GET /api/posts/saved`: offsets count saves, so a short page isn't the end. */
@JsonClass(generateAdapter = true)
data class SavedPostsPagination(
    val nextOffset: Int? = null,
    val hasMore: Boolean? = null,
)

/** Envelope for `GET /api/posts/saved`: the viewer's saved posts they can still open, newest save first. */
@JsonClass(generateAdapter = true)
data class SavedPostsResponse(
    val posts: List<MyPostDto> = emptyList(),
    val pagination: SavedPostsPagination? = null,
)

/** Envelope for `GET /api/posts/user/:userId`. */
@JsonClass(generateAdapter = true)
data class MyPostsResponse(
    val posts: List<MyPostDto> = emptyList(),
    val pagination: FeedPagination? = null,
)

/** Response for `POST /api/posts/:id/archive` and `/unarchive`. */
@JsonClass(generateAdapter = true)
data class PostArchiveResponse(
    val archived: Boolean,
    @Json(name = "archived_at") val archivedAt: String? = null,
)
