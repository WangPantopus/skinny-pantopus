@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.SkyPalette
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * The Sun card, right under the weather on Today: the sun's path from sunrise to sunset over a small sky in the
 * weather picture's colours (blue by day, peach at dawn, orange-pink at dusk, deep navy with stars at night). The sun
 * glows where it is now (it travels there when the card appears) and the stretch it has covered is lit in gold; by
 * night it waits half below the horizon, and the moon shows its real phase and name. How long until the next sunrise
 * or sunset leads; the times and the day's length read as before. Parity twin of iOS `TodaySunArc.swift`.
 */

/** The path spans the card: the horizon 14 dp above the bottom, the peak 18 dp from the top. */
private val DIAL_HEIGHT = 140.dp
private val HORIZON_INSET = 14.dp
private val PEAK_INSET = 18.dp

/** Above this font scale the sunrise, daylight and sunset stack, so no time breaks in a third of the card. */
private const val TIMES_STACK_SCALE = 1.3f

/**
 * [weather] is the reported weather, so the little sky matches the big one above it. [at] draws one moment with the sun
 * already in place, for a shared picture; null follows the clock. [overline] is a line above the sky (Place's
 * address-first screen: "RIGHT NOW IN VANCOUVER", TABCARD §4b); null on Today.
 */
@Composable
fun TodaySunArcCard(
    data: PlaceSunriseSunsetData,
    modifier: Modifier = Modifier,
    timeZone: ZoneId = ZoneId.systemDefault(),
    weather: WeatherConditionCode? = null,
    at: ZonedDateTime? = null,
    overline: String? = null,
) {
    val clock = rememberMinuteClock(timeZone)
    val now = at ?: clock
    val moment = SkyMoment.at(now, data.localSunrise(timeZone), data.localSunset(timeZone))
    // Another day's times (an older server's cache, a provider outage) keep their "as of" day: no countdown from them.
    val day = PlacePresentation.fmtSunDay(data, timeZone)
    val today = day == null || day == "today"
    val up = moment.minutes >= moment.sunrise && moment.minutes <= moment.sunset
    val target = restingPlace(moment, up)
    val reduced = rememberMotionReduced()
    val travelled = remember { Animatable(0f) }
    LaunchedEffect(target, reduced) {
        // Forward along the path; never backwards (night to the sunrise side snaps).
        if (reduced || target < travelled.value) {
            travelled.snapTo(target)
        } else {
            travelled.animateTo(target, spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessVeryLow))
        }
    }
    val countdown = sunCountdown(now, moment, up).takeIf { today }
    val daylight = "${data.daylightMinutes / 60}h ${data.daylightMinutes % 60}m"
    val spoken = (overline?.let { "${it.lowercase().replaceFirstChar(Char::uppercase)}. " } ?: "") + spokenSun(data, moment, countdown)
    PlaceDetailCard(
        modifier = modifier.testTag("todaySunArc").clearAndSetSemantics { contentDescription = spoken },
        padding = 16.dp,
    ) {
        overline?.let {
            Text(
                it,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.88.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(bottom = 14.dp),
            )
        }
        SunDial(
            moment = moment,
            sky = SkyPalette.sky(moment.phase, weather?.let(::skyWeather) ?: SkyPalette.Weather.CLEAR),
            travelled = if (at != null) target else travelled.value,
            up = up,
            reading = countdown ?: ("Daylight" to daylight),
        )
        SunTimes(
            rise = clock(moment.sunrise),
            set = clock(moment.sunset),
            daylight = daylight.takeIf { today },
            day = day.takeUnless { today },
            modifier = Modifier.padding(top = 14.dp),
        )
    }
}

/** Where the sun rests: along the path by day; through dusk where it set; the rest of the night where it will rise. */
private fun restingPlace(
    moment: SkyMoment,
    up: Boolean,
): Float =
    when {
        up -> moment.dayFraction
        moment.minutes > moment.sunset && moment.phase == SkyPalette.Phase.DUSK -> 1.0
        else -> 0.0
    }.toFloat()

/**
 * ("Sunset in", "3h 10m") by day; ("Sunrise in", "5h 54m") by night. Counted in real time: on the day the clocks
 * change, wall-clock minutes are an hour off around the change.
 */
private fun sunCountdown(
    now: ZonedDateTime,
    moment: SkyMoment,
    up: Boolean,
): Pair<String, String> {
    val minutesLeft =
        when {
            up -> SkyMoment.minutesUntil(now, moment.sunset)
            moment.minutes < moment.sunrise -> SkyMoment.minutesUntil(now, moment.sunrise)
            else -> SkyMoment.minutesUntil(now, moment.sunrise, nextDay = true)
        }
    val whole = minutesLeft.roundToInt().coerceAtLeast(1)
    val span = if (whole >= 60) "${whole / 60}h ${whole % 60}m" else "${whole}m"
    return (if (up) "Sunset in" else "Sunrise in") to span
}

