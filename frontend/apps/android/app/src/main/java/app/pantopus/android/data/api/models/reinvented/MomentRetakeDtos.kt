package app.pantopus.android.data.api.models.reinvented

import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Retake ("Pulse, reinvented" phase 3, CONTRACT 8e): a Retake is its first Moment and the Moments people added from the
 * same spot. Read only while the switch is on for the reader.
 */

/** `retake` on a Moment answer: the Retake it belongs to, with the frames and people this reader may see. */
@JsonClass(generateAdapter = true)
data class MomentRetakeStateDto(
    /** Blank: no Retake (a `retake` without `start_id` never stops a Moment from opening). */
    @Json(name = "start_id") val startId: String = "",
    val title: String = "",
    @Json(name = "started_by") val startedBy: MomentAuthorDto? = null,
    @Json(name = "started_at") val startedAt: String? = null,
    val frames: Int = 1,
    val people: Int = 1,
    @Json(name = "is_start") val isStart: Boolean = false,
) {
    /** "Retake · 4 frames". */
    val tag: String get() = "Retake · $frames ${if (frames == 1) "frame" else "frames"}"
}

/** The Retake a Moment belongs to, for a reader whose switch is on; null where there is none (or no start id). */
val app.pantopus.android.data.api.models.moments.MomentDto.shownRetake: MomentRetakeStateDto?
    get() = retake?.takeIf { it.startId.isNotBlank() }

/** One frame of a Retake: who stood there, when, in which season and weather. */
@JsonClass(generateAdapter = true)
data class RetakeFrameDto(
    val id: String,
    val author: MomentAuthorDto? = null,
    val at: String? = null,
    @Json(name = "date_label") val dateLabel: String = "",
    val weather: String? = null,
    val season: String = "",
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    @Json(name = "media_url") val mediaUrl: String? = null,
) {
    val picture: String? get() = mediaUrl ?: thumbUrl

    /** "Oct 3 · Fall · fog". */
    val label: String
        get() {
            val season = SEASONS[season] ?: season
            return listOf(dateLabel, season, weather.orEmpty()).filter { it.isNotBlank() }.joinToString(" · ")
        }

    private companion object {
        val SEASONS = mapOf("winter" to "Winter", "spring" to "Spring", "summer" to "Summer", "fall" to "Fall")
    }
}

/** `GET /api/reinvented/retakes/:id`: the Retake, its frames oldest first (only those the reader may see). */
@JsonClass(generateAdapter = true)
data class RetakeDto(
    @Json(name = "start_id") val startId: String,
    val title: String = "",
    @Json(name = "place_label") val placeLabel: String? = null,
    @Json(name = "started_by") val startedBy: MomentAuthorDto? = null,
    @Json(name = "started_at") val startedAt: String? = null,
    @Lossy val frames: List<RetakeFrameDto> = emptyList(),
    @Json(name = "want_to_go") val wantToGo: Int = 0,
    @Json(name = "can_add") val canAdd: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class RetakeEnvelope(
    val retake: RetakeDto,
)
