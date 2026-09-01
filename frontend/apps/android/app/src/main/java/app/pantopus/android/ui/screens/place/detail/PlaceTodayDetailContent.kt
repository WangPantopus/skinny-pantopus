package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.GoodDayVerdict
import app.pantopus.android.data.api.models.place.PlaceAirQualityData
import app.pantopus.android.data.api.models.place.PlaceGoodDayTile
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.PlaceWeatherAlert
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.data.api.models.place.WeatherAlertSeverity
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlin.math.roundToInt

/** The row shows at most five tiles; the rest stay in the group page. */
private const val GOOD_DAY_TILE_CAP = 5

@Composable
fun PlaceTodayDetailContent(intel: PlaceIntelligence) {
    intel.section(PlaceSectionId.WEATHER)?.let { env ->
        PlaceDetailSectionLabel("Weather")
        val data = env.weather
        if (data != null && env.isLive()) {
            NowCard(data)
            PlaceSourceNote("National Weather Service", PlacePresentation.fmtTime(env.asOf))
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
    intel.section(PlaceSectionId.GOOD_DAY_TO)?.let { env ->
        val data = env.goodDayTo
        if (data != null && env.isLive() && data.tiles.isNotEmpty()) {
            PlaceDetailSectionLabel("Good day to\u2026")
            GoodDayRow(data.tiles)
            PlaceSourceNote("Derived from today's conditions", PlacePresentation.fmtTime(env.asOf))
        }
        // Deliberately silent when there is nothing to answer: an empty
        // verdict row is worse than no row.
    }
    intel.section(PlaceSectionId.AIR_QUALITY)?.let { env ->
        PlaceDetailSectionLabel("Air quality")
        val data = env.airQuality
        if (data != null && env.isLive()) {
            AqiCard(data)
            PlaceSourceNote("AirNow · EPA", PlacePresentation.fmtTime(env.asOf))
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
    intel.section(PlaceSectionId.ALERTS)?.let { env ->
        PlaceDetailSectionLabel("Alerts")
        AlertsCard(env.alerts?.active.orEmpty())
        PlaceSourceNote("National Weather Service", "live")
    }
    intel.section(PlaceSectionId.SUNRISE_SUNSET)?.let { env ->
        PlaceDetailSectionLabel("Sun")
        val data = env.sunriseSunset
        if (data != null) {
            SunCard(data)
            PlaceSourceNote("Your location", "today")
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
    PlaceDetailSectionLabel("Coming soon")
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PlaceComingSoonRow(PantopusIcon.Flower2, "Pollen & allergens", "Daily pollen count for your area")
        PlaceComingSoonRow(PantopusIcon.Trash, "Trash & recycling", "Your pickup schedule")
        PlaceComingSoonRow(PantopusIcon.ZapOff, "Power outages", "Live status for your block")
    }
}

/**
 * "Good day to…" — verdicts, not readings. Tapping a tile reveals the
 * numbers behind it: an opinionated tile that won't show its inputs is
 * worse than no tile, because one visibly wrong verdict discredits every
 * other card here.
 */
@Composable
private fun GoodDayRow(tiles: List<PlaceGoodDayTile>) {
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    val shown = tiles.take(GOOD_DAY_TILE_CAP)
    val open = shown.firstOrNull { it.id == openId }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            shown.forEach { tile ->
                val tint =
                    when (tile.verdict) {
                        GoodDayVerdict.YES -> PantopusColors.home
                        GoodDayVerdict.CAUTION -> PantopusColors.warning
                        else -> PantopusColors.appTextMuted
                    }
                Column(
                    modifier =
                        Modifier
                            .width(108.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(PantopusColors.appSurface)
                            .clickable { openId = if (openId == tile.id) null else tile.id }
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(tile.glyph, fontSize = 19.sp)
                    Text(
                        tile.label,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(tile.answer, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = tint)
                }
            }
        }
        if (open != null) {
            PlaceDetailCard {
                Text(
                    open.label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
                Text(open.because, fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
            }
        }
    }
}

@Composable
private fun NowCard(data: PlaceWeatherData) {
    PlaceDetailCard {
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Now", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        "${data.currentTempF.roundToInt()}",
                        fontSize = 56.sp,
                        fontWeight = FontWeight.Light,
                        color = PantopusColors.appText,
                    )
                    Text(
                        "°",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Light,
                        color = PantopusColors.appText,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
                if (data.conditionLabel.isNotEmpty()) {
                    Text(data.conditionLabel, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier =
                        Modifier
                            .size(54.dp)
                            .clip(RoundedCornerShape(15.dp))
                            .background(PantopusColors.warningBg)
                            .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(15.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        weatherGlyph(data.conditionCode),
                        null,
                        size = 30.dp,
                        strokeWidth = 2f,
                        tint = weatherTint(data.conditionCode),
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    if (data.highF != null && data.lowF != null) {
                        Text(
                            "H ${data.highF.roundToInt()}° · L ${data.lowF.roundToInt()}°",
                            fontSize = 13.5.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    if (data.feelsLikeF != null) {
                        Text("Feels like ${data.feelsLikeF.roundToInt()}°", fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
                    }
                }
            }
        }
    }
}

@Composable
private fun AqiCard(data: PlaceAirQualityData) {
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(
                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(14.dp)).background(PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Wind, null, size = 23.dp, strokeWidth = 2f, tint = PantopusColors.home)
                }
                Column {
                    Text("${data.index}", fontSize = 34.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    Text(data.categoryLabel, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = aqiColor(data))
                }
            }
            // Continuous AQI scale (token-clean green→amber→red).
            androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(14.dp)) {
                val frac = (data.index / 300.0).coerceIn(0.0, 1.0)
                Box(
                    modifier =
                        Modifier.fillMaxWidth().height(
                            8.dp,
                        ).align(
                            Alignment.CenterStart,
                        ).clip(
                            CircleShape,
                        ).background(Brush.horizontalGradient(listOf(PantopusColors.home, PantopusColors.warning, PantopusColors.error))),
                )
                Box(
                    modifier =
                        Modifier
                            .offset(x = maxWidth * frac.toFloat() - 7.dp)
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .border(3.dp, aqiColor(data), CircleShape)
                            .align(Alignment.CenterStart),
                )
            }
            Text(data.healthMessage, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun AlertsCard(active: List<PlaceWeatherAlert>) {
    if (active.isEmpty()) {
        PlaceDetailCard {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Check, null, size = 21.dp, strokeWidth = 2.5f, tint = PantopusColors.home)
                }
                Column {
                    Text("No active alerts", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    Text("Nothing to watch for on your block right now.", fontSize = 13.sp, color = PantopusColors.appTextMuted)
                }
            }
        }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            active.forEach { AlertRow(it) }
        }
    }
}

@Composable
private fun AlertRow(alert: PlaceWeatherAlert) {
    val warn = alert.severity == WeatherAlertSeverity.WARNING
    val bg = if (warn) PantopusColors.errorBg else PantopusColors.warningBg
    val fg = if (warn) PantopusColors.error else PantopusColors.warning
    PlaceDetailCard(padding = 15.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(modifier = Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(bg), contentAlignment = Alignment.Center) {
                PantopusIconImage(PantopusIcon.TriangleAlert, null, size = 18.dp, strokeWidth = 2f, tint = fg)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(alert.event, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                if (alert.headline.isNotEmpty()) Text(alert.headline, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = fg)
                if (alert.description.isNotEmpty()) {
                    Text(
                        alert.description,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun SunCard(data: PlaceSunriseSunsetData) {
    PlaceDetailCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SunStat(PantopusIcon.Sunrise, "Sunrise", PlacePresentation.fmtSunClock(data.sunrise))
            Spacer(modifier = Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Daylight", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
                Text(
                    "${data.daylightMinutes / 60}h ${data.daylightMinutes % 60}m",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextStrong,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            SunStat(PantopusIcon.Sunset, "Sunset", PlacePresentation.fmtSunClock(data.sunset))
        }
    }
}

@Composable
private fun SunStat(
    icon: PantopusIcon,
    label: String,
    time: String,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PantopusIconImage(icon, null, size = 22.dp, strokeWidth = 2f, tint = PantopusColors.warning)
        Text(time.uppercase(), fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
    }
}

private fun aqiColor(data: PlaceAirQualityData): Color =
    when (data.category) {
        app.pantopus.android.data.api.models.place.AirQualityCategory.GOOD -> PantopusColors.home
        app.pantopus.android.data.api.models.place.AirQualityCategory.MODERATE,
        app.pantopus.android.data.api.models.place.AirQualityCategory.UNHEALTHY_SENSITIVE,
        -> PantopusColors.warning
        app.pantopus.android.data.api.models.place.AirQualityCategory.UNHEALTHY,
        app.pantopus.android.data.api.models.place.AirQualityCategory.VERY_UNHEALTHY,
        app.pantopus.android.data.api.models.place.AirQualityCategory.HAZARDOUS,
        -> PantopusColors.error
        app.pantopus.android.data.api.models.place.AirQualityCategory.UNKNOWN -> PantopusColors.appTextSecondary
    }

private fun weatherGlyph(code: WeatherConditionCode): PantopusIcon =
    when (code) {
        WeatherConditionCode.CLEAR -> PantopusIcon.Sun
        WeatherConditionCode.PARTLY_CLOUDY -> PantopusIcon.CloudSun
        WeatherConditionCode.CLOUDY, WeatherConditionCode.FOG -> PantopusIcon.Cloud
        WeatherConditionCode.RAIN,
        WeatherConditionCode.SLEET,
        WeatherConditionCode.SNOW,
        WeatherConditionCode.THUNDERSTORM,
        -> PantopusIcon.CloudRain
        WeatherConditionCode.WIND -> PantopusIcon.Wind
        WeatherConditionCode.UNKNOWN -> PantopusIcon.Cloud
    }

private fun weatherTint(code: WeatherConditionCode): Color =
    when (code) {
        WeatherConditionCode.CLEAR, WeatherConditionCode.THUNDERSTORM -> PantopusColors.warning
        WeatherConditionCode.RAIN, WeatherConditionCode.SLEET, WeatherConditionCode.SNOW -> PantopusColors.primary600
        else -> PantopusColors.appTextSecondary
    }
