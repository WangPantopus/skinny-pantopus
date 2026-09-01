@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "CyclomaticComplexMethod",
    "UNUSED_PARAMETER",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.ConflictAlternativesSheet
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

object BookingDetailTags {
    const val SCREEN = "bookingDetail"
    const val RESCHEDULE = "bookingDetailReschedule"
    const val APPROVE = "bookingDetailApprove"
    const val DECLINE = "bookingDetailDecline"
    const val CANCEL = "bookingDetailCancel"
    const val REASSIGN = "bookingDetailReassign"
    const val MESSAGE = "bookingDetailMessage"
    const val FOLLOW_UP = "bookingDetailFollowUp"
    const val REBOOK = "bookingDetailRebook"
    const val SEND_REBOOK = "bookingDetailSendRebook"
    const val CONFLICT_BANNER = "bookingDetailConflictBanner"
}

@Composable
fun BookingDetailScreen(
    bookingId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BookingDetailViewModel = hiltViewModel(),
    rescheduleViewModel: RescheduleReassignViewModel = hiltViewModel(),
    cancelViewModel: CancelRefundViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val approveDecline by viewModel.approveDecline.collectAsStateWithLifecycle()
    val reschedule by rescheduleViewModel.state.collectAsStateWithLifecycle()
    val rescheduleCommitted by rescheduleViewModel.committed.collectAsStateWithLifecycle()
    val cancel by cancelViewModel.state.collectAsStateWithLifecycle()
    val cancelCommitted by cancelViewModel.committed.collectAsStateWithLifecycle()

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) viewModel.start() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(rescheduleCommitted) {
        if (rescheduleCommitted) {
            viewModel.refresh()
            rescheduleViewModel.committedConsumed()
        }
    }
    LaunchedEffect(cancelCommitted) {
        if (cancelCommitted) {
            viewModel.refresh()
            cancelViewModel.committedConsumed()
        }
    }

    val data = (state as? BookingDetailUiState.Loaded)?.data

    Box(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).testTag(BookingDetailTags.SCREEN),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            DetailTopBar(
                data = data,
                onBack = onBack,
                onReschedule = { d ->
                    rescheduleViewModel.open(
                        d.owner,
                        d.pillar,
                        d.startUtc,
                        d.endUtc,
                        d.canReassign,
                        reassignOnly = false,
                    )
                },
                onReassign = { d ->
                    rescheduleViewModel.open(
                        d.owner,
                        d.pillar,
                        d.startUtc,
                        d.endUtc,
                        allowReassign = true,
                        reassignOnly = true,
                    )
                },
                onCancel = { d ->
                    cancelViewModel.open(
                        d.owner,
                        d.pillar,
                        "${d.eventName} · ${d.requesterName} · ${d.whenRange}",
                        hasPayment = d.hasPayment,
                        creditRedeemed = d.creditRedeemed,
                        alreadyCancelled =
                            d.status == BookingStatus.Cancelled ||
                                d.status == BookingStatus.Declined,
                        refundIssued = d.refundIssued,
                    )
                },
                onDecline = viewModel::openDecline,
            )
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val s = state) {
                    BookingDetailUiState.Loading -> DetailSkeleton()
                    is BookingDetailUiState.Error ->
                        // Design frame 10: cloud-off glyph on an error-red hero +
                        // "Couldn't load this booking" (mirrors iOS errorView).
                        EmptyState(
                            icon = PantopusIcon.CloudOff,
                            headline = "Couldn't load this booking",
                            subcopy = s.message,
                            ctaTitle = "Try again",
                            onCta = viewModel::load,
                            tint = PantopusColors.errorBg,
                            accent = PantopusColors.error,
                        )
                    is BookingDetailUiState.Loaded -> DetailContent(s.data)
                }
            }
            if (data != null) {
                if (data.hasConflict) {
                    ConflictBanner()
                }
                DetailDock(
                    data = data,
                    onApprove = viewModel::openApprove,
                    onDecline = viewModel::openDecline,
                    onReschedule = {
                        rescheduleViewModel.open(
                            data.owner,
                            data.pillar,
                            data.startUtc,
                            data.endUtc,
                            data.canReassign,
                            reassignOnly = false,
                        )
                    },
                )
            }
        }
    }

    // ─── Sheets ───────────────────────────────────────────────────────────────
    approveDecline?.let { sheet ->
        ApproveDeclineSheet(
            state = sheet,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            onDismiss = viewModel::dismissApproveDecline,
            onApprove = viewModel::approve,
            onExpandDecline = viewModel::expandDecline,
            onSelectReason = viewModel::selectReason,
            onSetNote = viewModel::setNote,
            onDecline = viewModel::declineConfirm,
            // Design FrameDeclineExpanded: "Propose another time" link (approve-decline-frames.jsx:153-155).
            // Dismiss the approve/decline sheet then open the reschedule flow.
            onProposeTime =
                data?.let { d ->
                    if (d.canReschedule) {
                        {
                            viewModel.dismissApproveDecline()
                            rescheduleViewModel.open(
                                d.owner,
                                d.pillar,
                                d.startUtc,
                                d.endUtc,
                                d.canReassign,
                                reassignOnly = false,
                            )
                        }
                    } else {
                        null
                    }
                },
        )
    }

    reschedule?.let { rs ->
        val conflict = rs.conflict
        if (conflict != null) {
            ConflictAlternativesSheet(
                conflict = conflict,
                onPick = rescheduleViewModel::pickAlternative,
                onPickAnotherTime = rescheduleViewModel::dismissConflict,
                onDismiss = rescheduleViewModel::dismissConflict,
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                accent = rs.pillar.accent,
                body = "Here are the nearest open times for this booking.",
                showSavedNote = false,
            )
        } else {
            RescheduleReassignSheet(
                state = rs,
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                onDismiss = rescheduleViewModel::dismiss,
                onSelectDay = rescheduleViewModel::selectDay,
                onSelectSlot = rescheduleViewModel::selectSlot,
                onSelectMember = rescheduleViewModel::selectMember,
                onSetAuthority = rescheduleViewModel::setAuthority,
                onToggleNotify = rescheduleViewModel::toggleNotify,
                onConfirm = rescheduleViewModel::confirm,
                onProposedDone = {
                    rescheduleViewModel.dismiss()
                    viewModel.refresh()
                },
            )
        }
    }

    cancel?.let { cs ->
        CancelRefundSheet(
            state = cs,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            onDismiss = cancelViewModel::dismiss,
            onSelectReason = cancelViewModel::selectReason,
            onSetOther = cancelViewModel::setOther,
            onSetNote = cancelViewModel::setNote,
            onToggleNotify = cancelViewModel::toggleNotify,
            onSelectPreset = cancelViewModel::selectPreset,
            onToggleRestoreCredit = cancelViewModel::toggleRestoreCredit,
            onConfirm = cancelViewModel::confirm,
            onDone = cancelViewModel::done,
        )
    }
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

