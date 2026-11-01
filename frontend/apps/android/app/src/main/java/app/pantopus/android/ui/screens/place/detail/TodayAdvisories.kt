package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceWeatherAlert
import app.pantopus.android.data.api.models.place.WeatherAlertSeverity
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Two advisories show; the rest wait behind "N more". */
private const val ADVISORIES_SHOWN = 2

/** An alert's window and order on the place's clock (TPR contract §3). */
object AlertWindow {
    /** Warnings first, then watches, then advisories; within one, the soonest end. */
    fun ordered(alerts: List<PlaceWeatherAlert>): List<PlaceWeatherAlert> =
        alerts.sortedWith(
            compareBy<PlaceWeatherAlert> { rank(it.severity) }
                .thenBy { PlanFormat.instant(it.ends) ?: java.time.Instant.MAX },
        )

    @Suppress("MagicNumber")
    private fun rank(severity: WeatherAlertSeverity): Int =
        when (severity) {
            WeatherAlertSeverity.WARNING -> 0
            WeatherAlertSeverity.WATCH -> 1
            WeatherAlertSeverity.ADVISORY -> 2
            WeatherAlertSeverity.UNKNOWN -> 3
        }

    /** "Until 10 AM", "Through Mon 10 AM", "From 4 AM until 10 AM", "Until further notice". */
    fun text(
        alert: PlaceWeatherAlert,
        now: ZonedDateTime,
    ): String {
        val zone = now.zone
        val onset = PlanFormat.instant(alert.onset)?.atZone(zone)
        val ends = PlanFormat.instant(alert.ends)?.atZone(zone)
        val end =
            when {
                ends == null -> "until further notice"
                ends.toLocalDate() == (onset?.takeIf { it.isAfter(now) } ?: now).toLocalDate() -> "until ${clock(ends)}"
                else -> "through ${day(ends)} ${clock(ends)}"
            }
        val window =
            if (onset != null && onset.isAfter(now)) {
                val start = if (onset.toLocalDate() == now.toLocalDate()) clock(onset) else "${day(onset)} ${clock(onset)}"
                "From $start $end"
            } else {
                end
            }
        return window.replaceFirstChar { it.uppercase() }
    }

    /** True while the alert covers part of the rest of [now]'s day at the place. */
    fun coversToday(
        alert: PlaceWeatherAlert,
        now: ZonedDateTime,
    ): Boolean {
        val onset = PlanFormat.instant(alert.onset)
        val ends = PlanFormat.instant(alert.ends)
        val endOfDay = now.toLocalDate().plusDays(1).atStartOfDay(now.zone).toInstant()
        return (ends == null || ends.isAfter(now.toInstant())) && (onset == null || onset.isBefore(endOfDay))
    }

    /** "10 AM", "10:30 AM": the place's clock. */
    fun clock(at: ZonedDateTime): String = at.format(DateTimeFormatter.ofPattern(if (at.minute == 0) "h a" else "h:mm a", Locale.US))

    private fun day(at: ZonedDateTime): String = at.format(DateTimeFormatter.ofPattern("EEE", Locale.US))

    /** "Issued Sat 10:39 PM": when the provider issued this bulletin, on the place's clock. */
    fun issued(
        alert: PlaceWeatherAlert,
        zone: ZoneId,
    ): String? = PlanFormat.instant(alert.sent)?.atZone(zone)?.let { "Issued ${day(it)} ${clock(it)}" }

    /** "Started 1 AM · Ends 10 AM" (or "Starts …"): the hazard's own window, with the weekday off today. */
    fun span(
        alert: PlaceWeatherAlert,
        now: ZonedDateTime,
    ): String? {
        fun at(instant: java.time.Instant): String {
            val local = instant.atZone(now.zone)
            return if (local.toLocalDate() == now.toLocalDate()) clock(local) else "${day(local)} ${clock(local)}"
        }
        val onset = PlanFormat.instant(alert.onset)
        val ends = PlanFormat.instant(alert.ends)
        return listOfNotNull(
            onset?.let { (if (it.isAfter(now.toInstant())) "Starts " else "Started ") + at(it) },
            ends?.let { "Ends ${at(it)}" },
        ).takeIf { it.isNotEmpty() }?.joinToString(" · ")
    }
}

