@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions", "CyclomaticComplexMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.ConflictAlternativesSheet
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling._shared.SlotTimeList
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.OffsetDateTime

const val MANAGE_BOOKING_TAG = "manageBookingScreen"

/**
 * A6 — D4 Manage your booking. Fills the A0 `MANAGE_BOOKING` stub
 * (`booking/{manageToken}`); the VM reads the token from `SavedStateHandle`.
 * Token-authed, often signed-out: status badge + A09.4 summary, reschedule /
 * cancel gated by server `actions`, an inline add-to-calendar cluster, the
 * policy notice, and the TokenAccept-style expired/invalid state.
 */
@Composable
fun ManageBookingScreen(
    manageToken: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: ManageBookingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val rescheduleSheet by viewModel.reschedule.collectAsStateWithLifecycle()
    val cancelSheet by viewModel.cancel.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val conflictSheetState = rememberModalBottomSheetState()

    LaunchedEffect(manageToken) { viewModel.start() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(MANAGE_BOOKING_TAG)) {
        ManageTopBar(onBack = onBack)
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when (val s = state) {
                is ManageBookingUiState.Loading -> ManageLoadingSkeleton()
                is ManageBookingUiState.Expired -> ManageExpired(onBack = onBack, onContactHost = onBack)
                is ManageBookingUiState.Error -> ErrorState(message = s.message, onRetry = viewModel::refresh)
                is ManageBookingUiState.Loaded ->
                    ManageBookingContent(
                        data = s.data,
                        onReschedule = viewModel::openReschedule,
                        onCancel = viewModel::openCancel,
                        onAddToCalendar = { addToCalendarManage(context, s.data) },
                        onBookAgain = { s.data.pageSlug?.let { onNavigate(SchedulingRoutes.publicBooking(it)) } },
                    )
            }
        }
    }

    rescheduleSheet?.let { sheet ->
        if (sheet.conflict != null) {
            ConflictAlternativesSheet(
                conflict = sheet.conflict,
                onPick = { slot -> viewModel.confirmReschedule(slot.start) },
                onPickAnotherTime = viewModel::dismissRescheduleConflict,
                onDismiss = viewModel::dismissRescheduleConflict,
                sheetState = conflictSheetState,
            )
        } else {
            RescheduleSheet(sheet = sheet, onPick = { viewModel.confirmReschedule(it) }, onDismiss = viewModel::dismissReschedule)
        }
    }

    cancelSheet?.let { sheet ->
        CancelSheet(sheet = sheet, onConfirm = viewModel::confirmCancel, onDismiss = viewModel::dismissCancel)
    }
}

@Composable
private fun ManageTopBar(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(46.dp).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).clickable(onClickLabel = "Back", onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
            }
            Text(
                text = "Your booking",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            Box(modifier = Modifier.size(34.dp))
        }
        HorizontalDivider(color = PantopusColors.appBorder)
    }
}

