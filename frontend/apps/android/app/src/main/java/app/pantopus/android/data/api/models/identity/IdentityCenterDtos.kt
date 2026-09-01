@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.identity

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Envelope from `GET /api/identity-center`. */
@JsonClass(generateAdapter = true)
data class IdentityCenterResponse(
    @Json(name = "private_account") val privateAccount: PrivateAccountDto? = null,
    @Json(name = "local_profile") val localProfile: LocalProfileDto? = null,
    @Json(name = "audience_profile") val audienceProfile: AudienceProfileDto? = null,
    val bridges: BridgesDto? = null,
    val homes: List<HomeIdentityDto>? = null,
    @Json(name = "business_profiles") val businessProfiles: List<BusinessIdentityDto>? = null,
    @Json(name = "persona_count") val personaCount: Int? = null,
    @Json(name = "block_counts") val blockCounts: BlockCountsDto? = null,
)

@JsonClass(generateAdapter = true)
data class PrivateAccountDto(
    val id: String,
    val email: String? = null,
    val name: String? = null,
    val verified: Boolean? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class LocalProfileDto(
    val id: String,
    val handle: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "post_count") val postCount: Int? = null,
    @Json(name = "connection_count") val connectionCount: Int? = null,
    val verified: Boolean? = null,
    val locality: String? = null,
)

@JsonClass(generateAdapter = true)
data class AudienceProfileDto(
    val id: String,
    val handle: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "follower_count") val followerCount: Int? = null,
    @Json(name = "post_cadence") val postCadence: String? = null,
    val status: String? = null,
)

@JsonClass(generateAdapter = true)
data class BridgesDto(
    @Json(name = "show_persona_on_local") val showPersonaOnLocal: Boolean? = null,
    @Json(name = "show_local_on_persona") val showLocalOnPersona: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class HomeIdentityDto(
    val id: String,
    val name: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "primary_photo_url") val primaryPhotoUrl: String? = null,
    val role: String? = null,
)

@JsonClass(generateAdapter = true)
data class BusinessIdentityDto(
    val id: String,
    @Json(name = "display_name") val displayName: String? = null,
    val role: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class BlockCountsDto(
    val personal: Int? = null,
    val audience: Int? = null,
)

/** Body for `PATCH /api/identity-center/bridges/:personaId`. */
@JsonClass(generateAdapter = true)
data class UpdateBridgesBody(
    @Json(name = "show_persona_on_local") val showPersonaOnLocal: Boolean? = null,
    @Json(name = "show_local_on_persona") val showLocalOnPersona: Boolean? = null,
)

/** Acknowledgement envelope from the PATCH — backend emits `{ "bridge": {...} }` (singular). */
@JsonClass(generateAdapter = true)
data class BridgesEchoResponse(
    val bridge: BridgesDto? = null,
)

// View As (GET /api/identity-center/view-as — identityCenter.js:489) — P1-F.
// `visible` is the serialized profile the viewer sees; `hidden` lists redacted
// field keys. Keys are camelCase on the wire (the route builds plain JS
// objects), so no @Json mappings are needed.
@JsonClass(generateAdapter = true)
data class ViewAsResponse(
    val viewer: String? = null,
    val viewerLabel: String? = null,
    val visible: ViewAsVisibleProfile? = null,
    val hidden: List<String>? = null,
    val context: ViewAsContextDto? = null,
)

@JsonClass(generateAdapter = true)
data class ViewAsVisibleProfile(
    val handle: String? = null,
    val displayName: String? = null,
    val bio: String? = null,
    val badges: List<String>? = null,
    val locality: ViewAsLocality? = null,
    val stats: ViewAsStats? = null,
    val viewer: ViewAsViewerRelationship? = null,
)

@JsonClass(generateAdapter = true)
data class ViewAsLocality(
    val city: String? = null,
    val state: String? = null,
    val neighborhood: String? = null,
    val precision: String? = null,
)

@JsonClass(generateAdapter = true)
data class ViewAsStats(
    val reviews: Int? = null,
    val gigsCompleted: Int? = null,
)

@JsonClass(generateAdapter = true)
data class ViewAsViewerRelationship(
    val relationshipStatus: String? = null,
    val isFollowingLocal: Boolean? = null,
    val canMessage: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class ViewAsContextDto(
    val isNeighbor: Boolean? = null,
    val isConnection: Boolean? = null,
    val isHouseholdMember: Boolean? = null,
    val isGigParticipant: Boolean? = null,
)
