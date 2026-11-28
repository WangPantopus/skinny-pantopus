package app.pantopus.android.data.api.models.moments

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * "Pulse, reinvented": playable items on a Moment (CONTRACT 7b and 7g): a poll, a slider or the spectrum dial, the board,
 * the question box, guess and reveal, a countdown, a lifted quote, fog, a swatch, and before and after. Each sits on the
 * picture as a stamp does (`x`, `y`, `scale`, `rotation`). The author sends them in `POST /api/moments` as `play`; every
 * Moment answer to a reader whose switch is on carries them back with what that reader may see (`mine`, `results`,
 * `open`). With the switch off the server sends no `play` key and today's screens show the plain picture and words.
 */

/** The kinds, as the server names them. */
object MomentPlayKinds {
    const val POLL = "poll"
    const val SLIDER = "slider"
    const val BOARD = "board"
    const val QUESTION = "question"
    const val GUESS = "guess"
    const val COUNTDOWN = "countdown"
    const val QUOTE = "quote"
    const val FOG = "fog"
    const val SWATCH = "swatch"
    const val BEFORE_AFTER = "before_after"
    const val MOVING_WORDS = "moving_words"
}

/**
 * Moving words (CONTRACT 7k): the author's own line over a photo, in one of the Studio's ten letterings (by the shared
 * id), moving in one of four ways, in one of four colours. Drawn only, never answered.
 */
object MomentMovingWords {
    /** At most two on a post, inside the four items in all. */
    const val MOST = 2

    /** At most sixty UTF-16 units, as the server and the web count them. */
    const val LONGEST = 60

    /** The four motions, by the ids the server takes, with their names. */
    val MOTIONS = listOf("drift" to "Drift", "pulse" to "Pulse", "wave" to "Wave", "type" to "Type")

    /** White, warm yellow, black and sky (as on iPhone and the web). */
    val COLORS = listOf("#FFFFFF", "#FDE68A", "#111827", "#38BDF8")

    const val WHITE = "#FFFFFF"

    /**
     * The words as they may go out: one line (a line break becomes a space), at most [LONGEST] UTF-16 units, never
     * cutting a letter (an emoji, a flag) in two.
     */
    fun cut(typed: String): String {
        val line = typed.replace('\n', ' ').replace('\r', ' ')
        if (line.length <= LONGEST) return line
        val letters = java.text.BreakIterator.getCharacterInstance()
        letters.setText(line)
        var end = 0
        var next = letters.next()
        while (next != java.text.BreakIterator.DONE && next <= LONGEST) {
            end = next
            next = letters.next()
        }
        return line.substring(0, end)
    }
}

/** A board's two axes' words (CONTRACT 7b): `x_axis` has `left` and `right`, `y_axis` `bottom` and `top`. */
@JsonClass(generateAdapter = true)
data class MomentPlayAxisDto(
    val left: String? = null,
    val right: String? = null,
    val bottom: String? = null,
    val top: String? = null,
)

/** Guess and reveal's range: a number between [min] and [max], in [unit]. */
@JsonClass(generateAdapter = true)
data class MomentPlayRangeDto(
    val min: Double,
    val max: Double,
    val unit: String? = null,
)

/** A box on the picture (a swatch's try-on place), shares of the picture from the top left. */
@JsonClass(generateAdapter = true)
data class MomentPlayBoxDto(
    val x: Double,
    val y: Double,
    val w: Double,
    val h: Double,
)

/** The reader's own answer, in the shape the kind's `PUT` takes; a guess adds whether it was right or how far off. */
@JsonClass(generateAdapter = true)
data class MomentPlayMineDto(
    val choice: Int? = null,
    val value: Double? = null,
    val x: Double? = null,
    val y: Double? = null,
    val note: String? = null,
    val text: String? = null,
    val right: Boolean? = null,
    @Json(name = "off_by") val offBy: Double? = null,
)

/** Someone on a board or along the dial: [person] only for the reader and their connections. */
@JsonClass(generateAdapter = true)
data class MomentPlayFaceDto(
    val x: Double = 0.5,
    val y: Double? = null,
    val note: String? = null,
    val mine: Boolean = false,
    val person: MomentAuthorDto? = null,
)

/** What this reader may see of everyone's answers (CONTRACT 7b, by kind). */
@JsonClass(generateAdapter = true)
data class MomentPlayResultsDto(
    val counts: List<Int>? = null,
    val total: Int? = null,
    val average: Double? = null,
    val count: Int? = null,
    val faces: List<MomentPlayFaceDto>? = null,
)

