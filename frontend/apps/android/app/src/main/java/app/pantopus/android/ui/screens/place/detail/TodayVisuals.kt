@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.AirQualityCategory
import app.pantopus.android.data.api.models.place.GoodDayVerdict
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.PlaceGoodDayTile
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.delay
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/*
 * Smaller pictures for the Today tab: the air-quality gauge, the "Good day
 * to…" verdict tile, the two-week strip of the address calendar and the
 * calm all-clear badge for alerts. Each shows the numbers the card already
 * had; motion is short and skipped when animations are off. Parity twin of
 * iOS `TodayVisuals.swift`.
 */

// ─── Air-quality gauge ───────────────────────────────────────

/** EPA breakpoints; each band gets an equal sixth of the dial. */
private val AQI_BREAKS = listOf(0.0, 50.0, 100.0, 150.0, 200.0, 300.0, 500.0)

fun aqiFraction(index: Int): Double {
    val value = index.toDouble().coerceIn(0.0, 500.0)
    for (band in 0 until 6) {
        if (value <= AQI_BREAKS[band + 1]) {
            return (band + (value - AQI_BREAKS[band]) / (AQI_BREAKS[band + 1] - AQI_BREAKS[band])) / 6
        }
    }
    return 1.0
}

fun aqiBand(
    category: AirQualityCategory,
    index: Int,
): Int =
    when (category) {
        AirQualityCategory.GOOD -> 0
        AirQualityCategory.MODERATE -> 1
        AirQualityCategory.UNHEALTHY_SENSITIVE -> 2
        AirQualityCategory.UNHEALTHY -> 3
        AirQualityCategory.VERY_UNHEALTHY -> 4
        AirQualityCategory.HAZARDOUS -> 5
        AirQualityCategory.UNKNOWN -> (aqiFraction(index) * 6).toInt().coerceIn(0, 5)
    }

/**
 * A half-dial in the six EPA bands; the current band is lit, the marker swings to the
 * reading when the card appears, the index sits in the middle.
 */
