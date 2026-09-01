package app.pantopus.android.data.api.models.users

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/users/search` response envelope. Backend route at
 * `backend/routes/users.js:2481` returns `{users: [...]}` via the
 * `serializeCompatibilitySearchUser` helper at line 293.
 */
@JsonClass(generateAdapter = true)
data class UserSearchResponse(
    val users: List<UserSearchResultDto>,
)

/**
 * One row in the verified-user directory search. Trimmed projection of
 * `LocalProfile` + `User`. Fields are nullable — `city` / `state` are
 * suppressed when the local-profile's `show_neighborhood` flag is
 * false, even for a successful match.
 *
 * Field names use camelCase on the wire (the backend helper renames
 * `profile_picture` → `profilePicture`), so explicit `@Json(name)` is
 * only required for fields whose Kotlin name differs.
 */
@JsonClass(generateAdapter = true)
data class UserSearchResultDto(
    val id: String,
    val username: String?,
    val name: String?,
    @Json(name = "profilePicture") val profilePicture: String?,
    val city: String?,
    val state: String?,
    @Json(name = "accountType") val accountType: String?,
)
