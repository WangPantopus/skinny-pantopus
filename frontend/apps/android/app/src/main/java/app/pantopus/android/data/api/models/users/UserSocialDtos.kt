package app.pantopus.android.data.api.models.users

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * T3 — response bodies for the plain follow graph and the profile-picture
 * upload. Mirrors the iOS `UserSocialDTOs.swift` 1:1.
 */

/**
 * `POST` / `DELETE /api/users/:id/follow` response —
 * `backend/routes/users.js:3583` and `:3609`.
 */
@JsonClass(generateAdapter = true)
data class FollowActionResponse(
    val message: String? = null,
    val following: Boolean? = null,
)

/**
 * `GET /api/users/:id/relationship` response —
 * `backend/routes/users.js:3697`. [relationship] is one of
 * `none | pending_sent | pending_received | connected | blocked`.
 */
@JsonClass(generateAdapter = true)
data class UserRelationshipDto(
    val relationship: String? = null,
    val following: Boolean? = null,
    @Json(name = "followed_by") val followedBy: Boolean? = null,
)

/** Trimmed `User` row echoed back by the profile-picture upload. */
@JsonClass(generateAdapter = true)
data class ProfilePictureUserDto(
    val id: String,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/**
 * `POST /api/upload/profile-picture` response —
 * `backend/routes/upload.js:293`.
 */
@JsonClass(generateAdapter = true)
data class ProfilePictureUploadResponse(
    val message: String? = null,
    val url: String,
    val key: String? = null,
    val user: ProfilePictureUserDto? = null,
)
