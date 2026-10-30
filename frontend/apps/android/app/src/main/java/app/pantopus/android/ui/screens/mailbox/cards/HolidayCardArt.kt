@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PointMode
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import app.pantopus.android.R
import app.pantopus.android.ui.theme.PantopusColors
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * Christmas cards (launch key `holiday_cards`): the shared look. The pictures ship with the app
 * (`assets/holiday-cards/<design>.jpg`, and a `-thumb` for grids and rows); the card prints its caption by hand,
 * "CHRISTMAS, 2026" and a postmark under the picture, on paper the colour of the picture's own border.
 */
object HolidayCardArt {
    /** The pictures' heights for their 960-pixel width, by number, so a card keeps its shape before its picture loads. */
    private val pictureHeights =
        mapOf(
            1 to 1054,
            2 to 1054,
            3 to 1034,
            4 to 1054,
            5 to 1035,
            6 to 1032,
            7 to 1058,
            8 to 1045,
            9 to 1062,
            10 to 1040,
            11 to 1027,
            12 to 1052,
            13 to 1065,
            14 to 1046,
            15 to 1052,
            16 to 1042,
            17 to 1054,
        )

    private val designId = Regex("^[a-z0-9-]{1,64}$")

    /** The strip printed under the picture is this much of the card's width tall. */
    const val STRIP = 0.15f

    /** The three pictures fanned on the way in. */
    val fan = listOf("christmas-2026-01", "christmas-2026-08", "christmas-2026-15")

    /** The caption's hand: Nothing You Could Do (SIL Open Font License, `assets/licenses`). */
    val captionHand = FontFamily(Font(R.font.nothing_you_could_do))

    /** The picture for [design] in the app's assets; null for a design id that isn't one. */
    fun picture(
        design: String,
        thumb: Boolean = false,
    ): String? {
        if (!designId.matches(design)) return null
        return "file:///android_asset/holiday-cards/$design${if (thumb) "-thumb" else ""}.jpg"
    }

    /** Width over height of [design]'s picture. */
    fun pictureAspect(design: String): Float {
        val height = design.substringAfterLast('-').toIntOrNull()?.let(pictureHeights::get) ?: DEFAULT_HEIGHT
        return PICTURE_WIDTH / height
    }

    /** Width over height of the whole card: the picture and the strip under it. */
    fun cardAspect(design: String): Float = 1f / (1f / pictureAspect(design) + STRIP)

    /** The card's paper, from the server's colour (a "#rrggbb" string); the plain card paper when it names none. */
    fun paper(color: String?): Color =
        color
            ?.takeIf { it.length == 7 && it.startsWith("#") }
            ?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() }
            ?: PantopusColors.cardPaper

    /** Soft darker edges over the whole card, like a CSS inset shadow [reach] wide. */
    fun DrawScope.agedEdges(reach: Float) {
        val shade = PantopusColors.cardEdgeShade
        // A blurred edge fades fast: half the shade at the edge, a sixth halfway in, none at [reach].
        val fade = listOf(shade.copy(alpha = shade.alpha * 0.5f), shade.copy(alpha = shade.alpha * 0.16f), Color.Transparent)
        drawRect(Brush.horizontalGradient(fade, startX = 0f, endX = reach))
        drawRect(Brush.horizontalGradient(fade, startX = size.width, endX = size.width - reach))
        drawRect(Brush.verticalGradient(fade, startY = 0f, endY = reach))
        drawRect(Brush.verticalGradient(fade, startY = size.height, endY = size.height - reach))
    }

    /** Paper grain: faint dots [step] apart, so a flat colour reads as card stock. */
    fun DrawScope.paperGrain(
        color: Color,
        step: Float,
        dot: Float,
    ) {
        val points = ArrayList<Offset>()
        var y = step / 2f
        while (y < size.height) {
            var x = step / 2f
            while (x < size.width) {
                points += Offset(x, y)
                x += step
            }
            y += step
        }
        drawPoints(points, PointMode.Points, color, strokeWidth = dot, cap = StrokeCap.Round)
    }

    private const val PICTURE_WIDTH = 960f
    private const val DEFAULT_HEIGHT = 1048
}

/**
 * Days and times on cards. The sender's own clock for their take-back time; "their 7 a.m. mail" for the person it's
 * going to, never their 7 a.m. turned into the sender's hours.
 */
object HolidayCardTimes {
    private val shortDayFormat = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    private val longDayFormat = DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.US)
    private val postmarkFormat = DateTimeFormatter.ofPattern("MMM d", Locale.US)

    fun zone(timeZone: String?): ZoneId = timeZone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()

    fun parse(value: String?): Instant? =
        value?.let { raw ->
            runCatching { Instant.parse(raw) }.getOrNull() ?: runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
        }

    /** "Sat, Dec 19", from a time or a calendar day ("2026-12-19"). */
    fun shortDay(
        value: String?,
        zone: ZoneId,
    ): String = localDay(value, zone)?.format(shortDayFormat).orEmpty()

    /** A time's calendar day in [zone], or a calendar day ("2026-10-30") as it is. */
    private fun localDay(
        value: String?,
        zone: ZoneId,
    ): LocalDate? =
        if (value?.length == 10) {
            runCatching { LocalDate.parse(value) }.getOrNull()
        } else {
            parse(value)?.atZone(zone)?.toLocalDate()
        }

    /** "Friday, December 25". */
    fun longDay(
        value: String?,
        zone: ZoneId,
    ): String = parse(value)?.atZone(zone)?.format(longDayFormat).orEmpty()

    /** "7 a.m.", "7:30 a.m.". */
    fun clockTime(
        value: String?,
        zone: ZoneId,
    ): String = parse(value)?.atZone(zone)?.let(::clock).orEmpty()

    private fun clock(time: ZonedDateTime): String {
        val hour = (time.hour % 12).let { if (it == 0) 12 else it }
        val minutes = if (time.minute == 0) "" else ":${"%02d".format(time.minute)}"
        return "$hour$minutes ${if (time.hour < 12) "a.m." else "p.m."}"
    }

    /** "in 6 days", "tomorrow", "today": counted by calendar day in [zone]. */
    fun inDays(
        value: String?,
        zone: ZoneId,
        now: Instant = Instant.now(),
    ): String? {
        val day = parse(value)?.atZone(zone)?.toLocalDate() ?: return null
        val days = ChronoUnit.DAYS.between(now.atZone(zone).toLocalDate(), day).coerceAtLeast(0)
        return when (days) {
            0L -> "today"
            1L -> "tomorrow"
            else -> "in $days days"
        }
    }

    /** "OCT 30" for the postmark, from a calendar day ("2026-10-30") or a time. */
    fun postmarkDay(
        value: String?,
        zone: ZoneId,
    ): String = localDay(value, zone)?.format(postmarkFormat)?.uppercase(Locale.US).orEmpty()
}
