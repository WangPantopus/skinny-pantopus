package app.pantopus.android.data.api.models.plans

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Nearby Plans: the wire shapes of `/api/plans` (the build brief's contract, section 5).
 *
 * A plan reaches the app as one [PlanDto]. Everyone allowed to see it gets the public card; the host and the
 * people who are in also get the private parts ([PlanDto.place], [PlanDto.people], [PlanDto.chatRoomId],
 * [PlanDto.myRequest]) and the host gets [PlanDto.requestsCount] and [PlanDto.autoRules]. Those fields are null
 * for everyone else, so "is the private part here" is the only test the screens need.
 *
 * Timestamps stay ISO-8601 strings on the wire; `PlanTimes` parses them.
 */

/** `area`: the public point and its name. `precision` is `area` (about 500 m) or `neighborhood` (playdates). */
@JsonClass(generateAdapter = true)
data class PlanAreaDto(
    @Json(name = "label") val label: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "precision") val precision: String? = null,
    /** The town ("Camas"). */
    @Json(name = "city") val city: String? = null,
)

/** `host`: first name and last initial, the verified badge and two counts. Never an address. */
@JsonClass(generateAdapter = true)
data class PlanHostDto(
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "verified_address") val verifiedAddress: Boolean = false,
    @Json(name = "plans_hosted") val plansHosted: Int = 0,
    @Json(name = "mutual_connections") val mutualConnections: Int = 0,
    /** Ended plans of this plan's kind ("Hosted 2 playdates"). */
    @Json(name = "kind_hosted") val kindHosted: Int? = null,
    /** Median minutes the host takes to answer; null with fewer than 3 answers. */
    @Json(name = "typical_answer_minutes") val typicalAnswerMinutes: Int? = null,
)

/** `details.game`: the game a watch party is for. */
@JsonClass(generateAdapter = true)
data class PlanGameRefDto(
    @Json(name = "label") val label: String? = null,
    @Json(name = "starts_at") val startsAt: String? = null,
)

/** `details`: the per-type facts (brief section 4). Every field is optional. */
@JsonClass(generateAdapter = true)
data class PlanDetailsDto(
    @Json(name = "game") val game: PlanGameRefDto? = null,
    @Json(name = "sport") val sport: String? = null,
    @Json(name = "level") val level: String? = null,
    @Json(name = "extra_gear") val extraGear: Boolean? = null,
    @Json(name = "kids_age_bands") val kidsAgeBands: List<String>? = null,
    @Json(name = "walk_kind") val walkKind: String? = null,
    @Json(name = "pace") val pace: String? = null,
    @Json(name = "dogs_welcome") val dogsWelcome: Boolean? = null,
)

/**
 * `viewer`: where the person looking stands. `role` is `none`, `host` or `guest`; `request_status` is a
 * `PlanRequest.status`; `cannot_ask_reason` is one of the codes in `PlanCannotAsk`.
 */
@JsonClass(generateAdapter = true)
data class PlanViewerDto(
    @Json(name = "role") val role: String? = null,
    @Json(name = "request_status") val requestStatus: String? = null,
    @Json(name = "waitlist_position") val waitlistPosition: Int? = null,
    @Json(name = "can_ask") val canAsk: Boolean = false,
    @Json(name = "cannot_ask_reason") val cannotAskReason: String? = null,
    /** The rule that would let this viewer in right now (`anyone_nearby`, `verified`, `hosted_before`), or null. */
    @Json(name = "auto_rule") val autoRule: String? = null,
    /** True once this viewer answered "How was it" (A5). */
    @Json(name = "feedback_given") val feedbackGiven: Boolean = false,
)

/** `place`: the exact place. Only in a host's or an accepted guest's [PlanDto]. */
@JsonClass(generateAdapter = true)
data class PlanPlaceDto(
    @Json(name = "name") val name: String? = null,
    @Json(name = "address") val address: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "note") val note: String? = null,
)

