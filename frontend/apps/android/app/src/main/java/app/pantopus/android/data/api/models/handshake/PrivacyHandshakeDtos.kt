@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.handshake

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// GET /api/personas/:handle/fan-handle-suggestion

@JsonClass(generateAdapter = true)
data class FanHandleSuggestionResponse(
    val suggestion: String? = null,
    val locked: Boolean? = null,
    val identity: AudienceIdentityDto? = null,
)

@JsonClass(generateAdapter = true)
data class AudienceIdentityDto(
    val id: String,
    val handle: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
)

// GET /api/personas/:id/follow/status

@JsonClass(generateAdapter = true)
data class FollowStatusResponse(
    val following: Boolean? = null,
    val status: String? = null,
    val relationshipType: String? = null,
    val notificationLevel: String? = null,
)

// POST /api/personas/:id/follow

/** Request body. `acknowledged_platform_trust` MUST be `true`. */
@JsonClass(generateAdapter = true)
data class HandshakeBody(
    @Json(name = "tier_rank") val tierRank: Int,
    @Json(name = "fan_handle") val fanHandle: String,
    @Json(name = "fan_display_name") val fanDisplayName: String? = null,
    @Json(name = "fan_avatar_url") val fanAvatarUrl: String? = null,
    @Json(name = "acknowledged_platform_trust") val acknowledgedPlatformTrust: Boolean = true,
    @Json(name = "acknowledged_using_pantopus_username") val acknowledgedUsingPantopusUsername: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class HandshakeSubmitResponse(
    val follow: HandshakeFollowDto? = null,
    val status: String? = null,
    val membership: HandshakeMembershipDto? = null,
    val requiresPayment: Boolean? = null,
    val subscribeUrl: String? = null,
    val handshake: HandshakeEchoDto? = null,
)

@JsonClass(generateAdapter = true)
data class HandshakeFollowDto(
    val id: String? = null,
    val status: String? = null,
    val relationshipType: String? = null,
)

@JsonClass(generateAdapter = true)
data class HandshakeMembershipDto(
    val id: String? = null,
    @Json(name = "fan_handle") val fanHandle: String? = null,
    @Json(name = "tier_id") val tierId: String? = null,
    val status: String? = null,
)

@JsonClass(generateAdapter = true)
data class HandshakeEchoDto(
    @Json(name = "tier_rank") val tierRank: Int? = null,
    @Json(name = "tier_id") val tierId: String? = null,
    @Json(name = "fan_handle") val fanHandle: String? = null,
)

/** 4xx error envelope from the handshake POST. */
@JsonClass(generateAdapter = true)
data class HandshakeValidationErrorDto(
    val error: String? = null,
    val code: String? = null,
    val details: List<HandshakeValidationDetail>? = null,
)

@JsonClass(generateAdapter = true)
data class HandshakeValidationDetail(
    val path: String? = null,
    val message: String? = null,
)

// PATCH /api/personas/:id/follow/preferences

@JsonClass(generateAdapter = true)
data class FollowPreferencesBody(
    @Json(name = "notification_level") val notificationLevel: String? = null,
    @Json(name = "muted_until") val mutedUntil: String? = null,
)

@JsonClass(generateAdapter = true)
data class FollowPreferencesResponse(
    val ok: Boolean? = null,
)
