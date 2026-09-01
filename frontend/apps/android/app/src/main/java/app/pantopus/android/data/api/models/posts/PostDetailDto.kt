package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Author / business-author projection on a post. Mirrors the
 * `CREATOR_SELECT` columns from `backend/services/feedService.js:60`.
 */
@JsonClass(generateAdapter = true)
data class PostCreatorDto(
    val id: String,
    val username: String?,
    val name: String?,
    @Json(name = "first_name") val firstName: String?,
    @Json(name = "last_name") val lastName: String?,
    @Json(name = "profile_picture_url") val profilePictureUrl: String?,
    val city: String?,
    val state: String?,
    @Json(name = "account_type") val accountType: String?,
) {
    /** Best-effort display name across the various populated fields. */
    val displayName: String
        get() {
            if (!name.isNullOrEmpty()) return name
            val combined = listOfNotNull(firstName, lastName).filter { it.isNotEmpty() }.joinToString(" ")
            if (combined.isNotEmpty()) return combined
            if (!username.isNullOrEmpty()) return "@$username"
            return "Pantopus user"
        }

    /** "City, ST" if both, else city, else state, else null. */
    val locality: String?
        get() =
            when {
                !city.isNullOrEmpty() && !state.isNullOrEmpty() -> "$city, $state"
                !city.isNullOrEmpty() -> city
                !state.isNullOrEmpty() -> state
                else -> null
            }
}

/** Home reference attached to a post. */
@JsonClass(generateAdapter = true)
data class PostHomeRefDto(
    val id: String,
    val address: String?,
    val city: String?,
    val state: String?,
)

/**
 * A single comment on a post. Route reference:
 * `backend/routes/posts.js:2157`.
 */
@JsonClass(generateAdapter = true)
data class PostCommentDto(
    val id: String,
    @Json(name = "post_id") val postId: String,
    @Json(name = "user_id") val userId: String,
    @Json(name = "parent_comment_id") val parentCommentId: String?,
    val comment: String,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "is_deleted") val isDeleted: Boolean,
    val userHasLiked: Boolean? = null,
    @Json(name = "like_count") val likeCount: Int? = null,
    val author: PostCreatorDto? = null,
)

/** `GET /api/posts/:id` envelope — see `backend/routes/posts.js:2142`. */
@JsonClass(generateAdapter = true)
data class PostDetailResponse(
    val post: PostDetailDto,
)

/**
 * Post detail — union of columns the handler selects. List endpoints
 * project a smaller subset, so most fields are optional / nullable.
 */
@JsonClass(generateAdapter = true)
data class PostDetailDto(
    val id: String,
    @Json(name = "user_id") val userId: String,
    val title: String?,
    val content: String,
    @Json(name = "post_type") val postType: String?,
    @Json(name = "post_format") val postFormat: String?,
    val purpose: String?,
    @Json(name = "media_urls") val mediaUrls: List<String> = emptyList(),
    @Json(name = "media_types") val mediaTypes: List<String>? = null,
    @Json(name = "media_thumbnails") val mediaThumbnails: List<String> = emptyList(),
    @Json(name = "media_live_urls") val mediaLiveUrls: List<String> = emptyList(),
    @Json(name = "location_name") val locationName: String? = null,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "is_edited") val isEdited: Boolean? = null,
    @Json(name = "like_count") val likeCount: Int = 0,
    @Json(name = "comment_count") val commentCount: Int = 0,
    @Json(name = "share_count") val shareCount: Int? = null,
    @Json(name = "view_count") val viewCount: Int? = null,
    val creator: PostCreatorDto? = null,
    val home: PostHomeRefDto? = null,
    val userHasLiked: Boolean = false,
    val userHasSaved: Boolean = false,
    val userHasReposted: Boolean = false,
    val comments: List<PostCommentDto> = emptyList(),
    // Edit-mode prefill fields — see iOS PostDetailDTO parity.
    val visibility: String? = null,
    @Json(name = "event_date") val eventDate: String? = null,
    @Json(name = "event_venue") val eventVenue: String? = null,
    @Json(name = "lost_found_type") val lostFoundType: String? = null,
    @Json(name = "service_category") val serviceCategory: String? = null,
    @Json(name = "deal_business_name") val dealBusinessName: String? = null,
)