/** The loaded D4 body — public so Paparazzi can render it without Hilt. */
@Composable
fun ManageBookingContent(
    data: ManageBookingData,
    onReschedule: () -> Unit,
    onCancel: () -> Unit,
    onAddToCalendar: () -> Unit,
    onBookAgain: () -> Unit,
) {
    val pillar = pillarForOwner(data.ownerType)
    val dimmed = data.status == ManageStatus.Past || data.status == ManageStatus.Cancelled
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SchedulingStatusPill(status = data.status.toPillStatus())
        ManageSummaryCard(data = data, pillar = pillar, dimmed = dimmed, struck = data.status == ManageStatus.Cancelled)

        when (data.status) {
            ManageStatus.Cancelled ->
                CancelledBanner(
                    title = data.cancelledOnLabel?.let { "This booking was cancelled on $it" } ?: "This booking was cancelled",
                    accent = pillar.accent,
                    showBookAgain = data.pageSlug != null,
                    onBookAgain = onBookAgain,
                )
            ManageStatus.Past ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        // Spec copy: "This call has already happened."
                        text = "This call has already happened.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            else -> {
                Column {
                    ConfirmOverline("Manage")
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        ActionRow(
                            icon = PantopusIcon.CalendarClock,
                            label = "Reschedule",
                            sub = "Pick a new time that works for you.",
                            enabled = data.canReschedule,
                            tone = ActionTone.Neutral,
                            accent = pillar.accent,
                            onClick = onReschedule,
                        )
                        ActionRow(
                            icon = PantopusIcon.XCircle,
                            label = "Cancel booking",
                            sub = "Cancelling frees the slot for someone else.",
                            enabled = data.canCancel,
                            tone = ActionTone.Error,
                            accent = pillar.accent,
                            onClick = onCancel,
                        )
                        if (data.windowClosed) {
                            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                                PantopusIconImage(
                                    icon = PantopusIcon.Lock,
                                    contentDescription = null,
                                    size = 13.dp,
                                    tint = PantopusColors.warning,
                                )
                                Text(
                                    text = "Too late to change online — contact ${data.hostName} to reschedule or cancel.",
                                    style = PantopusTextStyle.caption,
                                    color = PantopusColors.warning,
                                )
                            }
                        }
                    }
                }
            }
        }

        if (data.status != ManageStatus.Cancelled) {
            CalendarCluster(accent = pillar.accent, onAddTo = { onAddToCalendar() }, onDownloadIcs = onAddToCalendar)
        }

        // Design FramePast (manage-booking-frames.jsx:286): PolicyCard shown with
        // "Booked a follow-up? Manage it from the new confirmation email." for past bookings.
        // Confirmed/Pending also show the standard cancellation policy card.
        val policyText =
            when (data.status) {
                ManageStatus.Past -> "Booked a follow-up? Manage it from the new confirmation email."
                else -> data.cancellationPolicy
            }
        if (!policyText.isNullOrBlank()) {
            PolicyCard(
                policy = policyText,
                hostName = data.hostName,
                accent = pillar.accent,
                showContact = data.status != ManageStatus.Past && data.pageSlug != null,
                onContactHost = onBookAgain,
            )
        }
    }
}

/**
 * The already-cancelled banner with a pillar-accent "Book again" affordance
 * (rotate-ccw glyph), mirroring the spec FrameCancelled + iOS cancelledBanner.
 */
@Composable
private fun CancelledBanner(
    title: String,
    accent: Color,
    showBookAgain: Boolean,
    onBookAgain: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.XCircle,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.error,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = title, style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = PantopusColors.error)
            Text(
                text = "The slot was released. Nothing further is owed.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
            if (showBookAgain) {
                Row(
                    modifier = Modifier.clickable(onClick = onBookAgain).padding(top = Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 13.dp, tint = accent)
                    Text(text = "Book again", style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = accent)
                }
            }
        }
    }
}

