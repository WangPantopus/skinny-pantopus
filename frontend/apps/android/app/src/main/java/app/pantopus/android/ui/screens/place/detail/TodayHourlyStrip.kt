@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import android.text.format.DateFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.PlaceWeatherAlert
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.data.api.models.place.PlaceWeatherHour
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.screens.place.components.placeSurface
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.SkyPalette
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/** A chance of rain or snow under this reads as noise on the hourly strip and the daily forecast (contract §2). */
internal const val PRECIP_SHOWN_FROM = 10.0
private const val HOURS_SHOWN = 24
private val CELL_WIDTH = 58.dp

/** One hour on the strip, on the place's clock. */
data class HourlyCell(
    val start: ZonedDateTime,
    val now: Boolean,
    val hour: PlaceWeatherHour,
    /** The temperature shown: the current reading for "Now", the forecast for the hours after it. */
    val temp: Double,
    /** The advisory covering this hour, if one does. */
    val alert: PlaceWeatherAlert?,
    val night: Boolean,
)

/** The strip's hours: the one holding now ("Now") and the rest of the forecast, at most 24 (contract §2). */
fun hourlyCells(
    data: PlaceWeatherData,
    alerts: List<PlaceWeatherAlert>,
    sun: PlaceSunriseSunsetData?,
    now: ZonedDateTime,
): List<HourlyCell> {
    val zone = now.zone
    val ordered = AlertWindow.ordered(alerts)
    return data.hourly
        .mapNotNull { hour -> runCatching { Instant.parse(hour.time) }.getOrNull()?.let { it to hour } }
        .filter { (start, _) -> start.plusSeconds(3600).isAfter(now.toInstant()) }
        .sortedBy { it.first }
        .take(HOURS_SHOWN)
        .map { (start, hour) ->
            val at = start.atZone(zone)
            val covering =
                ordered.firstOrNull { alert ->
                    val onset = PlanFormat.instant(alert.onset)
                    val ends = PlanFormat.instant(alert.ends)
                    (onset == null || !onset.isAfter(start)) && (ends == null || ends.isAfter(start))
                }
            val moment = SkyMoment.at(at, sun?.localSunrise(zone), sun?.localSunset(zone))
            val isNow = !start.isAfter(now.toInstant())
            HourlyCell(at, isNow, hour, if (isNow) data.currentTempF else hour.tempF, covering, moment.phase == SkyPalette.Phase.NIGHT)
        }
}

/**
 * The visible hourly forecast under the sky (TPR brief 7.1): "Now" and the coming hours with their sky, temperature
 * and, when it matters, the chance of rain or snow; an advisory's hours carry its band and name. It scrolls sideways
 * on its own, so the page keeps its vertical scroll; TalkBack hears one summary.
 */
@Composable
fun TodayHourlyStrip(
    cells: List<HourlyCell>,
    modifier: Modifier = Modifier,
) {
    if (cells.isEmpty()) return
    val spoken = hourlySummary(cells)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .placeSurface()
                .horizontalScroll(rememberScrollState())
                .clearAndSetSemantics { contentDescription = spoken }
                .padding(horizontal = 6.dp, vertical = 10.dp)
                .testTag("today.hourly"),
    ) {
        // The band row and the rain line show only when some hour needs them (as on iPhone).
        val band = cells.any { it.alert != null }
        val rain = cells.any { precipLabel(it.hour) != null }
        cells.forEachIndexed { index, cell ->
            val starts = cell.alert != null && cell.alert.id != cells.getOrNull(index - 1)?.alert?.id
            // How many hours in a row this advisory covers from here: its name fits inside its band.
            val run = if (starts) cells.drop(index).takeWhile { it.alert?.id == cell.alert?.id }.size else 0
            HourCell(cell, bandCells = run, band = band, rain = rain)
        }
    }
}

