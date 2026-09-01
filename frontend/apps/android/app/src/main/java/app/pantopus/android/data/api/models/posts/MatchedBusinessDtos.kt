package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/posts/:id/matched-businesses` — the "Nearby Providers" card on
 * Pulse post detail. Route `backend/routes/posts.js:2550`.
 */

/**
 * Response envelope. [cached] is true when the payload came from the
 * pre-computed `matched_businesses_cache` snapshot; [expired] is set when the
 * post is older than the 30-day suppression window.
 */
@JsonClass(generateAdapter = true)
data class MatchedBusinessesResponse(
    val businesses: List<MatchedBusinessDto> = emptyList(),
    val cached: Boolean? = null,
    val expired: Boolean? = null,
)

/**
 * One organically matched local business.
 *
 * The live (`cached=false`) hydration path emits `completed_gigs` and omits
 * `distance_miles` / `neighbor_count` / `is_new_business`; the cached snapshot
 * (`jobs/organicMatch.js:96`) emits those three and omits `completed_gigs`.
 * Everything beyond the identity fields is therefore nullable.
 */
@JsonClass(generateAdapter = true)
data class MatchedBusinessDto(
    @Json(name = "business_user_id") val businessUserId: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    val categories: List<String>? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    @Json(name = "review_count") val reviewCount: Int? = null,
    @Json(name = "completed_gigs") val completedGigs: Int? = null,
    @Json(name = "distance_miles") val distanceMiles: Double? = null,
    @Json(name = "neighbor_count") val neighborCount: Int? = null,
    @Json(name = "is_new_business") val isNewBusiness: Boolean? = null,
    @Json(name = "is_open_now") val isOpenNow: Boolean? = null,
)
