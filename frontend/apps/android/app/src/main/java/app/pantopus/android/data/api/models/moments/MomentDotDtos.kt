package app.pantopus.android.data.api.models.moments

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * "Pulse, reinvented" phase 2, living objects (CONTRACT 7c): Illuminate's dots. The author puts a dot on a thing in the
 * photo; a reader taps it. Each holds a note, a rating or a link (a `thing` and a `whisper` come with field cards and
 * sound). The author sends them in `POST /api/moments` as `dots`; every Moment answer to a reader whose switch is on
 * carries them back. With the switch off the server sends no `dots` key and today's screens show the plain picture.
 */

/** The kinds this app makes and draws now, as the server names them. */
object MomentDotKinds {
    const val NOTE = "note"
    const val RATING = "rating"
    const val LINK = "link"
    const val THING = "thing"
    const val WHISPER = "whisper"

    /** Made in the Studio and drawn in the viewer by this app. */
    val MADE = listOf(NOTE, RATING, LINK, WHISPER)
}

/** One dot as the author places it (`x`, `y`: its place on the picture, 0 to 1 from the top left) and as a reader reads it. */
@JsonClass(generateAdapter = true)
data class MomentDotDto(
    // Defaults, so a dot this app can't read never stops a Moment from opening: it is simply not drawn.
    val id: String = "",
    val kind: String = "",
    val x: Double = 0.5,
    val y: Double = 0.5,
    /** A note's words (up to 140). */
    val text: String? = null,
    /** A rating's thing (up to 40), or a thing's own guess. */
    val label: String? = null,
    /** A rating's stars, 1 to 5. */
    val stars: Int? = null,
    /** A link's https address (up to 500) and its optional title (up to 60). */
    val url: String? = null,
    val title: String? = null,
    /** A whisper's three seconds (CONTRACT 7e): a short signed link and its length, null until its sound is up. */
    @Json(name = "audio_url") val audioUrl: String? = null,
    @Json(name = "duration_ms") val durationMs: Long? = null,
) {
    companion object {
        /** Up to eight dots on one picture (CONTRACT 7c). */
        const val MOST = 8
        const val NOTE_LETTERS = 140
        const val LABEL_LETTERS = 40
        const val URL_LETTERS = 500
        const val TITLE_LETTERS = 60
    }
}

/** A dot this app draws: a kind it knows with what that kind needs. */
val MomentDotDto.drawable: Boolean
    get() =
        id.isNotBlank() &&
            when (kind) {
                MomentDotKinds.NOTE -> !text.isNullOrBlank()
                MomentDotKinds.RATING -> !label.isNullOrBlank() && stars in 1..5
                MomentDotKinds.LINK -> linkHost != null
                MomentDotKinds.WHISPER -> !audioUrl.isNullOrBlank()
                else -> false
            }

/** A link dot's site, for an http or https address only (it opens only on a tap); null otherwise. */
val MomentDotDto.linkHost: String?
    get() =
        url
            ?.let { runCatching { java.net.URI(it.trim()) }.getOrNull() }
            ?.takeIf { it.scheme.equals("https", true) || it.scheme.equals("http", true) }
            ?.host
            ?.removePrefix("www.")
            ?.takeIf { it.isNotBlank() }

/**
 * What the author typed as an https link, as it goes out ("example.com" reads as https://example.com, as on iPhone);
 * null for anything else (the server takes only https, CONTRACT 7c).
 */
fun httpsLink(typed: String?): String? {
    val trimmed = typed?.trim().orEmpty()
    if (trimmed.isEmpty() || trimmed.any { it.isWhitespace() }) return null
    val full = if (trimmed.contains("://")) trimmed else "https://$trimmed"
    val uri = runCatching { java.net.URI(full) }.getOrNull() ?: return null
    return full.takeIf { uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && it.length <= MomentDotDto.URL_LETTERS }
}