@Composable
private fun DetailTopBar(
    data: BookingDetailData?,
    onBack: () -> Unit,
    onReschedule: (BookingDetailData) -> Unit,
    onReassign: (BookingDetailData) -> Unit,
    onCancel: (BookingDetailData) -> Unit,
    onDecline: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .height(48.dp)
                .padding(horizontal = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier.size(
                    40.dp,
                ).clip(CircleShape).clickable(onClickLabel = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = 21.dp,
                tint = PantopusColors.appText,
            )
        }
        Spacer(Modifier.weight(1f))
        if (data != null) {
            SchedulingStatusPill(status = data.pillStatus)
        }
        if (data != null && data.isActive) {
            Box {
                Box(
                    modifier =
                        Modifier.size(
                            40.dp,
                        ).clip(CircleShape).clickable(onClickLabel = "More actions") {
                            menuOpen = true
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MoreVertical,
                        contentDescription = "More actions",
                        size = 19.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    if (data.status == BookingStatus.Pending) {
                        MenuItem(PantopusIcon.X, "Decline", danger = true) {
                            menuOpen = false
                            onDecline()
                        }
                    }
                    if (data.canReschedule) {
                        MenuItem(PantopusIcon.CalendarClock, "Reschedule") {
                            menuOpen = false
                            onReschedule(data)
                        }
                    }
                    if (data.canReassign) {
                        MenuItem(PantopusIcon.UserCheck, "Reassign") {
                            menuOpen = false
                            onReassign(data)
                        }
                    }
                    if (data.canCancel) {
                        MenuItem(PantopusIcon.XCircle, "Cancel booking", danger = true) {
                            menuOpen = false
                            onCancel(data)
                        }
                    }
                }
            }
        }
    }
    HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
}

