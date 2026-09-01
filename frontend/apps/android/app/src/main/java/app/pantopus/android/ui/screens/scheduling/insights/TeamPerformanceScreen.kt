@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import kotlin.math.max

/**
 * H12 Team Performance (A17, Business violet). A round-robin balance indicator +
 * an avatar-first member list comparing booking load and reliability. Handles
 * business-only, permission-gated, single-member, empty, loading, and error.
 * The violet pillar is never reassigned; metrics are always announced with text.
 */
@Composable
fun TeamPerformanceScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: TeamPerformanceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val sort by viewModel.sort.collectAsStateWithLifecycle()
    val memberOptions by viewModel.memberOptions.collectAsStateWithLifecycle()
    var showFilter by remember { mutableStateOf(false) }
    val accent = viewModel.pillar.accent

    LaunchedEffect(Unit) { viewModel.start() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.insights.team")) {
        InsightsTopBar(title = "Team performance", onBack = onBack) {
            if (state is TeamUiState.Loaded) {
                InsightsSortChip(label = sort.title, accent = accent, onClick = viewModel::toggleSort)
            }
        }
        when (val current = state) {
            is TeamUiState.Loading -> InsightsSkeleton(InsightsSkeletonKind.ReportList)
            is TeamUiState.Loaded ->
                LoadedBody(
                    data = current.data,
                    filter = filter,
                    accent = accent,
                    onOpenFilter = { showFilter = true },
                )
            is TeamUiState.Empty ->
                CenteredNote(
                    icon = PantopusIcon.Users,
                    title = "Not enough team data",
                    subtitle = "Team insights appear once more than one member takes bookings.",
                    accent = accent,
                    tint = viewModel.pillar.accentBg,
                )
            is TeamUiState.BusinessOnly ->
                CenteredNote(
                    icon = PantopusIcon.Users,
                    title = "Business pages only",
                    subtitle = "Team performance compares members on a business round-robin engine.",
                    accent = accent,
                    tint = viewModel.pillar.accentBg,
                )
            is TeamUiState.PermissionGated ->
                CenteredNote(
                    icon = PantopusIcon.Lock,
                    title = "Owners and admins only",
                    subtitle = "Only owners and admins can view team performance.",
                    accent = accent,
                    tint = viewModel.pillar.accentBg,
                )
            is TeamUiState.Error -> InsightsErrorView(message = current.message, onRetry = viewModel::refresh)
        }
    }

    if (showFilter) {
        InsightsFilterSheet(
            initial = filter,
            eventTypeOptions = emptyList(),
            memberOptions = memberOptions,
            accent = accent,
            onApply = viewModel::apply,
            onDismiss = { showFilter = false },
        )
    }
}

@Composable
private fun LoadedBody(
    data: TeamData,
    filter: InsightsFilter,
    accent: Color,
    onOpenFilter: () -> Unit,
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
        Row(modifier = Modifier.fillMaxWidth()) {
            InsightsPeriodChip(label = filter.chipLabel(), accent = accent, badge = filter.activeFilterCount, onClick = onOpenFilter)
        }

        if (data.isSingleMember) SingleMemberNote(accent) else BalanceCard(data, accent)

        // Members
        InsightsCard {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                InsightsOverline("Members")
                Column {
                    data.rows.forEachIndexed { index, row ->
                        MemberRow(row, accent)
                        if (index < data.rows.lastIndex) InsightsHairline()
                    }
                }
            }
        }

        Spacer(Modifier.height(Spacing.s6))
    }
}

@Composable
private fun BalanceCard(
    data: TeamData,
    accent: Color,
) {
    InsightsCard {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                InsightsOverline("Round-robin balance", modifier = Modifier.weight(1f))
                PantopusIconImage(PantopusIcon.Gauge, contentDescription = null, size = 14.dp, tint = accent)
            }
            TeamBalanceBar(rows = data.rows, accent = accent)
            Text(
                data.balanceLabel,
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun SingleMemberNote(accent: Color) {
    InsightsCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(
                modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(accent.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.User, contentDescription = null, size = 16.dp, tint = accent)
            }
            Text(
                "Only one member takes bookings right now.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun MemberRow(
    row: HostRow,
    accent: Color,
) {
    val plural = if (row.bookings == 1) "" else "s"
    val strip = "${row.bookings} booking$plural · ${row.completed} completed · ${InsightsFormat.percent(row.noShowRate)} no-show"
    val sharePct = (row.share * 100).toInt()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp)
                .semantics(mergeDescendants = true) { contentDescription = "${row.name}, $strip, $sharePct percent of bookings" },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(accent.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(row.initials, color = accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    row.name,
                    color = PantopusColors.appText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(strip, color = PantopusColors.appTextSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        ProportionBar(value = row.share, accent = accent)
    }
}

/** The round-robin distribution bar — one accent-tinted segment per member. */
@Composable
private fun TeamBalanceBar(
    rows: List<HostRow>,
    accent: Color,
) {
    Row(
        modifier = Modifier.fillMaxWidth().height(16.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        rows.filter { it.share > 0 }.forEachIndexed { index, row ->
            val alpha = max(0.3, 0.9 - 0.14 * index).toFloat()
            Box(
                modifier =
                    Modifier
                        .fillMaxHeight()
                        .weight(row.share.toFloat())
                        .clip(RoundedCornerShape(3.dp))
                        .background(accent.copy(alpha = alpha)),
            )
        }
    }
}

@Composable
private fun CenteredNote(
    icon: PantopusIcon,
    title: String,
    subtitle: String,
    accent: Color,
    tint: Color,
) {
    Column(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).padding(horizontal = Spacing.s6),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(modifier = Modifier.size(72.dp).clip(CircleShape).background(tint), contentAlignment = Alignment.Center) {
            PantopusIconImage(icon, contentDescription = null, size = 30.dp, tint = accent)
        }
        Spacer(Modifier.height(Spacing.s4))
        Text(title, color = PantopusColors.appText, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.s2))
        Text(subtitle, color = PantopusColors.appTextSecondary, fontSize = 13.5.sp, textAlign = TextAlign.Center)
    }
}
