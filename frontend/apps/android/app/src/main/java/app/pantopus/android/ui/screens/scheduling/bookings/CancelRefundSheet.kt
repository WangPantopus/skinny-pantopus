@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val CANCEL_REFUND_SHEET_TAG = "cancelRefundSheet"

/**
 * E5 Cancel & Refund sheet. Reason chips (free-text "Other") + a note + a
 * notify switch; when the booking is paid (and the paid flag is on) a refund
 * card explains the policy-driven refund the server issues. 409 `PAST_DEADLINE`
 * renders inline; `REFUND_FAILED` flips the CTA to "Retry refund".
 */
@Composable
fun CancelRefundSheet(
    state: CancelSheetUiState,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onSelectReason: (String) -> Unit,
    onSetOther: (String) -> Unit,
    onSetNote: (String) -> Unit,
    onToggleNotify: () -> Unit,
    onSelectPreset: (RefundPreset) -> Unit,
    onToggleRestoreCredit: () -> Unit,
    onConfirm: () -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(CANCEL_REFUND_SHEET_TAG),
    ) {
        when {
            state.alreadyCancelled ->
                CancelTerminal(
                    title = "Already cancelled",
                    body = alreadyCancelledBody(state),
                    showRefundRow = state.refundOutcomeIssued,
                    onDone = onDone,
                )
            state.succeeded ->
                CancelTerminal(
                    title = "Booking cancelled",
                    body = cancelledOutcomeBody(state),
                    showRefundRow = state.refundOutcomeIssued,
                    onDone = onDone,
                )
            else ->
                CancelForm(
                    state = state,
                    onSelectReason = onSelectReason,
                    onSetOther = onSetOther,
                    onSetNote = onSetNote,
                    onToggleNotify = onToggleNotify,
                    onSelectPreset = onSelectPreset,
                    onToggleRestoreCredit = onToggleRestoreCredit,
                    onConfirm = onConfirm,
                )
        }
    }
}

@Composable
private fun CancelForm(
    state: CancelSheetUiState,
    onSelectReason: (String) -> Unit,
    onSetOther: (String) -> Unit,
    onSetNote: (String) -> Unit,
    onToggleNotify: () -> Unit,
    onSelectPreset: (RefundPreset) -> Unit,
    onToggleRestoreCredit: () -> Unit,
    onConfirm: () -> Unit,
) {
    Column(
        modifier =
            Modifier.fillMaxWidth().padding(
                horizontal = Spacing.s4,
                vertical = Spacing.s2,
            ),
    ) {
        Text(
            text = "Cancel this booking?",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = state.summary,
            fontSize = 12.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(top = Spacing.s1),
        )

        // Frame 7 · the refund-failed banner sits directly under the header block.
        if (state.refundFailed) {
            state.errorMessage?.let {
                Spacer(Modifier.height(Spacing.s3))
                CancelInlineError(it)
            }
        }

        Spacer(Modifier.height(Spacing.s4))
        CancelReasonChips(state = state, onSelect = onSelectReason, onSetOther = onSetOther)
        Spacer(Modifier.height(Spacing.s3))
        NoteField(
            value = state.note,
            placeholder = "Note to the other party (optional)",
            onChange = onSetNote,
        )

        if (state.showRefund) {
            Spacer(Modifier.height(Spacing.s3))
            RefundCard(state = state, onSelectPreset = onSelectPreset)
        }
        if (state.creditRedeemed) {
            Spacer(Modifier.height(Spacing.s3))
            RestoreCreditCard(
                accent = state.pillar.accent,
                restore = state.restoreCredit,
                onToggle = onToggleRestoreCredit,
            )
        }

        Spacer(Modifier.height(Spacing.s3))
        NotifySwitch(notify = state.notify, onToggle = onToggleNotify, accent = state.pillar.accent)

        // Non-refund errors render inline at the foot of the form.
        if (!state.refundFailed) {
            state.errorMessage?.let {
                Spacer(Modifier.height(Spacing.s3))
                CancelInlineError(it)
            }
        }

        Spacer(Modifier.height(Spacing.s4))
        val label =
            when {
                state.submitting -> "Cancelling"
                state.refundFailed -> "Retry refund"
                state.showRefund -> "Cancel & refund"
                else -> "Cancel booking"
            }
        // The icon set carries no lucide `rotate-cw`; `RefreshCw` is the nearest
        // available retry glyph (deferred: exact rotate-cw).
        val icon = if (state.refundFailed) PantopusIcon.RefreshCw else PantopusIcon.XCircle
        DangerFilledButton(
            label = label,
            leadingIcon = icon,
            loading = state.submitting,
            onClick = onConfirm,
            modifier = Modifier.testTag("cancelConfirm"),
        )
        Spacer(Modifier.height(Spacing.s4))
    }
}

@Composable
private fun CancelReasonChips(
    state: CancelSheetUiState,
    onSelect: (String) -> Unit,
    onSetOther: (String) -> Unit,
) {
    Column {
        Text(
            text = "REASON",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s2),
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            state.reasons.forEach { reason ->
                val on = reason == state.selectedReason
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 34.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(
                                if (on) PantopusColors.errorBg else PantopusColors.appSurface,
                            )
                            .then(
                                if (on) {
                                    Modifier
                                } else {
                                    Modifier.border(
                                        1.dp,
                                        PantopusColors.appBorder,
                                        RoundedCornerShape(Radii.pill),
                                    )
                                },
                            )
                            .clickable { onSelect(reason) }
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = reason,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (on) PantopusColors.error else PantopusColors.appTextStrong,
                    )
                }
            }
        }
        if (state.selectedReason == "Other") {
            Spacer(Modifier.height(Spacing.s2))
            NoteField(
                value = state.otherText,
                placeholder = "Tell us what happened",
                onChange = onSetOther,
            )
        }
    }
}

