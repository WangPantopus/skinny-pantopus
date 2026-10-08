@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.time.ZonedDateTime
import kotlin.math.min
import kotlin.math.roundToInt

/*
 * The Today tab's "Now" card as a living sky over the resident's house:
 * the sky, the sun or the moon (in its real phase), clouds, rain, snow,
 * fog, wind and storms follow the reported weather and the time of day at
 * this address. The numbers sit on top, read exactly as before.
 *
 * Motion is decoration, so it stops when animations are removed in the
 * system settings, in battery saver, while the app is in the background
 * and while the card is scrolled away; the still picture is the same
 * scene. Parity twin of iOS `TodaySky.swift`.
 */

/** The "Now" reading drawn over the living sky. Touch and hold, then slide, to see the hours ahead (`TodaySkyScrub.kt`). */
@Composable
fun TodaySkyHero(
    data: PlaceWeatherData,
    sun: PlaceSunriseSunsetData?,
    /** The address calendar's upcoming dates: on the evening before a household pickup the bins stand at the curb. */
    pickups: List<PlaceCalendarEvent> = emptyList(),
    /** Tapping the bins shows the pickup schedule. */
    onBins: (() -> Unit)? = null,
) {
    val reduced = rememberMotionReduced()
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val screenHeight = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    var onScreen by remember { mutableStateOf(true) }
    val animating = !reduced && lifecycle.isAtLeast(Lifecycle.State.RESUMED) && onScreen
    val time = rememberSkyTime(animating)
    val now = rememberMinuteClock()
    val hours = remember(data.hourly, now) { SkyScrub.hours(data.hourly, now) }
    val scrub = rememberSkyScrub(reduced)
    val picked = scrub.index?.let { hours.getOrNull(it) }
    val current = SkyView.at(now, null, data, sun, pickups)
    val shown = if (picked == null) current else SkyView.at(now, picked, data, sun, pickups)
    val sky = SkyPalette.sky(shown.moment.phase, skyWeather(shown.weather.conditionCode))
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                // Grows with large fonts instead of clipping the reading; the ground stays at the bottom.
                .heightIn(min = 188.dp)
                .shadow(elevation = 10.dp, shape = shape, ambientColor = sky.mid, spotColor = sky.mid)
                .clip(shape)
                // Behind the crossfade between two hours, so the page never shows through.
                .background(sky.mid)
                // A hairline edge keeps a night sky from melting into a dark page.
                .border(1.dp, SkyPalette.white.copy(alpha = 0.1f), shape)
                .onGloballyPositioned {
                    val bounds = it.boundsInWindow()
                    onScreen = bounds.bottom > 0f && bounds.top < screenHeight
                }.skyScrubGesture(hours.size, scrub)
                .testTag("todaySkyHero"),
    ) {
        Crossfade(
            targetState = picked,
            modifier = Modifier.matchParentSize(),
            animationSpec = tween(if (reduced) 0 else 180),
            label = "skyHour",
        ) { hour ->
            val painter = (if (hour == picked) shown else SkyView.at(now, hour, data, sun, pickups)).painter(!animating)
            Canvas(modifier = Modifier.fillMaxSize().clearAndSetSemantics { }) {
                val t = time.doubleValue
                val perDp = density
                withTransform({ scale(perDp, perDp, pivot = Offset.Zero) }) {
                    painter.paint(this, size.width / perDp, size.height / perDp, t)
                }
            }
        }
        SkyReading(SkyReadingModel.of(data, current.note, picked, now), hours.size, scrub)
        // The bins only stand at the curb now, not in an hour slid to.
        val bins = current.note?.takeIf { picked == null && it.bins.isNotEmpty() }
        if (bins != null && onBins != null) BinsTarget(bins, onBins)
        scrub.index?.takeIf { picked != null }?.let { SkyScrubTrack(it, hours.size) }
        SkyScrubHint(hours.size, scrubbing = scrub.index != null)
    }
}

