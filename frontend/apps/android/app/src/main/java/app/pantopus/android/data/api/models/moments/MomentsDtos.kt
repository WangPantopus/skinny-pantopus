package app.pantopus.android.data.api.models.moments

import app.pantopus.android.data.api.models.reinvented.MomentPlanDto
import app.pantopus.android.data.api.models.reinvented.MomentRepliesStateDto
import app.pantopus.android.data.living.MomentHeadingBody
import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.ToJson

/*
 * Pantopus Moments (contract v3.4, `~/pantopus-moments/coord/CONTRACT.md`, owned by the server session). Every route
 * answers 404 `MOMENTS_UNAVAILABLE` while the `moments` flag is off for the caller.
 */

/** Who posted a Moment: a person, a business, or the Pantopus curator. */
@JsonClass(generateAdapter = true)
data class MomentAuthorDto(
    val id: String,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    val initials: String? = null,
    val verified: Boolean = false,
    /** `person`, `business` or `pantopus`. */
    val kind: String = "person",
    /** Posted under a made-up name (made-up-names contract); false from a server without it. */
    @Json(name = "made_up_name") val madeUpName: Boolean = false,
)

/** One Moment in a ring, oldest first (the order they play in). */
@JsonClass(generateAdapter = true)
data class MomentBriefDto(
    val id: String,
    /** `photo`, `video` or `text`. */
    val kind: String,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    val seen: Boolean = false,
)

/** One person's Moments at one spot: a ring on the map. */
@JsonClass(generateAdapter = true)
data class MomentRingDto(
    /** Stable and opaque: author + spot cell. */
    val id: String,
    val author: MomentAuthorDto,
    /** The exact pin, or the approximate grid point when shown as an area; absent for [noLocation] rings. */
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    /** Moments posted with no location (contract v3.4, `GET /map` `unplaced`): in the row of faces, never on the map. */
    @Json(name = "no_location") val noLocation: Boolean = false,
    /** A place or a town, never a street address. */
    @Json(name = "place_label") val placeLabel: String? = null,
    val moments: List<MomentBriefDto> = emptyList(),
    @Json(name = "unseen_count") val unseenCount: Int = 0,
    @Json(name = "newest_at") val newestAt: String? = null,
    val mine: Boolean = false,
    /** A small look at the newest Moment, for the pin (contract v3.6); null without one and from an older server. */
    val preview: MomentRingPreviewDto? = null,
    /**
     * How high its newest Moment was made, in feet above sea level, and whether in flight (contract v3.8,
     * `MomentHeight.kt`); none unless heights are on for you and its author showed it. A number either way it is
     * written (4390 or 4390.0).
     */
    @Json(name = "altitude_ft") val altitudeFt: Double? = null,
    val flying: Boolean = false,
    /** The Sky: its newest Moment shows only its area (made at home), so its pin floats over its spot with no tail. */
    val floating: Boolean = false,
    /**
     * Until when the ring is live (API v4.1): the latest `live_until` among its Moments taken here, when its newest
     * Moment is an exact pin away from home; null otherwise and from an older server. The "Live now" chip and the dot.
     */
    @Json(name = "live_until") val liveUntil: String? = null,
)

/**
 * A small look at a ring's newest Moment, drawn inside its pin on the map (founder, 2026-11-11; contract v3.6,
 * `GET /api/moments/map`, built in backend/services/moments/momentStore.js `previewOf`). A photo or a video carries a
 * signed link to its small thumbnail (it lasts 15 minutes; the map is read again every minute); a text card carries its
 * background. Every field is optional, so a shape this app can't use only costs the picture.
 *
 * Looking at a preview is not watching the Moment: nothing is recorded, so the viewer never shows in Seen by. The
 * founder accepted that knowingly.
 */
@JsonClass(generateAdapter = true)
data class MomentRingPreviewDto(
    @Json(name = "moment_id") val momentId: String? = null,
    val kind: String? = null,
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    /** A text card's background name ("teal", "sky", "green", "amber", "rose", "slate"). */
    val background: String? = null,
) {
    val isText: Boolean get() = kind == "text"

    /** Whether there is something to draw: a text card always has its colours, a picture needs its Moment and link. */
    val canShow: Boolean get() = isText || (!momentId.isNullOrBlank() && !thumbUrl.isNullOrBlank())
}

/** A reaction and how many gave it (author only, most used first). */
@JsonClass(generateAdapter = true)
data class MomentReactionCountDto(
    val reaction: String,
    val count: Int = 0,
)