@Composable
fun TodayAqiGauge(
    index: Int,
    category: AirQualityCategory,
) {
    val band = aqiBand(category, index)
    val reduced = rememberMotionReduced()
    val shown = remember { Animatable(0f) }
    LaunchedEffect(index, reduced) {
        val target = aqiFraction(index).toFloat()
        if (reduced) shown.snapTo(target) else shown.animateTo(target, spring(dampingRatio = 0.6f, stiffness = 60f))
    }
    Box(
        modifier = Modifier.width(128.dp).height(80.dp).clearAndSetSemantics { contentDescription = "Air quality index $index" },
        contentAlignment = Alignment.BottomCenter,
    ) {
        val surface = PantopusColors.appSurface
        Canvas(modifier = Modifier.fillMaxSize()) {
            for (segment in 0 until 6) {
                val start = (segment + 0.06) / 6
                val end = (segment + 0.94) / 6
                val path = Path()
                for (step in 0..12) {
                    val point = gaugePoint(start + (end - start) * step / 12)
                    if (step == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
                }
                val color = SkyPalette.airQualityBands[segment].copy(alpha = if (segment == band) 1f else 0.3f)
                drawPath(path, color, style = Stroke(width = 10.dp.toPx()))
            }
            val marker = gaugePoint(shown.value.toDouble())
            drawCircle(surface, 8.dp.toPx(), marker)
            drawCircle(SkyPalette.airQualityBands[band], 6.25.dp.toPx(), marker, style = Stroke(width = 3.5.dp.toPx()))
        }
        // Sized in dp: the reading is part of the dial and must stay inside it at any font size;
        // the category and caption beside it scale.
        val unscaled = 1f / LocalDensity.current.fontScale
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "$index",
                fontSize = (30 * unscaled).sp,
                lineHeight = (30 * unscaled).sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                "AQI",
                fontSize = (10.5f * unscaled).sp,
                lineHeight = (13 * unscaled).sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

/** The dial: a half circle whose centre sits on the bottom edge. */
private fun DrawScope.gaugePoint(fraction: Double): Offset {
    val radius = min(size.width / 2, size.height) - 7.dp.toPx()
    val theta = PI * (1 + fraction.coerceIn(0.0, 1.0))
    return Offset(
        (size.width / 2 + radius * cos(theta)).toFloat(),
        (size.height - 2.dp.toPx() + radius * sin(theta)).toFloat(),
    )
}

// ─── "Good day to…" tile ─────────────────────────────────────

private class VerdictTone(
    val fg: Color,
    val bg: Color,
    val mark: PantopusIcon,
)

private fun verdictTone(verdict: GoodDayVerdict) =
    when (verdict) {
        GoodDayVerdict.YES -> VerdictTone(PantopusColors.home, PantopusColors.homeBg, PantopusIcon.Check)
        GoodDayVerdict.CAUTION -> VerdictTone(PantopusColors.warning, PantopusColors.warningBg, PantopusIcon.Info)
        GoodDayVerdict.NO -> VerdictTone(PantopusColors.appTextMuted, PantopusColors.appSurfaceSunken, PantopusIcon.X)
        GoodDayVerdict.UNKNOWN -> VerdictTone(PantopusColors.appTextMuted, PantopusColors.appSurfaceSunken, PantopusIcon.Minus)
    }

/** One verdict: the activity in a tinted bubble, a verdict mark, the question, the answer in the verdict's colour. */
@Composable
fun TodayGoodDayTile(
    tile: PlaceGoodDayTile,
    open: Boolean,
    modifier: Modifier = Modifier,
) {
    val tone = verdictTone(tile.verdict)
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier =
            modifier
                .fillMaxHeight()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(if (open) 1.5.dp else 1.dp, if (open) tone.fg else PantopusColors.appBorder, shape)
                .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(tone.bg),
                contentAlignment = Alignment.Center,
            ) { Text(tile.glyph, fontSize = (21 / LocalDensity.current.fontScale).sp) }
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier = Modifier.size(19.dp).clip(CircleShape).background(tone.fg),
                contentAlignment = Alignment.Center,
            ) { PantopusIconImage(tone.mark, null, size = 11.dp, strokeWidth = 3.2f, tint = PantopusColors.appSurface) }
        }
        Text(tile.label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
        Text(tile.answer, fontSize = 13.5.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold, color = tone.fg)
    }
}

/**
 * A tile's pop-in: from 88 % scale and clear to full size, staggered by [index], once per [key].
 * Returns the progress for [popIn]; it starts at full size when [animate] is false.
 */
@Composable
fun rememberPopIn(
    key: Any,
    index: Int,
    animate: Boolean,
): Float {
    val pop = remember(key) { Animatable(if (animate) POP_FROM else 1f) }
    LaunchedEffect(key) {
        if (pop.value < 1f) {
            delay(index * 70L)
            pop.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = 300f))
        }
    }
    return pop.value
}

private const val POP_FROM = 0.88f

/** Scales and fades a tile by its [rememberPopIn] progress. */
fun Modifier.popIn(progress: Float): Modifier =
    graphicsLayer {
        scaleX = progress
        scaleY = progress
        alpha = ((progress - POP_FROM) / (1f - POP_FROM)).coerceIn(0f, 1f)
    }

// ─── Two-week strip of the address calendar ─────────────────

private val KIND_ORDER = listOf("garbage", "recycling", "yard_waste", "bulk_pickup", "street_sweeping")

fun calendarKindColor(kind: String): Color =
    when (kind) {
        "garbage" -> PantopusColors.appTextSecondary
        "recycling" -> PantopusColors.primary600
        "yard_waste" -> PantopusColors.home
        "bulk_pickup", "street_sweeping" -> PantopusColors.warning
        else -> PantopusColors.business
    }

private fun kindLabel(kind: String) =
    when (kind) {
        "garbage" -> "Garbage"
        "recycling" -> "Recycling"
        "yard_waste" -> "Yard waste"
        "bulk_pickup" -> "Bulk pickup"
        "street_sweeping" -> "Street sweeping"
        else -> "Other dates"
    }

private class StripDay(
    val date: LocalDate,
    val isToday: Boolean,
    val kinds: List<String>,
)