@Composable
private fun ManageSummaryCard(
    data: ManageBookingData,
    pillar: SchedulingPillar,
    dimmed: Boolean,
    struck: Boolean,
) {
    val strike = if (struck) TextDecoration.LineThrough else TextDecoration.None
    ConfirmCard(modifier = if (dimmed) Modifier.alpha(0.6f) else Modifier) {
        SummaryDetailRow(icon = PantopusIcon.User) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                HostAvatar(pillar = pillar, initials = ConfirmUtils.initials(data.hostName), diameter = 30.dp)
                Column(modifier = Modifier.padding(start = Spacing.s2)) {
                    Text(
                        text = data.eventName,
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        textDecoration = strike,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text(text = data.hostName, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                        PillarTag(pillar = pillar)
                    }
                }
            }
        }
        SummaryDetailRow(icon = PantopusIcon.Calendar) {
            Text(
                text = data.whenLabel,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                textDecoration = strike,
            )
            TimezoneChip(label = data.tzLabel, accent = pillar.accent, modifier = Modifier.padding(top = Spacing.s1))
        }
        SummaryDetailRow(icon = PantopusIcon.Video, divider = data.inviteeName != null) {
            Text(
                text = data.locationLabel,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            if (data.locationSub != null) {
                Text(
                    text = data.locationSub,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        if (data.inviteeName != null) {
            SummaryDetailRow(icon = PantopusIcon.Users, divider = false) {
                Text(
                    text = data.inviteeName,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

/** Maps the local D4 booking status onto the shared scheduling pill vocabulary. */
private fun ManageStatus.toPillStatus(): SchedulingPillStatus =
    when (this) {
        ManageStatus.Confirmed -> SchedulingPillStatus.Confirmed
        ManageStatus.Pending -> SchedulingPillStatus.Pending
        ManageStatus.Past -> SchedulingPillStatus.Past
        ManageStatus.Cancelled -> SchedulingPillStatus.Cancelled
    }

private enum class ActionTone { Neutral, Error }

@Composable
private fun ActionRow(
    icon: PantopusIcon,
    label: String,
    sub: String,
    enabled: Boolean,
    tone: ActionTone,
    accent: Color,
    onClick: () -> Unit,
) {
    val isErr = tone == ActionTone.Error
    val border =
        if (!enabled) {
            PantopusColors.appBorder
        } else if (isErr) {
            PantopusColors.errorLight
        } else {
            PantopusColors.appBorderStrong
        }
    val tileBg =
        if (!enabled) {
            PantopusColors.appSurfaceSunken
        } else if (isErr) {
            PantopusColors.errorBg
        } else {
            accent.copy(alpha = TILE_ALPHA)
        }
    val tileFg =
        if (!enabled) {
            PantopusColors.appTextMuted
        } else if (isErr) {
            PantopusColors.error
        } else {
            accent
        }
    val labelColor =
        if (!enabled) {
            PantopusColors.appTextMuted
        } else if (isErr) {
            PantopusColors.error
        } else {
            PantopusColors.appText
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, border, RoundedCornerShape(Radii.lg))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(tileBg), contentAlignment = Alignment.Center) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = tileFg)
        }
        Column(modifier = Modifier.weight(1f).padding(start = Spacing.s2)) {
            Text(text = label, style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = labelColor)
            // Spec action sub-label is 10.5px.
            Text(text = sub, fontSize = 10.5f.sp, color = PantopusColors.appTextSecondary)
        }
        if (enabled) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun PolicyCard(
    policy: String,
    hostName: String,
    accent: Color,
    showContact: Boolean,
    onContactHost: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            PantopusIconImage(
                icon = PantopusIcon.Info,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(end = Spacing.s2),
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(text = policy, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
                // Spec PolicyCard: a pillar-accent "Contact <host>" mail button below the body.
                if (showContact) {
                    Row(
                        modifier = Modifier.clickable(onClick = onContactHost),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(icon = PantopusIcon.Mail, contentDescription = null, size = 12.dp, tint = accent)
                        Text(
                            text = "Contact ${ConfirmUtils.firstName(hostName)}",
                            style = PantopusTextStyle.caption,
                            fontWeight = FontWeight.Bold,
                            color = accent,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ManageExpired(
    onBack: () -> Unit,
    onContactHost: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        ConfirmHalo(kind = HaloKind.Warning, icon = PantopusIcon.Link)
        Text(
            text = "This link has expired",
            style = PantopusTextStyle.h3,
            // Spec headline is 20/700 bold.
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s4),
        )
        Text(
            // Spec copy: "Request a fresh one and we'll email it to you."
            text = "For your security, manage links expire after a while. Request a fresh one and we'll email it to you.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2, bottom = Spacing.s5),
        )
        // Spec token-expired footer: primary "Request a new link" (mail) + ghost "Contact host".
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(onClickLabel = "Request a new link", onClick = onContactHost),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mail,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
                modifier = Modifier.padding(end = Spacing.s1),
            )
            Text(
                text = "Request a new link",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier.fillMaxWidth().height(
                    38.dp,
                ).padding(top = Spacing.s2).clickable(onClickLabel = "Contact host", onClick = onContactHost),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Contact host",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

/**
 * Hand-rolled loading skeleton mirroring the spec FrameLoading geometry: a badge
 * pill, the summary card (avatar + two lines, when-line + tz chip, location line),
 * the "Manage" overline bar, and two 56dp action tiles. Mirrors iOS loadingSkeleton.
 */
@Composable
private fun ManageLoadingSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 96.dp, height = 24.dp, cornerRadius = Radii.pill)
        ConfirmCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Shimmer(width = 30.dp, height = 30.dp, cornerRadius = Radii.pill)
                Column(modifier = Modifier.padding(start = Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 120.dp, height = 11.dp)
                    Shimmer(width = 80.dp, height = 9.dp)
                }
            }
            HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s2))
            Shimmer(width = 160.dp, height = 11.dp)
            Shimmer(width = 120.dp, height = 22.dp, cornerRadius = Radii.pill, modifier = Modifier.padding(top = Spacing.s2))
            HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s2))
            Shimmer(width = 140.dp, height = 11.dp)
        }
        Shimmer(width = 70.dp, height = 11.dp)
        Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.lg)
        Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.lg)
    }
}

// ─── Local reschedule / cancel sheets ────────────────────────────────────────

@Composable
private fun RescheduleSheet(
    sheet: RescheduleSheetState,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState()
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = PantopusColors.appSurface) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(text = "Pick a new time", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            when {
                sheet.loading -> SchedulingLoadingSkeleton(rows = 2)
                sheet.slots.isEmpty() ->
                    Text(
                        text = "No open times in the next few weeks. Contact your host for a custom time.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                else ->
                    SlotTimeList(
                        slots = sheet.slots,
                        selectedStart = null,
                        onSelect = { onPick(it.start) },
                    )
            }
            sheet.errorMessage?.let {
                ConfirmBanner(tone = BannerTone.Error, icon = PantopusIcon.AlertCircle, title = it)
            }
            if (sheet.submitting) {
                Text(
                    text = "Rescheduling…",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun CancelSheet(
    sheet: CancelSheetState,
    onConfirm: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState()
    var reason by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = PantopusColors.appSurface) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(text = "Cancel this booking?", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            Text(
                text = "Cancelling frees the slot for someone else. We'll let your host know.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            ConfirmTextInput(
                value = reason,
                onValueChange = { reason = it },
                placeholder = "Reason (optional)",
                singleLine = false,
                minHeight = 64.dp,
                enabled = !sheet.submitting,
            )
            sheet.errorMessage?.let {
                ConfirmBanner(tone = BannerTone.Error, icon = PantopusIcon.AlertCircle, title = it)
            }
            app.pantopus.android.ui.components.DestructiveButton(
                title = if (sheet.submitting) "Cancelling…" else "Cancel booking",
                onClick = { onConfirm(reason) },
                isEnabled = !sheet.submitting,
                modifier = Modifier.fillMaxWidth(),
            )
            app.pantopus.android.ui.components.GhostButton(title = "Keep booking", onClick = onDismiss, modifier = Modifier.fillMaxWidth())
        }
    }
}

private const val TILE_ALPHA = 0.12f

private fun addToCalendarManage(
    context: Context,
    data: ManageBookingData,
) {
    val begin = parseEpoch(data.startUtc) ?: return
    val end = parseEpoch(data.endUtc) ?: (begin + DEFAULT_MS)
    val intent =
        Intent(Intent.ACTION_INSERT).apply {
            this.data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, data.eventName)
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
            putExtra(CalendarContract.Events.DESCRIPTION, "Booking with ${data.hostName}")
        }
    runCatching { context.startActivity(intent) }
}

private fun parseEpoch(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return runCatching { Instant.parse(iso).toEpochMilli() }
        .recoverCatching { OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
        .getOrNull()
}

private const val DEFAULT_MS = 30L * 60 * 1000
