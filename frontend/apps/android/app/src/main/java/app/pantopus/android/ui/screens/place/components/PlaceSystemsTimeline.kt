package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceHomeSystem
import app.pantopus.android.ui.theme.PantopusColors
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Years drawn past the longer of the typical range and the age, so "now" never sits on the edge. */
private const val TIMELINE_MARGIN_YEARS = 2

/** A system's standing in words (TPR brief 7.4); the card adds that beyond a typical range isn't proof of failure. */
fun systemStatusWords(system: PlaceHomeSystem): String =
    when (system.status) {
        "past_expected" -> "Beyond its typical range"
        "aging" -> "Nearing its typical range"
        "ok" -> "Within its typical range"
        else -> "Install year unknown"
    }

/** "Last service Mar 14, 2026 · Furnace tune-up · Your maintenance log" when the server sends one (contract §5). */
fun systemServiceLine(system: PlaceHomeSystem): String? {
    val service = system.lastService ?: return null
    val date =
        runCatching { LocalDate.parse(service.date.substringBefore('T')).format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)) }
            .getOrNull() ?: return null
    return listOfNotNull("Last service $date", service.title?.takeIf { it.isNotBlank() }, service.sourceLabel.takeIf { it.isNotBlank() })
        .joinToString(" · ")
}

private fun statusTone(status: String): Color =
    when (status) {
        "past_expected" -> PantopusColors.error
        "aging" -> PantopusColors.warning
        "ok" -> PantopusColors.home
        else -> PantopusColors.appTextMuted
    }

/**
 * The systems timeline (TPR brief 7.4): per system, a bar from the install year to now with the typical service-life
 * range shaded, the age, how the year is known, its standing in words and the last service date where one is
 * recorded. An unknown year stays unknown: no bar. [compact] (Place's glance group) leaves out the source and service
 * lines; the Your home page shows everything.
 */
@Composable
fun PlaceSystemsTimeline(
    systems: List<PlaceHomeSystem>,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth().testTag("place.systemsTimeline"), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        systems.forEach { system -> SystemRow(system, compact) }
    }
}

@Composable
private fun SystemRow(
    system: PlaceHomeSystem,
    compact: Boolean,
) {
    val tone = statusTone(system.status)
    val known = system.installedYear != null
    val ageText = system.installedYear?.let { year -> "$year · ${system.ageYears ?: 0} yrs" } ?: "Year unknown"
    val range = "typical ${system.typicalLifeLow}–${system.typicalLifeHigh} yrs"
    val service = systemServiceLine(system)
    val spoken =
        listOfNotNull(
            "${system.label}: " +
                (system.installedYear?.let { "installed $it, ${system.ageYears ?: 0} years ago" } ?: "install year unknown"),
            "Typical service life ${system.typicalLifeLow} to ${system.typicalLifeHigh} years",
            systemStatusWords(system).takeIf { known },
            system.sourceLabel.takeIf { it.isNotBlank() },
            service,
        ).joinToString(". ")
    Column(
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = spoken },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                system.label,
                fontSize = if (compact) 14.sp else 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Text(ageText, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = tone)
        }
        if (known) {
            LifeBar(
                age = system.ageYears ?: 0,
                low = system.typicalLifeLow,
                high = system.typicalLifeHigh,
                tone = tone,
            )
            Text(systemStatusWords(system), fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary)
        }
        if (!compact) {
            Text(
                listOfNotNull(system.sourceLabel.takeIf { it.isNotBlank() }, range).joinToString(" · "),
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextMuted,
            )
            service?.let { Text(it, fontSize = 11.5.sp, lineHeight = 15.sp, color = PantopusColors.appTextMuted) }
        }
    }
}

/** The years since install against the typical range: the range shaded, the age drawn to "now". */
@Composable
private fun LifeBar(
    age: Int,
    low: Int,
    high: Int,
    tone: Color,
) {
    val band = PantopusColors.appBorder
    val track = PantopusColors.appSurfaceSunken
    val span = (maxOf(high, age) + TIMELINE_MARGIN_YEARS).coerceAtLeast(1).toFloat()
    Canvas(modifier = Modifier.fillMaxWidth().height(12.dp)) {
        val radius = CornerRadius(size.height / 2, size.height / 2)
        val barHeight = size.height / 2
        val top = (size.height - barHeight) / 2
        drawRoundRect(track, topLeft = Offset(0f, top), size = Size(size.width, barHeight), cornerRadius = radius)
        if (high > low) {
            drawRoundRect(
                band,
                topLeft = Offset(size.width * low / span, 0f),
                size = Size(size.width * (high - low) / span, size.height),
                cornerRadius = radius,
            )
        }
        val ageWidth = (size.width * age / span).coerceAtLeast(barHeight)
        drawRoundRect(tone, topLeft = Offset(0f, top), size = Size(ageWidth, barHeight), cornerRadius = radius)
        drawCircle(tone, radius = size.height / 2, center = Offset(ageWidth, size.height / 2))
    }
}
