@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "MatchingDeclarationName", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.hub

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** A5 — what the summary card should render. */
@Immutable
sealed interface SummaryCardContent {
    data class Data(val summary: HubSummaryUi) : SummaryCardContent

    data object Empty : SummaryCardContent

    data object Error : SummaryCardContent

    data object Loading : SummaryCardContent
}

/**
 * A5 Scheduling Summary Card — a reusable composable embedded at the top of the
 * Scheduling Hub (and reusable elsewhere). Accents off the active [pillar].
 */
@Composable
fun SummaryCard(
    content: SummaryCardContent,
    pillar: SchedulingPillar,
    onShare: () -> Unit,
    onRetry: () -> Unit,
    onInsights: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(16.dp))
                .clip(RoundedCornerShape(16.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(16.dp))
                .padding(Spacing.s4),
    ) {
        // Loading replaces the entire card body with shimmer (including header area).
        if (content is SummaryCardContent.Loading) {
            SummaryLoading()
        } else {
            val showPeriod = content is SummaryCardContent.Data
            SummaryHeader(pillar = pillar, showPeriod = showPeriod)
            Spacer(Modifier.height(Spacing.s3 + 2.dp))
            when (content) {
                is SummaryCardContent.Data -> SummaryData(content.summary, pillar, onInsights)
                SummaryCardContent.Empty -> SummaryEmpty(pillar, onShare)
                SummaryCardContent.Error -> SummaryError(onRetry)
                SummaryCardContent.Loading -> Unit // handled above
            }
        }
    }
}

@Composable
private fun SummaryHeader(
    pillar: SchedulingPillar,
    showPeriod: Boolean,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("THIS MONTH", color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.weight(1f))
        if (showPeriod) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(3.dp),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                PeriodChip("This week", active = false, pillar = pillar)
                PeriodChip("This month", active = true, pillar = pillar)
            }
        }
    }
}

@Composable
private fun PeriodChip(
    label: String,
    active: Boolean,
    pillar: SchedulingPillar,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (active) pillar.accent else PantopusColors.appSurfaceSunken)
                .padding(horizontal = 11.dp, vertical = 5.dp),
    ) {
        Text(
            label,
            color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
            fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun SummaryData(
    summary: HubSummaryUi,
    pillar: SchedulingPillar,
    onInsights: () -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp)) {
        StatCell(value = summary.bookings.toString(), label = "Bookings", modifier = Modifier.weight(1f))
        StatDivider()
        if (summary.deltaPct != null) {
            StatCell(
                value = formatDelta(summary.deltaPct),
                label = "vs last month",
                delta = summary.deltaPct,
                modifier = Modifier.weight(1f),
            )
            StatDivider()
        }
        StatCell(value = summary.upcoming.toString(), label = "Upcoming", modifier = Modifier.weight(1f))
        StatDivider()
        StatCell(value = summary.noShows.toString(), label = "No-shows", modifier = Modifier.weight(1f))
    }
    if (summary.sparkCounts.any { it > 0 }) {
        Spacer(Modifier.height(Spacing.s4))
        Sparkline(counts = summary.sparkCounts, accent = pillar.accent)
    }
    if (summary.breakdown.isNotEmpty()) {
        Spacer(Modifier.height(Spacing.s3))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            summary.breakdown.forEach { chip ->
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurfaceSunken)
                            .padding(horizontal = 9.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 1.dp),
                ) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(pillar.accent))
                    Text(chip.label, color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                    Text(chip.count.toString(), color = PantopusColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
        }
    }
    Spacer(Modifier.height(Spacing.s3))
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
        Row(
            modifier = Modifier.clickable(onClick = onInsights).testTag("schedulingSummarySeeInsights"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text("See insights", color = pillar.accent, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 14.dp, tint = pillar.accent)
        }
    }
}

@Composable
private fun StatCell(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    delta: Int? = null,
) {
    val color =
        when {
            delta == null -> PantopusColors.appText
            delta >= 0 -> PantopusColors.success
            else -> PantopusColors.error
        }
    Column(modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            if (delta != null) {
                PantopusIconImage(
                    icon = if (delta >= 0) PantopusIcon.ArrowUp else PantopusIcon.ArrowDown,
                    contentDescription = null,
                    size = 16.dp,
                    tint = color,
                )
            }
            Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        }
        Text(label, color = PantopusColors.appTextSecondary, fontWeight = FontWeight.SemiBold, fontSize = 10.5.sp)
    }
}

