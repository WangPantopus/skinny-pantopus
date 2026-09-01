@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.audience

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// GET /api/personas/me

@JsonClass(generateAdapter = true)
data class PersonaMeResponse(
    val persona: PersonaSummaryDto? = null,
    val channel: BroadcastChannelDto? = null,
)

@JsonClass(generateAdapter = true)
data class PersonaSummaryDto(
    val id: String,
    val handle: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val bannerUrl: String? = null,
    val bio: String? = null,
    val category: String? = null,
    val audienceLabel: String? = null,
    /** `open / approval_required / invite_only / organization_managed`. */
    val audienceMode: String? = null,
    val publicLinks: List<PersonaPublicLinkDto>? = null,
    val followerCount: Int? = null,
    val postCount: Int? = null,
)

@JsonClass(generateAdapter = true)
data class BroadcastChannelDto(
    val id: String,
    val title: String? = null,
    val description: String? = null,
    val status: String? = null,
)

// GET /api/personas/me/audience

@JsonClass(generateAdapter = true)
data class AudienceListResponse(
    val persona: PersonaSummaryDto? = null,
    val items: List<FanDto> = emptyList(),
    val counts: AudienceCountsDto = AudienceCountsDto(),
    /** Offset cursor echoed by the handler
     *  (`backend/routes/personas.js:735-741`). Absent on the no-persona
     *  short-circuit, so it stays nullable. */
    val pagination: AudiencePaginationDto? = null,
)