/** What TalkBack reads: the times and the day's length as before, the countdown and, by night, the moon. */
private fun spokenSun(
    data: PlaceSunriseSunsetData,
    moment: SkyMoment,
    countdown: Pair<String, String>?,
): String {
    val moon = if (moment.phase == SkyPalette.Phase.NIGHT) " ${MoonPhase.spoken(moment.moonPhase)}." else ""
    return "Sunrise ${clock(moment.sunrise)}, sunset ${clock(moment.sunset)}, ${data.daylightMinutes / 60} hours " +
        "${data.daylightMinutes % 60} minutes of daylight." + (countdown?.let { " ${it.first} ${it.second}." } ?: "") + moon
}

/** The little sky: the path over it, the sun (or the moon and stars by night) and the countdown in the middle. */
@Composable
private fun SunDial(
    moment: SkyMoment,
    sky: SkyPalette.Sky,
    travelled: Float,
    up: Boolean,
    reading: Pair<String, String>,
) {
    val night = moment.phase == SkyPalette.Phase.NIGHT
    // Dark ink on a light sky, white on a dark one, read where the words sit.
    val ink = if (perceived(mix(sky.mid, sky.bottom, 0.45f)) > 0.5f) SkyPalette.scrim else SkyPalette.white
    val surface = PantopusColors.appSurface
    val border = PantopusColors.appBorder
    Box(modifier = Modifier.fillMaxWidth().height(DIAL_HEIGHT)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val horizon = size.height - HORIZON_INSET.toPx()
            arcPath(1f)?.let { dome ->
                dome.close()
                drawPath(
                    dome,
                    Brush.verticalGradient(0f to sky.top, 0.5f to sky.mid, 1f to sky.bottom, startY = PEAK_INSET.toPx(), endY = horizon),
                )
            }
            if (night) drawStars()
            arcPath(1f)?.let {
                drawPath(
                    it,
                    SkyPalette.white.copy(alpha = 0.55f),
                    style = Stroke(width = 1.5.dp.toPx(), cap = StrokeCap.Round, pathEffect = dashes()),
                )
            }
            arcPath(travelled)?.let { path ->
                // A soft glow under the gold.
                drawPath(path, SkyPalette.sunLow.copy(alpha = 0.18f), style = Stroke(width = 11.dp.toPx(), cap = StrokeCap.Round))
                drawPath(path, SkyPalette.sunLow.copy(alpha = 0.3f), style = Stroke(width = 6.5.dp.toPx(), cap = StrokeCap.Round))
                drawPath(
                    path,
                    Brush.horizontalGradient(listOf(SkyPalette.sunLow, SkyPalette.sunHigh)),
                    style = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round),
                )
            }
            drawLine(border, Offset(4.dp.toPx(), horizon), Offset(size.width - 4.dp.toPx(), horizon), 1.dp.toPx())
            // Where the sun comes up and goes down.
            for (end in listOf(0f, 1f)) {
                drawCircle(SkyPalette.sunLow, 3.5.dp.toPx(), arcPoint(end))
                drawCircle(surface, 3.5.dp.toPx() - 0.75.dp.toPx(), arcPoint(end), style = Stroke(width = 1.5.dp.toPx()))
            }
            // A glowing disc by day; by night a dimmer one, half below the horizon.
            val sun = arcPoint(travelled)
            if (up) {
                drawSun(sun, up = true)
            } else {
                clipRect(left = -40.dp.toPx(), top = -40.dp.toPx(), right = size.width + 40.dp.toPx(), bottom = horizon) {
                    drawSun(sun, up = false)
                }
            }
        }
        if (night) MoonLine(moment.moonPhase, Modifier.align(Alignment.TopCenter).padding(top = 38.dp))
        SunReading(reading, ink, Modifier.align(Alignment.BottomCenter).padding(bottom = HORIZON_INSET + 10.dp))
    }
}

private fun DrawScope.drawSun(
    center: Offset,
    up: Boolean,
) {
    val glow = (if (up) 26 else 18).dp.toPx()
    drawCircle(
        Brush.radialGradient(
            0f to SkyPalette.sunHigh.copy(alpha = if (up) 0.6f else 0.35f),
            6.dp.toPx() / glow to SkyPalette.sunHigh.copy(alpha = if (up) 0.6f else 0.35f),
            1f to SkyPalette.sunLow.copy(alpha = 0f),
            center = center,
            radius = glow,
        ),
        glow,
        center,
    )
    val alpha = if (up) 1f else 0.85f
    drawCircle(
        Brush.radialGradient(
            listOf(SkyPalette.white, SkyPalette.sunHigh, SkyPalette.sunLow),
            center = center + Offset(-2.dp.toPx(), -3.dp.toPx()),
            radius = 11.dp.toPx(),
        ),
        10.dp.toPx(),
        center,
        alpha = alpha,
    )
    drawCircle(SkyPalette.white.copy(alpha = 0.9f), 10.dp.toPx() - 0.75.dp.toPx(), center, alpha = alpha, style = Stroke(1.5.dp.toPx()))
}