@Composable
private fun StatDivider() {
    Box(modifier = Modifier.width(1.dp).height(36.dp).background(PantopusColors.appBorderSubtle))
}

@Composable
private fun Sparkline(
    counts: List<Int>,
    accent: androidx.compose.ui.graphics.Color,
) {
    val maxV = (counts.maxOrNull() ?: 1).coerceAtLeast(1)
    Canvas(modifier = Modifier.fillMaxWidth().height(40.dp)) {
        if (counts.size < 2) return@Canvas
        val w = size.width
        val h = size.height
        val stepX = w / (counts.size - 1)
        val points = counts.mapIndexed { i, v -> Offset(i * stepX, h - (v.toFloat() / maxV) * (h - 2f)) }
        val line =
            Path().apply {
                moveTo(points.first().x, points.first().y)
                points.drop(1).forEach { lineTo(it.x, it.y) }
            }
        val area =
            Path().apply {
                addPath(line)
                lineTo(points.last().x, h)
                lineTo(points.first().x, h)
                close()
            }
        drawPath(area, color = accent.copy(alpha = 0.08f))
        drawPath(line, color = accent, style = Stroke(width = 2f))
        drawCircle(color = accent, radius = 3f, center = points.last())
    }
}

@Composable
private fun SummaryEmpty(
    pillar: SchedulingPillar,
    onShare: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(44.dp).clip(RoundedCornerShape(Radii.lg)).background(pillar.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CalendarClock, contentDescription = null, size = 22.dp, tint = pillar.accent)
        }
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Text("No bookings yet", color = PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text("Share your link to get your first one.", color = PantopusColors.appTextSecondary, fontSize = 12.5.sp)
        }
    }
    Spacer(Modifier.height(Spacing.s3))
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.accent)
                .clickable(onClick = onShare),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = PantopusIcon.Share, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextInverse)
        Text("Share booking link", color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
    }
}

@Composable
private fun SummaryError(onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CloudOff, contentDescription = null, size = 20.dp, tint = PantopusColors.appTextSecondary)
        }
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Text("Couldn't load your numbers", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            Text("Check your connection and try again.", color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 14.dp, vertical = Spacing.s2)
                    .testTag("schedulingSummaryRetry"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextStrong)
            Text("Retry", color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
        }
    }
}

@Composable
private fun SummaryLoading() {
    // Header row: overline label shimmer + period-toggle pill shimmer
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.width(88.dp).height(11.dp).clip(RoundedCornerShape(Radii.xs)).background(PantopusColors.appSurfaceSunken))
        Spacer(Modifier.weight(1f))
        Box(
            modifier =
                Modifier.width(
                    120.dp,
                ).height(26.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.appSurfaceSunken),
        )
    }
    Spacer(Modifier.height(14.dp))
    // Stat cells row
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp)) {
        repeat(4) {
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier =
                        Modifier.fillMaxWidth(
                            0.7f,
                        ).height(22.dp).clip(RoundedCornerShape(Radii.xs)).background(PantopusColors.appSurfaceSunken),
                )
                Spacer(Modifier.height(Spacing.s1))
                Box(
                    modifier =
                        Modifier.fillMaxWidth(
                            0.9f,
                        ).height(9.dp).clip(RoundedCornerShape(Radii.xs)).background(PantopusColors.appSurfaceSunken),
                )
            }
        }
    }
    Spacer(Modifier.height(Spacing.s4))
    // Sparkline shimmer
    Box(modifier = Modifier.fillMaxWidth().height(40.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken))
    // "See insights" link shimmer
    Spacer(Modifier.height(Spacing.s3))
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Box(modifier = Modifier.width(86.dp).height(12.dp).clip(RoundedCornerShape(Radii.xs)).background(PantopusColors.appSurfaceSunken))
    }
}

private fun formatDelta(pct: Int): String = if (pct >= 0) "+$pct%" else "$pct%"
