@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
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
 * H9 Insights Dashboard (A17). A single scroll of read-only cards: 2×2 headline
 * tiles, a bookings-over-time chart, a ranked top-event-types list, and footer
 * links into the no-show report and team performance. Loading / empty / loaded /
 * error states, wrapped in the offline banner.
 */
@Composable
fun InsightsDashboardScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: InsightsDashboardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    var showFilter by remember { mutableStateOf(false) }
    val accent = viewModel.pillar.accent

    LaunchedEffect(Unit) { viewModel.start() }

    val loaded = state as? InsightsDashboardUiState.Loaded

    Column(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.insights.dashboard"),
    ) {
        InsightsTopBar(title = "Insights", onBack = onBack) {
            InsightsPeriodChip(
                label = filter.chipLabel(),
                accent = accent,
                badge = filter.activeFilterCount,
                onClick = { showFilter = true },
            )
        }
        when (val current = state) {
            is InsightsDashboardUiState.Loading -> InsightsSkeleton(InsightsSkeletonKind.Dashboard)
            is InsightsDashboardUiState.Empty ->
                EmptyState(
                    icon = PantopusIcon.BarChart3,
                    headline = "Not enough data yet",
                    subcopy = "Insights appear once you have a few bookings. Share your link to get started.",
                    ctaTitle = "Share your booking link",
                    onCta = { onNavigate(viewModel.bookingPageRoute()) },
                    tint = viewModel.pillar.accentBg,
                    accent = accent,
                )
            is InsightsDashboardUiState.Loaded ->
                DashboardBody(
                    data = current.data,
                    accent = accent,
                    onOpenType = { onNavigate(viewModel.openTypeRoute(it)) },
                    onOpenNoShow = { onNavigate(viewModel.openNoShowRoute()) },
                    onOpenTeam = { onNavigate(viewModel.openTeamRoute()) },
                )
            is InsightsDashboardUiState.Error ->
                InsightsErrorView(message = current.message, onRetry = viewModel::refresh)
        }
    }

    if (showFilter) {
        InsightsFilterSheet(
            initial = filter,
            eventTypeOptions = loaded?.data?.eventTypeOptions.orEmpty(),
            memberOptions = emptyList(),
            accent = accent,
            onApply = viewModel::apply,
            onDismiss = { showFilter = false },
        )
    }
}

@Composable
private fun DashboardBody(
    data: DashboardData,
    accent: Color,
    onOpenType: (String) -> Unit,
    onOpenNoShow: () -> Unit,
    onOpenTeam: () -> Unit,
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
        // 2×2 headline tiles
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
                Text("Last 30 days", color = PantopusColors.appTextMuted, fontSize = 10.sp)
            }
        }

        // Top event types
        if (data.topTypes.isNotEmpty()) {
            InsightsCard {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    InsightsOverline("Top event types")
                    Column {
                        data.topTypes.forEachIndexed { index, row ->
                            RankedRowItem(row = row, accent = accent, onTap = { onOpenType(row.id) })
                            if (index < data.topTypes.lastIndex) InsightsHairline()
                        }
                    }
                }
            }
        }

        // Footer links
        InsightsCard(padding = 4.dp) {
            Column {
                InsightsLinkRow(
                    icon = PantopusIcon.Shield,
                    title = "No-show & cancellation report",
                    subtitle = data.noShowLinkSubtitle,
                    accent = accent,
                    onClick = onOpenNoShow,
                )
                if (data.isBusiness) {
                    InsightsHairline(startInset = 43.dp)
                    InsightsLinkRow(
                        icon = PantopusIcon.Users,
                        title = "Team performance",
                        subtitle = "Round-robin balance",
                        accent = accent,
                        onClick = onOpenTeam,
                    )
                }
            }
        }

        Spacer(Modifier.height(Spacing.s6))
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
