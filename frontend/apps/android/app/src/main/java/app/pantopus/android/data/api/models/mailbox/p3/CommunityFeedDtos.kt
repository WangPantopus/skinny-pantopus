@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.p3

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Phase-3 community mail feed in
 * `backend/routes/mailboxV2Phase3.js` (mounted at `api/mailbox/v2/p3` —
 * `backend/app.js:317`).
 *
 * Feed rows are raw `CommunityMailItem` table rows enriched server-side
 * with a `reactions` roll-up and the caller's own `user_reactions`. Only
 * the columns the native screen renders are modelled.
 */

/** One aggregated reaction bucket — route `backend/routes/mailboxV2Phase3.js:609`. */
@JsonClass(generateAdapter = true)
data class CommunityReactionCountDto(
    @Json(name = "reaction_type") val reactionType: String,
    @Json(name = "count") val count: Int,
)

/** A published neighborhood / civic item — route `backend/routes/mailboxV2Phase3.js:565`. */
@JsonClass(generateAdapter = true)
data class CommunityFeedItemDto(
    @Json(name = "id") val id: String,
    @Json(name = "mail_id") val mailId: String? = null,
    @Json(name = "home_id") val homeId: String? = null,
    /**
     * `civic_notice` / `neighborhood_event` / `local_business` /
     * `building_announcement` — `categoryCommunityType`,
     * `backend/routes/mailboxV2Phase3.js:812`.
     */
    @Json(name = "community_type") val communityType: String? = null,
    @Json(name = "published_to") val publishedTo: String? = null,
    @Json(name = "title") val title: String? = null,
    @Json(name = "body") val body: String? = null,
    @Json(name = "sender_display") val senderDisplay: String? = null,
    @Json(name = "sender_trust") val senderTrust: String? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "verified_sender") val verifiedSender: Boolean? = null,
    @Json(name = "event_date") val eventDate: String? = null,
    @Json(name = "rsvp_deadline") val rsvpDeadline: String? = null,
    @Json(name = "views") val views: Int? = null,
    @Json(name = "neighbors_received") val neighborsReceived: Int? = null,
    @Json(name = "rsvp_count") val rsvpCount: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "reactions") val reactions: List<CommunityReactionCountDto>? = null,
    @Json(name = "user_reactions") val userReactions: List<String>? = null,
)

/** `GET api/mailbox/v2/p3/community/feed` envelope — route line 617. */
@JsonClass(generateAdapter = true)
data class CommunityFeedResponse(
    @Json(name = "items") val items: List<CommunityFeedItemDto> = emptyList(),
    @Json(name = "total") val total: Int? = null,
)

/**
 * Wire body for `POST api/mailbox/v2/p3/community/react` — validator at
 * `backend/routes/mailboxV2Phase3.js:51`. `reactionType` is one of
 * `acknowledged` / `will_attend` / `concerned` / `thumbs_up`.
 */
@JsonClass(generateAdapter = true)
data class CommunityReactRequest(
    @Json(name = "communityItemId") val communityItemId: String,
    @Json(name = "reactionType") val reactionType: String,
)

/** `POST api/mailbox/v2/p3/community/react` envelope — route line 738. */
@JsonClass(generateAdapter = true)
data class CommunityReactResponse(
    @Json(name = "message") val message: String? = null,
    @Json(name = "reactions") val reactions: List<CommunityReactionCountDto>? = null,
)

/**
 * Wire body for `POST api/mailbox/v2/p3/community/flag` — validator at
 * `backend/routes/mailboxV2Phase3.js:60`.
 */
@JsonClass(generateAdapter = true)
data class CommunityFlagRequest(
    @Json(name = "communityItemId") val communityItemId: String,
)

/** `POST api/mailbox/v2/p3/community/flag` envelope — route line 805. */
@JsonClass(generateAdapter = true)
data class CommunityFlagResponse(
    @Json(name = "message") val message: String? = null,
)
