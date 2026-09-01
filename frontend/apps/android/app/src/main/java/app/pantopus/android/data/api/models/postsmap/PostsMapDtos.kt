package app.pantopus.android.data.api.models.postsmap

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET /api/posts/map` — route `backend/routes/posts.js:1646`.
 *
 * The handler emits one heterogeneous `markers[]` array whose rows carry
 * a `layer_type` discriminator; the field set differs per layer, so every
 * layer-specific field is nullable here and the consumer switches on
 * [PostsMapMarkerDto.layerType].
 */
@JsonClass(generateAdapter = true)
data class PostsMapResponse(
    @Json(name = "markers") val markers: List<PostsMapMarkerDto> = emptyList(),
    /**
     * Non-null only when the viewport came back empty — the backend runs
     * `find_nearest_activity_center` and hands back a coordinate the
     * client can offer to jump to (`backend/routes/posts.js:1854`).
     */
    @Json(name = "nearest_activity_center") val nearestActivityCenter: PostsMapCenterDto? = null,
)

/** Fallback coordinate for an empty viewport. */
@JsonClass(generateAdapter = true)
data class PostsMapCenterDto(
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
)

/** Marker author — present on the `post` / `task` / `offer` layers. */
@JsonClass(generateAdapter = true)
data class PostsMapCreatorDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "username") val username: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/**
 * One marker row. [layerType] is the discriminator (`post` / `task` /
 * `offer` / `business` / `home`); everything past [longitude] is
 * layer-specific.
 */
@Suppress("LongParameterList")
@JsonClass(generateAdapter = true)
data class PostsMapMarkerDto(
    @Json(name = "layer_type") val layerType: String = "post",
    @Json(name = "id") val id: String,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    // post layer — backend/routes/posts.js:1690
    @Json(name = "title") val title: String? = null,
    @Json(name = "post_type") val postType: String? = null,
    @Json(name = "post_as") val postAs: String? = null,
    @Json(name = "audience") val audience: String? = null,
    @Json(name = "content") val content: String? = null,
    @Json(name = "location_name") val locationName: String? = null,
    @Json(name = "home_address") val homeAddress: String? = null,
    @Json(name = "like_count") val likeCount: Int? = null,
    @Json(name = "comment_count") val commentCount: Int? = null,
    @Json(name = "userHasLiked") val userHasLiked: Boolean? = null,
    @Json(name = "userHasSaved") val userHasSaved: Boolean? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "creator") val creator: PostsMapCreatorDto? = null,
    // task / offer layers — backend/routes/posts.js:1730 and :1765
    @Json(name = "description") val description: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "locationUnlocked") val locationUnlocked: Boolean? = null,
    // business layer — backend/routes/posts.js:1793
    @Json(name = "business_name") val businessName: String? = null,
    @Json(name = "address") val address: String? = null,
    @Json(name = "logo_url") val logoUrl: String? = null,
    @Json(name = "is_verified") val isVerified: Boolean? = null,
    // home layer — backend/routes/posts.js:1833
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "home_type") val homeType: String? = null,
)
