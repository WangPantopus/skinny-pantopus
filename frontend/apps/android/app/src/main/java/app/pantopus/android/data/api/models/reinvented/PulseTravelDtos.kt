package app.pantopus.android.data.api.models.reinvented

import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * Passing on and Eyes on ("Pulse, reinvented" phase 3, CONTRACT 8f), read only while the switch is on for the reader.
 */

/** Who passed a post on: how many passes this reader may read, and up to three carriers. */
@JsonClass(generateAdapter = true)
data class PulsePassedDto(
    val count: Int = 0,
    @Lossy val carriers: List<MomentAuthorDto> = emptyList(),
)

/** On a pass: the original it carries and who carried it. */
@JsonClass(generateAdapter = true)
data class PulsePassedOnDto(
    val from: String? = null,
    @Json(name = "carried_by") val carriedBy: MomentAuthorDto? = null,
)

/** On an Eyes-on Ask: whether it is open, until when, and its Live answers. */
@JsonClass(generateAdapter = true)
data class PulseEyesOnDto(
    val open: Boolean = false,
    val until: String? = null,
    val answers: Int = 0,
)

/**
 * The phase 3 keys of a post in `GET /api/reinvented/list` (`passed`, `passed_on`, `eyes_on`), with who wrote it and as
 * whom: read beside today's post from the same answer ([ReinventedListItemDto.travel]).
 */
@JsonClass(generateAdapter = true)
data class PulseTravelDto(
    val passed: PulsePassedDto? = null,
    @Json(name = "passed_on") val passedOn: PulsePassedOnDto? = null,
    @Json(name = "eyes_on") val eyesOn: PulseEyesOnDto? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "post_as") val postAs: String? = null,
    @Json(name = "post_type") val postType: String? = null,
) {
    /** Under a post's status line: who carried it here, who passed it on, or an Eyes-on Ask's window. */
    fun line(zone: ZoneId = ZoneId.systemDefault()): String? {
        passedOn?.carriedBy?.let { return "Carried here by ${first(it)}" }
        passed?.takeIf { it.count >= 1 }?.let { return "Passed on by ${names(it.carriers, it.count)}" }
        val eyes = eyesOn ?: return null
        val words = StringBuilder("Eyes on · ")
        words.append(if (eyes.open) "open until ${clock(eyes.until, zone)}" else "closed")
        if (eyes.answers > 0) words.append(" · ${eyes.answers} ${if (eyes.answers == 1) "Live answer" else "Live answers"}")
        return words.toString()
    }

    /** "Pass it on" is offered on someone else's post that isn't a pass itself or under a made-up name. */
    fun mayPass(viewer: String?): Boolean = viewer != null && userId != null && userId != viewer && passedOn == null && postAs != "pen_name"

    companion object {
        fun first(person: MomentAuthorDto): String = person.firstName ?: person.name?.ifBlank { null } ?: "someone"

        /** "Dana and Ade", "Dana, Ade and 3 others". */
        fun names(
            people: List<MomentAuthorDto>,
            count: Int,
        ): String {
            val shown = people.take(2).map(::first)
            val rest = count - shown.size
            if (shown.isEmpty()) return "$count ${if (count == 1) "person" else "people"}"
            if (rest <= 0) return shown.joinToString(" and ")
            return "${shown.joinToString(", ")} and $rest ${if (rest == 1) "other" else "others"}"
        }

        /** "4:30 PM" for an ISO time; empty when it can't be read. */
        fun clock(
            iso: String?,
            zone: ZoneId = ZoneId.systemDefault(),
        ): String =
            iso?.let { runCatching { Instant.parse(it) }.getOrNull() }
                ?.atZone(zone)
                ?.format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
                .orEmpty()
    }
}

/** One open Eyes-on Ask near the reader (`POST /api/reinvented/eyes-on/near`). */
@JsonClass(generateAdapter = true)
data class EyesOnAskDto(
    val id: String,
    val question: String = "",
    val place: String? = null,
    val author: MomentAuthorDto? = null,
    val at: String? = null,
    val until: String = "",
    val answers: Int = 0,
)

@JsonClass(generateAdapter = true)
data class EyesOnNearResponse(
    @Lossy val asks: List<EyesOnAskDto> = emptyList(),
)

/** The reader's place, in the body only: never in the address, never kept. */
@JsonClass(generateAdapter = true)
data class EyesOnNearBody(
    val latitude: Double,
    val longitude: Double,
)
