package app.pantopus.android.data.api.models.users

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Compact session-identity projection. Build via the companion helpers
 * from the richer login / profile responses.
 */
@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val email: String,
    @Json(name = "display_name") val displayName: String?,
    @Json(name = "avatar_url") val avatarUrl: String?,
    /**
     * P1.1 — true when the backend reports `role == "admin"`. Drives the
     * Admin section on the Settings index + the admin-only Review-claims
     * gate. Defaults to `false` so existing UserDto call sites compile
     * unchanged.
     */
    @Json(name = "is_admin") val isAdmin: Boolean = false,
    /**
     * P6.6 — public handle (`@username`) surfaced in session state so
     * [app.pantopus.android.ui.screens.root.RootSessionViewModel] can open
     * the public-profile setup. Defaults to `""` so existing UserDto call
     * sites compile unchanged.
     */
    val username: String = "",
)

/**
 * Social-link bundle inside [UserProfile]. Route:
 * `backend/routes/users.js:1427`.
 */
@JsonClass(generateAdapter = true)
data class SocialLinks(
    val website: String?,
    val linkedin: String?,
    val twitter: String?,
    val instagram: String?,
    val facebook: String?,
)

/**
 * `GET /api/users/profile` user envelope — route
 * `backend/routes/users.js:1427`. Shape fields whose upstream type is
 * provider-dependent (residency, inviteProgress) are decoded as untyped.
 */
@JsonClass(generateAdapter = true)
data class UserProfile(
    val id: String,
    val email: String,
    val username: String,
    val firstName: String,
    val middleName: String?,
    val lastName: String,
    val name: String,
    val phoneNumber: String?,
    val dateOfBirth: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipcode: String?,
    val accountType: String,
    val role: String,
    val verified: Boolean,
    val residency: JsonValue?,
    @Json(name = "avatar_url") val avatarUrl: String?,
    @Json(name = "profile_picture_url") val profilePictureUrl: String?,
    val profilePicture: String?,
    val bio: String?,
    val tagline: String?,
    val socialLinks: SocialLinks?,
    val skills: List<String>?,
    @Json(name = "followers_count") val followersCount: Int?,
    @Json(name = "average_rating") val averageRating: Double?,
    @Json(name = "gigs_posted") val gigsPosted: Int?,
    @Json(name = "gigs_completed") val gigsCompleted: Int?,
    val profileVisibility: String?,
    val createdAt: String,
    val updatedAt: String,
    /**
     * `User.show_email` / `User.show_phone` — surface the account email /
     * phone on the public profile. The route echoes each both camelCase and
     * snake_case (`backend/routes/users.js:2024-2027`); we read camelCase.
     */
    val showEmail: Boolean? = null,
    val showPhone: Boolean? = null,
)

/** Envelope for `GET /api/users/profile`. Route: `backend/routes/users.js:1427`. */
@JsonClass(generateAdapter = true)
data class ProfileResponse(
    val user: UserProfile,
    /** Shape varies by invite service — decoded lazily. */
    @Json(name = "invite_progress") val inviteProgress: JsonValue?,
)

/**
 * `PATCH /api/users/profile` request. Every field optional — unspecified
 * keys are left untouched server-side. Route:
 * `backend/routes/users.js:1503`.
 */
@JsonClass(generateAdapter = true)
data class ProfileUpdateRequest(
    val firstName: String? = null,
    val middleName: String? = null,
    val lastName: String? = null,
    val phoneNumber: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    val dateOfBirth: String? = null,
    val bio: String? = null,
    val tagline: String? = null,
    val profileVisibility: String? = null,
    /**
     * The two contact-visibility booleans the PATCH handler maps onto
     * `show_email` / `show_phone` (`backend/routes/users.js:2076-2083`). The
     * Joi schema accepts camelCase and snake_case (`users.js:797-800`); we
     * send camelCase. Null keys are omitted by Moshi.
     */
    val showEmail: Boolean? = null,
    val showPhone: Boolean? = null,
    val website: String? = null,
    val linkedin: String? = null,
    val twitter: String? = null,
    val instagram: String? = null,
    val facebook: String? = null,
)

/** Envelope for `PATCH /api/users/profile`. Route: `backend/routes/users.js:1503`. */
@JsonClass(generateAdapter = true)
data class ProfileUpdateResponse(
    val message: String,
    val user: UserProfile,
)

/**
 * Body for `PUT /api/users/skills` — replaces the caller's whole skill
 * list. Route `backend/routes/users.js:2246`; mirror of iOS
 * `UpdateSkillsRequest`.
 */
@JsonClass(generateAdapter = true)
data class UpdateSkillsRequest(
    val skills: List<String>,
)

/**
 * `{ skills: [...] }` echo from `PUT /api/users/skills`. The handler
 * trims, dedupes, caps each entry at 100 chars and the list at 50, then
 * returns the cleaned array (`backend/routes/users.js:2254`).
 */
@JsonClass(generateAdapter = true)
data class UpdateSkillsResponse(
    val skills: List<String>,
)

/**
 * `GET /api/users/:id/stats` envelope — route
 * `backend/routes/users.js:2787`.
 */
@JsonClass(generateAdapter = true)
data class UserStatsDto(
    @Json(name = "total_gigs_posted") val totalGigsPosted: Int = 0,
    @Json(name = "total_gigs_completed") val totalGigsCompleted: Int = 0,
    @Json(name = "total_earnings") val totalEarnings: Double = 0.0,
    @Json(name = "average_rating") val averageRating: Double = 0.0,
    @Json(name = "total_ratings") val totalRatings: Int = 0,
)
