package app.pantopus.android.data.api.models.reinvented

import app.pantopus.android.data.api.models.moments.MomentDto
import com.squareup.moshi.JsonClass

/*
 * "Mail it" (CONTRACT 8j) and "Tonight in <town>" (8k), "Pulse, reinvented" phase 3. Read only while the switch is on for
 * the reader. Mail it rides today's letters: the server keeps the Moment's picture as one of the sender's own mail
 * enclosures, and the app then sends an ordinary letter through today's `POST /api/mailbox/send`.
 */

/** One of the sender's own mail enclosures: [ref] goes in the letter's `attachments`. */
@JsonClass(generateAdapter = true)
data class MailItEnclosureDto(
    val ref: String,
    val id: String? = null,
    val name: String? = null,
)

/** `POST /api/reinvented/moments/:id/enclosure`: the picture kept, the words to start with, where it was. */
@JsonClass(generateAdapter = true)
data class MailItEnclosedDto(
    val enclosure: MailItEnclosureDto,
    val words: String? = null,
    val place: String? = null,
)

/** `POST /api/reinvented/town-film`: the town's film of the day's Moments, oldest first. */
@JsonClass(generateAdapter = true)
data class TownFilmDto(
    val town: String? = null,
    val date: String? = null,
    val count: Int = 0,
    val people: Int = 0,
    @Lossy val moments: List<MomentDto> = emptyList(),
)

/** `{ "film": null }` before 8 pm, after 4 am, or where the town hasn't enough today. */
@JsonClass(generateAdapter = true)
data class TownFilmEnvelope(
    val film: TownFilmDto? = null,
)
