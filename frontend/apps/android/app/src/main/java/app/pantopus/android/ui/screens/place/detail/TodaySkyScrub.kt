@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import android.content.Context
import android.text.format.DateFormat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.data.api.models.place.PlaceWeatherHour
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

/*
 * Drag through the day: touch and hold the Now card, then slide. The card's width spans the
 * next 24 forecast hours; the sky, the sun or the moon, the weather and the reading follow the
 * hour under the finger, and the card winds back to now on release. TalkBack adjusts it an hour
 * at a time. Parity twin of iOS `TodaySkyScrub.swift`.
 */

/** One forecast hour the card can show. */
data class SkyScrubHour(
    val time: ZonedDateTime,
    val hour: PlaceWeatherHour,
)

object SkyScrub {
    /** The forecast hours after this one, at most 24. */
    fun hours(
        hourly: List<PlaceWeatherHour>,
        after: ZonedDateTime,
    ): List<SkyScrubHour> =
        hourly
            .mapNotNull { hour ->
                val instant = runCatching { Instant.parse(hour.time) }.getOrNull() ?: return@mapNotNull null
                instant.atZone(after.zone).takeIf { it.isAfter(after) }?.let { SkyScrubHour(it, hour) }
            }.sortedBy { it.time }
            .take(24)

    /** The reading for that hour: its temperature and sky, and that day's high and low. */
    fun weather(
        data: PlaceWeatherData,
        picked: SkyScrubHour,
    ): PlaceWeatherData {
        val day = data.daily.firstOrNull { it.date.startsWith(picked.time.toLocalDate().toString()) }
        return data.copy(
            currentTempF = picked.hour.tempF,
            conditionCode = picked.hour.conditionCode,
            conditionLabel = label(picked.hour.conditionCode),
            feelsLikeF = null,
            highF = day?.highF ?: data.highF,
            lowF = day?.lowF ?: data.lowF,
            hourly = emptyList(),
        )
    }

    fun label(code: WeatherConditionCode): String =
        when (code) {
            WeatherConditionCode.CLEAR -> "Clear"
            WeatherConditionCode.PARTLY_CLOUDY -> "Partly cloudy"
            WeatherConditionCode.CLOUDY -> "Cloudy"
            WeatherConditionCode.FOG -> "Fog"
            WeatherConditionCode.RAIN -> "Rain"
            WeatherConditionCode.SNOW -> "Snow"
            WeatherConditionCode.SLEET -> "Sleet"
            WeatherConditionCode.THUNDERSTORM -> "Thunderstorms"
            WeatherConditionCode.WIND -> "Windy"
            WeatherConditionCode.UNKNOWN -> ""
        }

    private fun snowy(picked: SkyScrubHour) =
        picked.hour.conditionCode == WeatherConditionCode.SNOW || picked.hour.conditionCode == WeatherConditionCode.SLEET

    /** "Rain 40%" when there's a real chance of it, in place of "Feels like". */
    fun precipChip(picked: SkyScrubHour): String? =
        if (picked.hour.precipChance < 10) {
            null
        } else {
            "${if (snowy(picked)) "Snow" else "Rain"} ${picked.hour.precipChance.roundToInt()}%"
        }

    private fun time(
        picked: SkyScrubHour,
        now: ZonedDateTime,
    ): String {
        // "3 PM" or "15", in the person's own clock style.
        val pattern = DateFormat.getBestDateTimePattern(Locale.getDefault(), "j")
        val time = picked.time.format(DateTimeFormatter.ofPattern(pattern))
        return if (picked.time.toLocalDate() == now.toLocalDate()) time else "Tomorrow $time"
    }

    /** "3 PM", or "TOMORROW 6 AM" past midnight: takes the place of "NOW". */
    fun kicker(
        picked: SkyScrubHour,
        now: ZonedDateTime,
    ): String = time(picked, now).uppercase()

    /** "3 PM: 68°, Partly cloudy, 40% chance of rain." */
    fun spoken(
        picked: SkyScrubHour,
        now: ZonedDateTime,
    ): String {
        val parts = mutableListOf("${time(picked, now)}: ${picked.hour.tempF.roundToInt()}°")
        label(picked.hour.conditionCode).takeIf { it.isNotEmpty() }?.let { parts += it }
        if (picked.hour.precipChance >= 10) {
            parts += "${picked.hour.precipChance.roundToInt()}% chance of ${if (snowy(picked)) "snow" else "rain"}"
        }
        return parts.joinToString(", ") + "."
    }
}