/** A whole Moment, as the viewer plays it. */
@JsonClass(generateAdapter = true)
data class MomentDto(
    val id: String,
    val author: MomentAuthorDto,
    val kind: String,
    /** `uploading`, `checking`, `live`, `held`, `ended` or (the Sky, author only) `scheduled` (others only ever get `live`). */
    val state: String = "live",
    val caption: String? = null,
    val text: String? = null,
    /** `teal`, `sky`, `green`, `amber`, `rose` or `slate` (text cards). */
    val background: String? = null,
    /** Signed and short-lived (15 minutes): never stored. */
    @Json(name = "media_url") val mediaUrl: String? = null,
    @Json(name = "poster_url") val posterUrl: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    @Json(name = "duration_ms") val durationMs: Long? = null,
    @Json(name = "place_label") val placeLabel: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "show_area") val showArea: Boolean = false,
    /** `nearby` or `connections`. */
    val audience: String = "nearby",
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    val hours: Int = 24,
    val seen: Boolean = false,
    @Json(name = "my_reaction") val myReaction: String? = null,
    /** Author only. */
    @Json(name = "viewer_count") val viewerCount: Int? = null,
    @Json(name = "reaction_counts") val reactionCounts: List<MomentReactionCountDto>? = null,
    /**
     * When the photo or video was taken, set only when that was more than a day before it was posted (contract v3.3):
     * the viewer says "Taken Oct 3" so an old photo never reads as now. Null for anything newer, text cards, and from a
     * server without it.
     */
    @Json(name = "taken_at") val takenAt: String? = null,
    /** Posted with no location (contract v3.4): no point or place, connections only. */
    @Json(name = "no_location") val noLocation: Boolean = false,
    /** How high it was made, in feet above sea level, and whether in flight (contract v3.8); `height` is the picture's. */
    @Json(name = "altitude_ft") val altitudeFt: Double? = null,
    val flying: Boolean = false,
    /** A part of a longer video posted as several Moments (contract v3.11); null for any other Moment. */
    val series: MomentSeriesDto? = null,
    /** The Sky (v4.0): it floats over an area (its point is the area's). */
    val floating: Boolean = false,
    /** The Sky: it was shared later, so the viewer says "Earlier today" (or "Yesterday") in place of "12m ago". */
    val earlier: Boolean = false,
    /** The Sky, for its author only: when it shares (or shared). */
    @Json(name = "share_at") val shareAt: String? = null,
    /**
     * The Live mark (API v4.1): the app's own camera took it at this spot. Never set with [takenAt], at home, on an area
     * or with no location; false from an older server.
     */
    @Json(name = "taken_here") val takenHere: Boolean = false,
    /** Until when it reads "Live from here", then "Taken here"; null for one shared later, which never reads Live. */
    @Json(name = "live_until") val liveUntil: String? = null,
    /** The weather when it was posted ("31°F · Snow"); only on a Moment taken here whose author showed it. */
    val weather: MomentWeatherDto? = null,
    /** "Pulse, reinvented" (CONTRACT 2c): the stamps placed on it, with their values; only to a person whose switch is on. */
    val stamps: List<MomentStampDto>? = null,
    /** "Pulse, reinvented" (CONTRACT 4): the signal you gave it (one of the five), for a person whose switch is on. */
    @Json(name = "my_signal") val mySignal: String? = null,
    /** "Pulse, reinvented" (CONTRACT 3): until when its author may still change it; the author's own, switch on only. */
    @Json(name = "editable_until") val editableUntil: String? = null,
    /** "Pulse, reinvented" (CONTRACT 3): every stamp's kept value an edit may place, by kind (null where none). */
    @Json(name = "stamp_choices") val stampChoices: Map<String, MomentStampValueDto?>? = null,
    /** "Pulse, reinvented" (CONTRACT 5b): a guess-the-spot Moment's guesses, for a reader whose switch is on; else null. */
    val guess: MomentGuessStateDto? = null,
    /** "Pulse, reinvented" (CONTRACT 6d): "Keep this?" is offered on the author's own Moment; false from today's server. */
    @Json(name = "keep_offer") val keepOffer: Boolean = false,
    /** "Pulse, reinvented" (CONTRACT 6g): the plan started from it that this reader may see in Plans; else null. */
    val plan: MomentPlanDto? = null,
    /** "Pulse, reinvented" (CONTRACT 8a): replies people can see on it, for a reader whose switch is on; else null. */
    val replies: MomentRepliesStateDto? = null,
    /** "Pulse, reinvented" (CONTRACT 7h): the people its caption mentions, for a reader whose switch is on; else null. */
    val mentions: List<MomentAuthorDto>? = null,
    /** "Pulse, reinvented" (CONTRACT 7b, 7g): its playable items, for a reader whose switch is on; else null. */
    val play: List<MomentPlayItemDto>? = null,
    /** "Pulse, reinvented" (CONTRACT 7c): Illuminate's dots, for a reader whose switch is on; else null. */
    val dots: List<MomentDotDto>? = null,
    /** "Pulse, reinvented" (CONTRACT 8e): the Retake it belongs to, for a reader whose switch is on; else null. */
    val retake: app.pantopus.android.data.api.models.reinvented.MomentRetakeStateDto? = null,
    /** "Pulse, reinvented" (CONTRACT 8h): the convergence it joined, for a reader whose switch is on; else null. */
    val convergence: app.pantopus.android.data.api.models.reinvented.MomentConvergenceStateDto? = null,
    /** "Pulse, reinvented" (CONTRACT 10c): its author's whole picture, shown fit and never cut; false from today's server. */
    val whole: Boolean = false,
    /** "Pulse, reinvented" (CONTRACT 10c): the two colours a whole picture sits on; else null. */
    val backdrop: MomentBackdropDto? = null,
    /** "Pulse, reinvented" (CONTRACT 8i): the pinboard it starts or is a piece of, for a reader whose switch is on; else null. */
    val pinboard: app.pantopus.android.data.api.models.reinvented.MomentPinboardStateDto? = null,
    /** "Pulse, reinvented" (CONTRACT 8g): how it opens later, for a reader whose switch is on; else null. */
    val seal: app.pantopus.android.data.api.models.reinvented.MomentSealStateDto? = null,
    /** "Pulse, reinvented" (CONTRACT 7e): its place sound or voice, for a reader whose switch is on; else null. */
    val sound: app.pantopus.android.data.moments.sound.MomentSoundDto? = null,
)

