@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.home

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaItem
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaRowCard
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaSection
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaSkeletonRow
import app.pantopus.android.ui.screens.homes.calendar.MonthStripHeader
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * F15 — Permission-Gated Scheduler View. A read-only render mode of the Home
 * agenda for a member lacking calendar.edit. The member can browse, accept or
 * decline their own assignments, and request scheduling access. Mirrors iOS
 * `PermissionGatedSchedulerScreen`.
 */
@Composable
fun PermissionGatedSchedulerScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
) {
    val viewModel: PermissionGatedSchedulerViewModel = hiltViewModel()
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .testTag("gatedScheduler"),
    ) {
        when (val current = state) {
            is GatedSchedulerUiState.Loading -> {
                TopBar(showAction = true, requested = false, onRequestAccess = {})
                HintBar()
                Column(
                    modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    repeat(5) { HomeAgendaSkeletonRow() }
                }
            }
            is GatedSchedulerUiState.NoAccess ->
                EmptyState(
                    icon = PantopusIcon.ShieldAlert,
                    headline = "No access to this schedule",
                    subcopy =
                        "You don't have permission to view this household's calendar. " +
                            "Ask an admin to give you access.",
                    ctaTitle = "Ask to manage",
                    onCta = { viewModel.requestAccess() },
                    tint = PantopusColors.homeBg,
                    accent = PantopusColors.home,
                )
            is GatedSchedulerUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.CloudOff,
                    headline = "Couldn't load the schedule",
                    subcopy = current.message,
                    ctaTitle = "Try again",
                    onCta = { viewModel.load() },
                )
            is GatedSchedulerUiState.Loaded ->
                LoadedBody(
                    data = current.data,
                    onRequestAccess = viewModel::requestAccess,
                    onPrevWeek = { viewModel.shiftWeek(PermissionGatedSchedulerViewModel.WeekShift.Previous) },
                    onNextWeek = { viewModel.shiftWeek(PermissionGatedSchedulerViewModel.WeekShift.Next) },
                    onAccept = viewModel::accept,
                    onDecline = viewModel::decline,
                )
        }
    }
}

@Composable
private fun LoadedBody(
    data: LoadedData,
    onRequestAccess: () -> Unit,
    onPrevWeek: () -> Unit,
    onNextWeek: () -> Unit,
    onAccept: (HomeAgendaItem) -> Unit,
    onDecline: (HomeAgendaItem) -> Unit,
) {
    TopBar(showAction = true, requested = data.requested, onRequestAccess = onRequestAccess)

    if (data.requested) {
        RequestSentBanner()
    } else {
        HintBar()
    }

    if (data.assignments.isEmpty() && data.monthStrip != null) {
        MonthStripHeader(
            state = data.monthStrip,
            onSelectDay = {},
            onPrevMonth = onPrevWeek,
            onNextMonth = onNextWeek,
        )
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (data.assignments.isNotEmpty()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.UserCheck,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.personal,
                )
                Text(
                    text = "MY ASSIGNMENTS · ${data.assignments.size}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                    color = PantopusColors.personal,
                )
            }
            data.assignments.forEach { item ->
                AssignmentRow(
                    item = item,
                    isActioning = data.actioningId == item.id,
                    onAccept = { onAccept(item) },
                    onDecline = { onDecline(item) },
                )
            }
            Spacer(Modifier.height(Spacing.s2))
        }

        data.agendaSections.forEach { section ->
            AgendaSection(section)
        }
    }
}

@Composable
private fun AgendaSection(section: HomeAgendaSection) {
    Text(
        text = section.header,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(start = Spacing.s1, top = Spacing.s1),
    )
    section.items.forEach { item ->
        HomeAgendaRowCard(item = item, enabled = false)
    }
}

@Composable
private fun TopBar(
    showAction: Boolean,
    requested: Boolean,
    onRequestAccess: () -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .heightIn(min = 46.dp)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Calendar",
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            if (showAction) {
                if (requested) {
                    RequestSentPill()
                } else {
                    AskToManagePill(onClick = onRequestAccess)
                }
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder)
    }
}

@Composable
private fun AskToManagePill(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .border(1.dp, PantopusColors.home.copy(alpha = 0.25f), RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 5.dp)
                .testTag("gatedScheduler_askToManage"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldPlus,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.homeDark,
        )
        Text(
            text = "Ask to manage",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.homeDark,
        )
    }
}

@Composable
private fun RequestSentPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 10.dp, vertical = 5.dp)
                .testTag("gatedScheduler_requestSent"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "Request sent",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun HintBar() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.infoBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Eye,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.info,
        )
        Text(
            text = "You can view the schedule. Ask an admin to make changes.",
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.primary800,
        )
    }
    HorizontalDivider(color = PantopusColors.infoLight)
}

@Composable
private fun RequestSentBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .padding(top = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.info,
        )
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text = "Request sent",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.info,
            )
            Text(
                text =
                    "We asked an admin to give you scheduling access. " +
                        "You'll be notified when they respond.",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun AssignmentRow(
    item: HomeAgendaItem,
    isActioning: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(1.5.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(
                modifier = Modifier.size(width = 42.dp, height = 36.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = item.time,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                if (item.ampm.isNotEmpty()) {
                    Text(
                        text = item.ampm,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .size(width = 1.dp, height = 36.dp)
                        .background(PantopusColors.infoLight),
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = item.title,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    YourSlotPill()
                    item.location?.let { loc ->
                        Text(
                            text = loc,
                            fontSize = 10.5.sp,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().alpha(if (isActioning) 0.5f else 1f),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            ActionButton(
                modifier = Modifier.weight(1f).testTag("gatedScheduler_accept_${item.id}"),
                icon = PantopusIcon.Check,
                label = "Accept",
                background = PantopusColors.home,
                foreground = PantopusColors.appTextInverse,
                bordered = false,
                enabled = !isActioning,
                onClick = onAccept,
            )
            ActionButton(
                modifier = Modifier.weight(1f).testTag("gatedScheduler_decline_${item.id}"),
                icon = PantopusIcon.X,
                label = "Decline",
                background = PantopusColors.appSurface,
                foreground = PantopusColors.appTextStrong,
                bordered = true,
                enabled = !isActioning,
                onClick = onDecline,
            )
        }
    }
}

@Composable
private fun YourSlotPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.personalBg)
                .padding(horizontal = 7.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UserCheck,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.personal,
        )
        Text(
            text = "Your slot",
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.personal,
        )
    }
}

@Composable
private fun ActionButton(
    icon: PantopusIcon,
    label: String,
    background: androidx.compose.ui.graphics.Color,
    foreground: androidx.compose.ui.graphics.Color,
    bordered: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 34.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .then(
                    if (bordered) {
                        Modifier.border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.md))
                    } else {
                        Modifier
                    },
                )
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = foreground,
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
        )
    }
}