/** One of `people`: who's going. Only in a host's or an accepted guest's [PlanDto]. */
@JsonClass(generateAdapter = true)
data class PlanPersonDto(
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "party_size") val partySize: Int = 1,
    @Json(name = "verified_address") val verifiedAddress: Boolean = false,
    @Json(name = "is_host") val isHost: Boolean = false,
    @Json(name = "on_my_way") val onMyWay: Boolean = false,
    /** Host view only (H9): the person's distance band, when the server adds it. */
    @Json(name = "distance_band") val distanceBand: String? = null,
    /** Host view only (H9): "you hosted Alex before". */
    @Json(name = "hosted_before") val hostedBefore: Boolean? = null,
    /** Host view only: the person's request, so the host can remove them (H9). */
    @Json(name = "request_id") val requestId: String? = null,
    @Json(name = "plans_joined") val plansJoined: Int? = null,
    @Json(name = "new_to_pantopus") val newToPantopus: Boolean? = null,
    @Json(name = "reconfirm_needed") val reconfirmNeeded: Boolean? = null,
    @Json(name = "kids_count") val kidsCount: Int? = null,
    @Json(name = "kids_age_bands") val kidsAgeBands: List<String>? = null,
)

/** `my_request`: the viewer's own request, once they have one. */
@JsonClass(generateAdapter = true)
data class PlanMyRequestDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "party_size") val partySize: Int? = null,
    @Json(name = "reconfirm_needed") val reconfirmNeeded: Boolean = false,
    /** What the host's change asked "Still coming?" about: "time", "place" or "both" (null from older servers). */
    @Json(name = "reconfirm_reason") val reconfirmReason: String? = null,
    @Json(name = "note") val note: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "kids_count") val kidsCount: Int? = null,
    @Json(name = "kids_age_bands") val kidsAgeBands: List<String>? = null,
    @Json(name = "on_my_way") val onMyWay: Boolean = false,
    @Json(name = "waitlist_position") val waitlistPosition: Int? = null,
    @Json(name = "decided_by") val decidedBy: String? = null,
    @Json(name = "decided_at") val decidedAt: String? = null,
    @Json(name = "asks_left") val asksLeft: Int? = null,
)

/**
 * PlanCard, PlanDetail and the host's extras in one shape (brief section 5). The fields after [shareUrl] are
 * null unless the viewer is the host or is in.
 */
@Suppress("LongParameterList")
@JsonClass(generateAdapter = true)
data class PlanDto(
    @Json(name = "id") val id: String,
    @Json(name = "kind") val kind: String = "",
    @Json(name = "title") val title: String = "",
    @Json(name = "about") val about: String? = null,
    /** Null for a playdate until the viewer is in or hosting. */
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    @Json(name = "day_part") val dayPart: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    /** The plan's local date (`YYYY-MM-DD`), present even when the time is hidden ("Saturday morning"). */
    @Json(name = "starts_on") val localDateRaw: String? = null,
    /** When asking closes (the start, or 30 minutes before the end for pickup games and walks); null when hidden. */
    @Json(name = "asking_closes_at") val askingClosesAt: String? = null,
    @Json(name = "area") val area: PlanAreaDto? = null,
    @Json(name = "distance_band") val distanceBand: String? = null,
    @Json(name = "place_kind") val placeKind: String? = null,
    @Json(name = "host") val host: PlanHostDto? = null,
    @Json(name = "spots") val spots: Int = 0,
    @Json(name = "going_count") val goingCount: Int = 0,
    @Json(name = "spots_left") val spotsLeft: Int = 0,
    @Json(name = "is_full") val isFull: Boolean = false,
    @Json(name = "waitlist_count") val waitlistCount: Int = 0,
    @Json(name = "details") val details: PlanDetailsDto? = null,
    @Json(name = "how_people_get_in") val howPeopleGetIn: String? = null,
    @Json(name = "join_requirement") val joinRequirement: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "viewer") val viewer: PlanViewerDto? = null,
    @Json(name = "share_url") val shareUrl: String? = null,
    // PlanDetail: the host and people who are in.
    @Json(name = "place") val place: PlanPlaceDto? = null,
    @Json(name = "people") val people: List<PlanPersonDto>? = null,
    @Json(name = "chat_room_id") val chatRoomId: String? = null,
    /** False once the chat is read-only (24 hours after the end) or the plan is cancelled. */
    @Json(name = "chat_open") val chatOpen: Boolean? = null,
    /** The host's note when they cancelled. */
    @Json(name = "cancel_note") val cancelNote: String? = null,
    /** The viewer's own request, any status (top level of the card and the detail). */
    @Json(name = "my_request") val myRequest: PlanMyRequestDto? = null,
    // The host only.
    @Json(name = "requests_count") val requestsCount: Int? = null,
    @Json(name = "auto_rules") val autoRules: List<String>? = null,
    @Json(name = "guest_note") val guestNote: String? = null,
)

