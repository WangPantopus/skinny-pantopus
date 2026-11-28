package app.pantopus.android.data.api.models.reinvented

import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import app.pantopus.android.data.api.models.moments.MomentDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * Pinboards and the crowd freeze ("Pulse, reinvented" phase 3, CONTRACT 8i). A pinboard is a shared prompt ("Best fall
 * tree on your walk") that people add one photo each to for a week; it stays. The crowd freeze is one scene taken from
 * many phones within a minute, walked around with one slider. Read only while the switch is on for the reader.
 */

/** `pinboard` on a Moment answer: the pinboard this Moment starts or is a piece of. A blank [startId] is no pinboard. */
@JsonClass(generateAdapter = true)
data class MomentPinboardStateDto(
    @Json(name = "start_id") val startId: String = "",
    val prompt: String = "",
    val pieces: Int = 1,
    val open: Boolean = false,
    @Json(name = "is_start") val isStart: Boolean = false,
) {
    /** "Pinboard · 4 pieces". */
    val tag: String get() = "Pinboard · $pieces ${if (pieces == 1) "piece" else "pieces"}"
}

/** The pinboard a Moment belongs to, for a reader whose switch is on; null where there is none (or no start id). */
val MomentDto.shownPinboard: MomentPinboardStateDto?
    get() = pinboard?.takeIf { it.startId.isNotBlank() }

/** One piece of a pinboard: whose it is and its picture. */
@JsonClass(generateAdapter = true)
data class PinboardPieceDto(
    val id: String,
    val author: MomentAuthorDto? = null,
    val at: String? = null,
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    @Json(name = "media_url") val mediaUrl: String? = null,
) {
    val picture: String? get() = mediaUrl ?: thumbUrl
}

/** `GET /api/reinvented/pinboards/:id`: the prompt and the pieces this reader may see, newest first. */
@JsonClass(generateAdapter = true)
data class PinboardDto(
    @Json(name = "start_id") val startId: String,
    val prompt: String = "",
    @Json(name = "started_by") val startedBy: MomentAuthorDto? = null,
    @Json(name = "started_at") val startedAt: String? = null,
    @Json(name = "open_until") val openUntil: String? = null,
    val open: Boolean = false,
    @Lossy val pieces: List<PinboardPieceDto> = emptyList(),
    @Json(name = "can_add") val canAdd: Boolean = false,
) {
    /** "Started by Ivy Sato · 4 pieces · open until Tue, Dec 2", or "… · closed". */
    fun subtitle(zone: ZoneId = ZoneId.systemDefault()): String {
        val count = pieces.size
        val until =
            openUntil?.let { runCatching { Instant.parse(it) }.getOrNull() }
                ?.atZone(zone)
                ?.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))
        return listOf(
            "Started by ${startedBy?.name ?: "someone"}",
            "$count ${if (count == 1) "piece" else "pieces"}",
            if (open) until?.let { "open until $it" } ?: "open" else "closed",
        ).joinToString(" · ")
    }
}

@JsonClass(generateAdapter = true)
data class PinboardEnvelope(
    val pinboard: PinboardDto,
)

/** `GET /api/reinvented/crowd/:id`: the photos and videos of one scene, ordered around it ([center] is the one asked). */
@JsonClass(generateAdapter = true)
data class CrowdDto(
    val center: String = "",
    @Lossy val moments: List<MomentDto> = emptyList(),
)

/** `{ "crowd": null }` where fewer than three phones caught the scene. */
@JsonClass(generateAdapter = true)
data class CrowdEnvelope(
    val crowd: CrowdDto? = null,
)