@Composable
private fun MenuItem(
    icon: PantopusIcon,
    label: String,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        leadingIcon = {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = if (danger) PantopusColors.error else PantopusColors.appTextSecondary,
            )
        },
        text = {
            Text(
                text = label,
                fontSize = 13.sp,
                color = if (danger) PantopusColors.error else PantopusColors.appText,
            )
        },
        onClick = onClick,
    )
}

// ─── Content ──────────────────────────────────────────────────────────────────

@Composable
private fun DetailContent(data: BookingDetailData) {
    Column(
        modifier =
            Modifier.fillMaxSize().verticalScroll(
                rememberScrollState(),
            ).padding(bottom = Spacing.s12),
    ) {
        Header(data)
        StatusBanner(data)
        RequesterCard(data)
        data.location?.let { LocationCard(it, data.pillar.accent) }
        if (data.assignedHostInitials != null) {
            AssignedMemberCard(data)
        }
        if (data.intakeAnswers.isNotEmpty()) {
            IntakeCard(data.intakeAnswers)
        }
        if (data.timeline.isNotEmpty()) {
            TimelineCard(data.timeline, data.pillar.accent)
        }
        Spacer(Modifier.height(Spacing.s4))
    }
}

/**
 * The status-contextual banner above the cards (design frames 3/4/5).
 * Cancelled/declined → neutral circle-slash + optional refund line; no-show →
 * error user-x with the requester's first name; completed/past → blue sparkles
 * follow-up promo. Mirrors iOS `statusBanner`.
 */
@Composable
private fun StatusBanner(data: BookingDetailData) {
    when {
        data.status == BookingStatus.Cancelled || data.status == BookingStatus.Declined -> {
            val verb = if (data.status == BookingStatus.Declined) "Declined" else "Cancelled"
            val note = data.cancelledNote
            Banner(
                icon = PantopusIcon.CircleSlash,
                tint = PantopusColors.appTextSecondary,
                bg = PantopusColors.appSurfaceSunken,
                text = if (note != null) "$verb by host · “$note”" else "$verb by host",
            )
            if (data.hasPayment) {
                RefundLine()
            }
        }
        data.status == BookingStatus.NoShow ->
            Banner(
                // The icon set carries no lucide `user-x`; `UserMinus` is the
                // nearest available no-show glyph (deferred: exact user-x).
                icon = PantopusIcon.UserMinus,
                tint = PantopusColors.error,
                bg = PantopusColors.errorBg,
                text = "Marked no-show · ${data.requesterFirstName} didn't attend",
            )
        data.status == BookingStatus.Completed ->
            FollowUpPromo(data.requesterFirstName)
        data.rescheduled ->
            Banner(
                icon = PantopusIcon.CalendarClock,
                tint = PantopusColors.primary600,
                bg = PantopusColors.primary50,
                text = "This booking was rescheduled",
            )
    }
}

/** Design frame 3 · blue sparkles "Send a follow-up" promo (completed/past). */
@Composable
private fun FollowUpPromo(firstName: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Send a follow-up",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Thank $firstName and offer a time to book again.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/**
 * Design frame 4 · "Refund" card under the cancelled banner. The owner-side
 * BookingDto carries no price/amount, so the figure is deferred; mirrors iOS
 * refundLine ("Refunded to card · Issued" in the success tone).
 */
@Composable
private fun RefundLine() {
    DetailCard {
        CardOverline(PantopusIcon.Receipt, "Refund", PantopusColors.appTextSecondary)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Refunded to card",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "Issued",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
        }
    }
}

@Composable
private fun Header(data: BookingDetailData) {
    Column(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s4)) {
        Text(
            text = data.eventName,
            fontSize = 21.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = data.whenRange,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s1),
        )
        Row(
            modifier =
                Modifier
                    .padding(top = Spacing.s3)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(data.pillar.accentBg)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(data.pillar.accent))
            Text(
                text = data.ownerLabel,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = data.pillar.accent,
            )
        }
    }
}

@Composable
private fun Banner(
    icon: PantopusIcon,
    tint: Color,
    bg: Color,
    text: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = tint)
        Text(text = text, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = tint)
    }
}

@Composable
private fun DetailCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s3)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        content()
    }
}

