@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.cards

import android.content.Context
import android.net.ConnectivityManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PointMode
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import app.pantopus.android.BuildConfig
import app.pantopus.android.R
import app.pantopus.android.ui.theme.PantopusColors
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Collections
import java.util.Locale

/**
 * Christmas cards (launch key `holiday_cards`): the shared look. The first 17 pictures ship with the app
 * (`assets/holiday-cards/<design>.jpg`, and a `-thumb` for grids and rows); any other comes from the website
 * (`/holiday-cards/<design>.jpg`) and is kept on the phone, so new pictures need no app update. The card prints its
 * caption by hand, "CHRISTMAS, 2026" and a postmark under the picture, on paper the colour of the picture's own border.
 */
object HolidayCardArt {
    /**
     * The pictures the app carries, and their heights for their 960-pixel width, so a card keeps its shape before its
     * picture loads.
     */
    private val pictureHeights =
        mapOf(
            "christmas-2026-01" to 1054,
            "christmas-2026-02" to 1054,
            "christmas-2026-03" to 1034,
            "christmas-2026-04" to 1054,
            "christmas-2026-05" to 1035,
            "christmas-2026-06" to 1032,
            "christmas-2026-07" to 1058,
            "christmas-2026-08" to 1045,
            "christmas-2026-09" to 1062,
            "christmas-2026-10" to 1040,
            "christmas-2026-11" to 1027,
            "christmas-2026-12" to 1052,
            "christmas-2026-13" to 1065,
            "christmas-2026-14" to 1046,
            "christmas-2026-15" to 1052,
            "christmas-2026-16" to 1042,
            "christmas-2026-17" to 1054,
        )

    private val designId = Regex("^[a-z0-9-]{1,64}$")

    /** The website pictures already loaded ahead in this run. */
    private val loadedAhead: MutableSet<String> = Collections.synchronizedSet(mutableSetOf())

    /** The strip printed under the picture is this much of the card's width tall. */
    const val STRIP = 0.15f

    /** The three pictures fanned on the way in. */
    val fan = listOf("christmas-2026-01", "christmas-2026-08", "christmas-2026-15")

    /** The caption's hand: Nothing You Could Do (SIL Open Font License, `assets/licenses`). */
    val captionHand = FontFamily(Font(R.font.nothing_you_could_do))

    /**
     * The picture for [design], for every place a card shows: the app's own for the pictures it carries, else the
     * website's, kept on the phone once loaded so it shows again without the network. Null for a design id that isn't
     * one. Nothing is drawn while it loads or when it can't: the card's paper behind it shows at the picture's shape.
     */
    @Composable
    fun picture(
        design: String,
        thumb: Boolean = false,
    ): ImageRequest? {
        val context = LocalContext.current
        return remember(context, design, thumb) {
            if (designId.matches(design)) {
                val web = webPicture(design, thumb)
                ImageRequest
                    .Builder(context)
                    .data(web ?: "file:///android_asset/holiday-cards/${fileName(design, thumb)}")
                    // The image cache keeps on disk only what's asked for: the website's pictures are.
                    .apply { if (web != null) diskCachePolicy(CachePolicy.ENABLED) }
                    .build()
            } else {
                null
            }
        }
    }

    /**
     * Loads [design]'s full picture from the website ahead of time (its piece shows in the Mailbox, in Sent or on
     * the look, or it's the card chosen), so it's on the phone before the card first slides out of its envelope.
     * Nothing for a picture the app carries, nor while Data Saver holds this app back; once a run, unless it couldn't
     * load.
     */
    fun loadAhead(
        context: Context,
        design: String,
    ) {
        val url = webPicture(design, thumb = false) ?: return
        val saver = context.getSystemService(ConnectivityManager::class.java)?.restrictBackgroundStatus
        if (saver == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED || !loadedAhead.add(url)) return
        val request =
            ImageRequest
                .Builder(context)
                .data(url)
                .diskCachePolicy(CachePolicy.ENABLED)
                // Only to have it on the phone: not kept in memory, and read at a small size.
                .memoryCachePolicy(CachePolicy.DISABLED)
                .size(AHEAD_SIZE_PX)
                .listener(
                    onCancel = { loadedAhead.remove(url) },
                    onError = { _, _ -> loadedAhead.remove(url) },
                ).build()
        context.imageLoader.enqueue(request)
    }

    /** The website's address for a picture the app doesn't carry; null for one it carries or an id that isn't one. */
    private fun webPicture(
        design: String,
        thumb: Boolean,
    ): String? {
        if (!designId.matches(design) || design in pictureHeights) return null
        return BuildConfig.PANTOPUS_WEB_BASE_URL.trimEnd('/') + "/holiday-cards/" + fileName(design, thumb)
    }

    private fun fileName(
        design: String,
        thumb: Boolean,
    ): String = "$design${if (thumb) "-thumb" else ""}.jpg"

    /**
     * Width over height of [design]'s picture: the pictures the app carries keep their own sizes; any other is
     * [height] (the server's, at 960 pixels wide), or the usual shape when the server doesn't say.
     */
    fun pictureAspect(
        design: String,
        height: Int? = null,
    ): Float {
        val pixels = pictureHeights[design] ?: height?.takeIf { it > 0 } ?: DEFAULT_HEIGHT
        return PICTURE_WIDTH / pixels
    }

    /** Width over height of the whole card: the picture and the strip under it. */
    fun cardAspect(
        design: String,
        height: Int? = null,
    ): Float = 1f / (1f / pictureAspect(design, height) + STRIP)

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

    /** Loading ahead reads the picture this small (it's only kept on disk). */
    private const val AHEAD_SIZE_PX = 64
}

/**
 * Days and times on cards. The sender's own clock for their take-back time; "their 7 a.m. mail" for the person it's
 * going to, never their 7 a.m. turned into the sender's hours.
 */
object HolidayCardTimes {
    private val shortDayFormat = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    private val longDayFormat = DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.US)
    private val fullDateFormat = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US)
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

    /** "Friday, December 25", from a time or a calendar day ("2026-12-25"). */
    fun longDay(
        value: String?,
        zone: ZoneId,
    ): String = localDay(value, zone)?.format(longDayFormat).orEmpty()

    /** "in 14 days", "tomorrow", "today": a count of days, as [inDays] says it. */
    fun inDays(days: Int): String =
        when {
            days <= 0 -> "today"
            days == 1 -> "tomorrow"
            else -> "in $days days"
        }

    /** "October 30, 2026" (as the email's link page prints it), from a time or a calendar day. */
    fun fullDate(
        value: String?,
        zone: ZoneId,
    ): String = localDay(value, zone)?.format(fullDateFormat).orEmpty()

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