@Composable
private fun HourCell(
    cell: HourlyCell,
    /** The hours this advisory's band spans from here; 0 where it doesn't begin. */
    bandCells: Int,
    band: Boolean,
    rain: Boolean,
) {
    Column(modifier = Modifier.width(CELL_WIDTH), horizontalAlignment = Alignment.CenterHorizontally) {
        // The advisory's band, its name above the band where it begins.
        if (band) {
            Box(modifier = Modifier.fillMaxWidth().height(20.dp)) {
                if (cell.alert != null) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.BottomStart)
                                .fillMaxWidth()
                                .height(5.dp)
                                .background(PantopusColors.warningLight),
                    )
                }
                if (cell.alert != null && bandCells > 0) {
                    Text(
                        cell.alert.event,
                        fontSize = 10.5.sp,
                        lineHeight = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.warning,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier =
                            Modifier
                                .align(Alignment.TopStart)
                                .wrapContentWidth(Alignment.Start, unbounded = true)
                                .widthIn(max = CELL_WIDTH * bandCells)
                                .padding(start = 6.dp),
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            when {
                cell.now -> "Now"
                // The first hour of a new day says which day it is.
                cell.start.hour == 0 -> cell.start.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, Locale.getDefault())
                else -> hourLabel(cell.start)
            },
            fontSize = 12.sp,
            fontWeight = if (cell.now) FontWeight.Bold else FontWeight.Medium,
            color = if (cell.now) PantopusColors.appText else PantopusColors.appTextSecondary,
            maxLines = 1,
        )
        Spacer(modifier = Modifier.height(6.dp))
        PantopusIconImage(
            conditionIcon(cell.hour.conditionCode, cell.night),
            null,
            size = 20.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextStrong,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text("${cell.temp.roundToInt()}°", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        if (rain) {
            Text(
                precipLabel(cell.hour).orEmpty(),
                fontSize = 11.5.sp,
                lineHeight = 14.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.primary600,
                maxLines = 1,
            )
        }
    }
}

/** "2 PM" or "14", in the person's own clock style. */
private fun hourLabel(at: ZonedDateTime): String =
    at.format(DateTimeFormatter.ofPattern(DateFormat.getBestDateTimePattern(Locale.getDefault(), "j"), Locale.getDefault()))

private fun precipLabel(hour: PlaceWeatherHour): String? =
    hour.precipChance.takeIf { it >= PRECIP_SHOWN_FROM }?.let { "${it.roundToInt()}%" }

/** The hour's sky as a glyph; the moon by night when it's clear. */
fun conditionIcon(
    code: WeatherConditionCode,
    night: Boolean,
): PantopusIcon =
    when (code) {
        WeatherConditionCode.CLEAR -> if (night) PantopusIcon.Moon else PantopusIcon.Sun
        WeatherConditionCode.PARTLY_CLOUDY -> if (night) PantopusIcon.Cloud else PantopusIcon.CloudSun
        WeatherConditionCode.CLOUDY, WeatherConditionCode.FOG, WeatherConditionCode.UNKNOWN -> PantopusIcon.Cloud
        WeatherConditionCode.RAIN -> PantopusIcon.CloudRain
        WeatherConditionCode.SNOW, WeatherConditionCode.SLEET -> PantopusIcon.Snowflake
        WeatherConditionCode.THUNDERSTORM -> PantopusIcon.Zap
        WeatherConditionCode.WIND -> PantopusIcon.Wind
    }

/** One sentence for TalkBack: now, the low and high ahead with their hours, the wettest hour, and any advisory window. */
fun hourlySummary(cells: List<HourlyCell>): String {
    val first = cells.first()
    val now = "Now ${first.temp.roundToInt()}°, ${SkyScrub.label(first.hour.conditionCode)}"
    val parts = mutableListOf("Next ${cells.size} hours. $now")
    cells.minByOrNull { it.temp }?.let { parts += "low ${it.temp.roundToInt()}° at ${hourLabel(it.start)}" }
    cells.maxByOrNull { it.temp }?.let { parts += "high ${it.temp.roundToInt()}° at ${hourLabel(it.start)}" }
    cells.maxByOrNull { it.hour.precipChance }?.takeIf { it.hour.precipChance >= PRECIP_SHOWN_FROM }?.let {
        parts += "chance of rain up to ${it.hour.precipChance.roundToInt()}% at ${hourLabel(it.start)}"
    }
    cells.mapNotNull { it.alert }.distinctBy { it.id }.forEach { alert ->
        val covered = cells.filter { it.alert?.id == alert.id }
        parts += "${alert.event} from ${hourLabel(covered.first().start)} to ${hourLabel(covered.last().start.plusHours(1))}"
    }
    return parts.joinToString(", ") + "."
}
