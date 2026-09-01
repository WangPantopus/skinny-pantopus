@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.businessinbox

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Wire shapes for the business-side inbox:
 *  - `GET /api/chat/business/:businessUserId/rooms`
 *    (`backend/routes/chats.js:756` builds the row);
 *  - `GET /api/businesses/:businessId/matched-posts`
 *    (`backend/routes/businesses.js:4380` selects the columns).
 *
 * Mirrors iOS `BusinessInboxDTOs.swift`.
 */
@JsonClass(generateAdapter = true)
data class BusinessInboxRoomsResponse(
    val rooms: List<BusinessInboxRoomDto> = emptyList(),
    val total: Int? = null,
    val totalUnread: Int? = null,
)

/**
 * One room the business identity participates in. The serializer flattens
 * the counterpart onto `other_participant_*` fields rather than nesting a
 * participants array.
 */
@JsonClass(generateAdapter = true)
data class BusinessInboxRoomDto(
    val id: String,
    @Json(name = "room_type") val roomType: String? = null,
    @Json(name = "room_name") val roomName: String? = null,
    @Json(name = "last_message_at") val lastMessageAt: String? = null,
    @Json(name = "last_message_preview") val lastMessagePreview: String? = null,
    @Json(name = "unread_count") val unreadCount: Int? = null,
    @Json(name = "other_participant_name") val otherParticipantName: String? = null,
    @Json(name = "other_participant_username") val otherParticipantUsername: String? = null,
)

@JsonClass(generateAdapter = true)
data class BusinessMatchedPostsResponse(
    val posts: List<BusinessMatchedPostDto> = emptyList(),
    val pagination: BusinessMatchedPostsPageDto? = null,
)

@JsonClass(generateAdapter = true)
data class BusinessMatchedPostsPageDto(
    val page: Int? = null,
    @Json(name = "page_size") val pageSize: Int? = null,
    @Json(name = "total_count") val totalCount: Int? = null,
    @Json(name = "total_pages") val totalPages: Int? = null,
)

/** One neighborhood post whose `matched_business_ids` contains this business. */
@JsonClass(generateAdapter = true)
data class BusinessMatchedPostDto(
    val id: String,
    val title: String? = null,
    val content: String? = null,
    @Json(name = "post_type") val postType: String? = null,
    @Json(name = "like_count") val likeCount: Int? = null,
    @Json(name = "comment_count") val commentCount: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val creator: BusinessMatchedPostCreatorDto? = null,
)

@JsonClass(generateAdapter = true)
data class BusinessMatchedPostCreatorDto(
    val id: String? = null,
    val name: String? = null,
    val username: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)