/** `nearest_elsewhere` (F4): the closest town with plans 5 to 15 miles away when the page is empty. */
@JsonClass(generateAdapter = true)
data class PlansElsewhereDto(
    @Json(name = "city") val city: String? = null,
    @Json(name = "count") val count: Int = 0,
    @Json(name = "miles") val miles: Int? = null,
)

/** `GET /api/plans`: the list under the map, soonest first. */
@JsonClass(generateAdapter = true)
data class PlansListResponse(
    @Json(name = "items") val items: List<PlanDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
    @Json(name = "nearest_elsewhere") val nearestElsewhere: PlansElsewhereDto? = null,
)

/**
 * `viewer` on `GET /api/plans/mine`: where the person stands. [verifiedAddress] is a verified-resident home (postcard,
 * document, landlord or admin); [seesPlaydates] is that and `plans_playdates` on. Both default to true so an older
 * server changes nothing.
 */
@JsonClass(generateAdapter = true)
data class PlansStandingDto(
    @Json(name = "verified_address") val verifiedAddress: Boolean = true,
    @Json(name = "sees_playdates") val seesPlaydates: Boolean = true,
)

/** `GET /api/plans/mine`: the list's "Your plans" and the Today cards. */
@JsonClass(generateAdapter = true)
data class MyPlansResponse(
    @Json(name = "hosting") val hosting: List<PlanDto> = emptyList(),
    @Json(name = "going") val going: List<PlanDto> = emptyList(),
    @Json(name = "asked") val asked: List<PlanDto> = emptyList(),
    @Json(name = "waitlisted") val waitlisted: List<PlanDto> = emptyList(),
    /** Ended in the last 2 days, the viewer hosted or was in (A5). */
    @Json(name = "recent") val recent: List<PlanDto> = emptyList(),
    @Json(name = "viewer") val viewer: PlansStandingDto? = null,
)

/** One pin of `GET /api/posts/map?layers=plans`: the area point for everyone, the exact point for people in. */
@JsonClass(generateAdapter = true)
data class PlanPinDto(
    @Json(name = "layer_type") val layerType: String = "plan",
    @Json(name = "id") val id: String,
    @Json(name = "kind") val kind: String = "",
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "precision") val precision: String? = null,
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    @Json(name = "day_part") val dayPart: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "starts_on") val startsOn: String? = null,
    @Json(name = "area_label") val areaLabel: String? = null,
    @Json(name = "title") val title: String? = null,
    @Json(name = "spots") val spots: Int = 0,
    @Json(name = "going_count") val goingCount: Int = 0,
    @Json(name = "spots_left") val spotsLeft: Int = 0,
    @Json(name = "is_full") val isFull: Boolean = false,
    @Json(name = "state") val state: String? = null,
    @Json(name = "viewer_role") val viewerRole: String? = null,
    @Json(name = "viewer_request_status") val viewerRequestStatus: String? = null,
    @Json(name = "distance_band") val distanceBand: String? = null,
)

/** `GET /api/posts/map` read for the Plans layer only; other layers' rows are dropped by `layer_type`. */
@JsonClass(generateAdapter = true)
data class PlanPinsResponse(
    @Json(name = "markers") val markers: List<PlanPinDto> = emptyList(),
)

/** `place` in the create body. `home_id` only for `kind = home`. */
@JsonClass(generateAdapter = true)
data class PlanPlaceInput(
    @Json(name = "kind") val kind: String,
    @Json(name = "name") val name: String? = null,
    @Json(name = "address") val address: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "home_id") val homeId: String? = null,
)