/** Night stars inside the sky, clear of the moon and the countdown; always in the same places (as on iPhone). */
private fun DrawScope.drawStars() {
    val horizon = (size.height - HORIZON_INSET.toPx()).toDouble()
    val rx = size.width / 2.0 - 24.dp.toPx()
    val ry = horizon - PEAK_INSET.toPx()
    val middle = size.width / 2.0
    val random = SkyRandom(23)
    for (index in 0 until 34) {
        val across = random.next() * 1.84 - 0.92
        val rise = 0.3 + random.next() * 0.62
        val radius = (0.5 + random.next() * 0.85) * density
        val alpha = (0.4 + random.next() * 0.55).toFloat()
        val x = middle + across * rx
        val y = horizon - ry * sqrt(1 - across * across) * rise
        // Keep the moon's line and the countdown clear.
        val nearMoon = abs(x - middle) < 76.dp.toPx() && y < 66.dp.toPx() && y > 28.dp.toPx()
        val nearCountdown = abs(x - middle) < 62.dp.toPx() && y > horizon - 66.dp.toPx()
        if (nearMoon || nearCountdown) continue
        val at = Offset(x.toFloat(), y.toFloat())
        drawCircle(SkyPalette.white.copy(alpha = alpha), radius.toFloat(), at)
        // A few brighter ones sparkle.
        if (index % 9 == 4) drawPath(sparkle(at, 3.6.dp.toPx()), SkyPalette.white.copy(alpha = alpha * 0.8f))
    }
}

/** A four-pointed glint. */
private fun sparkle(
    at: Offset,
    size: Float,
): Path {
    val waist = size * 0.22f
    return Path().apply {
        moveTo(at.x, at.y - size)
        lineTo(at.x + waist, at.y - waist)
        lineTo(at.x + size, at.y)
        lineTo(at.x + waist, at.y + waist)
        lineTo(at.x, at.y + size)
        lineTo(at.x - waist, at.y + waist)
        lineTo(at.x - size, at.y)
        lineTo(at.x - waist, at.y - waist)
        close()
    }
}

/** The moon in its real phase, softly lit, and the phase's name. */
@Composable
private fun MoonLine(
    phase: Double,
    modifier: Modifier,
) {
    // Sized in dp: it sits inside the arc and must fit it at any font size.
    val unscaled = 1f / LocalDensity.current.fontScale
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Canvas(modifier = Modifier.size(18.dp)) {
            val radius = size.minDimension / 2
            drawCircle(
                Brush.radialGradient(
                    0.5f to SkyPalette.moonGlow.copy(alpha = 0.3f),
                    1f to SkyPalette.moonGlow.copy(alpha = 0f),
                    center = center,
                    radius = 20.dp.toPx(),
                ),
                20.dp.toPx(),
            )
            drawCircle(SkyPalette.white.copy(alpha = 0.14f), radius)
            drawPath(TodaySkyPainter.moonPath(center, radius, phase), SkyPalette.moon)
        }
        Text(
            MoonPhase.name(phase),
            fontSize = (11.5f * unscaled).sp,
            lineHeight = (14 * unscaled).sp,
            fontWeight = FontWeight.SemiBold,
            color = SkyPalette.white.copy(alpha = 0.85f),
        )
    }
}

/** The countdown in the middle of the sky; the day's length for another day's times. */
@Composable
private fun SunReading(
    reading: Pair<String, String>,
    ink: Color,
    modifier: Modifier,
) {
    // Sized in dp: the reading sits inside the arc and must fit it at any font size; the times below scale.
    val unscaled = 1f / LocalDensity.current.fontScale
    val shadow = if (ink == SkyPalette.white) Shadow(SkyPalette.scrim.copy(alpha = 0.35f), Offset(0f, 1f), 6f) else null
    val style = LocalTextStyle.current.merge(TextStyle(shadow = shadow, fontFeatureSettings = "tnum"))
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            reading.first,
            fontSize = (12.5f * unscaled).sp,
            lineHeight = (16 * unscaled).sp,
            fontWeight = FontWeight.SemiBold,
            color = ink.copy(alpha = 0.8f),
            style = style,
        )
        Text(
            reading.second,
            fontSize = (27 * unscaled).sp,
            lineHeight = (32 * unscaled).sp,
            fontWeight = FontWeight.Bold,
            color = ink,
            style = style,
        )
    }
}

