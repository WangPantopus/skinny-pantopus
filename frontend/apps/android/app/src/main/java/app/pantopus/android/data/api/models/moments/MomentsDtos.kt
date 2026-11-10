package app.pantopus.android.data.api.models.moments

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.ToJson

/*
 * Pantopus Moments (contract v2, `~/pantopus-moments/coord/CONTRACT.md`, owned by the server session). Every route
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
    /** The exact pin, or the approximate grid point when shown as an area. */
    val latitude: Double,
    val longitude: Double,
    /** A place or a town, never a street address. */
    @Json(name = "place_label") val placeLabel: String? = null,
    val moments: List<MomentBriefDto> = emptyList(),
    @Json(name = "unseen_count") val unseenCount: Int = 0,
    @Json(name = "newest_at") val newestAt: String? = null,
    val mine: Boolean = false,
)

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
    /** `uploading`, `checking`, `live`, `held` or `ended` (others only ever get `live`). */
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
)

@JsonClass(generateAdapter = true)
data class MomentsMapResponse(
    val rings: List<MomentRingDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MomentsMineResponse(
    val moments: List<MomentDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MomentEnvelope(
    val moment: MomentDto,
)

@JsonClass(generateAdapter = true)
data class MomentPointBody(
    val latitude: Double,
    val longitude: Double,
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
)

@JsonClass(generateAdapter = true)
data class MomentAdultConfirmResponse(
    @Json(name = "attested_at") val attestedAt: String? = null,
)

/**
 * Where a Moment pins: `gps` (the phone's fix, at most 5 minutes old, with [fixAt]) or `capture` (where a library
 * item was taken, in the last 24 hours, with [takenAt]).
 */
@JsonClass(generateAdapter = true)
data class MomentLocationBody(
    val source: String,
    val latitude: Double,
    val longitude: Double,
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
)

@JsonClass(generateAdapter = true)
data class MomentViewerDto(
    val user: MomentAuthorDto,
    @Json(name = "viewed_at") val viewedAt: String? = null,
    val reaction: String? = null,
    val replied: Boolean = false,
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
)

/** [ChatMomentRefDto] on the wire. */
@JsonClass(generateAdapter = true)
data class ChatMomentRefJson(
    val id: String,
    val kind: String? = null,
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    val ended: Boolean = false,
    @Json(name = "from_me") val fromMe: Boolean? = null,
)

/**
 * Reads a chat message's Moment with its picture link and writes it without: the chat copies saved on the phone are
 * written with this, and a signed link must not sit in a file (a quote read back shows the Moment's mark until the
 * next read brings a fresh link).
 */
class ChatMomentRefJsonAdapter {
    @FromJson
    fun fromJson(json: ChatMomentRefJson): ChatMomentRefDto = ChatMomentRefDto(json.id, json.kind, json.thumbUrl, json.ended, json.fromMe)

    @ToJson
    fun toJson(ref: ChatMomentRefDto): ChatMomentRefJson = ChatMomentRefJson(ref.id, ref.kind, null, ref.ended, ref.fromMe)
}