/** `gps` in the create body: proves the host is nearby; never the pin. */
@JsonClass(generateAdapter = true)
data class PlanGpsInput(
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    /** ISO-8601 time of the fix. */
    @Json(name = "timestamp") val timestamp: String,
)

/** `POST /api/plans` body. */
@Suppress("LongParameterList")
@JsonClass(generateAdapter = true)
data class CreatePlanBody(
    @Json(name = "kind") val kind: String,
    @Json(name = "title") val title: String,
    @Json(name = "about") val about: String? = null,
    @Json(name = "starts_at") val startsAt: String,
    @Json(name = "ends_at") val endsAt: String,
    @Json(name = "place") val place: PlanPlaceInput,
    @Json(name = "spots") val spots: Int,
    @Json(name = "auto_rules") val autoRules: List<String> = emptyList(),
    @Json(name = "join_requirement") val joinRequirement: String,
    @Json(name = "details") val details: PlanDetailsDto? = null,
    @Json(name = "guest_note") val guestNote: String? = null,
    @Json(name = "gps") val gps: PlanGpsInput? = null,
    /** A5 "Host again": the plan this one copies (records the funnel). */
    @Json(name = "hosted_again_from") val hostedAgainFrom: String? = null,
)

/** `PATCH /api/plans/:id` body: only the fields being changed (nulls are left out). */
@Suppress("LongParameterList")
@JsonClass(generateAdapter = true)
data class UpdatePlanBody(
    @Json(name = "title") val title: String? = null,
    @Json(name = "about") val about: String? = null,
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    @Json(name = "place") val place: PlanPlaceInput? = null,
    @Json(name = "spots") val spots: Int? = null,
    @Json(name = "auto_rules") val autoRules: List<String>? = null,
    @Json(name = "details") val details: PlanDetailsDto? = null,
    @Json(name = "guest_note") val guestNote: String? = null,
)

/** `POST /api/plans/:id/cancel` body. */
@JsonClass(generateAdapter = true)
data class CancelPlanBody(
    @Json(name = "note") val note: String? = null,
)

/** `POST /api/plans/:id/requests` body. The kids fields are for playdates only. */
@JsonClass(generateAdapter = true)
data class AskToJoinBody(
    @Json(name = "party_size") val partySize: Int,
    @Json(name = "note") val note: String? = null,
    @Json(name = "kids_count") val kidsCount: Int? = null,
    @Json(name = "kids_age_bands") val kidsAgeBands: List<String>? = null,
    @Json(name = "stays_with_kids") val staysWithKids: Boolean? = null,
    /** A fresh fix when the person browses by location (homes and saved places count without it). */
    @Json(name = "gps") val gps: PlanGpsInput? = null,
)

/** `POST /api/plans/:id/report` body: reason is spam, harassment, inappropriate, misinformation, safety or other. */
@JsonClass(generateAdapter = true)
data class PlanReportBody(
    @Json(name = "reason") val reason: String,
    @Json(name = "details") val details: String? = null,
)

/** `request` in the ask reply. */
@JsonClass(generateAdapter = true)
data class PlanRequestRefDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "waitlist_position") val waitlistPosition: Int? = null,
)

/** `POST /api/plans/:id/requests` reply: the request and the plan as the asker now sees it. */
@JsonClass(generateAdapter = true)
data class AskToJoinResponse(
    @Json(name = "request") val request: PlanRequestRefDto? = null,
    @Json(name = "plan") val plan: PlanDto? = null,
)

/** `RequestView.user`: what a host sees about someone who asked. Never an address. */
@JsonClass(generateAdapter = true)
data class PlanRequestUserDto(
    @Json(name = "new_to_pantopus") val newToPantopus: Boolean = false,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "verified_address") val verifiedAddress: Boolean = false,
    @Json(name = "distance_band") val distanceBand: String? = null,
    @Json(name = "plans_joined") val plansJoined: Int = 0,
    @Json(name = "mutual_connections") val mutualConnections: Int = 0,
    @Json(name = "hosted_before") val hostedBefore: Boolean = false,
)