/** What the card shows at a moment: now, or the forecast [hour] slid to. */
private class SkyView(
    val time: ZonedDateTime,
    val weather: PlaceWeatherData,
    val moment: SkyMoment,
    val note: SkyNote?,
) {
    fun painter(still: Boolean) =
        TodaySkyPainter(
            condition = weather.conditionCode,
            moment = moment,
            temperature = weather.currentTempF,
            note = note,
            season = SkySeason.at(time.toLocalDate()),
            meteorShower = SkyNote.meteors(time, moment) != null,
            still = still,
        )

    companion object {
        fun at(
            now: ZonedDateTime,
            hour: SkyScrubHour?,
            data: PlaceWeatherData,
            sun: PlaceSunriseSunsetData?,
            pickups: List<PlaceCalendarEvent>,
        ): SkyView {
            val time = hour?.time ?: now
            val weather = hour?.let { SkyScrub.weather(data, it) } ?: data
            val moment = SkyMoment.at(time, sun?.sunrise, sun?.sunset)
            return SkyView(time, weather, moment, SkyNote.pick(time, moment, weather, pickups))
        }
    }
}

/** The bins drawn at the curb, as a 48 dp target that shows the pickup schedule. */
@Composable
private fun BoxScope.BinsTarget(
    note: SkyNote,
    onBins: () -> Unit,
) {
    BoxWithConstraints(modifier = Modifier.matchParentSize()) {
        val center = TodaySkyGround.binsCenter(maxWidth.value, maxHeight.value, note.bins.size)
        Box(
            modifier =
                Modifier
                    .offset(x = (center.x - 26).dp, y = (center.y - 24).dp)
                    .size(52.dp, 48.dp)
                    .clickable(onClickLabel = "Show the pickup schedule", onClick = onBins)
                    .clearAndSetSemantics {
                        contentDescription = note.spoken
                        role = Role.Button
                    }.testTag("todaySkyBins"),
        )
    }
}

/** Seconds of the day, advanced at about 30 frames a second while [animating]. */
@Composable
private fun rememberSkyTime(animating: Boolean): androidx.compose.runtime.MutableDoubleState {
    val time = remember { mutableDoubleStateOf(2.0) }
    LaunchedEffect(animating) {
        while (animating && isActive) {
            time.doubleValue = (System.currentTimeMillis() % 86_400_000L) / 1000.0
            delay(33L)
        }
    }
    return time
}

/** What the reading says: now with today's note, or the hour slid to. */
private class SkyReadingModel(
    val weather: PlaceWeatherData,
    /** "NOW", today's note or the hour slid to ("3 PM"). */
    val kicker: String,
    /** A note sits on the chips' dark glass; "NOW" and an hour's time don't need it. */
    val glass: Boolean,
    /** "Full moon tonight. Now, 60°, Overcast": one spoken reading. */
    val spoken: String,
    /** The hour slid to, said after each TalkBack adjustment. */
    val value: String,
    val chips: List<String>,
    val spokenChips: String,
) {
    companion object {
        fun of(
            data: PlaceWeatherData,
            note: SkyNote?,
            picked: SkyScrubHour?,
            now: ZonedDateTime,
        ): SkyReadingModel {
            val shown = picked?.let { SkyScrub.weather(data, it) } ?: data
            val temp = data.currentTempF.roundToInt()
            val reading = if (data.conditionLabel.isEmpty()) "Now, $temp°" else "Now, $temp°, ${data.conditionLabel}"
            val (chips, spokenChips) = chips(shown, picked)
            return SkyReadingModel(
                weather = shown,
                kicker = picked?.let { SkyScrub.kicker(it, now) } ?: note?.kicker ?: "NOW",
                glass = picked == null && note != null,
                spoken = note?.let { "${it.spoken} $reading" } ?: reading,
                value = picked?.let { SkyScrub.spoken(it, now) } ?: "Now",
                chips = chips,
                spokenChips = spokenChips,
            )
        }

        /**
         * High/low and feels-like (or an hour's chance of rain), each in a dark glass chip: they sit near
         * the bright horizon, where white text alone can't keep 4.5:1 on a light sky. Also as spoken.
         */
        private fun chips(
            shown: PlaceWeatherData,
            picked: SkyScrubHour?,
        ): Pair<List<String>, String> {
            val range = if (shown.highF != null && shown.lowF != null) shown.highF.roundToInt() to shown.lowF.roundToInt() else null
            val extra = if (picked != null) SkyScrub.precipChip(picked) else shown.feelsLikeF?.let { "Feels like ${it.roundToInt()}°" }
            val spoken =
                listOfNotNull(
                    range?.let { "High ${it.first}°, low ${it.second}°" },
                    extra?.replaceFirstChar { if (picked == null) it.lowercaseChar() else it },
                ).joinToString(", ")
            return listOfNotNull(range?.let { "H ${it.first}° · L ${it.second}°" }, extra) to spoken
        }
    }
}