@Composable
private fun CardOverline(
    icon: PantopusIcon,
    text: String,
    accent: Color,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier = Modifier.padding(bottom = Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = accent)
        Text(
            text = text.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun RequesterCard(data: BookingDetailData) {
    // The design uses "Attendee" once the booking is terminal/past, "Requester"
    // while it's live — mirrors iOS requesterOverline.
    val overline =
        when (data.status) {
            BookingStatus.Pending, BookingStatus.Confirmed -> "Requester"
            else -> "Attendee"
        }
    DetailCard {
        CardOverline(PantopusIcon.User, overline, data.pillar.accent)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            BookingAvatar(pillar = data.pillar, initials = data.requesterInitials, size = 40.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = data.requesterName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = data.requesterSub,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            // Design AttendeeRow trailing 36x36 outlined message-circle button
            // (brand blue). Messaging has no route yet, so it's a no-op affordance.
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(onClickLabel = "Message") {}
                        .testTag(BookingDetailTags.MESSAGE),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageCircle,
                    contentDescription = "Message",
                    size = 17.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
}

/** Design frames 1/3/5 · vertical status timeline with done/not-done nodes. */
@Composable
private fun TimelineCard(
    steps: List<TimelineStep>,
    accent: Color,
) {
    DetailCard {
        CardOverline(PantopusIcon.Activity, "Status", accent)
        Column {
            steps.forEachIndexed { index, step ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier =
                                Modifier
                                    .size(18.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (step.done) {
                                            PantopusColors.success
                                        } else {
                                            PantopusColors.appSurface
                                        },
                                    )
                                    .then(
                                        if (step.done) {
                                            Modifier
                                        } else {
                                            Modifier.border(
                                                2.dp,
                                                PantopusColors.appBorderStrong,
                                                CircleShape,
                                            )
                                        },
                                    ),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (step.done) {
                                PantopusIconImage(
                                    icon = PantopusIcon.Check,
                                    contentDescription = null,
                                    size = 11.dp,
                                    strokeWidth = 3f,
                                    tint = PantopusColors.appTextInverse,
                                )
                            }
                        }
                        if (index < steps.size - 1) {
                            Box(
                                modifier =
                                    Modifier
                                        .padding(vertical = 2.dp)
                                        .size(width = 2.dp, height = 22.dp)
                                        .background(
                                            if (step.done) {
                                                PantopusColors.successLight
                                            } else {
                                                PantopusColors.appBorder
                                            },
                                        ),
                            )
                        }
                    }
                    Column(
                        modifier =
                            Modifier.padding(
                                bottom = if (index < steps.size - 1) Spacing.s2 else 0.dp,
                            ),
                    ) {
                        Text(
                            text = step.label,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color =
                                if (step.done) {
                                    PantopusColors.appText
                                } else {
                                    PantopusColors.appTextMuted
                                },
                        )
                        step.time?.let {
                            Text(
                                text = it,
                                fontSize = 10.5.sp,
                                color = PantopusColors.appTextMuted,
                                modifier = Modifier.padding(top = 1.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Design frame 6 · amber conflict banner above the dock ("This overlaps another booking"). */
@Composable
private fun ConflictBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag(BookingDetailTags.CONFLICT_BANNER),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.TriangleAlert,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.warning,
        )
        // Design: "This slot overlaps a confirmed booking" (approve-decline-frames.jsx:117).
        Text(
            text = "This slot overlaps a confirmed booking",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.warning,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "View",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warning,
            modifier = Modifier.clickable(onClickLabel = "View conflict") {},
        )
    }
}

@Composable
private fun AssignedMemberCard(data: BookingDetailData) {
    DetailCard {
        CardOverline(PantopusIcon.UserRound, "Assigned member", data.pillar.accent)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier.size(
                        30.dp,
                    ).clip(CircleShape).background(PantopusColors.businessBg),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = data.assignedHostInitials.orEmpty(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.business,
                )
            }
            Text(
                text = "Team member",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun LocationCard(
    location: LocationInfo,
    accent: Color,
) {
    DetailCard {
        CardOverline(location.icon, "Location", accent)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier.size(
                        34.dp,
                    ).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = location.icon,
                    contentDescription = null,
                    size = 16.dp,
                    tint = accent,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = location.value,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = location.sub,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
        }
    }
}

@Composable
private fun IntakeCard(answers: List<IntakeAnswer>) {
    var expanded by remember { mutableStateOf(false) }
    DetailCard {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier.size(
                        34.dp,
                    ).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ClipboardList,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Intake answers",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "${answers.size} answers",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (expanded) {
            Spacer(Modifier.height(Spacing.s2))
            answers.forEach { answer ->
                Column(modifier = Modifier.padding(top = Spacing.s2)) {
                    Text(
                        text = answer.label,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = answer.value,
                        fontSize = 12.5.sp,
                        color = PantopusColors.appText,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                }
            }
        }
    }
}

// ─── Dock ─────────────────────────────────────────────────────────────────────

@Composable
private fun DetailDock(
    data: BookingDetailData,
    onApprove: () -> Unit,
    onDecline: () -> Unit,
    onReschedule: () -> Unit,
) {
    // Deferred dock CTAs (Message / Follow up / Rebook / Send rebook link) have no
    // route or endpoint yet, so they render faithfully as no-op affordances —
    // mirrors iOS's intentionally-stubbed dock handlers.
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        HorizontalDivider(
            thickness = 1.dp,
            color = PantopusColors.appBorder,
            modifier = Modifier.padding(bottom = Spacing.s3),
        )
        when (data.status) {
            BookingStatus.Pending ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    DockGhostButton(
                        label = "Decline",
                        leadingIcon = PantopusIcon.X,
                        danger = true,
                        onClick = onDecline,
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.DECLINE),
                    )
                    DockPrimaryButton(
                        label = "Approve",
                        leadingIcon = PantopusIcon.Check,
                        onClick = onApprove,
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.APPROVE),
                    )
                }
            BookingStatus.Confirmed ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    DockGhostButton(
                        label = "Reschedule",
                        leadingIcon = PantopusIcon.CalendarClock,
                        onClick = onReschedule,
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.RESCHEDULE),
                    )
                    DockPrimaryButton(
                        label = "Message",
                        leadingIcon = PantopusIcon.MessageCircle,
                        onClick = {},
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.MESSAGE),
                    )
                }
            BookingStatus.Completed ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    DockGhostButton(
                        label = "Rebook",
                        leadingIcon = PantopusIcon.RefreshCw,
                        onClick = {},
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.REBOOK),
                    )
                    DockPrimaryButton(
                        label = "Follow up",
                        leadingIcon = PantopusIcon.Send,
                        onClick = {},
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.FOLLOW_UP),
                    )
                }
            BookingStatus.NoShow ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    DockGhostButton(
                        label = "Message",
                        leadingIcon = PantopusIcon.MessageCircle,
                        onClick = {},
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.MESSAGE),
                    )
                    DockPrimaryButton(
                        label = "Send rebook link",
                        leadingIcon = PantopusIcon.Link,
                        onClick = {},
                        modifier = Modifier.weight(1f).testTag(BookingDetailTags.SEND_REBOOK),
                    )
                }
            BookingStatus.Cancelled, BookingStatus.Declined ->
                DockPrimaryButton(
                    label = "Rebook this time",
                    leadingIcon = PantopusIcon.RefreshCw,
                    onClick = {},
                    modifier = Modifier.testTag(BookingDetailTags.REBOOK),
                )
        }
    }
}

