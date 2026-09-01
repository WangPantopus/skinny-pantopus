@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod", "CyclomaticComplexMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.edge

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
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.DestructiveButton
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling._shared.SlotTimeList
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANAGE_POLICY_TAG = "schedulingManagePolicy"

/**
 * D10 — Reschedule / Cancel cutoff & policy-blocked, the customer's manage
 * surface. Reuses the Foundation slot picker for reschedule, the typed 409
 * decode for conflicts, and the terminal-state component when the link is
 * expired/cancelled. Reschedule/cancel/add-to-calendar present locally.
 */
@Composable
fun RescheduleCancelPolicyScreen(
    manageToken: String,
    onBack: () -> Unit,
    onNavigate: (String) -> Unit = {},
    viewModel: RescheduleCancelPolicyViewModel = hiltViewModel(key = "manage-$manageToken"),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val rescheduleState by viewModel.reschedule.collectAsStateWithLifecycle()
    val cancelState by viewModel.cancel.collectAsStateWithLifecycle()

    androidx.compose.runtime.LaunchedEffect(manageToken) { viewModel.start(manageToken) }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(MANAGE_POLICY_TAG)) {
        when (val s = state) {
            is ManageUiState.Terminal ->
                UnavailableExpiredScreen(state = s.state, onBack = onBack, modifier = Modifier.weight(1f))
            else -> {
                ManageTopBar(onBack = onBack)
                when (val current = state) {
                    is ManageUiState.Loading -> SchedulingLoadingSkeleton(modifier = Modifier.weight(1f), rows = 3)
                    is ManageUiState.Error ->
                        ErrorState(
                            message = current.message,
                            modifier = Modifier.weight(1f),
                            onRetry = viewModel::load,
                        )
                    is ManageUiState.Loaded ->
                        ManageContent(
                            view = current.view,
                            mode = current.mode,
                            modifier = Modifier.weight(1f),
                            onReschedule = viewModel::openReschedule,
                            onCancel = viewModel::openCancel,
                            onAccept = viewModel::acceptProposed,
                            onDecline = viewModel::declineProposed,
                            onKeep = onBack,
                        )
                    else -> Unit
                }
            }
        }
    }

    val view = (state as? ManageUiState.Loaded)?.view
    if (rescheduleState !is RescheduleSheetState.Hidden) {
        RescheduleSheet(
            state = rescheduleState,
            pillar = view?.pillar ?: SchedulingPillar.Personal,
            onPick = viewModel::confirmReschedule,
            onDismiss = viewModel::closeReschedule,
        )
    }
    if (cancelState !is CancelSheetState.Hidden) {
        CancelSheet(state = cancelState, onConfirm = viewModel::confirmCancel, onDismiss = viewModel::closeCancel)
    }
}

@Composable
private fun ManageTopBar(onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s2, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).clickable(onClickLabel = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
        }
        // Design frames.jsx line 55: fontSize 15, fontWeight 600, centered.
        Text(
            text = "Your booking",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        Box(modifier = Modifier.size(34.dp))
    }
}