/**
 * The next two weeks as fourteen day cells with a coloured dot for each kind of date: the rhythm
 * of pickups at a glance. The rows below carry the same dates in words, so TalkBack skips the strip.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TodayCalendarStrip(
    today: String,
    windowDays: Int,
    events: List<PlaceCalendarEvent>,
) {
    val start = runCatching { LocalDate.parse(today.take(10)) }.getOrNull() ?: return
    val days =
        (0 until windowDays.coerceIn(7, 14)).map { offset ->
            val date = start.plusDays(offset.toLong())
            val key = date.toString()
            val kinds =
                events
                    .filter { it.date.startsWith(key) }
                    .map { if (it.kind in KIND_ORDER) it.kind else "other" }
                    .distinct()
                    .sortedBy { KIND_ORDER.indexOf(it).let { i -> if (i < 0) 99 else i } }
            StripDay(date, offset == 0, kinds)
        }
    val present = days.flatMap { it.kinds }.distinct()
    Column(
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics { }.testTag("addressCalendarStrip"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            days.forEach { day -> StripCell(day, Modifier.weight(1f)) }
        }
        if (present.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                present.forEach { kind ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(calendarKindColor(kind)))
                        Text(kindLabel(kind), fontSize = 11.5.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextSecondary)
                    }
                }
            }
        }
    }
}

@Composable
private fun StripCell(
    day: StripDay,
    modifier: Modifier,
) {
    val weekend = day.date.dayOfWeek == DayOfWeek.SATURDAY || day.date.dayOfWeek == DayOfWeek.SUNDAY
    val initial = "SMTWTFS"[day.date.dayOfWeek.value % 7].toString()
    // Fourteen cells share the card's width, so their labels are sized in dp and can't overflow
    // at large font sizes; the rows below say the same dates in scalable text.
    val unscaled = 1f / LocalDensity.current.fontScale
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            initial,
            fontSize = (10 * unscaled).sp,
            fontWeight = FontWeight.SemiBold,
            color = if (day.isToday) PantopusColors.primary600 else PantopusColors.appTextMuted,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(26.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        if (day.isToday) {
                            PantopusColors.primary600
                        } else {
                            PantopusColors.appSurfaceSunken.copy(
                                alpha = if (weekend) 0.55f else 1f,
                            )
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "${day.date.dayOfMonth}",
                fontSize = (12.5f * unscaled).sp,
                fontWeight = if (day.isToday) FontWeight.Bold else FontWeight.SemiBold,
                color = if (day.isToday) PantopusColors.appSurface else PantopusColors.appText,
            )
        }
        Row(modifier = Modifier.height(5.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            day.kinds.take(3).forEach { kind ->
                Box(modifier = Modifier.size(5.dp).clip(CircleShape).background(calendarKindColor(kind)))
            }
        }
    }
}

// ─── Alerts all-clear ────────────────────────────────────────

/** The green check with three slow, quiet pings when it appears: someone is keeping watch. It then rests. */
@Composable
fun TodayAllClearBadge() {
    val reduced = rememberMotionReduced()
    val home = PantopusColors.home
    val ping = remember { Animatable(0f) }
    var pinging by remember { mutableStateOf(false) }
    LaunchedEffect(reduced) {
        if (reduced) return@LaunchedEffect
        pinging = true
        repeat(3) {
            ping.snapTo(0f)
            ping.animateTo(1f, tween(2400, easing = LinearEasing))
        }
        pinging = false
    }
    Box(
        modifier =
            Modifier.size(44.dp).drawBehind {
                if (!pinging) return@drawBehind
                val eased = 1 - (1 - ping.value) * (1 - ping.value)
                drawCircle(
                    home.copy(alpha = 0.45f * (1 - eased)),
                    radius = size.minDimension / 2 * (1 + 0.55f * eased),
                    style = Stroke(width = 2.dp.toPx()),
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier.fillMaxSize().clip(CircleShape).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) { PantopusIconImage(PantopusIcon.Check, null, size = 21.dp, strokeWidth = 2.5f, tint = home) }
    }
}