/**
 * One playable item, as the author places it and as a reader reads it. Every field past the placement is optional: each
 * kind carries its own few. A kind this app doesn't know (a newer server) is never drawn.
 */
@JsonClass(generateAdapter = true)
data class MomentPlayItemDto(
    val id: String,
    val kind: String,
    val x: Double = 0.5,
    val y: Double = 0.5,
    val scale: Double = 1.0,
    val rotation: Double = 0.0,
    val question: String? = null,
    val options: List<String>? = null,
    val left: String? = null,
    val right: String? = null,
    /** A slider's look: `slider` or `dial`. */
    val look: String? = null,
    val emoji: String? = null,
    @Json(name = "x_axis") val xAxis: MomentPlayAxisDto? = null,
    @Json(name = "y_axis") val yAxis: MomentPlayAxisDto? = null,
    val prompt: String? = null,
    val range: MomentPlayRangeDto? = null,
    /** A guess's right answer: there only for its author and after the reader's try. */
    val answer: Double? = null,
    val title: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    val text: String? = null,
    val source: String? = null,
    val colors: List<String>? = null,
    val box: MomentPlayBoxDto? = null,
    /** Before and after's two words over the halves ("Before" and "After" when left out). */
    val before: String? = null,
    val after: String? = null,
    /** Moving words' lettering (one of the ten shared ids), motion (`drift`, `pulse`, `wave`, `type`) and `#RRGGBB` colour. */
    val lettering: String? = null,
    val motion: String? = null,
    val color: String? = null,
    /** Read only: whether answers are taken now (never for the author), the reader's answer, and the results. */
    val open: Boolean? = null,
    val mine: MomentPlayMineDto? = null,
    val results: MomentPlayResultsDto? = null,
) {
    companion object {
        /** Before and after's one item (CONTRACT 7g): its place means nothing, so it sits in the middle. */
        fun beforeAfter(
            before: String,
            after: String,
        ): MomentPlayItemDto =
            MomentPlayItemDto(
                id = "before-after",
                kind = MomentPlayKinds.BEFORE_AFTER,
                before = before.trim().take(BEFORE_AFTER_WORDS).ifEmpty { null },
                after = after.trim().take(BEFORE_AFTER_WORDS).ifEmpty { null },
            )

        /** The most letters in each of before and after's two words. */
        const val BEFORE_AFTER_WORDS = 24
    }
}

/** A Moment's before and after item, when it has one: its picture is the two photos side by side. */
val MomentDto.beforeAfter: MomentPlayItemDto?
    get() = play?.firstOrNull { it.kind == MomentPlayKinds.BEFORE_AFTER }?.takeIf { kind == "photo" }

/** A reader's answer to one item (`PUT /api/reinvented/play/:id/:item`, CONTRACT 7b): only the kind's own fields go out. */
@JsonClass(generateAdapter = true)
data class MomentPlayAnswerBody(
    val choice: Int? = null,
    val value: Double? = null,
    val x: Double? = null,
    val y: Double? = null,
    val note: String? = null,
    val text: String? = null,
)

/** The answer to a `PUT`: the item again, with this reader's answer and what they may now see. */
@JsonClass(generateAdapter = true)
data class MomentPlayAnswerResponse(
    val item: MomentPlayItemDto? = null,
)

/** The kinds a reader answers, and limits the Studio keeps to (CONTRACT 7b). */
object MomentPlayLimits {
    val ANSWERED =
        setOf(MomentPlayKinds.POLL, MomentPlayKinds.SLIDER, MomentPlayKinds.BOARD, MomentPlayKinds.QUESTION, MomentPlayKinds.GUESS)
    const val QUESTION_LETTERS = 100
    const val OPTION_LETTERS = 40
    const val TITLE_LETTERS = 60
    const val END_LETTERS = 24
    const val MOST_OPTIONS = 4

    /** A countdown ends at most 30 days ahead. */
    const val COUNTDOWN_DAYS = 30L
}

/** One answer in the author's list (CONTRACT 7b, the author's side): a question box's words or a board's note. */
@JsonClass(generateAdapter = true)
data class MomentPlayAnswerRowDto(
    val id: String = "",
    val text: String? = null,
    val note: String? = null,
    val at: String? = null,
    val person: MomentAuthorDto? = null,
)

/** `GET /api/reinvented/play/:id/:item/answers`: newest first, 50 a page. */
@JsonClass(generateAdapter = true)
data class MomentPlayAnswersPageDto(
    val answers: List<MomentPlayAnswerRowDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
)
