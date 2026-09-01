@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.beacon

import app.pantopus.android.data.api.models.audience.BroadcastChannelDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Decoder shapes for the A21.1 public Beacon profile when driven by the
 * persona backend. One persona shape decodes both:
 *
 *  - `GET /api/personas/me`      — the owner's own Beacon ("My Beacon").
 *    Route `backend/routes/personas.js:367`.
 *  - `GET /api/personas/:handle` — a visitor viewing someone's Beacon.
 *    Route `backend/routes/personas.js:1028`.
 *
 * The serializer always emits the `viewer` block — `isOwner: true` on `me`,
 * the visitor's follow status on `:handle`. Mirrors iOS `BeaconProfileDTOs.swift`.
 */
@JsonClass(generateAdapter = true)
data class BeaconPersonaResponse(
    val persona: BeaconPersonaDto? = null,
    val channel: BroadcastChannelDto? = null,
)

@JsonClass(generateAdapter = true)
data class BeaconPersonaDto(
    val id: String,
    val handle: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val bannerUrl: String? = null,
    val bio: String? = null,
    val category: String? = null,
    val audienceLabel: String? = null,
    val audienceMode: String? = null,
    val followerCount: Int? = null,
    val postCount: Int? = null,
    val broadcastEnabled: Boolean? = null,
    val createdAt: String? = null,
    val publicLinks: List<BeaconPublicLinkDto>? = null,
    val credential: BeaconCredentialDto? = null,
    val viewer: BeaconViewerDto? = null,
)

@JsonClass(generateAdapter = true)
data class BeaconViewerDto(
    val isOwner: Boolean? = null,
    val isFollowing: Boolean? = null,
    val followStatus: String? = null,
    val relationshipType: String? = null,
    val notificationLevel: String? = null,
)

/**
 * Verification credential. `status == "verified"` drives the verified check
 * dot + the gold "Persona · Verified" tier chip; otherwise the chip reads
 * "Persona · New".
 */
@JsonClass(generateAdapter = true)
data class BeaconCredentialDto(
    val status: String? = null,
    val label: String? = null,
)

@JsonClass(generateAdapter = true)
data class BeaconPublicLinkDto(
    val label: String? = null,
    val url: String? = null,
)

// GET /api/personas/:handle/posts

@JsonClass(generateAdapter = true)
data class BeaconPostsResponse(
    val posts: List<BeaconPostDto> = emptyList(),
)

/**
 * One persona broadcast. Tolerant of the post serializer (`content`,
 * `like_count`, `comment_count`) and the broadcast-message serializer
 * (`body`, `delivered_count`, `read_count`, `locked`, `teaser`).
 */
@JsonClass(generateAdapter = true)
data class BeaconPostDto(
    val id: String? = null,
    val body: String? = null,
    val content: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val visibility: String? = null,
    @Json(name = "target_tier_rank") val targetTierRank: Int? = null,
    @Json(name = "like_count") val likeCount: Int? = null,
    @Json(name = "comment_count") val commentCount: Int? = null,
    @Json(name = "delivered_count") val deliveredCount: Int? = null,
    @Json(name = "read_count") val readCount: Int? = null,
    val locked: Boolean? = null,
    val teaser: String? = null,
    @Json(name = "media_urls") val mediaUrls: List<String>? = null,
    /**
     * Set on Post rows published through a broadcast channel
     * (`backend/routes/broadcastChannels.js:554`). Non-null is what makes a
     * row eligible for a read receipt — RN gates on the same field
     * (`src/app/persona/[personaHandle]/index.tsx:66`).
     */
    @Json(name = "broadcast_channel_id") val broadcastChannelId: String? = null,
)

// PATCH /api/personas/:id/follow/preferences

@JsonClass(generateAdapter = true)
data class BeaconFollowPreferencesBody(
    @Json(name = "notification_level") val notificationLevel: String? = null,
    @Json(name = "muted_until") val mutedUntil: String? = null,
)

// DELETE /api/personas/:id/follow

@JsonClass(generateAdapter = true)
data class BeaconActionEcho(
    val message: String? = null,
    val status: String? = null,
)
