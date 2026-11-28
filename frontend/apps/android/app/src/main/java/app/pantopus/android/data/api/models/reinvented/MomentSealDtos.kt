package app.pantopus.android.data.api.models.reinvented

import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import app.pantopus.android.data.api.models.moments.MomentDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Relics and "Seal it" ("Pulse, reinvented" phase 3, CONTRACT 8g): a Moment that opens later, on a date, at a place, or
 * the next time it rains there. Until it opens nobody but its author sees what it holds; a place relic is found near
 * where it was left and opened by standing there. Read only while the switch is on for the reader.
 */

/** `seal` on a Moment answer: how it opens, whether it has, and the server's words for when ("Opens on Dec 25, 2026"). */
@JsonClass(generateAdapter = true)
data class MomentSealStateDto(
    val opens: String = "",
    val at: String? = null,
    val open: Boolean = true,
    val hint: String? = null,
    @Json(name = "opened_at") val openedAt: String? = null,
)

/** The seal of a Moment that hasn't opened yet (only its author ever reaches one); null for an opened one or none. */
val MomentDto.unopenedSeal: MomentSealStateDto?
    get() = seal?.takeIf { it.opens.isNotBlank() && !it.open }

/** One place relic near the reader (`POST /api/reinvented/seals/near`): [here] within 100 m, else within 300 m. */
@JsonClass(generateAdapter = true)
data class RelicDto(
    val id: String,
    val author: MomentAuthorDto? = null,
    @Json(name = "left_at") val leftAt: String? = null,
    val hint: String? = null,
    val here: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class RelicsNearResponse(
    @Lossy val relics: List<RelicDto> = emptyList(),
)

/** The reader's place, in the body only: never in the address, never kept. */
@JsonClass(generateAdapter = true)
data class SealPlaceBody(
    val latitude: Double,
    val longitude: Double,
)
