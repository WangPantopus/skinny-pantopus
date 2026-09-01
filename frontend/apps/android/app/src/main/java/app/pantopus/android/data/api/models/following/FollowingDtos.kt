package app.pantopus.android.data.api.models.following

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * §1A① — "Following" (Beacons you follow) DTOs. Decodes the
 * `serializeFollowingRow` envelope from
 * `backend/serializers/identitySerializers.js:408`. The serializer already
 * emits camelCase keys, so the Kotlin property names match the wire 1:1 and
 * no `@Json(name = …)` remapping is required.
 */

/** `GET /api/personas/me/following` envelope. */
@JsonClass(generateAdapter = true)
data class FollowingListResponse(
    val items: List<FollowingRowDto> = emptyList(),
    val counts: FollowingCountsDto = FollowingCountsDto(),
    val pagination: FollowingPaginationDto? = null,
)

@JsonClass(generateAdapter = true)
data class FollowingCountsDto(
    val totalFollowing: Int = 0,
    val unreadBeacons: Int = 0,
)

@JsonClass(generateAdapter = true)
data class FollowingPaginationDto(
    val nextOffset: Int? = null,
    val hasMore: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class FollowingRowDto(
    val membershipId: String,
    val persona: FollowingPersonaDto,
    val fanHandle: String? = null,
    val notificationLevel: String? = null,
    /** Present (non-null) only while the membership is currently muted. */
    val mutedUntil: String? = null,
    /** Present only for paid tiers (rank > 1). */
    val paidTier: FollowingTierDto? = null,
    val latestPost: FollowingPostDto? = null,
    val unreadCount: Int? = 0,
    val followedAt: String? = null,
    val lastSeenAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class FollowingPersonaDto(
    val id: String,
    val handle: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val status: String? = null,
    val verified: Boolean? = false,
    /** Not emitted by the current serializer — decoded optionally so the
     *  subtitle can show "· {n} followers" if it ever appears. */
    val followerCount: Int? = null,
)

@JsonClass(generateAdapter = true)
data class FollowingTierDto(
    val rank: Int = 0,
    val name: String? = null,
    val priceCents: Int? = null,
)

@JsonClass(generateAdapter = true)
data class FollowingPostDto(
    val id: String,
    val snippet: String? = null,
    val createdAt: String? = null,
)

/** `PATCH …/mute` body. `muteFollowingSchema` requires `days` (1…365). */
@JsonClass(generateAdapter = true)
data class FollowingMuteBody(
    val days: Int,
)

/** `POST …/seen` echo. */
@JsonClass(generateAdapter = true)
data class FollowingSeenResponse(
    val unreadCount: Int? = null,
    val lastSeenAt: String? = null,
)

/** `PATCH …/mute` echo. */
@JsonClass(generateAdapter = true)
data class FollowingMuteResponse(
    val mutedUntil: String? = null,
)

/**
 * `PATCH /api/personas/:id/follow/preferences` body. The validator requires
 * `notification_level` to be one of `all | highlights | none`
 * (`notificationPreferenceSchema`, `backend/routes/personas.js:88`).
 */
@JsonClass(generateAdapter = true)
data class FollowNotificationLevelBody(
    @Json(name = "notification_level") val notificationLevel: String,
)

/** `PATCH /api/personas/:id/follow/preferences` echo. */
@JsonClass(generateAdapter = true)
data class FollowPreferencesResponse(
    val following: Boolean? = null,
    val status: String? = null,
    val relationshipType: String? = null,
    val notificationLevel: String? = null,
)

/** `DELETE /api/personas/:id/follow` echo (`{ message }`). */
@JsonClass(generateAdapter = true)
data class FollowingActionEcho(
    val message: String? = null,
)
