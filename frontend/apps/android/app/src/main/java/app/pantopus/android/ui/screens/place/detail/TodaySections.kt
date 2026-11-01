package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.AirQualityCategory
import app.pantopus.android.data.api.models.place.PlaceCoverage
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.placeSurface
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.ZoneId

private const val MINUTES_PER_HOUR = 60

/** A Today section's title (the largest type after the sky and an advisory) and its quiet trailing note. */
@Composable
fun TodaySectionHead(
    title: String,
    modifier: Modifier = Modifier,
    trailing: String? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(top = 24.dp, bottom = 10.dp, start = 2.dp, end = 2.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            title,
            fontSize = 18.sp,
            lineHeight = 23.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.2).sp,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        trailing?.let { Text(it, fontSize = 12.5.sp, color = PantopusColors.appTextMuted) }
    }
}

/** A brand-colored text action with a 48 dp target. */
@Composable
fun TodayTextAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    state: String? = null,
) {
    Text(
        text,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.primary600,
        modifier =
            modifier
                .clip(RoundedCornerShape(8.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { state?.let { stateDescription = it } }
                .heightIn(min = 48.dp)
                .padding(horizontal = 2.dp, vertical = 14.dp),
    )
}

/**
 * Air quality and daylight side by side (TPR brief 5.6): the number, category, main pollutant, monitor or model
 * estimate and time; the day's length with sunrise and sunset on the place's clock. Each opens its full card; a side
 * that can't answer says so in its own words.
 */
@Composable
fun TodayAirDaylightPair(
    air: PlaceSectionEnvelope?,
    sun: PlaceSectionEnvelope?,
    zone: ZoneId?,
    onAir: () -> Unit,
    onSun: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (air == null && sun == null) return
    Row(
        modifier = modifier.fillMaxWidth().padding(top = 16.dp).height(IntrinsicSize.Min).placeSurface().testTag("today.airDaylight"),
    ) {
        PairHalf(airLines(air, zone), onAir, Modifier.weight(1f).testTag("today.air"))
        Box(modifier = Modifier.width(1.dp).fillMaxHeight().padding(vertical = 14.dp).background(PantopusColors.appBorderSubtle))
        PairHalf(daylightLines(sun, zone), onSun, Modifier.weight(1f).testTag("today.daylight"))
    }
}

/** One side of the pair: its label, its reading and the line under it. */
private data class PairLines(
    val label: String,
    val value: String,
    val detail: String?,
    val dot: androidx.compose.ui.graphics.Color? = null,
    val spoken: String,
)

private fun airLines(
    env: PlaceSectionEnvelope?,
    zone: ZoneId?,
): PairLines {
    val data = env?.airQuality?.takeIf { env.isLive() }
    if (env == null || data == null) {
        val why = env?.let(::unavailableWords) ?: "Not available here yet"
        return PairLines("Air quality", "—", why, spoken = "Air quality: $why")
    }
    val pollutant = data.dominantPollutant?.let { POLLUTANTS[it.lowercase()] ?: it.uppercase() }
    val how = if (env.coverage == PlaceCoverage.PARTIAL) "model estimate" else "nearby monitor"
    val time = PlacePresentation.fmtTime(env.asOf, zone)
    val detail = listOfNotNull(pollutant, how, time).joinToString(" · ")
    return PairLines(
        "Air quality",
        "${data.index} ${data.categoryLabel}",
        detail,
        airDot(data.category),
        "Air quality ${data.index}, ${data.categoryLabel}. $detail",
    )
}

private fun daylightLines(
    env: PlaceSectionEnvelope?,
    zone: ZoneId?,
): PairLines {
    val data = env?.sunriseSunset
    if (env == null || data == null) {
        val why = env?.let(::unavailableWords) ?: "Not available here yet"
        return PairLines("Daylight", "—", why, spoken = "Daylight: $why")
    }
    val length = "${data.daylightMinutes / MINUTES_PER_HOUR}h ${data.daylightMinutes % MINUTES_PER_HOUR}m"
    val rise = PlacePresentation.fmtSunClock(data.localSunrise(zone))
    val set = PlacePresentation.fmtSunClock(data.localSunset(zone))
    val day = PlacePresentation.fmtSunDay(data, zone)?.takeUnless { it == "today" }
    val detail = listOfNotNull("↑ $rise  ↓ $set", day).joinToString(" · ")
    return PairLines("Daylight", length, detail, spoken = "Daylight $length. Sunrise $rise, sunset $set${day?.let { ", $it" } ?: ""}.")
}

/** An unavailable, unsupported, locked or failed side, in its own words (never read as clear). */
private fun unavailableWords(env: PlaceSectionEnvelope): String =
    when {
        env.status == PlaceSectionStatus.ERROR -> "Couldn't load just now"
        !env.unavailableReason.isNullOrBlank() -> env.unavailableReason.orEmpty()
        else -> "Not available here yet"
    }

private val POLLUTANTS = mapOf("pm25" to "PM2.5", "pm10" to "PM10", "ozone" to "Ozone", "no2" to "NO2", "so2" to "SO2", "co" to "CO")

private fun airDot(category: AirQualityCategory) =
    when (category) {
        AirQualityCategory.GOOD -> PantopusColors.home
        AirQualityCategory.MODERATE, AirQualityCategory.UNHEALTHY_SENSITIVE -> PantopusColors.warning
        AirQualityCategory.UNHEALTHY, AirQualityCategory.VERY_UNHEALTHY, AirQualityCategory.HAZARDOUS -> PantopusColors.error
        AirQualityCategory.UNKNOWN -> PantopusColors.appTextMuted
    }

@Composable
private fun PairHalf(
    lines: PairLines,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Column(
        modifier =
            modifier
                .clickable(role = Role.Button, onClickLabel = "Show the full card", onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = lines.spoken
                    role = Role.Button
                }.heightIn(min = 48.dp)
                .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(lines.label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            lines.dot?.let { Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(it)) }
            Text(lines.value, fontSize = 19.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        }
        lines.detail?.let { Text(it, fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary) }
    }
}

/**
 * A folded group under its title and one-line summary (Complete your home setup; Sources and full conditions): the
 * row says whether it is open, and its content shows only when it is.
 */
@Composable
fun TodayFold(
    title: String,
    summary: String?,
    open: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth().padding(top = 16.dp).placeSurface().animateContentSize()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClick = onToggle)
                    .semantics(mergeDescendants = true) { stateDescription = if (open) "Expanded" else "Collapsed" }
                    .heightIn(min = 56.dp)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                summary?.let { Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary) }
            }
            PantopusIconImage(if (open) PantopusIcon.Minus else PantopusIcon.Plus, null, size = 18.dp, tint = PantopusColors.appTextMuted)
        }
        if (open) {
            TodayHairline()
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp)) { content() }
        }
    }
}

/** A row inside a fold that opens one existing flow: its title in the brand color, and what it holds. */
@Composable
fun TodayFoldRow(
    title: String,
    subtitle: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onClick)
                .heightIn(min = 52.dp)
                .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
            subtitle?.let { Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary) }
        }
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** "Ask Pantopus about today": the assistant about this place's day, at the end of the page. */
@Composable
fun TodayAskEntry(
    title: String,
    onAsk: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = 20.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                .clickable(role = Role.Button, onClick = onAsk)
                .heightIn(min = 48.dp)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .testTag("todayAskPantopus"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(PantopusIcon.Sparkles, null, size = 18.dp, tint = PantopusColors.magic)
        Text(title, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600, modifier = Modifier.weight(1f))
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}