/** The forecast hour slid to ([index], null is now), and the wind back to now on release. */
@Stable
class SkyScrubState internal constructor(
    private val scope: CoroutineScope,
    private val reduced: Boolean,
    private val haptics: HapticFeedback,
) {
    var index by mutableStateOf<Int?>(null)
        private set
    private var rewind: Job? = null

    /** The finger is over hour [hour]: a tick each time it moves to another one. */
    fun pick(hour: Int) {
        rewind?.cancel()
        if (hour != index) {
            index = hour
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        }
    }

    /** TalkBack's adjustment; null is now. */
    fun set(hour: Int?) {
        rewind?.cancel()
        index = hour
    }

    /** Back to now, an hour at a time (at once with animations off). */
    fun release() {
        val from = index ?: return
        rewind?.cancel()
        if (reduced) {
            index = null
            return
        }
        rewind =
            scope.launch {
                var hour = from
                val step = max(1, from / 8)
                while (hour > 0) {
                    hour = max(0, hour - step)
                    index = hour
                    delay(30L)
                }
                index = null
            }
    }
}

@Composable
fun rememberSkyScrub(reduced: Boolean): SkyScrubState {
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    return remember(reduced) { SkyScrubState(scope, reduced, haptics) }
}

/** Touch and hold the sky, then slide: the card's width spans the [count] hours ahead. */
fun Modifier.skyScrubGesture(
    count: Int,
    scrub: SkyScrubState,
): Modifier =
    if (count == 0) {
        this
    } else {
        pointerInput(count, scrub) {
            fun hourAt(x: Float): Int {
                val inset = 18 * density
                val fraction = ((x - inset) / (size.width - inset * 2).coerceAtLeast(1f)).coerceIn(0f, 1f)
                return (fraction * (count - 1)).roundToInt()
            }
            detectDragGesturesAfterLongPress(
                onDragStart = { scrub.pick(hourAt(it.x)) },
                onDragEnd = { scrub.release() },
                onDragCancel = { scrub.release() },
                onDrag = { change, _ -> scrub.pick(hourAt(change.position.x)) },
            )
        }
    }

/** While sliding: where the chosen hour sits among the hours ahead. */
@Composable
fun BoxScope.SkyScrubTrack(
    index: Int,
    count: Int,
) {
    Canvas(modifier = Modifier.matchParentSize().clearAndSetSemantics { }) {
        val inset = 18.dp.toPx()
        val span = size.width - inset * 2
        val y = size.height - 9.dp.toPx()
        drawRoundRect(
            SkyPalette.white.copy(alpha = 0.35f),
            topLeft = Offset(inset, y - 1.5.dp.toPx()),
            size = Size(span, 3.dp.toPx()),
            cornerRadius = CornerRadius(1.5.dp.toPx()),
        )
        val x = inset + span * index / (count - 1).coerceAtLeast(1)
        drawCircle(SkyPalette.black.copy(alpha = 0.25f), 6.dp.toPx(), Offset(x, y + 1.dp.toPx()))
        drawCircle(SkyPalette.white, 5.dp.toPx(), Offset(x, y))
    }
}

private const val HINT_PREFS = "today_sky"
private const val HINT_KEY = "scrubHints"
private const val HINT_SHOWS = 3

/** "Hold and slide to see later": shown the first few times the card appears, not again once someone slides. */
@Composable
fun BoxScope.SkyScrubHint(
    hours: Int,
    scrubbing: Boolean,
) {
    val context = LocalContext.current
    val prefs = remember(context) { context.applicationContext.getSharedPreferences(HINT_PREFS, Context.MODE_PRIVATE) }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(hours > 0) {
        val seen = prefs.getInt(HINT_KEY, 0)
        if (hours > 0 && seen < HINT_SHOWS) {
            prefs.edit().putInt(HINT_KEY, seen + 1).apply()
            visible = true
        }
    }
    LaunchedEffect(scrubbing) {
        if (scrubbing) {
            prefs.edit().putInt(HINT_KEY, HINT_SHOWS).apply()
            visible = false
        }
    }
    if (visible && !scrubbing) {
        Text(
            "Hold and slide to see later",
            fontSize = 11.sp,
            lineHeight = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = SkyPalette.white,
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 18.dp, bottom = 9.dp)
                    .clip(CircleShape)
                    .background(SkyPalette.scrim.copy(alpha = 0.45f))
                    .padding(horizontal = 8.dp, vertical = 3.dp)
                    .clearAndSetSemantics { },
        )
    }
}