/** `RequestView`: one request on H10. */
@JsonClass(generateAdapter = true)
data class PlanRequestViewDto(
    @Json(name = "id") val id: String,
    @Json(name = "user") val user: PlanRequestUserDto? = null,
    @Json(name = "party_size") val partySize: Int = 1,
    @Json(name = "note") val note: String? = null,
    @Json(name = "kids_count") val kidsCount: Int? = null,
    @Json(name = "kids_age_bands") val kidsAgeBands: List<String>? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** `GET /api/plans/:id/requests` (host only). */
@JsonClass(generateAdapter = true)
data class PlanRequestsResponse(
    @Json(name = "pending") val pending: List<PlanRequestViewDto> = emptyList(),
    @Json(name = "waitlisted") val waitlisted: List<PlanRequestViewDto> = emptyList(),
)

/** `POST …/accept` body: `confirm_shares_address` the first time a host accepts someone at home (H10). */
@JsonClass(generateAdapter = true)
data class AcceptRequestBody(
    @Json(name = "confirm_shares_address") val confirmSharesAddress: Boolean? = null,
)

/** `POST /api/plans/:id/still-coming` body. `false` leaves the plan. */
@JsonClass(generateAdapter = true)
data class StillComingBody(
    @Json(name = "coming") val coming: Boolean,
)

/** `POST /api/plans/:id/feedback` body. `answer` is `great`, `ok` or `not_right`. */
@JsonClass(generateAdapter = true)
data class PlanFeedbackBody(
    @Json(name = "answer") val answer: String,
    @Json(name = "note") val note: String? = null,
)

/** One upcoming game for the watch-party composer (H2). */
@JsonClass(generateAdapter = true)
data class PlanGameDto(
    @Json(name = "id") val id: String,
    @Json(name = "label") val label: String = "",
    @Json(name = "team") val team: String? = null,
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    @Json(name = "source") val source: String? = null,
)

/** `GET /api/plans/games`. Empty is fine: the composer then offers only "Another game". */
@JsonClass(generateAdapter = true)
data class PlanGamesResponse(
    @Json(name = "games") val games: List<PlanGameDto> = emptyList(),
)

/** `center` of a public place. */
@JsonClass(generateAdapter = true)
data class PlanPlaceCenterDto(
    @Json(name = "lat") val lat: Double? = null,
    @Json(name = "lng") val lng: Double? = null,
)

/** One public place for H6 (the `GET /api/geo/places/nearby` row shape, filtered by the server). */
@JsonClass(generateAdapter = true)
data class PlanNearbyPlaceDto(
    @Json(name = "place_id") val placeId: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "category") val category: String? = null,
    /** Every kind the place is ("court", "tennis"), the main one first. */
    @Json(name = "categories") val categories: List<String>? = null,
    @Json(name = "address") val address: String? = null,
    @Json(name = "full_address") val fullAddress: String? = null,
    @Json(name = "center") val center: PlanPlaceCenterDto? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "kind") val kind: String? = null,
    @Json(name = "distance_m") val distanceMeters: Double? = null,
    @Json(name = "distance_band") val distanceBand: String? = null,
)

/**
 * `GET /api/plans/places/nearby`. [loading] is true (with a 202 and no places) the first time an area is asked for
 * while the source is slow; [attribution] is the credit the list must show ("© OpenStreetMap contributors").
 */
@JsonClass(generateAdapter = true)
data class PlanNearbyPlacesResponse(
    @Json(name = "places") val places: List<PlanNearbyPlaceDto> = emptyList(),
    @Json(name = "loading") val loading: Boolean = false,
    @Json(name = "attribution") val attribution: String? = null,
)

/**
 * `GET /api/public/plans/:id` (the web page's read): the public card, or for a playdate only
 * `{ kind: "playdate", city }`. The app reads it when `GET /api/plans/:id` says 404, to tell a playdate it may not
 * see yet (J9) from a plan that is gone.
 */
@JsonClass(generateAdapter = true)
data class PublicPlanDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "kind") val kind: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "title") val title: String? = null,
)

/** `GET /api/feature-flags/:flagName`: whether a flag is on for the signed-in person. */
@JsonClass(generateAdapter = true)
data class FeatureFlagResponse(
    @Json(name = "flagName") val flagName: String? = null,
    @Json(name = "enabled") val enabled: Boolean = false,
)