@Composable
fun ManageContent(
    view: ManageView,
    mode: ManagePolicyMode,
    onReschedule: () -> Unit,
    onCancel: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onKeep: () -> Unit,
    modifier: Modifier = Modifier,
    @Suppress("UNUSED_PARAMETER") onAddToCalendar: () -> Unit = {},
    onMessageHost: () -> Unit = onKeep,
) {
    // Within-policy (baseline) shows the Manage rows inline with no dock; every
    // blocked / proposed mode pins its CTAs in a fixed bottom dock (spec Dock).
    val showDock = mode != ManagePolicyMode.FreeToChange
    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SchedulingStatusPill(status = view.status)
            BookingSummaryCard(
                eventName = view.eventName,
                hostLabel = view.hostLabel,
                pillar = view.pillar,
                whenLabel = view.whenLabel,
                tzLabel = view.tzLabel,
            )
            val note = policyNote(mode, view)
            PolicyNoteCard(tone = note.tone, icon = note.icon, title = note.title, body = note.body, still = note.still)

            // Spec FrameRescheduleClosed adds an inline "Cancel instead" link below the note.
            if (mode == ManagePolicyMode.RescheduleClosed && view.canCancel) {
                CancelInsteadLink(pillar = view.pillar, onClick = onCancel)
            }

            if (mode == ManagePolicyMode.FreeToChange) {
                Text(
                    text = "MANAGE",
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(top = Spacing.s2),
                )
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    if (view.canReschedule) {
                        ManageActionRow(
                            icon = PantopusIcon.CalendarClock,
                            label = "Reschedule",
                            sub = "Pick a new time that works for you.",
                            pillar = view.pillar,
                            onClick = onReschedule,
                        )
                    }
                    if (view.canCancel) {
                        ManageActionRow(
                            icon = PantopusIcon.XCircle,
                            label = "Cancel booking",
                            sub = view.refundEstimateLabel?.let { "Refund: $it" } ?: "Release this time.",
                            destructive = true,
                            pillar = view.pillar,
                            onClick = onCancel,
                        )
                    }
                }
            }
            if (showDock) {
                // Leave clearance for the pinned dock so the scroll content isn't occluded.
                Box(modifier = Modifier.height(Spacing.s16))
            }
        }
        if (showDock) {
            ManageDock(
                mode = mode,
                view = view,
                onAccept = onAccept,
                onDecline = onDecline,
                onCancel = onCancel,
                onKeep = onKeep,
                onMessageHost = onMessageHost,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

/** The fixed bottom dock the policy-blocked / proposed states pin their CTAs to (spec Dock). */
@Composable
private fun ManageDock(
    mode: ManagePolicyMode,
    view: ManageView,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onCancel: () -> Unit,
    onKeep: () -> Unit,
    onMessageHost: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.xs))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        when (mode) {
            ManagePolicyMode.ProposedReschedule -> {
                PrimaryButton(title = "Accept new time", onClick = onAccept)
                GhostButton(title = "Keep my current time", onClick = onDecline)
            }
            ManagePolicyMode.PartialRefund -> {
                val label = view.refundEstimateLabel?.let { "Cancel and refund $it" } ?: "Cancel and refund"
                DestructiveButton(title = label, onClick = onCancel)
                GhostButton(title = "Keep my booking", onClick = onKeep)
            }
            ManagePolicyMode.NotOnline -> {
                PrimaryButton(title = "Message host", onClick = onMessageHost)
                GhostButton(title = "Keep my booking", onClick = onKeep)
            }
            else -> {
                // Cancel/reschedule window closed: keep + message-host fallback.
                GhostButton(title = "Keep my booking", onClick = onKeep)
                HostGhostButton(title = "Message host", pillar = view.pillar, onClick = onMessageHost)
            }
        }
    }
}

/** A pillar-tinted "host ghost" button (surface bg, pillar text, pillar-tint border) — spec hostGhost. */
@Composable
private fun HostGhostButton(
    title: String,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, pillar.accent.copy(alpha = HOST_GHOST_BORDER_ALPHA), RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = title, style = PantopusTextStyle.body, color = pillar.accent)
    }
}

private const val HOST_GHOST_BORDER_ALPHA = 0.4f

/** The centered primary "Cancel instead" inline link (spec FrameRescheduleClosed). */
@Composable
private fun CancelInsteadLink(
    pillar: SchedulingPillar,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(Spacing.s1),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.XCircle,
            contentDescription = null,
            size = 14.dp,
            tint = pillar.accent,
            modifier = Modifier.padding(end = Spacing.s1),
        )
        Text(
            text = "Cancel instead",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = pillar.accent,
        )
    }
}