/**
 * Neutral / danger ghost dock button (design `BtnGhost`): outlined, surface
 * fill, `fg2`/error text. Always 46dp tall · Radii.lg.
 */
@Composable
private fun DockGhostButton(
    label: String,
    leadingIcon: PantopusIcon,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
) {
    val fg = if (danger) PantopusColors.error else PantopusColors.appTextStrong
    Box(
        modifier =
            modifier
                .height(46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (danger) PantopusColors.errorLight else PantopusColors.appBorderStrong,
                    RoundedCornerShape(Radii.lg),
                )
                .clickable(onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = leadingIcon, contentDescription = null, size = 16.dp, tint = fg)
            Text(text = label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = fg)
        }
    }
}

/**
 * Filled primary dock button (design `BtnPrimary`): always the brand blue
 * `primary600`, never the owner accent. 46dp tall · Radii.lg.
 */
@Composable
private fun DockPrimaryButton(
    label: String,
    leadingIcon: PantopusIcon,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .height(46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .clickable(onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = leadingIcon,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = label,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

@Composable
private fun DetailSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 220.dp, height = 22.dp, cornerRadius = Radii.sm)
        Shimmer(width = 160.dp, height = 12.dp, cornerRadius = Radii.xs)
        Shimmer(width = 90.dp, height = 22.dp, cornerRadius = Radii.pill)
        Spacer(Modifier.height(Spacing.s2))
        repeat(3) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 40.dp, height = 40.dp, cornerRadius = Radii.pill)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 140.dp, height = 11.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 90.dp, height = 9.dp, cornerRadius = Radii.xs)
                }
            }
        }
    }
}