/**
 * A Moment's weather stamp (API v4.1, `momentWeather.weatherAt`): whole degrees Fahrenheit, one of nine kinds for the
 * icon (`clear`, `partly_cloudy`, `cloudy`, `fog`, `rain`, `snow`, `sleet`, `thunderstorm`, `wind`) and the words to
 * show ("Snow", "Wind 38 mph").
 */
@JsonClass(generateAdapter = true)
data class MomentWeatherDto(
    /** Whole degrees as the server sends them; a Double so "31.0" or a stray fraction never fails the Moment. */
    @Json(name = "temp_f") val tempF: Double? = null,
    val kind: String? = null,
    val label: String? = null,
)

/**
 * A part of a video longer than one Moment, posted as several Moments in order (contract v3.11): the same [id] on every
 * part, which part this is (1 first) and of how many.
 */
@JsonClass(generateAdapter = true)
data class MomentSeriesDto(
    val id: String,
    val index: Int,
    val count: Int,
)

/**
 * `GET /api/moments/limits` (contract v3.11): what a Moment may be, so a video is shaped before it goes up. Every field
 * is optional here; an older server answers 404 and the app keeps to 30 seconds in one part.
 */
@JsonClass(generateAdapter = true)
data class MomentLimitsResponse(
    val video: MomentVideoLimitsDto? = null,
    @Json(name = "daily_limit") val dailyLimit: Int? = null,
)

@JsonClass(generateAdapter = true)
data class MomentVideoLimitsDto(
    /** The longest one Moment's video runs. */
    @Json(name = "max_seconds") val maxSeconds: Double? = null,
    /** How many Moments a longer video may be posted as. */
    @Json(name = "max_parts") val maxParts: Int? = null,
    /** The largest video file an upload may be (less than 50 MB when storage takes less). */
    @Json(name = "max_bytes") val maxBytes: Long? = null,
)

