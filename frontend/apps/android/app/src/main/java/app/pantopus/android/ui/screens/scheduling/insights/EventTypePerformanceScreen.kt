@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * H10 Per-Event-Type Performance (A17). A header card (name / duration / price),
 * a Booked → Completed → No-show funnel, a 2×2 stat grid, a bookings-over-time
 * chart, and an "edit event type" footer. An in-screen chip row switches between
 * event types (the route is arg-less). Empty when the type was never booked.
 */
@Composable
fun EventTypePerformanceScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: EventTypePerformanceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val typeOptions by viewModel.typeOptions.collectAsStateWithLifecycle()
    val selectedId by viewModel.selectedId.collectAsStateWithLifecycle()
    var showFilter by remember { mutableStateOf(false) }
    val accent = viewModel.pillar.accent

    LaunchedEffect(Unit) { viewModel.start() }

    val title = typeOptions.firstOrNull { it.id == selectedId }?.name ?: "Performance"

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.insights.eventType")) {
        InsightsTopBar(title = title, onBack = onBack) {
            InsightsPeriodChip(label = filter.chipLabel(), accent = accent, onClick = { showFilter = true })
        }
        if (typeOptions.size > 1) {
            TypeSelectorRow(options = typeOptions, selectedId = selectedId, accent = accent, onSelect = viewModel::selectType)
        }
        when (val current = state) {
            is PerfUiState.Loading -> InsightsSkeleton(InsightsSkeletonKind.Detail)
            is PerfUiState.NoTypes ->
                EmptyState(
                    icon = PantopusIcon.Calendar,
                    headline = "No event types yet",
                    subcopy = "Create an event type and its performance shows up here once people book it.",
                    ctaTitle = "Open booking page",
                    onCta = { onNavigate(viewModel.bookingPageRoute()) },
                    tint = viewModel.pillar.accentBg,
                    accent = accent,
                )
            is PerfUiState.EmptyType ->
                EmptyTypeBody(header = current.header, accent = accent, onShare = { onNavigate(viewModel.bookingPageRoute()) })
            is PerfUiState.Loaded ->
                LoadedBody(data = current.data, accent = accent, onEdit = { onNavigate(viewModel.editorRoute()) })
            is PerfUiState.Error -> InsightsErrorView(message = current.message, onRetry = viewModel::refresh)
        }
    }

    if (showFilter) {
        InsightsFilterSheet(
            initial = filter,
            eventTypeOptions = emptyList(),
            memberOptions = emptyList(),
            accent = accent,
            onApply = viewModel::apply,
            onDismiss = { showFilter = false },
        )
    }
}

@Composable
private fun TypeSelectorRow(
    options: List<InsightsFilterOption>,
    selectedId: String?,
    accent: Color,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        options.forEach { option ->
            val selected = option.id == selectedId
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 30.dp)
                        .clip(CircleShape)
                        .background(if (selected) accent.copy(alpha = 0.14f) else PantopusColors.appSurface)
                        .border(1.dp, if (selected) accent else PantopusColors.appBorder, CircleShape)
                        .clickable { onSelect(option.id) }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option.name,
                    color = if (selected) accent else PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun LoadedBody(
    data: PerfData,
    accent: Color,
    onEdit: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3)
                .padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        HeaderCard(data.header)

        // Funnel
        InsightsCard {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                InsightsOverline("Funnel")
                data.funnel.forEach { step ->
                    FunnelStepRow(
                        label = step.label,
                        count = step.count,
                        proportion = step.proportion,
                        percent = step.percent,
                        accent = accent,
                    )
                }
            }
        }

        // 2×2 stat grid
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                StatTile(tile = data.tiles[0], accent = accent, modifier = Modifier.weight(1f))
                StatTile(tile = data.tiles[1], accent = accent, modifier = Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                StatTile(tile = data.tiles[2], accent = accent, modifier = Modifier.weight(1f))
                StatTile(tile = data.tiles[3], accent = accent, modifier = Modifier.weight(1f))
            }
        }

        // Bookings over time
        InsightsCard {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                InsightsOverline("Bookings over time")
                if (data.hasTrend) {
                    MiniBarChart(bars = data.dayBars, accent = accent)
                } else {
                    TrendPlaceholder()
                }
            }
        }

        // Edit event type
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(onClick = onEdit)
                    .testTag("scheduling.insights.editEventType")
                    .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(Modifier.weight(1f))
            PantopusIconImage(PantopusIcon.Pencil, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextStrong)
            Text("Edit event type", color = PantopusColors.appTextStrong, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
        }

        Spacer(Modifier.height(Spacing.s6))
    }
}

@Composable
private fun HeaderCard(header: PerfHeader) {
    InsightsCard {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                header.name,
                color = PantopusColors.appText,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                if (header.durationLabel.isNotEmpty()) MetaItem(PantopusIcon.Clock, header.durationLabel)
                MetaItem(PantopusIcon.Tag, header.priceLabel)
            }
        }
    }
}

@Composable
private fun MetaItem(
    icon: PantopusIcon,
    text: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        PantopusIconImage(icon, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
        Text(text, color = PantopusColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun EmptyTypeBody(
    header: PerfHeader,
    accent: Color,
    onShare: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3)
                .padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        HeaderCard(header)
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s8),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Box(
                modifier = Modifier.size(72.dp).clip(CircleShape).background(accent.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.CalendarClock, contentDescription = null, size = 30.dp, tint = accent)
            }
            Text(
                "No bookings yet for this type",
                color = PantopusColors.appText,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Text(
                "Share this event type's link and its performance shows up here.",
                color = PantopusColors.appTextSecondary,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
            )
            Box(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(accent)
                        .clickable(onClick = onShare)
                        .padding(horizontal = Spacing.s5, vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Share booking link", color = PantopusColors.appTextInverse, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun TrendPlaceholder() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(64.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken.copy(alpha = 0.5f)),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(PantopusIcon.BarChart3, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
            Text("More data needed for trends", color = PantopusColors.appTextMuted, fontSize = 12.sp)
        }
    }
}