/**
 * E5 frames 2–4 · refund section: receipt overline, a Full/Partial/Per-policy
 * segmented control, Paid + Refund-to-card money rows, and a per-preset policy
 * line. The owner booking carries no price, so figures render as a deferred
 * placeholder — structure/preset/copy mirror iOS refundCard().
 */
@Composable
private fun RefundCard(
    state: CancelSheetUiState,
    onSelectPreset: (RefundPreset) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                // iOS refundCard uses Radii.lg (12) vs the spec's 14 — kept at lg
                // since the icon set has no 14dp radius token (deferred: 2dp delta).
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            modifier = Modifier.padding(bottom = Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Receipt,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "REFUND",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        RefundPresetPicker(selected = state.refundPreset, onSelect = onSelectPreset)
        Spacer(Modifier.height(Spacing.s2))
        RefundMoneyRow(label = "Paid", value = DEFERRED_AMOUNT, strong = false)
        Box(
            modifier =
                Modifier
                    .padding(vertical = 2.dp)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
        RefundMoneyRow(
            label = "Refund to card",
            value = DEFERRED_AMOUNT,
            strong = true,
            valueColor = PantopusColors.success,
        )
        Text(
            text = state.refundPolicyCopy,
            fontSize = 10.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s2),
        )
    }
}

/** Deferred money placeholder — the owner booking payload has no price. */
private const val DEFERRED_AMOUNT = "—"

/** Full/Partial/Per-policy inset segmented control matching the design pills. */
@Composable
private fun RefundPresetPicker(
    selected: RefundPreset,
    onSelect: (RefundPreset) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        RefundPreset.entries.forEach { preset ->
            val on = preset == selected
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable { onSelect(preset) }
                        .testTag("cancelRefundPreset.${preset.name}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = preset.label,
                    fontSize = 11.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (on) PantopusColors.appText else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/** A Paid / Refund money row (tabular-style amount). */
@Composable
private fun RefundMoneyRow(
    label: String,
    value: String,
    strong: Boolean,
    valueColor: Color = PantopusColors.appText,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = if (strong) 13.5.sp else 12.5.sp,
            fontWeight = if (strong) FontWeight.Bold else FontWeight.Medium,
            color = if (strong) PantopusColors.appText else PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            fontSize = if (strong) 15.sp else 13.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor,
        )
    }
}

/**
 * E5 frame 5 · restore-credit switch for package-credit bookings (ticket tile +
 * "Restore session credit" row + toggle). Mirrors iOS restoreCreditCard().
 */
@Composable
private fun RestoreCreditCard(
    accent: Color,
    restore: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onToggle)
                .padding(Spacing.s3)
                .testTag("cancelRestoreCredit"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Ticket,
                contentDescription = null,
                size = 18.dp,
                tint = accent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Restore session credit",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Paid with a session package",
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = 1.dp),
            )
        }
        ToggleTrack(on = restore, accent = accent)
    }
}

/** The reusable pill toggle track used by the notify + restore-credit rows. */
@Composable
private fun ToggleTrack(
    on: Boolean,
    accent: Color,
) {
    Box(
        modifier =
            Modifier
                .size(width = 42.dp, height = 25.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (on) accent else PantopusColors.appBorderStrong),
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = 2.5.dp)
                    .size(20.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(PantopusColors.appSurface),
        )
    }
}

/**
 * E5 frames 5/8 · the read-only terminal scaffold: a 64dp circle-slash disc,
 * title + outcome copy, an optional "Refunded to card" row, and a ghost Done.
 * Mirrors iOS terminalScaffold.
 */
@Composable
private fun CancelTerminal(
    title: String,
    body: String,
    showRefundRow: Boolean,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier
                    .size(64.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CircleSlash,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = body,
                fontSize = 12.5.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
        if (showRefundRow) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(horizontal = Spacing.s3),
            ) {
                RefundMoneyRow(
                    label = "Refunded to card",
                    value = "Issued",
                    strong = true,
                    valueColor = PantopusColors.success,
                )
            }
        }
        PillarOutlineButton(
            label = "Done",
            onClick = onDone,
            modifier = Modifier.testTag("cancelDone"),
        )
        Spacer(Modifier.height(Spacing.s2))
    }
}

/** Body copy for the post-cancel confirmation (frame 5). Mirrors iOS refundOutcomeCopy. */
private fun cancelledOutcomeBody(state: CancelSheetUiState): String =
    when {
        state.showRefund && state.refundOutcomeIssued ->
            "A refund was issued to the card. The invitee has been notified."
        state.showRefund ->
            "No refund was due per your cancellation policy. The invitee has been notified."
        else -> "The invitee has been notified."
    }

/** Body copy for the already-cancelled read-only frame (frame 8). Mirrors iOS. */
private fun alreadyCancelledBody(state: CancelSheetUiState): String =
    when {
        state.refundOutcomeIssued -> "This booking was cancelled and refunded in full."
        state.showRefund ->
            "This booking was cancelled. No refund was due per your cancellation policy."
        else -> "This booking was cancelled and is no longer active."
    }

@Composable
private fun NotifySwitch(
    notify: Boolean,
    onToggle: () -> Unit,
    accent: Color,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onToggle)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Bell,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Notify invitee",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        ToggleTrack(on = notify, accent = accent)
    }
}

@Composable
private fun CancelInlineError(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.error,
        )
    }
}