@JsonClass(generateAdapter = true)
data class MomentsMapResponse(
    val rings: List<MomentRingDto> = emptyList(),
    /** Connections' (and your own) Moments with no location, one ring per person, whatever the area (contract v3.4). */
    val unplaced: List<MomentRingDto> = emptyList(),
    /** Heights are on for you (contract v3.9): the map offers "Elevation". False from a server before it. */
    @Json(name = "heights_on") val heightsOn: Boolean = false,
    /**
     * Moments with an elevation float by day (contract v3.10, `moment_float`), and where the sun is; false and null from
     * a server before it.
     */
    @Json(name = "float_on") val floatOn: Boolean = false,
    val sun: MomentSunDto? = null,
    /** "Pulse, reinvented" (CONTRACT 5d): live guess-the-spot Moments here, with no point; only for a reader whose switch is on. */
    @Json(name = "guess_spots") val guessSpots: List<MomentGuessSpotDto>? = null,
    /** The Sky: your own Moments waiting to share later, for your row only; empty while the Sky is off for you. */
    val scheduled: List<MomentDto> = emptyList(),
)

/**
 * Where the sun is over the middle of the map right now (contract v3.10): sent only while Moments float for you
 * (`float_on`). Degrees clockwise from true north, and above the horizon (negative after sunset).
 */
@JsonClass(generateAdapter = true)
data class MomentSunDto(
    @Json(name = "azimuth_deg") val azimuthDeg: Double? = null,
    @Json(name = "elevation_deg") val elevationDeg: Double? = null,
) {
    /** The sun is above the horizon and the answer says where: pins can float. */
    val isUp: Boolean get() = azimuthDeg != null && (elevationDeg ?: 0.0) > 0.0
}

@JsonClass(generateAdapter = true)
data class MomentsMineResponse(
    val moments: List<MomentDto> = emptyList(),
)

/** `GET /api/moments/unseen` (contract v3): how many people near you have something new for the tab's dot. */
@JsonClass(generateAdapter = true)
data class MomentsUnseenResponse(
    val count: Int = 0,
)

@JsonClass(generateAdapter = true)
data class MomentEnvelope(
    val moment: MomentDto,
)

/** A point for place-preview; none (location off) asks only for the 18+ state and `has_connections` (contract v3.4). */
@JsonClass(generateAdapter = true)
data class MomentPointBody(
    val latitude: Double? = null,
    val longitude: Double? = null,
    /** API v4.1: ask for the weather a Moment taken here would keep; only at the author's own fix, never a library item's. */
    val weather: Boolean? = null,
)

/** What the camera's chip and the Post sheet say about a spot before posting. */
@JsonClass(generateAdapter = true)
data class MomentPlacePreviewDto(
    @Json(name = "place_label") val placeLabel: String? = null,
    /** The town others see when "Show the area instead" is on. */
    @Json(name = "area_label") val areaLabel: String? = null,
    /** Within about 60 m of a home the caller lives at: the Post sheet says so first (P4). */
    @Json(name = "at_home") val atHome: Boolean = false,
    /** False: the one-time 18+ sheet comes before the camera. */
    @Json(name = "adult_confirmed") val adultConfirmed: Boolean = true,
    /**
     * The names that fit an exact pin here (contract v3, at most 6): the automatic [placeLabel] first, then other places
     * within about 100 m, the street's name and the town. Null from a server without it; one entry: nothing to pick.
     */
    val places: List<MomentPlaceChoiceDto>? = null,
    /** How far from the pin the place picker's venues may be (contract v3.3, 1500 m); null from an older server. */
    @Json(name = "pick_within_m") val pickWithinM: Int? = null,
    /** Whether you have a connection (contract v3.4): a Moment with no location needs one. Null from an older server. */
    @Json(name = "has_connections") val hasConnections: Boolean? = null,
    /** The sheet may offer "Show elevation" here (contract v3.8): heights are on for you and it isn't your home. */
    @Json(name = "can_show_height") val canShowHeight: Boolean = false,
    /** The Sky (Moments API v4.0): true while `sky_places` is on for you; the Post sheet then draws the Sky's rows. */
    val sky: Boolean = false,
    /** The Sky: the area the point floats over (its town, the area's own point, the disc's radius); null with no point. */
    val area: MomentSkyAreaDto? = null,
    /** The Sky: the public place that names the spot, what "Pin it at a place" starts with; null where there is none. */
    @Json(name = "place") val skyPlace: MomentPlaceChoiceDto? = null,
    /** The Sky: a pin is possible here (false at home). */
    @Json(name = "can_pin") val canPin: Boolean = false,
    /** The Sky: the "Share later" times on offer now ("In 1 hour", "In 3 hours", "Tonight at 8" before 7 pm). */
    @Json(name = "share_later") val shareLater: List<MomentShareLaterDto>? = null,
    /**
     * API v4.1, only when asked with `weather: true`: the stamp a Moment taken here would keep now, or null (at home, no
     * fresh reading within 2 seconds): then "Show the weather" isn't offered.
     */
    val weather: MomentWeatherDto? = null,
)

