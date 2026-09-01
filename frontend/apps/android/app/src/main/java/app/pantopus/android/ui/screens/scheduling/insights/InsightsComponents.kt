@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/**
 * A17 Insights & reports — the shared, read-only data-display kit for H9–H12:
 * top bar, period/sort chips, stat tiles, ranked rows, a mini bar chart, a
 * stacked reliability bar, funnel bars, skeletons, and an error view. Tokens
 * only — chart fills are the pillar accent / semantic tokens at reduced alpha,
 * never hardcoded chart colors. Every metric is also announced with a text
 * label (never color alone). Mirrors the iOS `InsightsComponents.swift`.
 */

private const val BAR_FILL_ALPHA = 0.85f
private const val ICON_TINT_ALPHA = 0.14f
private const val GHOST_FILL_ALPHA = 0.5f

// ─── Chrome ─────────────────────────────────────────────────────────────────

/** Back chevron + centered title + optional trailing control (period/sort chip). */
@Composable
fun InsightsTopBar(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    trailing: @Composable () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(46.dp)) {
            Text(
                text = title,
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.2).sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.Center).padding(horizontal = 52.dp),
            )
            Row(
                modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Box(
                    modifier = Modifier.size(36.dp).clip(RoundedCornerShape(Radii.md)).clickable(onClickLabel = "Back", onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.ChevronLeft, contentDescription = "Back", size = 21.dp, tint = PantopusColors.appText)
                }
                Box(contentAlignment = Alignment.CenterEnd) { trailing() }
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

/** The "Last 30 days" chip that opens the H13 Period & Filter sheet. */
@Composable
fun InsightsPeriodChip(
    label: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: Int = 0,
) {
    Row(
        modifier =
            modifier
                .height(30.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp)
                .semantics { contentDescription = "Period: $label. Opens date range and filters" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(PantopusIcon.Calendar, contentDescription = null, size = 13.dp, tint = accent)
        Text(label, color = PantopusColors.appTextStrong, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        if (badge > 0) {
            Box(modifier = Modifier.size(15.dp).clip(CircleShape).background(accent), contentAlignment = Alignment.Center) {
                Text("$badge", color = PantopusColors.appTextInverse, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
            }
        }
        PantopusIconImage(PantopusIcon.ChevronDown, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextMuted)
    }
}

/** A two-state sort chip (Team performance). */
@Composable
fun InsightsSortChip(
    label: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(30.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp)
                .semantics { contentDescription = "Sort by $label" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(PantopusIcon.ArrowDownUp, contentDescription = null, size = 12.dp, tint = accent)
        Text(label, color = PantopusColors.appTextStrong, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

// ─── Containers ─────────────────────────────────────────────────────────────

/** White card: 1px border, 16 radius. No left-border accents. */
@Composable
fun InsightsCard(
    modifier: Modifier = Modifier,
    padding: Dp = 14.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(padding),
        content = content,
    )
}

/** Title Case overline label. */
@Composable
fun InsightsOverline(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = PantopusColors.appTextMuted,
) {
    Text(
        text = text.uppercase(Locale.US),
        color = color,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        modifier = modifier,
    )
}

// ─── Stat tiles ─────────────────────────────────────────────────────────────

/** One headline metric: overline label, big number, optional delta chip. */
@Composable
fun StatTile(
    tile: MetricTile,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    InsightsCard(modifier = modifier.semantics(mergeDescendants = true) {}, padding = 12.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            InsightsOverline(tile.label)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    tile.value,
                    color = PantopusColors.appText,
                    fontSize = 23.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                tile.delta?.let { DeltaChip(it) }
            }
            tile.caption?.let {
                Text(it, color = PantopusColors.appTextMuted, fontSize = 10.sp)
            }
        }
    }
}

/** Up/down trend chip. */
@Composable
fun DeltaChip(delta: Int) {
    val up = delta >= 0
    val fg = if (up) PantopusColors.success else PantopusColors.error
    Row(
        modifier =
            Modifier
                .height(17.dp)
                .clip(CircleShape)
                .background(if (up) PantopusColors.successBg else PantopusColors.errorBg)
                .padding(horizontal = 5.dp)
                .clearAndSetSemantics {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        PantopusIconImage(
            if (up) PantopusIcon.TrendingUp else PantopusIcon.TrendingDown,
            contentDescription = null,
            size = 10.dp,
            strokeWidth = 2.4f,
            tint = fg,
        )
        Text(InsightsFormat.signedPercent(delta) ?: "", color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

// ─── Ranked rows ────────────────────────────────────────────────────────────

/** A horizontal proportion bar (0…1) on a sunken track. */
@Composable
fun ProportionBar(
    value: Double,
    accent: Color,
    modifier: Modifier = Modifier,
    height: Dp = 6.dp,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(height)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .clearAndSetSemantics {},
    ) {
        val fraction = value.coerceIn(0.0, 1.0).toFloat()
        if (fraction > 0f) {
            Box(
                modifier =
                    Modifier.fillMaxWidth(fraction).fillMaxHeight().clip(CircleShape).background(accent.copy(alpha = BAR_FILL_ALPHA)),
            )
        }
    }
}

/** A ranked "top event types" row. */
@Composable
fun RankedRowItem(
    row: RankedRow,
    accent: Color,
    modifier: Modifier = Modifier,
    onTap: (() -> Unit)? = null,
) {
    val countLabel = if (row.count == 1) "booking" else "bookings"
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(if (onTap != null) Modifier.clickable(onClick = onTap) else Modifier)
                .heightIn(min = 44.dp)
                .padding(vertical = 9.dp)
                .semantics(mergeDescendants = true) {
                    contentDescription = "Number ${row.rank}, ${row.title}, ${row.count} $countLabel"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Text(
            "${row.rank}",
            color = PantopusColors.appTextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(16.dp),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                row.title,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            ProportionBar(value = row.proportion, accent = accent)
        }
        Text("${row.count}", color = PantopusColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        if (onTap != null) {
            PantopusIconImage(PantopusIcon.ChevronRight, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

// ─── Charts ─────────────────────────────────────────────────────────────────

/** A compact bar chart for "bookings over time". */
@Composable
fun MiniBarChart(
    bars: List<DayBar>,
    accent: Color,
    modifier: Modifier = Modifier,
    height: Dp = 84.dp,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(height)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken.copy(alpha = GHOST_FILL_ALPHA))
                    .padding(horizontal = 2.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            bars.forEach { bar ->
                val barAlpha = if (bar.value == 0) ICON_TINT_ALPHA else BAR_FILL_ALPHA
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(maxOf(3.dp, height * bar.proportion.toFloat()))
                            .clip(RoundedCornerShape(3.dp))
                            .background(accent.copy(alpha = barAlpha))
                            .semantics { contentDescription = bar.accessibilityLabel },
                )
            }
        }
        Row(modifier = Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(bars.firstOrNull()?.dateLabel ?: "", color = PantopusColors.appTextMuted, fontSize = 9.5.sp)
            Text(bars.lastOrNull()?.dateLabel ?: "", color = PantopusColors.appTextMuted, fontSize = 9.5.sp)
        }
    }
}

/** A single stacked reliability bar (Honored / Late cancel / No-show) + legend. */
@Composable
fun StackedBreakdownBar(
    segments: List<BreakdownSegment>,
    modifier: Modifier = Modifier,
) {
    val spoken = segments.joinToString(", ") { "${it.label}: ${it.count}" }
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .semantics { contentDescription = spoken },
        ) {
            segments.filter { it.fraction > 0 }.forEach { segment ->
                Box(modifier = Modifier.fillMaxHeight().weight(segment.fraction.toFloat()).background(segmentColor(segment.kind)))
            }
        }
        Row(modifier = Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            segments.forEach { segment ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(segmentColor(segment.kind)))
                    Text(
                        "${segment.label} ${segment.count}",
                        color = PantopusColors.appTextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}

private fun segmentColor(kind: BreakdownSegment.Kind): Color =
    when (kind) {
        BreakdownSegment.Kind.Honored -> PantopusColors.success
        BreakdownSegment.Kind.LateCancel -> PantopusColors.warning
        BreakdownSegment.Kind.NoShow -> PantopusColors.error
    }

/** One funnel step (Per-event-type): label, a proportional bar, count + percent. */
@Composable
fun FunnelStepRow(
    label: String,
    count: Int,
    proportion: Double,
    percent: String?,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val trailing = "$count${percent?.let { " · $it" } ?: ""}"
    Column(
        modifier =
            modifier.fillMaxWidth().semantics(mergeDescendants = true) {
                contentDescription = "$label: $count${percent?.let { ", $it" } ?: ""}"
            },
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = PantopusColors.appText, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text(trailing, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
        }
        Box(
            modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(Radii.xs)).background(PantopusColors.appSurfaceSunken),
        ) {
            val fraction = proportion.coerceIn(0.0, 1.0).toFloat()
            if (fraction > 0f) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth(fraction)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(Radii.xs))
                            .background(accent.copy(alpha = BAR_FILL_ALPHA)),
                )
            }
        }
    }
}

// ─── Skeleton + error ───────────────────────────────────────────────────────

enum class InsightsSkeletonKind { Dashboard, Detail, ReportList }

/** Reusable loading scaffold — shimmer tiles + ghost chart. Never a spinner. */
@Composable
fun InsightsSkeleton(
    kind: InsightsSkeletonKind,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s4)
                .semantics { contentDescription = "Loading insights" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        when (kind) {
            InsightsSkeletonKind.Dashboard -> {
                repeat(2) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                        Box(modifier = Modifier.weight(1f)) { GhostBlock(72.dp) }
                        Box(modifier = Modifier.weight(1f)) { GhostBlock(72.dp) }
                    }
                }
                GhostBlock(140.dp)
                GhostBlock(160.dp)
            }
            InsightsSkeletonKind.Detail -> {
                GhostBlock(88.dp)
                GhostBlock(150.dp)
                GhostBlock(120.dp)
            }
            InsightsSkeletonKind.ReportList -> {
                GhostBlock(96.dp)
                repeat(4) { GhostBlock(60.dp, radius = Radii.lg) }
            }
        }
    }
}

@Composable
private fun GhostBlock(
    height: Dp,
    modifier: Modifier = Modifier,
    radius: Dp = Radii.xl,
) {
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        Shimmer(width = maxWidth, height = height, cornerRadius = radius)
    }
}

/** Shared retry view for a failed insights load. */
@Composable
fun InsightsErrorView(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().background(PantopusColors.appBg).padding(horizontal = Spacing.s8),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                PantopusIcon.CloudOff,
                contentDescription = null,
                size = 28.dp,
                strokeWidth = 1.8f,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Spacer(Modifier.height(Spacing.s4))
        Text("Couldn't load insights", color = PantopusColors.appText, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(Spacing.s2))
        Text(
            message,
            color = PantopusColors.appTextSecondary,
            fontSize = 13.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 260.dp),
        )
        Spacer(Modifier.height(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .border(BorderStroke(1.dp, PantopusColors.appBorder), CircleShape)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(PantopusIcon.RefreshCw, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextStrong)
            Text("Try again", color = PantopusColors.appTextStrong, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** A tappable footer row-link (dashboard → no-show / team). */
@Composable
fun InsightsLinkRow(
    icon: PantopusIcon,
    title: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .heightIn(min = 44.dp)
                .padding(vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(accent.copy(alpha = ICON_TINT_ALPHA)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon, contentDescription = null, size = 16.dp, tint = accent)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            subtitle?.let {
                Text(it, color = PantopusColors.appTextSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        PantopusIconImage(PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** A 20dp radio control: filled ring when selected. */
@Composable
fun InsightsRadioDot(
    selected: Boolean,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.size(20.dp).clip(CircleShape).border(2.dp, if (selected) accent else PantopusColors.appBorder, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Box(modifier = Modifier.size(11.dp).clip(CircleShape).background(accent))
        }
    }
}

/** A thin full-width divider hairline used to split stacked rows inside cards. */
@Composable
fun InsightsHairline(
    modifier: Modifier = Modifier,
    startInset: Dp = 0.dp,
) {
    Box(modifier = modifier.fillMaxWidth().padding(start = startInset).height(1.dp).background(PantopusColors.appBorder))
}
