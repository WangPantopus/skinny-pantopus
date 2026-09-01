@file:Suppress(
    "PackageNaming",
    "UNUSED_PARAMETER",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MagicNumber",
)
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val RESOURCE_DETAIL_TAG = "scheduling.resourceDetail"
const val RESOURCE_DETAIL_EDIT_TAG = "scheduling.resourceDetail.edit"

/** F11 Resource Detail / Booking Calendar. */
@Composable
fun ResourceDetailScreen(
    resourceId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: ResourceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }

    val loaded = state as? ResourceDetailUiState.Loaded
    val title = loaded?.resourceName?.takeIf { it.isNotBlank() } ?: "Resource"

    Scaffold(
        modifier = Modifier.fillMaxSize().testTag(RESOURCE_DETAIL_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = title,
                leading = SchedulingTopBarLeading.Back,
                onLeading = onBack,
                applyStatusBarInset = true,
                trailing = {
                    if (loaded != null) {
                        TextButton(
                            onClick = {
                                onNavigate(viewModel.editorRoute())
                            },
                            modifier = Modifier.testTag(RESOURCE_DETAIL_EDIT_TAG),
                        ) {
                            Text(
                                "Edit",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.home,
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (val s = state) {
                ResourceDetailUiState.Loading -> DetailSkeleton()
                is ResourceDetailUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load this resource",
                        message = s.message,
                        onRetry = viewModel::load,
                    )
                is ResourceDetailUiState.Loaded ->
                    DetailLoaded(
                        loaded = s,
                        onApprove = viewModel::approve,
                        onDecline = viewModel::decline,
                        onApprovalBadge = viewModel::openApprovalQueue,
                        onBookThis = {
                            onNavigate(viewModel.bookRoute())
                        },
                    )
            }
        }
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearActionError,
            confirmButton = { TextButton(onClick = viewModel::clearActionError) { Text("OK") } },
            title = { Text("Couldn't update") },
            text = { Text(message) },
        )
    }
}

@Composable
private fun DetailLoaded(
    loaded: ResourceDetailUiState.Loaded,
    onApprove: (String) -> Unit,
    onDecline: (String) -> Unit,
    onApprovalBadge: () -> Unit,
    onBookThis: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(
                        1f,
                    ).verticalScroll(rememberScrollState())
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            HeaderCard(loaded, onApprovalBadge)
            if (loaded.isFullyBooked) {
                FullyBookedBanner(loaded.fullyBookedThroughLabel, loaded.nextOpeningLabel)
            }
            if (loaded.approvals.isNotEmpty()) {
                ApprovalQueueCard(loaded.approvals, onApprove, onDecline)
            }
            ResourceOverlineLabel(text = loaded.bookingsLabel)
            if (loaded.sections.isEmpty()) {
                SectionCard {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Calendar,
                            contentDescription = null,
                            size = 16.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                        Text(
                            "No upcoming bookings yet.",
                            fontSize = 13.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            } else {
                loaded.sections.forEach { section ->
                    Text(
                        section.title,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    section.rows.forEach { BookingRow(it) }
                }
            }
        }
        StickyFooter {
            if (loaded.isFullyBooked) {
                HomePrimaryButton(
                    title = "Book next opening · ${loaded.nextOpeningLabel}",
                    icon = PantopusIcon.CalendarClock,
                    onClick = onBookThis,
                )
            } else {
                HomePrimaryButton(title = "Book this", icon = PantopusIcon.Plus, onClick = onBookThis)
            }
        }
    }
}

/** Amber "Fully booked through …" banner (F11 frame 3). */
@Composable
private fun FullyBookedBanner(
    throughLabel: String?,
    nextOpeningLabel: String?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarX,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.warning,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                throughLabel ?: "Fully booked",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.warmAmber,
            )
            nextOpeningLabel?.let {
                Text(
                    "Next opening is $it. You can still book that.",
                    fontSize = 11.sp,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
private fun HeaderCard(
    loaded: ResourceDetailUiState.Loaded,
    onApprovalBadge: () -> Unit,
) {
    SectionCard {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(
                            46.dp,
                        ).clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = loaded.kind.icon,
                    contentDescription = null,
                    size = 23.dp,
                    tint = PantopusColors.home,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    loaded.resourceName,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                TypeBadge(text = loaded.kind.label)
            }
        }
        if (loaded.ruleChips.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                loaded.ruleChips.forEach {
                    RuleChipView(
                        icon = it.icon,
                        text = it.text,
                        foreground = PantopusColors.homeDark,
                        background = PantopusColors.homeBg,
                    )
                }
            }
        }
        if (loaded.pendingApprovalCount > 0) {
            PendingApprovalBadge(count = loaded.pendingApprovalCount, onClick = onApprovalBadge)
        }
    }
}

@Composable
private fun ApprovalQueueCard(
    approvals: List<ResourceApproval>,
    onApprove: (String) -> Unit,
    onDecline: (String) -> Unit,
) {
    SectionCard(overline = "Approval queue · ${approvals.size}", overlineColor = PantopusColors.warmAmber) {
        approvals.forEachIndexed { index, approval ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    MemberOrInitials(approval.member, approval.who, size = 30.dp)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            approval.who,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.appText,
                        )
                        Text(
                            approval.whenText,
                            fontSize = 11.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    InlineHomeButton(title = "Approve", icon = PantopusIcon.Check, filled = true, onClick = {
                        onApprove(approval.id)
                    }, modifier = Modifier.weight(1f))
                    InlineHomeButton(title = "Decline", icon = PantopusIcon.X, filled = false, onClick = {
                        onDecline(approval.id)
                    }, modifier = Modifier.weight(1f))
                }
            }
            if (index < approvals.size - 1) {
                HorizontalDivider(
                    color = PantopusColors.appBorder,
                    modifier = Modifier.padding(vertical = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun BookingRow(row: ResourceBookingRow) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(
                        if (row.isPending) PantopusColors.warning else PantopusColors.success,
                    ),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                row.timeRange,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text("For: ${row.who}", fontSize = 11.sp, color = PantopusColors.appTextSecondary)
        }
        MemberOrInitials(row.member, row.who, size = 26.dp)
    }
}

/** Header-card + booking-row skeleton mirroring the loaded geometry (F11 frame 2). */
@Composable
private fun DetailSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SectionCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 46.dp, height = 46.dp, cornerRadius = Radii.lg)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 120.dp, height = 14.dp)
                    Shimmer(width = 52.dp, height = 14.dp, cornerRadius = Radii.sm)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Shimmer(width = 60.dp, height = 20.dp, cornerRadius = Radii.sm)
                Shimmer(width = 70.dp, height = 20.dp, cornerRadius = Radii.sm)
                Shimmer(width = 64.dp, height = 20.dp, cornerRadius = Radii.sm)
            }
        }
        Shimmer(width = 120.dp, height = 11.dp)
        repeat(3) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 5.dp, height = 5.dp, cornerRadius = Radii.pill)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 130.dp, height = 12.dp)
                    Shimmer(width = 70.dp, height = 9.dp)
                }
                Shimmer(width = 26.dp, height = 26.dp, cornerRadius = Radii.pill)
            }
        }
    }
}

@Composable
private fun MemberOrInitials(
    member: HomeMember?,
    fallback: String,
    size: androidx.compose.ui.unit.Dp,
) {
    HomeMemberAvatar(member = member ?: HomeMember(id = fallback, name = fallback), size = size)
}

@Composable
private fun StickyFooter(content: @Composable () -> Unit) {
    Column {
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Box(
            modifier =
                Modifier
                    .background(
                        PantopusColors.appSurface,
                    ).fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        ) {
            content()
        }
    }
}
