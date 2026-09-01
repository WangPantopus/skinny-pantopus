@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * H11 No-Show & Cancellation Report (A17). Headline rate, a stacked reliability
 * breakdown, the recent-no-shows list, and a policy callout — plus a
 * celebratory zero-no-show state. Outcome chips use semantic colors (never the
 * pillar), and every metric is announced with a text label.
 */
@Composable
fun NoShowReportScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: NoShowReportViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    var showFilter by remember { mutableStateOf(false) }
    val accent = viewModel.pillar.accent

    LaunchedEffect(Unit) { viewModel.start() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.insights.noShow")) {
        InsightsTopBar(title = "No-shows & cancellations", onBack = onBack) {
            InsightsPeriodChip(label = filter.chipLabel(), accent = accent, onClick = { showFilter = true })
        }
        when (val current = state) {
            is NoShowReportUiState.Loading -> InsightsSkeleton(InsightsSkeletonKind.ReportList)
            is NoShowReportUiState.Celebratory -> CelebratoryBody(windowDays = current.windowDays)
            is NoShowReportUiState.Loaded ->
                LoadedBody(data = current.data, accent = accent, onSetPolicy = { onNavigate(viewModel.policyRoute()) })
            is NoShowReportUiState.Error -> InsightsErrorView(message = current.message, onRetry = viewModel::refresh)
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
private fun LoadedBody(
    data: NoShowData,
    accent: Color,
    onSetPolicy: () -> Unit,
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
        // Headline rate
        InsightsCard {
            Column(
                modifier =
                    Modifier.semantics(mergeDescendants = true) {
                        contentDescription = "No-show rate ${data.noShowRateLabel}, ${data.subLabel}"
                    },
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                InsightsOverline("No-show rate")
                Text(data.noShowRateLabel, color = PantopusColors.appText, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Text(data.subLabel, color = PantopusColors.appTextSecondary, fontSize = 12.sp)
            }
        }

        // Breakdown
        InsightsCard {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                InsightsOverline("Breakdown")
                StackedBreakdownBar(segments = data.segments)
            }
        }

        // Recent no-shows
        if (data.recentRows.isNotEmpty()) {
            InsightsCard {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    InsightsOverline("Recent no-shows")
                    Column {
                        data.recentRows.forEachIndexed { index, row ->
                            RecentRow(row)
                            if (index < data.recentRows.lastIndex) InsightsHairline()
                        }
                    }
                }
            }
        }

        // Policy callout
        InsightsCard {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                Box(
                    modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(accent.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Shield, contentDescription = null, size = 16.dp, tint = accent)
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Reduce no-shows", color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Require a deposit or a cancellation window for this event type.",
                        color = PantopusColors.appTextSecondary,
                        fontSize = 11.5.sp,
                    )
                    Text(
                        "Set a policy",
                        color = accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier =
                            Modifier
                                .padding(top = 2.dp)
                                .clip(RoundedCornerShape(Radii.sm))
                                .clickable(onClick = onSetPolicy)
                                .testTag("scheduling.insights.setPolicy"),
                    )
                }
            }
        }

        Spacer(Modifier.height(Spacing.s6))
    }
}

@Composable
private fun RecentRow(row: RecentNoShowRow) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .padding(vertical = 9.dp)
                .semantics(mergeDescendants = true) {
                    contentDescription = "${row.name}, ${row.detail}, no-show${if (row.isRepeat) ", repeat" else ""}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                InsightsMath.initials(row.name),
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    row.name,
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (row.isRepeat) {
                    PantopusIconImage(PantopusIcon.Flag, contentDescription = "Repeat no-show", size = 12.dp, tint = PantopusColors.warning)
                }
            }
            Text(row.detail, color = PantopusColors.appTextSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        OutcomeChip()
    }
}

@Composable
private fun OutcomeChip() {
    Box(
        modifier = Modifier.heightIn(min = 21.dp).clip(CircleShape).background(PantopusColors.errorBg).padding(horizontal = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text("No-show", color = PantopusColors.error, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun CelebratoryBody(windowDays: Int) {
    Column(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).padding(horizontal = Spacing.s6),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.PartyPopper, contentDescription = null, size = 32.dp, tint = PantopusColors.success)
        }
        Spacer(Modifier.height(Spacing.s4))
        Text(
            "No no-shows. Nice.",
            color = PantopusColors.appText,
            fontSize = 19.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.s2))
        Text(
            "Everyone who booked in the last $windowDays days showed up.",
            color = PantopusColors.appTextSecondary,
            fontSize = 13.5.sp,
            textAlign = TextAlign.Center,
        )
    }
}
