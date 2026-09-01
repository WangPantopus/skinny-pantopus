@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.token_accept

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// GET /api/homes/invitations/token/:token

@JsonClass(generateAdapter = true)
data class HomeInviteResponse(
    val invitation: HomeInviteDetailsDto? = null,
    val home: HomeInviteHomeDto? = null,
    val inviter: HomeInviteInviterDto? = null,
    val expired: Boolean? = null,
    val alreadyUsed: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class HomeInviteDetailsDto(
    val id: String,
    val status: String? = null,
    @Json(name = "proposed_role") val proposedRole: String? = null,
    @Json(name = "invitee_email") val inviteeEmail: String? = null,
    @Json(name = "invitee_user_id") val inviteeUserId: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class HomeInviteHomeDto(
    val id: String,
    val name: String? = null,
    val city: String? = null,
    @Json(name = "home_type") val homeType: String? = null,
)

@JsonClass(generateAdapter = true)
data class HomeInviteInviterDto(
    val name: String? = null,
    val username: String? = null,
    val profilePicture: String? = null,
)

// GET /api/businesses/seats/invite-details

@JsonClass(generateAdapter = true)
data class BusinessSeatInviteResponse(
    @Json(name = "seat_id") val seatId: String? = null,
    val business: BusinessSeatBusinessDto? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "role_base") val roleBase: String? = null,
    @Json(name = "invite_email") val inviteEmail: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class BusinessSeatBusinessDto(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
)

// GET /api/homes/guest/:token

@JsonClass(generateAdapter = true)
data class GuestPassResponse(
    val pass: GuestPassDto? = null,
)

@JsonClass(generateAdapter = true)
data class GuestPassDto(
    val label: String? = null,
    val kind: String? = null,
    @Json(name = "custom_title") val customTitle: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "home_name") val homeName: String? = null,
    @Json(name = "welcome_message") val welcomeMessage: String? = null,
)

// POST /api/businesses/seats/{accept,decline}-invite

@JsonClass(generateAdapter = true)
data class BusinessSeatAcceptBody(
    val token: String,
    @Json(name = "display_name") val displayName: String? = null,
)

@JsonClass(generateAdapter = true)
data class BusinessSeatDeclineBody(
    val token: String,
)

@JsonClass(generateAdapter = true)
data class BusinessSeatAcceptResponse(
    val message: String? = null,
    @Json(name = "seat_id") val seatId: String? = null,
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "role_base") val roleBase: String? = null,
)

// POST /api/homes/invitations/token/:token/accept

@JsonClass(generateAdapter = true)
data class HomeAcceptResponse(
    val homeId: String? = null,
    val occupancy: HomeOccupancyEcho? = null,
    val merged: Boolean? = null,
    @Json(name = "accepted_role_base") val acceptedRoleBase: String? = null,
)

@JsonClass(generateAdapter = true)
data class HomeOccupancyEcho(
    val id: String? = null,
    val role: String? = null,
)

@JsonClass(generateAdapter = true)
data class GenericAcknowledgement(
    val ok: Boolean? = null,
    val message: String? = null,
)