/** The Sky: the area a point floats over (Moments API v4.0). */
@JsonClass(generateAdapter = true)
data class MomentSkyAreaDto(
    val label: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "radius_m") val radiusM: Double? = null,
)

/** The Sky: one "Share later" choice, `1h`, `3h` or `tonight`, its words and when it would share (ISO). */
@JsonClass(generateAdapter = true)
data class MomentShareLaterDto(
    val key: String,
    val label: String,
    val at: String? = null,
)

/** One name the Post sheet offers for the pin: [key] goes back as `place_key`, never the words. */
@JsonClass(generateAdapter = true)
data class MomentPlaceChoiceDto(
    val key: String,
    val label: String,
)

@JsonClass(generateAdapter = true)
data class MomentAdultConfirmResponse(
    @Json(name = "attested_at") val attestedAt: String? = null,
)

/**
 * Where a Moment pins: `gps` (the phone's fix, at most 5 minutes old, with [fixAt]), `capture` (where an album item
 * was taken, from any time, with [takenAt]) or `none` (no location: connections only, no point; contract v3.4).
 */
@JsonClass(generateAdapter = true)
data class MomentLocationBody(
    val source: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "fix_at") val fixAt: String? = null,
    @Json(name = "taken_at") val takenAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class CreateMomentBody(
    val kind: String,
    val hours: Int,
    val audience: String,
    @Json(name = "show_area") val showArea: Boolean,
    val caption: String? = null,
    val text: String? = null,
    val background: String? = null,
    val location: MomentLocationBody,
    /** One per Post tap: a retry of the same tap gets back the Moment it made instead of a second one. */
    @Json(name = "client_request_id") val clientRequestId: String? = null,
    /** The name picked on the Post sheet (a key from place-preview's `places`); left out for the automatic one. */
    @Json(name = "place_key") val placeKey: String? = null,
    /** When an album photo or video pinned where you are (its file doesn't say where) was taken (contract v3.3). */
    @Json(name = "taken_at") val takenAt: String? = null,
    /** A venue picked in the place picker around the pin (its `osm:` id, contract v3.3): the Moment pins there. */
    @Json(name = "venue_id") val venueId: String? = null,
    /** "Show elevation" was on (contract v3.8); left out otherwise. */
    val altitude: MomentAltitudeBody? = null,
    /** One part of a video posted as several Moments (contract v3.11); left out for a video posted as one. */
    val series: MomentSeriesDto? = null,
    /** The Sky (v4.0): `place` pins the Moment at a public place (the `venue_id`, else the one naming the spot). */
    val pin: String? = null,
    /** The Sky (v4.0): hold the Moment until then, `1h`, `3h` or `tonight`; left out to post now. */
    @Json(name = "share_later") val shareLater: String? = null,
    /** API v4.1: the app's own camera took this photo or video just now; the server keeps the Live mark only where it may. */
    @Json(name = "taken_here") val takenHere: Boolean? = null,
    /** API v4.1: "Show the weather" was on; the server reads the weather itself (a phone's reading is never sent). */
    @Json(name = "show_weather") val showWeather: Boolean? = null,
    /**
     * "Pulse, reinvented"'s Studio: `pen_name` posts the Moment under the person's made-up name (made-up-names contract,
     * "Moments"); left out otherwise.
     */
    @Json(name = "post_as") val postAs: String? = null,
    /** "Pulse, reinvented"'s Studio: the stamps placed on it (CONTRACT 2b); left out otherwise. */
    val stamps: List<MomentStampPlacement>? = null,
    /** The Studio: the height reading for an elevation stamp (CONTRACT 2b); left out otherwise. */
    val elevation: MomentAltitudeBody? = null,
    /** The Studio's "Guess the spot" (CONTRACT 5a): `true` only when picked; left out otherwise. */
    val guess: Boolean? = null,
    /** The Studio drawer's "Also show in Explore" (CONTRACT 6f): `true` only when chosen; left out otherwise. */
    val explore: Boolean? = null,
    /** The Studio's mentions (CONTRACT 7h): up to five person ids named in the caption; left out otherwise. */
    val mentions: List<String>? = null,
    /** The Studio's playable items (CONTRACT 7b, 7g: before and after so far); left out otherwise. */
    val play: List<MomentPlayItemDto>? = null,
    /** The Studio's dots (CONTRACT 7c): up to eight; left out otherwise. */
    val dots: List<MomentDotDto>? = null,
    /** CONTRACT 9h: the compass at the camera's own shot, switch on only (`data/living/LivingCompass.kt`); null left out. */
    val heading: MomentHeadingBody? = null,
    /** The Studio's whole photo (CONTRACT 10c): `true` only when it shows whole; left out otherwise. */
    val whole: Boolean? = null,
    /** The Studio's whole photo (CONTRACT 10c): the two colours it sits on, with `whole` only; left out otherwise. */
    val backdrop: MomentBackdropDto? = null,
)