@Composable
private fun ManageActionRow(
    icon: PantopusIcon,
    label: String,
    sub: String,
    onClick: () -> Unit,
    pillar: SchedulingPillar = SchedulingPillar.Personal,
    destructive: Boolean = false,
) {
    val accent = if (destructive) PantopusColors.error else pillar.accent
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, if (destructive) PantopusColors.errorLight else PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    32.dp,
                ).clip(
                    RoundedCornerShape(Radii.md),
                ).background(if (destructive) PantopusColors.errorBg else pillar.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = accent)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = if (destructive) PantopusColors.error else PantopusColors.appText,
            )
            Text(text = sub, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

private data class PolicyNote(
    val tone: EdgeTone,
    val icon: PantopusIcon,
    val title: String,
    val body: String,
    val still: String?,
)

private fun policyNote(
    mode: ManagePolicyMode,
    view: ManageView,
): PolicyNote {
    val freeUntil = view.freeCancelUntilLabel?.let { " until $it" } ?: ""
    val rescheduleBy = view.rescheduleDeadlineLabel?.let { " ended $it" } ?: " has ended"
    return when (mode) {
        ManagePolicyMode.FreeToChange ->
            PolicyNote(
                EdgeTone.Success,
                PantopusIcon.ShieldCheck,
                "You're free to change this",
                "Reschedule or cancel at no charge$freeUntil.",
                null,
            )
        ManagePolicyMode.FreeCancel ->
            PolicyNote(
                EdgeTone.Warn,
                PantopusIcon.Clock,
                "Reschedule window has closed",
                "Free reschedules$rescheduleBy.",
                "Cancel$freeUntil for a full refund.",
            )
        ManagePolicyMode.RescheduleClosed ->
            PolicyNote(
                EdgeTone.Warn,
                PantopusIcon.Clock,
                "Reschedule window has closed",
                "Free reschedules$rescheduleBy.",
                "Cancelling is still open.",
            )
        ManagePolicyMode.PartialRefund ->
            PolicyNote(
                EdgeTone.Warn,
                PantopusIcon.FileWarning,
                "You'll get a partial refund",
                view.refundEstimateLabel
                    ?.let { "Cancelling now, within 24 hours of your visit, refunds $it of what you paid." }
                    ?: "Cancelling now, within 24 hours of your visit, refunds part of what you paid.",
                view.freeCancelUntilLabel?.let { "Cancel before $it for a full refund." }
                    ?: "Cancel earlier for a full refund.",
            )
        ManagePolicyMode.CancelClosedNoRefund ->
            PolicyNote(
                EdgeTone.Warn,
                PantopusIcon.FileWarning,
                "It's too late to cancel for a refund",
                "Free cancellation$rescheduleBy.",
                "You can still cancel without a refund, or message your host.",
            )
        ManagePolicyMode.NotOnline ->
            PolicyNote(
                EdgeTone.Warn,
                PantopusIcon.FileWarning,
                "This booking can't be changed online",
                "Your host handles reschedules and cancellations directly.",
                "Message your host and they'll sort out any change with you.",
            )
        ManagePolicyMode.ProposedReschedule ->
            PolicyNote(
                EdgeTone.Info,
                PantopusIcon.CalendarClock,
                "Your host proposed a new time",
                view.proposedWhenLabel ?: view.whenLabel,
                "Accept to confirm, or keep your current time.",
            )
    }
}

// ─── Reschedule sheet ───────────────────────────────────────────────────────

@Composable
private fun RescheduleSheet(
    state: RescheduleSheetState,
    pillar: SchedulingPillar,
    onPick: (app.pantopus.android.data.api.models.scheduling.SlotDto) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState()
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = PantopusColors.appSurface) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(text = "Pick a new time", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            when (state) {
                is RescheduleSheetState.Loading, is RescheduleSheetState.Saving -> SchedulingLoadingSkeleton(rows = 3)
                is RescheduleSheetState.NoSlots ->
                    EdgeHalo(
                        tone = EdgeTone.Warn,
                        icon = PantopusIcon.CalendarX,
                        title = "No open times in this range",
                        body = "Widen the window or check back soon — availability changes often.",
                    )
                is RescheduleSheetState.Slots ->
                    SlotTimeList(slots = state.slots, selectedStart = null, onSelect = onPick, accent = pillar.accent)
                is RescheduleSheetState.Conflict -> {
                    EdgeHalo(
                        tone = EdgeTone.Warn,
                        icon = PantopusIcon.CalendarX,
                        title = "That time was just taken",
                        body = "Here are the closest open times — these are still open.",
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        state.alternatives.forEachIndexed { index, slot ->
                            AlternativeSlotRow(slot = slot, soonest = index == 0, accent = pillar.accent, onClick = { onPick(slot) })
                        }
                    }
                }
                is RescheduleSheetState.Error ->
                    Text(text = state.message, style = PantopusTextStyle.small, color = PantopusColors.error)
                is RescheduleSheetState.Hidden -> Unit
            }
        }
    }
}

// ─── Cancel sheet ───────────────────────────────────────────────────────────

@Composable
private fun CancelSheet(
    state: CancelSheetState,
    onConfirm: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState()
    var reason by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = PantopusColors.appSurface) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            EdgeHalo(
                tone = EdgeTone.Error,
                icon = PantopusIcon.XCircle,
                title = "Cancel this booking?",
                body =
                    (state as? CancelSheetState.Confirm)?.refundLabel?.let {
                        "You'll be refunded $it."
                    } ?: "This releases your time. Nothing further is owed.",
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s3),
            ) {
                if (reason.isEmpty()) {
                    Text(text = "Add a reason (optional)", style = PantopusTextStyle.small, color = PantopusColors.appTextMuted)
                }
                BasicTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    textStyle = PantopusTextStyle.small.copy(color = PantopusColors.appText),
                    modifier = Modifier.fillMaxWidth().testTag("cancelReasonField"),
                )
            }
            when (state) {
                is CancelSheetState.Saving -> SchedulingLoadingSkeleton(rows = 1)
                is CancelSheetState.Error -> Text(text = state.message, style = PantopusTextStyle.small, color = PantopusColors.error)
                else -> Unit
            }
            DestructiveButton(title = "Cancel booking", onClick = { onConfirm(reason) }, isLoading = state is CancelSheetState.Saving)
            GhostButton(title = "Keep my booking", onClick = onDismiss)
        }
    }
}
