package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `POST /api/posts` request body. Mirrors `createPostSchema` at
 * `backend/routes/posts.js:196-300`. Every optional field is nullable
 * so Moshi can drop it from the wire when the compose form doesn't
 * surface it — the backend's Joi schema rejects unexpected `null`s on
 * several keys, so we send `null` only where it's explicitly accepted.
 */
@JsonClass(generateAdapter = true)
data class PostCreateRequest(
    val content: String,
    val title: String? = null,
    @Json(name = "postType") val postType: String,
    val visibility: String,
    @Json(name = "postAs") val postAs: String,
    @Json(name = "mediaUrls") val mediaUrls: List<String>? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "locationName") val locationName: String? = null,
    // Instagram-style place tag (venue picked in the PlacePickerSheet).
    @Json(name = "locationAddress") val locationAddress: String? = null,
    @Json(name = "geocodeProvider") val geocodeProvider: String? = null,
    @Json(name = "geocodeAccuracy") val geocodeAccuracy: String? = null,
    @Json(name = "geocodePlaceId") val geocodePlaceId: String? = null,
    @Json(name = "homeId") val homeId: String? = null,
    @Json(name = "businessId") val businessId: String? = null,
    val tags: List<String>? = null,
    @Json(name = "gpsTimestamp") val gpsTimestamp: String? = null,
    @Json(name = "gpsLatitude") val gpsLatitude: Double? = null,
    @Json(name = "gpsLongitude") val gpsLongitude: Double? = null,
    @Json(name = "crossPostToConnections") val crossPostToConnections: Boolean? = null,
    @Json(name = "showOnProfile") val showOnProfile: Boolean? = null,
    @Json(name = "profileVisibilityScope") val profileVisibilityScope: String? = null,
    // Event-specific
    @Json(name = "eventDate") val eventDate: String? = null,
    @Json(name = "eventEndDate") val eventEndDate: String? = null,
    @Json(name = "eventVenue") val eventVenue: String? = null,
    // Safety alert
    @Json(name = "safetyAlertKind") val safetyAlertKind: String? = null,
    @Json(name = "behaviorDescription") val behaviorDescription: String? = null,
    // Deal
    @Json(name = "dealExpiresAt") val dealExpiresAt: String? = null,
    // Lost & Found
    @Json(name = "lostFoundType") val lostFoundType: String? = null,
    @Json(name = "contactPref") val contactPref: String? = null,
    @Json(name = "contactPhone") val contactPhone: String? = null,
    // Recommend / deal business name alias
    @Json(name = "businessName") val businessName: String? = null,
    // Ask category
    @Json(name = "serviceCategory") val serviceCategory: String? = null,
    // Announce / persona audience
    val audience: String? = null,
    // v1.2 purpose tag
    val purpose: String? = null,
)

/** Just enough of the wire `post` to surface the id for media upload. */
@JsonClass(generateAdapter = true)
data class PostCreateResponsePost(
    val id: String,
)

/**
 * `POST /api/posts` response envelope — the backend echoes a thin ack
 * plus the created row. The id may appear as `post_id` (legacy stubs)
 * or nested under `post.id` (live API).
 */
@JsonClass(generateAdapter = true)
data class PostCreateResponse(
    val message: String? = null,
    @Json(name = "post_id") val postId: String? = null,
    val post: PostCreateResponsePost? = null,
)