/**
 * "Show elevation" (contract v3.8): how high above sea level the fix, or the album photo, says the Moment was made, with
 * how far off that may be and the phone's speed (which tells a flight from a mountain) when the phone knows them.
 */
@JsonClass(generateAdapter = true)
data class MomentAltitudeBody(
    val meters: Double,
    @Json(name = "accuracy_m") val accuracyM: Double? = null,
    @Json(name = "speed_mps") val speedMps: Double? = null,
)

@JsonClass(generateAdapter = true)
data class MomentViewerDto(
    val user: MomentAuthorDto,
    @Json(name = "viewed_at") val viewedAt: String? = null,
    val reaction: String? = null,
    val replied: Boolean = false,
    /** "Pulse, reinvented" (CONTRACT 4): their signal, for an author whose switch is on. */
    val signal: String? = null,
)

@JsonClass(generateAdapter = true)
data class MomentViewersResponse(
    val count: Int = 0,
    val viewers: List<MomentViewerDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MomentReactionResponse(
    @Json(name = "my_reaction") val myReaction: String? = null,
)

@JsonClass(generateAdapter = true)
data class MomentReplyBody(
    val text: String,
)

@JsonClass(generateAdapter = true)
data class MomentReplyResponse(
    @Json(name = "room_id") val roomId: String? = null,
    @Json(name = "message_id") val messageId: String? = null,
)

@JsonClass(generateAdapter = true)
data class MomentReportBody(
    val reason: String,
    val details: String? = null,
)

/**
 * The Moment a chat message replies to, as every chat serializer adds it (contract "Chat"): drawn as a small quote
 * above the text, "Moment ended" with no picture once it has. The app's own JSON setup reads and writes it through
 * [ChatMomentRefJsonAdapter], which never writes the picture link; a plain reader (the chat socket's) uses this class's
 * own adapter.
 */
@JsonClass(generateAdapter = true)
data class ChatMomentRefDto(
    val id: String,
    val kind: String? = null,
    /** Signed and short-lived (15 minutes): shown while the app runs, never written to a saved copy. */
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    val ended: Boolean = false,
    /** Conversation lists only: the viewer sent that reply ("Replied to their Moment"). */
    @Json(name = "from_me") val fromMe: Boolean? = null,
    /**
     * A live text card's color (`teal` … `slate`) and its first words (contract v3.2): the quote shows the card. Null
     * for a photo or video, once ended, while held, across a block, and from a server without them.
     */
    val background: String? = null,
    val excerpt: String? = null,
)

/** [ChatMomentRefDto] on the wire. */
@JsonClass(generateAdapter = true)
data class ChatMomentRefJson(
    val id: String,
    val kind: String? = null,
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    val ended: Boolean = false,
    @Json(name = "from_me") val fromMe: Boolean? = null,
    val background: String? = null,
    val excerpt: String? = null,
)

/**
 * Reads a chat message's Moment with its picture link and writes it without: the chat copies saved on the phone are
 * written with this, and a signed link must not sit in a file (a quote read back shows the Moment's mark until the
 * next read brings a fresh link).
 */
class ChatMomentRefJsonAdapter {
    @FromJson
    fun fromJson(json: ChatMomentRefJson): ChatMomentRefDto =
        ChatMomentRefDto(json.id, json.kind, json.thumbUrl, json.ended, json.fromMe, json.background, json.excerpt)

    @ToJson
    fun toJson(ref: ChatMomentRefDto): ChatMomentRefJson =
        ChatMomentRefJson(ref.id, ref.kind, null, ref.ended, ref.fromMe, ref.background, ref.excerpt)
}