/** `{ nextOffset, hasMore }` — `nextOffset` is null on the last page. */
@JsonClass(generateAdapter = true)
data class AudiencePaginationDto(
    val nextOffset: Int? = null,
    val hasMore: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class AudienceCountsDto(
    val totalActive: Int? = null,
    val pending: Int? = null,
    val byTier: Map<String, Int>? = null,
)

/**
 * One follower row. The backend's creator-side serializer emits
 * camelCase keys (`fanHandle`, not `fan_handle`) so no `@Json` mapping
 * is needed. `id` is sourced from `membershipId` when present.
 */
@JsonClass(generateAdapter = true)
data class FanDto(
    val membershipId: String? = null,
    val fanHandle: String? = null,
    val fanDisplayName: String? = null,
    val fanAvatarUrl: String? = null,
    val status: String? = null,
    val tier: FanTierBadgeDto? = null,
    val verifiedLocal: Boolean? = null,
    val tenureMonths: Int? = null,
    val joinedMonth: String? = null,
    val cancelAtPeriodEnd: Boolean? = null,
) {
    val id: String get() = membershipId ?: fanHandle ?: ""
}

@JsonClass(generateAdapter = true)
data class FanTierBadgeDto(
    val rank: Int? = null,
    val name: String? = null,
)

// PATCH /api/personas/me/audience/:membershipId

/** Owner-side action body (A22.2 "Your audience"). `action` ∈
 *  `approve / decline / remove / mute / unmute`. */
@JsonClass(generateAdapter = true)
data class AudienceMemberActionBody(
    val action: String,
)

/** Echoes the membership id + new status after the transition. */
@JsonClass(generateAdapter = true)
data class AudienceMemberActionResponse(
    val membershipId: String? = null,
    val status: String? = null,
)

// PATCH /api/personas/:id/followers/:followId

/** Body for the owner-side follower status change. Only `status` is sent;
 *  the schema also accepts `relationship_type` / `notification_level` but
 *  the block flow never changes those. */
@JsonClass(generateAdapter = true)
data class AudienceFollowerStatusBody(
    val status: String,
)

/** `{ follower: … }` echoed after the change
 *  (`serializePersonaFollowForOwner`, `backend/routes/personas.js:225`). */
@JsonClass(generateAdapter = true)
data class AudienceFollowerUpdateResponse(
    val follower: AudienceFollowerDto? = null,
)

@JsonClass(generateAdapter = true)
data class AudienceFollowerDto(
    val id: String? = null,
    val status: String? = null,
    val relationshipType: String? = null,
    val notificationLevel: String? = null,
)

// GET /api/personas/:handle/posts

@JsonClass(generateAdapter = true)
data class PersonaPostsResponse(
    val posts: List<PersonaPostDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PersonaPostDto(
    val id: String,
    val body: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val visibility: String? = null,
    @Json(name = "target_tier_rank") val targetTierRank: Int? = null,
    @Json(name = "delivered_count") val deliveredCount: Int? = null,
    @Json(name = "read_count") val readCount: Int? = null,
    @Json(name = "media_urls") val mediaUrls: List<String>? = null,
)

// GET /api/personas/:handle/tiers

@JsonClass(generateAdapter = true)
data class PersonaTiersResponse(
    val tiers: List<PersonaTierDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PersonaTierDto(
    val id: String,
    val rank: Int,
    val name: String,
    val description: String? = null,
    val priceCents: Int? = null,
    val currency: String? = null,
)

// GET /api/personas/:id/membership-stats

@JsonClass(generateAdapter = true)
data class MembershipStatsResponse(
    val counts: MembershipStatsCountsDto = MembershipStatsCountsDto(),
)

@JsonClass(generateAdapter = true)
data class MembershipStatsCountsDto(
    val followers: Int? = null,
    val members: Int? = null,
    val insiders: Int? = null,
    val direct: Int? = null,
)

// GET /api/personas/:id/dms/threads

@JsonClass(generateAdapter = true)
data class PersonaThreadsResponse(
    val threads: List<PersonaThreadDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PersonaThreadDto(
    val id: String,
    val membershipId: String? = null,
    val fanHandle: String? = null,
    val fanDisplayName: String? = null,
    val fanAvatarUrl: String? = null,
    val tier: FanTierBadgeDto? = null,
    val lastMessagePreview: String? = null,
    val lastMessageAt: String? = null,
    val unreadCount: Int? = null,
    val status: String? = null,
    /** Creator-flagged thread — drives the amber flag glyph + Flagged
     *  filter chip count on the Creator Inbox surface. */
    val flagged: Boolean? = null,
    /** Verified-local follower flag — mirrors `FanDto.verifiedLocal` so
     *  the row avatar can render the small sky-blue check overlay. */
    val verifiedLocal: Boolean? = null,
    /** Counterparty user id needed to push the existing
     *  `ChatConversationScreen` in `Person` mode. Older serializers may
     *  not surface it — when null the row's tap target uses
     *  `membershipId` as the conversation peer. */
    val counterpartyUserId: String? = null,
)

// POST /api/broadcast/channels/:id/messages

/**
 * `visibility` ∈ `public / followers / tier_or_above / subscribers`;
 * `target_tier_rank` (1-4) is required for `tier_or_above`. [media] carries
 * already-hosted items (max 10) — locally-picked files are attached after
 * publish via `POST /api/upload/post-media/:messageId`, because a broadcast
 * message *is* a Post row and that route needs its id.
 */
@JsonClass(generateAdapter = true)
data class PublishUpdateBody(
    val body: String,
    val visibility: String,
    @Json(name = "target_tier_rank") val targetTierRank: Int? = null,
    val media: List<BroadcastMediaPayload>? = null,
    // Instagram-style place tag — an explicitly picked venue is intentional
    // public disclosure; auto GPS/home context never rides a Beacon post.
    // Keys mirror `createBroadcastMessageSchema` (snake_case) exactly.
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "location_name") val locationName: String? = null,
    @Json(name = "location_address") val locationAddress: String? = null,
    @Json(name = "place_id") val placeId: String? = null,
)

/**
 * One already-hosted media item on the publish call.
 * `broadcastMediaItemsFromPayload` (`backend/routes/broadcastChannels.js:113`)
 * reads `url` + `type` (+ optional `thumbnailUrl` / `liveVideoUrl`).
 */
@JsonClass(generateAdapter = true)
data class BroadcastMediaPayload(
    val url: String,
    val type: String,
    val thumbnailUrl: String? = null,
    val liveVideoUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class PublishUpdateResponse(
    val message: BroadcastMessageDto? = null,
)

@JsonClass(generateAdapter = true)
data class BroadcastMessageDto(
    val id: String? = null,
    val body: String? = null,
    val visibility: String? = null,
    @Json(name = "target_tier_rank") val targetTierRank: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

// GET /api/broadcast/channels/:id/messages  (history)

/**
 * History envelope. The compose surface only reads `messages`; `channel` /
 * `persona` / `analytics` / `viewer` are present on the wire but unused. The
 * owner sees full rows; a `locked` teaser row only appears for tier-gated
 * content above the viewer's rank (never for the owner), so all fields are
 * optional.
 */
@JsonClass(generateAdapter = true)
data class BroadcastHistoryResponse(
    val messages: List<BroadcastHistoryMessageDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class BroadcastHistoryMessageDto(
    val id: String? = null,
    val body: String? = null,
    val visibility: String? = null,
    @Json(name = "target_tier_rank") val targetTierRank: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "delivered_count") val deliveredCount: Int? = null,
    @Json(name = "read_count") val readCount: Int? = null,
    val media: List<BroadcastMediaDto>? = null,
    val locked: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class BroadcastMediaDto(
    val url: String? = null,
    val type: String? = null,
)
