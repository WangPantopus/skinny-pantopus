package app.pantopus.android.data.api.models.feed

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row in `GET /api/posts/feed` (route `backend/routes/posts.js:1449`).
 * The backend serializer projects every `Post` column the feed needs; we
 * keep the fields the Pulse UI actually reads.
 */
@JsonClass(generateAdapter = true)
data class FeedPost(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    val title: String? = null,
    val content: String? = null,
    @Json(name = "post_type") val postType: String? = null,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "like_count") val likeCount: Int = 0,
    @Json(name = "comment_count") val commentCount: Int = 0,
    @Json(name = "share_count") val shareCount: Int = 0,
    @Json(name = "userHasLiked") val userHasLiked: Boolean = false,
    @Json(name = "userHasSaved") val userHasSaved: Boolean = false,
    @Json(name = "userHasReposted") val userHasReposted: Boolean = false,
    /** Lifecycle state — `open` / `solved` (`backend/services/feedService.js:234`). */
    val state: String? = null,
    /**
     * True for cold-start neighborhood facts injected by the feed handler
     * (`backend/routes/posts.js:84`). Those rows are dismissable, never
     * reportable.
     */
    @Json(name = "is_seeded") val isSeeded: Boolean = false,
    /** Set when the post was authored as a business (`feedService.js:115`). */
    @Json(name = "business_author_id") val businessAuthorId: String? = null,
    @Json(name = "location_name") val locationName: String? = null,
    @Json(name = "event_date") val eventDate: String? = null,
    @Json(name = "event_venue") val eventVenue: String? = null,
    @Json(name = "lost_found_type") val lostFoundType: String? = null,
    @Json(name = "media_urls") val mediaUrls: List<String> = emptyList(),
    @Json(name = "media_thumbnails") val mediaThumbnails: List<String> = emptyList(),
    @Json(name = "media_types") val mediaTypes: List<String> = emptyList(),
    @Json(name = "media_live_urls") val mediaLiveUrls: List<String> = emptyList(),
    val creator: FeedPostCreator? = null,
)

/**
 * Author projection on a feed post. Mirrors the iOS `PostCreatorDTO`
 * shape and SAFE_CREATOR_SELECT + identity-author attachment.
 */
@JsonClass(generateAdapter = true)
data class FeedPostCreator(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    @Json(name = "displayName") val authorDisplayName: String? = null,
    val handle: String? = null,
    @Json(name = "avatarUrl") val avatarUrl: String? = null,
    val type: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "account_type") val accountType: String? = null,
) {
    /** Best-effort display name across legacy and identity-projection fields. */
    fun displayName(): String {
        val combined = listOfNotNull(firstName, lastName).filter { it.isNotEmpty() }.joinToString(" ")
        return authorDisplayName?.takeIf { it.isNotEmpty() }
            ?: name?.takeIf { it.isNotEmpty() }
            ?: combined.takeIf { it.isNotEmpty() }
            ?: username?.takeIf { it.isNotEmpty() }?.let { "@$it" }
            ?: handle?.takeIf { it.isNotEmpty() }?.let { "@$it" }
            ?: "Pantopus user"
    }
}

/** Paging envelope returned by `GET /api/posts/feed`. */
@JsonClass(generateAdapter = true)
data class FeedPagination(
    val nextCursor: FeedCursor? = null,
    val hasMore: Boolean? = null,
)

/** Keyset cursor returned by the v1.1 feed API. */
@JsonClass(generateAdapter = true)
data class FeedCursor(
    val createdAt: String,
    val id: String,
    val rankBucket: Int? = null,
)

/** `GET /api/posts/feed` response envelope. */
@JsonClass(generateAdapter = true)
data class FeedResponse(
    val posts: List<FeedPost>,
    val pagination: FeedPagination? = null,
)

/**
 * Push-token registration request (kept from legacy ApiService).
 * [deviceId] (persistent login, CONTRACT §"Device descriptor") links the
 * `PushToken` row to the trusted-device row so a device revoke / local
 * logout can delete exactly this device's tokens; the backend also reads
 * the `X-Device-Id` header when the body omits it.
 */
@JsonClass(generateAdapter = true)
data class RegisterPushTokenRequest(
    val token: String,
    val platform: String,
    val deviceId: String? = null,
)
