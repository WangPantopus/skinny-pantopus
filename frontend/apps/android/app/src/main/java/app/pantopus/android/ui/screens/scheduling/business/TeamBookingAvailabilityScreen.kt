@file:Suppress("PackageNaming", "UNUSED_PARAMETER", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val ROW_ICON = 36.dp

@Composable
fun TeamBookingAvailabilityScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: TeamBookingAvailabilityViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showAssign by remember { mutableStateOf(false) }
    var roundRobinFor by remember { mutableStateOf<String?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) { viewModel.load() }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            val content = state as? TeamBookingAvailabilityViewModel.UiState.Content
            BizTopBar(
                title = "Booking availability",
                onBack = onBack,
                trailing = {
                    if (content != null && !content.gated && content.assignable.isNotEmpty()) {
                        Box(
                            modifier =
                                Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).clickable { showAssign = true }
                                    .testTag("team.assignAction"),
                            contentAlignment = Alignment.Center,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.UsersRound,
                                contentDescription = "Assign a service",
                                size = 20.dp,
                                tint = bizAccent,
                            )
                        }
                    }
                },
            )
            when (val s = state) {
                TeamBookingAvailabilityViewModel.UiState.Loading ->
                    TeamAvailSkeleton(modifier = Modifier.fillMaxWidth())
                TeamBookingAvailabilityViewModel.UiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.UsersRound,
                        headline = "No team members yet",
                        subcopy = "Add members to your business to manage their booking availability.",
                        modifier = Modifier.fillMaxSize(),
                        tint = PantopusColors.businessBg,
                        accent = bizAccent,
                    )
                TeamBookingAvailabilityViewModel.UiState.BusinessOnly ->
                    EmptyState(
                        icon = PantopusIcon.Building2,
                        headline = "For business accounts",
                        subcopy = "Switch to a business profile to manage team booking availability.",
                        modifier = Modifier.fillMaxSize(),
                    )
                is TeamBookingAvailabilityViewModel.UiState.Error ->
                    ErrorState(message = s.message, modifier = Modifier.fillMaxSize(), onRetry = viewModel::refresh)
                is TeamBookingAvailabilityViewModel.UiState.Content ->
                    TeamContent(data = s, onOpenMember = { onNavigate(SchedulingRoutes.memberWorkingHours(it)) })
            }
        }
    }

    if (showAssign) {
        AssignmentPickerSheet(
            services = (state as? TeamBookingAvailabilityViewModel.UiState.Content)?.assignable.orEmpty(),
            onPick = { pick ->
                showAssign = false
                if (pick.collective) {
                    onNavigate(SchedulingRoutes.collectiveEventSetup(pick.id))
                } else {
                    roundRobinFor = pick.id
                }
            },
            onDismiss = { showAssign = false },
        )
    }

    roundRobinFor?.let { eventTypeId ->
        RoundRobinSheet(
            eventTypeId = eventTypeId,
            onDismiss = { roundRobinFor = null },
            onSaved = {
                roundRobinFor = null
                viewModel.refresh()
            },
        )
    }
}

@Composable
private fun TeamContent(
    data: TeamBookingAvailabilityViewModel.UiState.Content,
    onOpenMember: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        BizNote(
            text = "Bookings use each member's personal availability. Edit a member's hours to change when they can be booked.",
            tone = BizNoteTone.Info,
            icon = PantopusIcon.Info,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            BizOverline("Team")
            BizCard {
                data.rows.forEachIndexed { index, row ->
                    MemberRow(
                        row = row,
                        gated = data.gated,
                        showDivider = index != data.rows.lastIndex,
                        onClick = { onOpenMember(row.id) },
                    )
                }
            }
        }
        data.coverage?.let { CoverageCard(it) }
        if (data.gated) {
            BizLockNote("Only admins can change booking hours (team.manage).")
        }
    }
}

@Composable
private fun MemberRow(
    row: TeamBookingAvailabilityViewModel.MemberRowUi,
    gated: Boolean,
    showDivider: Boolean,
    onClick: () -> Unit,
) {
    Column(modifier = Modifier.clickable(onClick = onClick).testTag("team.member.${row.id}")) {
        Row(
            modifier = Modifier.fillMaxWidth().alpha(if (row.bookable) 1f else 0.55f).padding(vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            MemberAvatar(name = row.name, seed = row.id, size = ROW_ICON, dim = !row.bookable)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = row.name,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = row.summary,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (row.usesPersonalHours) {
                    BizChip(text = "Personal hours", tone = BizChipTone.Biz, icon = PantopusIcon.User)
                } else {
                    BizChip(text = "Business hours", tone = BizChipTone.Neutral, icon = PantopusIcon.Building2)
                }
            }
            if (!gated) {
                BizToggle(on = row.bookable, onToggle = { onClick() })
            }
            BizChevron()
        }
        if (showDivider) BizRowDivider()
    }
}

@Composable
private fun CoverageCard(coverage: TeamBookingAvailabilityViewModel.CoverageUi) {
    if (coverage.warning) {
        BizNote(text = coverage.text, tone = BizNoteTone.Warning, icon = PantopusIcon.CalendarX)
        return
    }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarX,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = coverage.text,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
        )
    }
}

/**
 * Loading skeleton mirroring `teamavail-frames.jsx` Frame 2 ShimRow geometry:
 * 36dp avatar circle + two text-line shimmers + 84×16 chip-pill shimmer + 46×28
 * toggle shimmer — four elements per row, 4 rows inside a BizCard.
 */
@Composable
private fun TeamAvailSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // Explainer note shimmer
        Shimmer(width = 260.dp, height = 12.dp, cornerRadius = Radii.xs)
        BizCard {
            repeat(4) { i ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    // Avatar circle
                    Shimmer(width = ROW_ICON, height = ROW_ICON, cornerRadius = ROW_ICON / 2)
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        // Name line
                        Shimmer(width = 120.dp, height = 11.dp, cornerRadius = Radii.xs)
                        // Summary line
                        Shimmer(width = 100.dp, height = 10.dp, cornerRadius = Radii.xs)
                        // Chip shimmer (84×16, pill radius — mirrors teamavail-frames.jsx:81-88)
                        Shimmer(width = 84.dp, height = 16.dp, cornerRadius = 9999.dp)
                    }
                    // Toggle pill shimmer (46×28)
                    Shimmer(width = 46.dp, height = 28.dp, cornerRadius = 9999.dp)
                }
                if (i != 3) BizRowDivider()
            }
        }
    }
}

@Composable
private fun AssignmentPickerSheet(
    services: List<TeamBookingAvailabilityViewModel.EventTypePick>,
    onPick: (TeamBookingAvailabilityViewModel.EventTypePick) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("team.assignSheet"),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2)) {
            Text(
                text = "Assign bookings",
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
            Text(
                text = "Pick a service to choose who takes its bookings.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = Spacing.s1, bottom = Spacing.s2),
            )
            services.forEach { service ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { onPick(service) }
                            .padding(vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Box(
                        modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(bizAccentBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = if (service.collective) PantopusIcon.UsersRound else PantopusIcon.ArrowsRepeat,
                            contentDescription = null,
                            size = 16.dp,
                            tint = bizAccent,
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = service.name,
                            style = PantopusTextStyle.small,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = if (service.collective) "Collective booking" else "Round-robin rotation",
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    BizChevron()
                }
            }
            Spacer(Modifier.height(Spacing.s4))
        }
    }
}
