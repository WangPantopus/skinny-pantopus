package app.pantopus.android.data.api.models.reinvented

import app.pantopus.android.data.api.models.moments.MomentDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Convergences and the sky strip ("Pulse, reinvented" phase 3, CONTRACT 8h): rarely, when several people photograph a
 * real sunset or a first snow at one place in the same minutes, a 15-minute window opens and every photo that joined it
 * is one kept piece. Read only while the switch is on for the reader.
 */

/** `convergence` on a Moment answer: the piece it joined. A blank [id] is no piece. */
@JsonClass(generateAdapter = true)
data class MomentConvergenceStateDto(
    val id: String = "",
    val kind: String = SUNSET,
    val title: String? = null,
    val open: Boolean = false,
) {
    val name: String get() = title?.ifBlank { null } ?: convergenceTitle(kind)

    /** "Tonight's sky · open now", "First snow". */
    val tag: String get() = if (open) "$name · open now" else name
}

/** `GET /api/reinvented/convergences/:id`: the piece, its photos oldest first (those this reader may see), its colours. */
@JsonClass(generateAdapter = true)
data class ConvergenceDto(
    val id: String = "",
    val kind: String = SUNSET,
    val title: String? = null,
    @Json(name = "opened_at") val openedAt: String? = null,
    @Json(name = "closes_at") val closesAt: String? = null,
    val open: Boolean = false,
    @Lossy val moments: List<MomentDto> = emptyList(),
    @Lossy val bands: List<String> = emptyList(),
) {
    val name: String get() = title?.ifBlank { null } ?: convergenceTitle(kind)
    val sunset: Boolean get() = kind == SUNSET
}

@JsonClass(generateAdapter = true)
data class ConvergenceEnvelope(
    val convergence: ConvergenceDto,
)

/** One day of a place's sunsets: its bands of colour. */
@JsonClass(generateAdapter = true)
data class SkyStripDayDto(
    val date: String = "",
    @Lossy val bands: List<String> = emptyList(),
    val count: Int = 0,
)

/** `GET /api/reinvented/strip/sky?cell=…&days=30`. */
@JsonClass(generateAdapter = true)
data class SkyStripResponse(
    @Lossy val days: List<SkyStripDayDto> = emptyList(),
)

const val SUNSET = "sunset"

/** "Tonight's sky" or "First snow". */
fun convergenceTitle(kind: String): String = if (kind == "first_snow") "First snow" else "Tonight’s sky"

/** The piece a Moment joined, for a reader whose switch is on; null where there is none (or no id). */
val MomentDto.shownConvergence: MomentConvergenceStateDto?
    get() = convergence?.takeIf { it.id.isNotBlank() }