@Composable
private fun SkyReading(
    model: SkyReadingModel,
    hours: Int,
    scrub: SkyScrubState,
) {
    // The numeral is a picture of the reading: it grows a little with the font size, not without bound.
    val fontScale = LocalDensity.current.fontScale
    val numeral = min(fontScale, 1.3f) / fontScale
    val shadow = TextStyle(shadow = Shadow(SkyPalette.black.copy(alpha = 0.28f), Offset(0f, 2f), 6f))
    Column(modifier = Modifier.padding(start = 18.dp, top = 14.dp, end = 110.dp, bottom = 36.dp)) {
        Column(modifier = Modifier.clearAndSetSemantics { hourSemantics(model, hours, scrub) }) {
            // 14 sp bold (large text) in full white: it sits over the cloud deck on grey days.
            Text(
                model.kicker,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.9.sp,
                color = SkyPalette.white,
                style = shadow,
                modifier = if (model.glass) Modifier.noteGlass() else Modifier,
            )
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    "${model.weather.currentTempF.roundToInt()}",
                    fontSize = (64 * numeral).sp,
                    lineHeight = (70 * numeral).sp,
                    fontWeight = FontWeight.Light,
                    letterSpacing = (-2).sp,
                    color = SkyPalette.white,
                    style = shadow,
                )
                Text(
                    "°",
                    fontSize = (34 * numeral).sp,
                    fontWeight = FontWeight.Light,
                    color = SkyPalette.white,
                    style = shadow,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (model.weather.conditionLabel.isNotEmpty()) {
                // 18 sp: large text, so 3:1 over the sky is enough (every scene clears it).
                Text(
                    model.weather.conditionLabel,
                    fontSize = 18.sp,
                    lineHeight = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SkyPalette.white,
                    style = shadow,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.offset(y = (-4).dp),
                )
            }
        }
        if (model.chips.isNotEmpty()) SkyChips(model.chips, model.spokenChips)
    }
}

/** The reading as TalkBack hears it, adjustable an hour at a time when there's an hourly forecast. */
private fun SemanticsPropertyReceiver.hourSemantics(
    model: SkyReadingModel,
    hours: Int,
    scrub: SkyScrubState,
) {
    contentDescription = model.spoken
    if (hours == 0) return
    stateDescription = model.value
    progressBarRangeInfo = ProgressBarRangeInfo((scrub.index ?: -1) + 1f, 0f..hours.toFloat(), steps = hours - 1)
    setProgress(label = "See another hour") { target ->
        val hour = target.roundToInt() - 1
        scrub.set(if (hour < 0) null else hour.coerceAtMost(hours - 1))
        true
    }
}

/**
 * A note is longer than "NOW" and can run under a bright cloud, so it sits on the chips' dark glass,
 * drawn outside its bounds so the card keeps its height.
 */
private fun Modifier.noteGlass(): Modifier =
    drawBehind {
        val padX = 8.dp.toPx()
        val padY = 3.dp.toPx()
        val height = size.height + padY * 2
        drawRoundRect(
            SkyPalette.scrim.copy(alpha = 0.45f),
            topLeft = Offset(-padX, -padY),
            size = Size(size.width + padX * 2, height),
            cornerRadius = CornerRadius(height / 2),
        )
    }

/** High/low and feels-like in dark glass chips; they wrap onto a second line rather than truncate. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SkyChips(
    chips: List<String>,
    spoken: String,
) {
    FlowRow(
        modifier = Modifier.padding(top = 2.dp).clearAndSetSemantics { contentDescription = spoken },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        chips.forEach { chip ->
            Text(
                chip,
                fontSize = 13.sp,
                lineHeight = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = SkyPalette.white,
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(SkyPalette.scrim.copy(alpha = 0.45f))
                        .padding(horizontal = 9.dp, vertical = 4.dp),
            )
        }
    }
}
