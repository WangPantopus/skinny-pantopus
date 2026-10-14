package app.pantopus.android.data.api.models.pulse

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// The Pulse contract's frozen shapes (docs/product/pulse-build/02-contract.md section 2). Every field is optional
// until PB's routes are on master (hold point H4), and every enum-like value is a plain string: the screens map the
// values they know and fall back to a generic reading for the rest, so a newer backend never breaks an older build.

/** Local saved page, including the request's start time. Reopening a copy never advances its read boundary. */
@JsonClass(generateAdapter = true)
data class PulseFeedCopy(
    val response: PulseFeedResponse,
    val readAt: String,
)

/** `GET /api/pulse/feed` (contract 2.3). */
@JsonClass(generateAdapter = true)
data class PulseFeedResponse(
    val view: String? = null,
    /** Server snapshot boundary; never substitute the device clock when acknowledging a page. */
    @Json(name = "read_at") val readAt: String? = null,
    val area: PulseAreaDto? = null,
    /** The area pill's choices; streets and neighborhoods appear only when they are open. */
    @Json(name = "areas_available") val areasAvailable: List<PulseAreaOptionDto>? = null,
    /** `{ reason: sparse | no_home | empty, card: meter | set_up_home | null }`, or null. */
    val quiet: PulseQuietDto? = null,
    /** Street, neighborhood, town: only the open areas, newest first inside each. */
    val groups: List<PulseGroupDto>? = null,
    val end: PulseEndDto? = null,
)

@JsonClass(generateAdapter = true)
data class PulseAreaDto(
    val id: String? = null,
    /** `town`, `neighborhood`, `street` or `place`. */
    val kind: String? = null,
    val name: String? = null,
    val state: String? = null,
    val title: String? = null,
)

/** Open areas of the primary home (`GET /api/pulse/areas/mine`, contract 2.2). */
@JsonClass(generateAdapter = true)
data class PulseMyAreasResponse(
    val town: PulseAreaDto? = null,
    val neighborhood: PulseAreaDto? = null,
    val street: PulseAreaDto? = null,
    @Json(name = "home_verified") val homeVerified: Boolean? = null,
)

/** Open towns only; no location or home details (`GET /api/pulse/areas/search`, contract 2.2). */
@JsonClass(generateAdapter = true)
data class PulseAreaSearchResponse(
    val areas: List<PulseAreaDto>? = null,
)

@JsonClass(generateAdapter = true)
data class PulseAreaOptionDto(
    val id: String? = null,
    val kind: String? = null,
    val name: String? = null,
    val title: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseQuietDto(
    val reason: String? = null,
    val card: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseGroupDto(
    /** `street`, `neighborhood`, `town`, or `earlier` for "Show earlier". */
    val key: String? = null,
    /** The header as it reads: "AROUND CAMAS". */
    val title: String? = null,
    @Json(name = "area_id") val areaId: String? = null,
    val items: List<PulsePostDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PulseEndDto(
    @Json(name = "caught_up") val caughtUp: Boolean? = null,
    /** When the page last had nothing newer: "since this morning". */
    val since: String? = null,
    @Json(name = "can_show_earlier") val canShowEarlier: Boolean? = null,
    @Json(name = "earlier_cursor") val earlierCursor: String? = null,
)

/** A feed item and the conversation's header (contract 2.1). */
@JsonClass(generateAdapter = true)
data class PulsePostDto(
    val id: String,
    /** `ask_local`, `share`, `offer`, `alert`, `event`, `lost_found`, or `legacy` (the raw value is in [legacyType]). */
    val type: String? = null,
    @Json(name = "legacy_type") val legacyType: String? = null,
    /** One of the 12 topics, or null. */
    val topic: String? = null,
    val title: String? = null,
    val text: String? = null,
    val media: List<PulseMediaDto> = emptyList(),
    @Json(name = "created_at") val createdAt: String? = null,
    val author: PulseAuthorDto? = null,
    /** The place or area the post is about. */
    val about: PulseAboutDto? = null,
    /** `public`, `verified_town` or `verified_area`. */
    @Json(name = "read_scope") val readScope: String? = null,
    val status: PulseStatusDto? = null,
    val action: PulseActionDto? = null,
    val counts: PulseCountsDto? = null,
    val event: PulseEventDto? = null,
    @Json(name = "lost_found") val lostFound: PulseLostFoundDto? = null,
    val offer: PulseOfferDto? = null,
    val viewer: PulseViewerDto? = null,
    val moderation: PulseModerationDto? = null,
)

@JsonClass(generateAdapter = true)
data class PulseMediaDto(
    val url: String? = null,
    val type: String? = null,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
)

/** The writer, with the relationship to the area the post is in (contract 2.1 and build spec section 10). */
@JsonClass(generateAdapter = true)
data class PulseAuthorDto(
    /** Null on public and signed-out responses. */
    val id: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    /** `resident`, `new_here`, `nearby`, `visitor`, `official`, `business` or `pantopus`. */
    val label: String? = null,
    /** Reader-relative and rounded, e.g. "0.6 mi" or "nearby"; null unless the reader has a verified home. */
    @Json(name = "distance_text") val distanceText: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "is_curator") val isCurator: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class PulseAboutDto(
    val label: String? = null,
    @Json(name = "area_id") val areaId: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseStatusDto(
    /** `open` or `resolved`. */
    val state: String? = null,
    /** `answered`, `closed`, `closed_unanswered`, `claimed`, `expired`, `happened` or `reunited`; null while open. */
    val resolution: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
)

/** The post type's one action and the viewer's state of it. */
@JsonClass(generateAdapter = true)
data class PulseActionDto(
    /** `answer`, `reply`, `claim`, `seen_it`, `going` or `its_mine`. */
    val kind: String? = null,
    val label: String? = null,
    val done: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class PulseCountsDto(
    val replies: Int? = null,
    /** Events only. */
    val going: Int? = null,
)

@JsonClass(generateAdapter = true)
data class PulseEventDto(
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    val venue: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseLostFoundDto(
    /** `lost` or `found`. */
    val kind: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseOfferDto(
    /** `choose` or `first`. */
    @Json(name = "claim_mode") val claimMode: String? = null,
    @Json(name = "requests_open") val requestsOpen: Boolean? = null,
    val gone: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class PulseViewerDto(
    @Json(name = "is_author") val isAuthor: Boolean? = null,
    val following: Boolean? = null,
    @Json(name = "can_mark_helpful") val canMarkHelpful: Boolean? = null,
    val saved: Boolean? = null,
    @Json(name = "can_keep_open") val canKeepOpen: Boolean? = null,
    @Json(name = "can_share") val canShare: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class PulseModerationDto(
    /** `live`, `held` or `removed`; held and removed only ever reach the author. */
    val state: String? = null,
)

/** `GET /api/pulse/feed/new` (contract 2.3): how many conversations wait behind the "↑ N new conversations" pill. */
@JsonClass(generateAdapter = true)
data class PulseNewCountResponse(
    val count: Int? = null,
)

/** `POST /api/pulse/feed/seen` body: the last-seen marker advances to [through]. */
@JsonClass(generateAdapter = true)
data class PulseSeenRequest(
    val view: String,
    val through: String,
)

/** A write's plain acknowledgement. */
@JsonClass(generateAdapter = true)
data class PulseAckResponse(
    val ok: Boolean? = null,
    /** The server-accepted monotonic seen marker, when acknowledging a page. */
    val through: String? = null,
)
