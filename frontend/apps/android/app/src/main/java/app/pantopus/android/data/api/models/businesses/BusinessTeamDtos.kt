@file:Suppress("LongParameterList")

package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for owner-side business team & roles management. Cloned from the
 * per-home `MembersDtos.kt` shape but pointed at the businessIam +
 * businessSeats route families (both mounted at `/api/businesses`).
 *
 * Endpoints:
 *  - GET    `/api/businesses/:id/me`                       — businessIam.js:42
 *  - GET    `/api/businesses/:id/role-presets`             — businessIam.js:80
 *  - GET    `/api/businesses/:id/members`                  — businessIam.js:104
 *  - POST   `/api/businesses/:id/members/:userId/role`     — businessIam.js:224
 *  - GET    `/api/businesses/:id/members/:userId/permissions` — businessIam.js:493
 *  - POST   `/api/businesses/:id/members/:userId/permissions` — businessIam.js:410
 *  - DELETE `/api/businesses/:id/members/:userId`          — businessIam.js:525
 *  - GET    `/api/businesses/:id/seats`                    — businessSeats.js:425
 *  - POST   `/api/businesses/:id/seats/invite`             — businessSeats.js:495
 *  - DELETE `/api/businesses/:id/seats/:seatId`            — businessSeats.js:698
 */

/** One assignable role preset. The change-role picker posts `key` back as
 *  `preset_key`. */
@JsonClass(generateAdapter = true)
data class BusinessRolePresetDto(
    val key: String,
    @Json(name = "display_name") val displayName: String = "",
    val description: String = "",
    @Json(name = "role_base") val roleBase: String = "viewer",
    @Json(name = "icon_key") val iconKey: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 100,
)

/** Envelope for `GET /api/businesses/:id/role-presets`. */
@JsonClass(generateAdapter = true)
data class BusinessRolePresetsResponse(
    val presets: List<BusinessRolePresetDto> = emptyList(),
)

/** The joined user record on a team membership. */
@JsonClass(generateAdapter = true)
data class BusinessTeamUserDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    val email: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** One active team membership row. */
@JsonClass(generateAdapter = true)
data class BusinessTeamMemberDto(
    val id: String,
    @Json(name = "role_base") val roleBase: String? = null,
    val title: String? = null,
    @Json(name = "joined_at") val joinedAt: String? = null,
    @Json(name = "invited_at") val invitedAt: String? = null,
    val notes: String? = null,
    val user: BusinessTeamUserDto? = null,
)

/** Envelope for `GET /api/businesses/:id/members`. */
@JsonClass(generateAdapter = true)
data class BusinessTeamMembersResponse(
    val members: List<BusinessTeamMemberDto> = emptyList(),
)

/** A seat row. The Team screen keeps only `invite_status == "pending"`. */
@JsonClass(generateAdapter = true)
data class BusinessSeatDto(
    val id: String,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "role_base") val roleBase: String? = null,
    @Json(name = "invite_status") val inviteStatus: String? = null,
    @Json(name = "invite_email") val inviteEmail: String? = null,
    @Json(name = "invite_expires_at") val inviteExpiresAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "is_you") val isYou: Boolean? = null,
)

/** Envelope for `GET /api/businesses/:id/seats`. */
@JsonClass(generateAdapter = true)
data class BusinessSeatsResponse(
    val seats: List<BusinessSeatDto> = emptyList(),
)

/** Body for `POST /api/businesses/:id/seats/invite` (matches the backend
 *  `inviteSchema`). `title` is intentionally omitted — not in the schema. */
@JsonClass(generateAdapter = true)
data class BusinessSeatInviteRequest(
    @Json(name = "display_name") val displayName: String,
    @Json(name = "role_base") val roleBase: String,
    @Json(name = "invite_email") val inviteEmail: String,
    val notes: String? = null,
)

/** Envelope for `POST /api/businesses/:id/seats/invite`. */
@JsonClass(generateAdapter = true)
data class BusinessSeatInviteResponse(
    val seat: BusinessSeatDto,
    @Json(name = "invite_token") val inviteToken: String? = null,
)

/** Body for `POST /api/businesses/:id/members/:userId/role`. */
@JsonClass(generateAdapter = true)
data class BusinessChangeRoleRequest(
    @Json(name = "preset_key") val presetKey: String,
)

/** Response for `GET /api/businesses/:id/members/:userId/permissions`. */
@JsonClass(generateAdapter = true)
data class BusinessMemberPermissionsResponse(
    val permissions: List<String> = emptyList(),
    @Json(name = "role_base") val roleBase: String? = null,
)

/** Body for `POST /api/businesses/:id/members/:userId/permissions`. */
@JsonClass(generateAdapter = true)
data class BusinessTogglePermissionRequest(
    val permission: String,
    val allowed: Boolean,
)
