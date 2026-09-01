package app.pantopus.android.data.api.models.profile

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Inline review row on the public profile. Source:
 * `backend/routes/users.js:2089`.
 */
@JsonClass(generateAdapter = true)
data class PublicProfileReview(
    val id: String?,
    @Json(name = "reviewer_id") val reviewerId: String?,
    @Json(name = "reviewee_id") val revieweeId: String?,
    val rating: Int,
    val content: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "reviewer_name") val reviewerName: String?,
    @Json(name = "reviewer_avatar") val reviewerAvatar: String?,
    @Json(name = "reviewer_username") val reviewerUsername: String?,
)

/**
 * `GET /api/users/id/:id` response — route `backend/routes/users.js:2041`.
 * Shape diverges from `/api/users/profile`: aggregated stats live at the
 * top level (gigs_posted, average_rating, …), reviews are inlined,
 * private fields are omitted.
 */
@JsonClass(generateAdapter = true)
data class PublicProfileDto(
    val id: String,
    val username: String = "",
    val firstName: String? = null,
    val lastName: String? = null,
    val name: String? = null,
    val bio: String? = null,
    val tagline: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    val city: String? = null,
    val state: String? = null,
    val accountType: String? = null,
    val verified: Boolean? = null,
    val residency: JsonValue? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "gigs_posted") val gigsPosted: Int? = null,
    @Json(name = "gigs_completed") val gigsCompleted: Int? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    @Json(name = "review_count") val reviewCount: Int? = null,
    @Json(name = "followers_count") val followersCount: Int? = null,
    val reviews: List<PublicProfileReview> = emptyList(),
    val socialLinks: JsonValue? = null,
    val skills: List<String> = emptyList(),
) {
    /** Best-effort display name. */
    val displayName: String
        get() {
            if (!name.isNullOrEmpty()) return name
            val combined = listOfNotNull(firstName, lastName).filter { it.isNotEmpty() }.joinToString(" ")
            if (combined.isNotEmpty()) return combined
            return "@$username"
        }

    /** "City, ST" if both present. */
    val locality: String?
        get() =
            when {
                !city.isNullOrEmpty() && !state.isNullOrEmpty() -> "$city, $state"
                !city.isNullOrEmpty() -> city
                else -> state
            }
}