/** Sunrise and sunset at the ends, the day's length (or the times' day) between them; stacked at large text. */
@Composable
private fun SunTimes(
    rise: String,
    set: String,
    daylight: String?,
    day: String?,
    modifier: Modifier,
) {
    if (LocalDensity.current.fontScale > TIMES_STACK_SCALE) {
        Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            StackedTime(PantopusIcon.Sunrise, "Sunrise", rise)
            StackedTime(PantopusIcon.Sunset, "Sunset", set)
            daylight?.let { StackedTime(null, "Daylight", it) }
            day?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.warning) }
        }
        return
    }
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        SunTime(PantopusIcon.Sunrise, "Sunrise", rise, Alignment.Start)
        Column(
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            if (daylight != null) {
                Text("Daylight", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
                Text(
                    daylight,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    style = LocalTextStyle.current.merge(TextStyle(fontFeatureSettings = "tnum")),
                )
            } else if (day != null) {
                Text(day, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.warning)
            }
        }
        SunTime(PantopusIcon.Sunset, "Sunset", set, Alignment.End)
    }
}

/**
 * True when animations are removed in the system settings. Battery saver doesn't count: iOS keeps
 * Today moving in Low Power Mode, and rain held in mid-air reads as a stuck screen.
 */
@Composable
fun rememberMotionReduced(): Boolean {
    val context = LocalContext.current
    val scale =
        android.provider.Settings.Global.getFloat(
            context.contentResolver,
            android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        )
    return scale == 0f
}

@Composable
private fun SunTime(
    icon: PantopusIcon,
    label: String,
    time: String,
    alignment: Alignment.Horizontal,
) {
    Column(horizontalAlignment = alignment, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            PantopusIconImage(icon, null, size = 15.dp, strokeWidth = 2f, tint = PantopusColors.warning)
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        }
        Text(
            time,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            style = LocalTextStyle.current.merge(TextStyle(fontFeatureSettings = "tnum")),
        )
    }
}

/** One line of the stacked times: icon, label and the reading at the end. */
@Composable
private fun StackedTime(
    icon: PantopusIcon?,
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        icon?.let { PantopusIconImage(it, null, size = 15.dp, strokeWidth = 2f, tint = PantopusColors.warning) }
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted, modifier = Modifier.weight(1f))
        Text(value, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
    }
}

/** The moon's phase in words, from its age in the synodic month (as iOS `MoonPhase`). */
object MoonPhase {
    fun name(phase: Double): String =
        when {
            phase < 0.03 -> "New moon"
            phase < 0.22 -> "Waxing crescent"
            phase < 0.28 -> "First quarter"
            phase < 0.47 -> "Waxing gibbous"
            phase < 0.53 -> "Full moon"
            phase < 0.72 -> "Waning gibbous"
            phase < 0.78 -> "Last quarter"
            phase < 0.97 -> "Waning crescent"
            else -> "New moon"
        }

    /** The name as TalkBack reads it: "Last quarter moon", "Full moon". */
    fun spoken(phase: Double): String = name(phase).let { if (it.endsWith("moon")) it else "$it moon" }
}

/** A straight blend of two colours in sRGB, as iOS `SkyRGB.mixed`. */
private fun mix(
    from: Color,
    to: Color,
    amount: Float,
): Color =
    Color(
        from.red + (to.red - from.red) * amount,
        from.green + (to.green - from.green) * amount,
        from.blue + (to.blue - from.blue) * amount,
    )

/** How light a colour looks, 0 (black) to 1 (white), as iOS reads it. */
private fun perceived(color: Color): Float = 0.2126f * color.red + 0.7152f * color.green + 0.0722f * color.blue

private fun clock(minutes: Double): String =
    LocalTime
        .ofSecondOfDay((minutes * 60).toLong().coerceIn(0L, 86_399L))
        .format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))

private fun DrawScope.dashes() = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 5.dp.toPx()))

private fun DrawScope.arcPoint(fraction: Float): Offset {
    val theta = PI * (1 - fraction.coerceIn(0f, 1f))
    val horizon = size.height - HORIZON_INSET.toPx()
    val rx = size.width / 2 - 24.dp.toPx()
    val ry = horizon - PEAK_INSET.toPx()
    return Offset((size.width / 2 + rx * cos(theta)).toFloat(), (horizon - ry * sin(theta)).toFloat())
}

private fun DrawScope.arcPath(progress: Float): Path? {
    if (progress <= 0f) return null
    val steps = (60 * progress.coerceIn(0f, 1f)).toInt().coerceAtLeast(1)
    val path = Path()
    for (step in 0..steps) {
        val point = arcPoint(progress * step / steps)
        if (step == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
    }
    return path
}