/**
 * The active advisories at the top of Today (TPR brief 5.3): each one's event, window and issuer in a warm block,
 * most severe and soonest first, two at a time; a tap opens the area, the times and the official text, unedited,
 * with its source. Nothing shows without alerts; an unchecked alert list never reaches here.
 */
@Composable
fun TodayAdvisorySummary(
    alerts: List<PlaceWeatherAlert>,
    source: String?,
    now: ZonedDateTime,
    modifier: Modifier = Modifier,
) {
    if (alerts.isEmpty()) return
    val ordered = AlertWindow.ordered(alerts)
    var all by rememberSaveable { mutableStateOf(false) }
    val shown = if (all) ordered else ordered.take(ADVISORIES_SHOWN)
    Column(modifier = modifier.fillMaxWidth().testTag("today.advisories"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        shown.forEach { AdvisoryBlock(it, source, now) }
        val more = ordered.size - ordered.take(ADVISORIES_SHOWN).size
        if (more > 0) {
            Text(
                if (all) "Show fewer" else "$more more",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(
                            role = Role.Button,
                            onClickLabel = if (all) "Show two alerts" else "Show every active alert",
                        ) { all = !all }
                        .heightIn(min = 48.dp)
                        .padding(horizontal = 4.dp, vertical = 14.dp)
                        .testTag("today.advisories.more"),
            )
        }
    }
}

@Composable
private fun AdvisoryBlock(
    alert: PlaceWeatherAlert,
    source: String?,
    now: ZonedDateTime,
) {
    var open by rememberSaveable(alert.id) { mutableStateOf(false) }
    val warning = alert.severity == WeatherAlertSeverity.WARNING
    val bg = if (warning) PantopusColors.errorBg else PantopusColors.warningBg
    val fg = if (warning) PantopusColors.error else PantopusColors.warning
    val issuer = alert.senderName?.takeIf { it.isNotBlank() } ?: source?.takeIf { it.isNotBlank() }
    val line = listOfNotNull(AlertWindow.text(alert, now), issuer).joinToString(" · ")
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(bg)
                .clickable(role = Role.Button, onClickLabel = if (open) "Hide the official text" else "Show the official text") {
                    open = !open
                }.semantics { stateDescription = if (open) "Expanded" else "Collapsed" }
                .animateContentSize()
                .padding(horizontal = 14.dp, vertical = 13.dp)
                .testTag("today.advisory.${alert.id}"),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(PantopusIcon.TriangleAlert, null, size = 18.dp, strokeWidth = 2f, tint = fg)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(alert.event, fontSize = 16.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(line, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
            }
            PantopusIconImage(if (open) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown, null, size = 16.dp, tint = fg)
        }
        if (open) AdvisoryDetail(alert, source, now)
    }
}

@Composable
private fun AdvisoryDetail(
    alert: PlaceWeatherAlert,
    source: String?,
    now: ZonedDateTime,
) {
    val links = LocalUriHandler.current
    val text = alert.originalText.ifBlank { alert.description }
    alert.area?.takeIf { it.isNotBlank() }?.let {
        Text("Area: $it", fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
    }
    AlertWindow.issued(alert, now.zone)?.let { Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary) }
    AlertWindow.span(alert, now)?.let { Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary) }
    if (alert.headline.isNotBlank() && alert.headline != alert.event) {
        Text(alert.headline, fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextStrong)
    }
    if (text.isNotBlank()) Text(text, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
    Text("${source?.takeIf { it.isNotBlank() } ?: "Source unavailable"} · live", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
    alert.detailsUrl?.takeIf { it.isNotBlank() }?.let { url ->
        Text(
            "Open the official alert",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable(role = Role.Button) { links.openUri(url) }.heightIn(min = 48.dp).padding(vertical = 14.dp),
        )
    }
}
