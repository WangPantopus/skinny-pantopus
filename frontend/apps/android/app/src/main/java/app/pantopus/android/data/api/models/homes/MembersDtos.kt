@file:Suppress("LongParameterList")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the per-home members roster exposed via
 * `/api/homes/:id/occupants` and friends.
 *
 * Endpoints:
 *  - GET    `/api/homes/:id/occupants`   — `backend/routes/home.js:3705`
 *    returns `{ occupants, pendingInvites }`. The Members screen
 *    buckets these client-side into Members / Guests / Pending tabs.
 *  - POST   `/api/homes/:id/invite`      — `backend/routes/home.js:5662`
 *  - DELETE `/api/homes/:id/members/:userId` —
 *    `backend/routes/homeIam.js:512`
 */

/** Active occupant row — wire shape returned by `/:id/occupants`. */
@JsonClass(generateAdapter = true)
data class OccupantDto(
    /** HomeOccupancy row id. */
    val id: String,
    @Json(name = "user_id") val userId: String,
    /** Wire enum: `owner / admin / manager / member / restricted_member /
     *  guest / lease_resident / …`. Anything matching `MemberRole.Guest`
     *  routes to the Guests tab. */
    val role: String? = null,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    /** Flattened from the joined User row. */
    @Json(name = "display_name") val displayName: String? = null,
    val username: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "joined_at") val joinedAt: String? = null,
    @Json(name = "can_manage_home") val canManageHome: Boolean? = null,
    @Json(name = "can_manage_finance") val canManageFinance: Boolean? = null,
    @Json(name = "can_manage_access") val canManageAccess: Boolean? = null,
    @Json(name = "can_manage_tasks") val canManageTasks: Boolean? = null,
    @Json(name = "can_view_sensitive") val canViewSensitive: Boolean? = null,
)

/** Pending invite mapped to a member-like shape by the backend. */
@JsonClass(generateAdapter = true)
data class PendingInviteDto(
    /** HomeInvite id. */
    val id: String,
    /** May be null when the invitee doesn't yet have an account. */
    @Json(name = "user_id") val userId: String? = null,
    val role: String? = null,
    val email: String? = null,
    /** Pretty label — backend falls back to email when name is unknown. */
    val name: String = "Invited user",
    @Json(name = "invited_by") val invitedBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** Envelope for `GET /api/homes/:id/occupants`. */
@JsonClass(generateAdapter = true)
data class OccupantsResponse(
    val occupants: List<OccupantDto> = emptyList(),
    val pendingInvites: List<PendingInviteDto> = emptyList(),
)

/**
 * Body for `POST /api/homes/:id/invite`. Backend accepts either an
 * `email` or `user_id`; the wizard sends `email`. `relationship` is
 * the wire role (member / guest / admin / …).
 */
@JsonClass(generateAdapter = true)
data class InviteMemberRequest(
    val email: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    val relationship: String,
    val message: String? = null,
)

/** Slim mirror of the backend `HomeInvite` row we project into the
 *  list optimistically after a successful POST. */
@JsonClass(generateAdapter = true)
data class InvitationDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "invited_by") val invitedBy: String? = null,
    @Json(name = "invitee_email") val inviteeEmail: String? = null,
    @Json(name = "invitee_user_id") val inviteeUserId: String? = null,
    @Json(name = "proposed_role") val proposedRole: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** Envelope for `POST /api/homes/:id/invite`. */
@JsonClass(generateAdapter = true)
data class InviteMemberResponse(
    val invitation: InvitationDto,
    val emailSent: Boolean? = null,
)

/** Envelope for `DELETE /api/homes/:id/members/:userId`. */
@JsonClass(generateAdapter = true)
data class RemoveMemberResponse(
    val message: String? = null,
)
