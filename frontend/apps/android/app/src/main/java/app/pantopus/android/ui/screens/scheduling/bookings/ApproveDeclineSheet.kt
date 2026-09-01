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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val APPROVE_DECLINE_SHEET_TAG = "approveDeclineSheet"

/**
 * E3 Approve / Decline request sheet — host-side, accent follows the booking's
 * pillar. Default frame shows requester + slot + intake preview + Approve /
 * Decline; tapping Decline expands the reason chips; submitting shows a spinner;
 * errors render inline with the actions re-enabled. Stateless: driven by
 * [BookingDetailViewModel].
 */
@Composable
fun ApproveDeclineSheet(
    state: ApproveDeclineSheetState,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onApprove: () -> Unit,
    onExpandDecline: () -> Unit,
    onSelectReason: (String) -> Unit,
    onSetNote: (String) -> Unit,
    onDecline: () -> Unit,
    /** Invoked when the user taps "Propose another time" in decline mode.
     *  Null hides the link (e.g. when reschedule is not available). */
    onProposeTime: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(APPROVE_DECLINE_SHEET_TAG),
    ) {
        Column(
            modifier =
                Modifier.fillMaxWidth().padding(
                    horizontal = Spacing.s4,
                    vertical = Spacing.s2,
                ),
        ) {
            Text(
                text = if (state.declineExpanded) "Decline request" else "Review request",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(bottom = Spacing.s3),
            )
            RequesterCard(state)
            Spacer(Modifier.height(Spacing.s3))
            SlotLine(state.slotLabel, state.pillar.accent)

            // Design FrameConflict: amber conflict banner between SlotLine and the
            // note/reason area (approve-decline-frames.jsx:113-120, :198-209).
            if (state.hasConflict) {
                Spacer(Modifier.height(Spacing.s3))
                SheetConflictBanner()
            }

            if (state.declineExpanded) {
                Spacer(Modifier.height(Spacing.s4))
                ReasonChips(
                    reasons = DECLINE_REASONS,
                    selected = state.selectedReason,
                    onSelect = onSelectReason,
                )
                // Design FrameDeclineExpanded: "Propose another time" link below chips
                // (approve-decline-frames.jsx:153-155) — calendar-plus icon, PRIMARY blue.
                onProposeTime?.let { propose ->
                    Spacer(Modifier.height(Spacing.s3))
                    ProposeTimeLink(onClick = propose)
                }
            } else if (state.intakeCount > 0) {
                Spacer(Modifier.height(Spacing.s2))
                IntakePreview(state.intakeCount)
            }

            Spacer(Modifier.height(Spacing.s3))
            NoteField(
                value = state.note,
                placeholder = "Add a note (optional)",
                onChange = onSetNote,
            )

            state.errorMessage?.let {
                Spacer(Modifier.height(Spacing.s3))
                InlineError(it)
            }

            Spacer(Modifier.height(Spacing.s4))
            if (state.declineExpanded) {
                DangerFilledButton(
                    label = "Decline request",
                    leadingIcon = PantopusIcon.X,
                    loading = state.submitting,
                    onClick = onDecline,
                    modifier = Modifier.testTag("approveDeclineConfirmDecline"),
                )
            } else {
                // Design: Approve CTA is always PRIMARY blue (primary600), not the pillar
                // accent (approve-decline-frames.jsx:20, :126 — background:PRIMARY).
                PillarFilledButton(
                    label = "Approve",
                    accent = SchedulingPillar.operationalPrimary,
                    leadingIcon = PantopusIcon.Check,
                    loading = state.approving,
                    enabled = !state.submitting,
                    onClick = onApprove,
                    modifier = Modifier.testTag("approveDeclineApprove"),
                )
                Spacer(Modifier.height(Spacing.s2))
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .clickable(enabled = !state.submitting, onClick = onExpandDecline)
                            .testTag("approveDeclineDecline"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Decline",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.error,
                    )
                }
            }
            Spacer(Modifier.height(Spacing.s4))
        }
    }
}

@Composable
private fun RequesterCard(state: ApproveDeclineSheetState) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        BookingAvatar(pillar = state.pillar, initials = state.requesterInitials, size = 40.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = state.requesterName,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = state.requesterSub,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun SlotLine(
    label: String,
    accent: androidx.compose.ui.graphics.Color,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, accent.copy(alpha = 0.25f), RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    38.dp,
                ).clip(RoundedCornerShape(Radii.md)).background(accent.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarClock,
                contentDescription = null,
                size = 19.dp,
                tint = accent,
            )
        }
        Text(
            text = label,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
    }
}

/**
 * Design: IntakePreview is a button element with a chevron-down icon
 * (approve-decline-frames.jsx:96-101). Tapping opens the detail screen's
 * intake card; the handler is a no-op affordance here until a dedicated
 * expand route lands.
 */
@Composable
private fun IntakePreview(count: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClickLabel = "View intake answers") {}
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ClipboardList,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Intake answers",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text(text = "$count answers", fontSize = 11.sp, color = PantopusColors.appTextMuted)
        PantopusIconImage(
            icon = PantopusIcon.ChevronDown,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

/**
 * Design FrameConflict: amber conflict banner inside the approve/decline sheet,
 * rendered between SlotLine and the note/reason area when [ApproveDeclineSheetState.hasConflict]
 * is true. Mirrors the amber ConflictBanner on the detail screen but lives inside
 * the modal (approve-decline-frames.jsx:113-120).
 */
@Composable
private fun SheetConflictBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.TriangleAlert,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.warning,
        )
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

/**
 * Design FrameDeclineExpanded: "Propose another time" text+icon link below the
 * reason chips (approve-decline-frames.jsx:153-155). Calendar-plus icon, PRIMARY blue.
 */
@Composable
private fun ProposeTimeLink(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .clickable(onClickLabel = "Propose another time", onClick = onClick)
                .padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarPlus,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Propose another time",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun ReasonChips(
    reasons: List<String>,
    selected: String?,
    onSelect: (String) -> Unit,
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
            reasons.forEach { reason ->
                val on = reason == selected
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
    }
}

@Composable
private fun InlineError(message: String) {
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

/** Shared read-only "note" field placeholder used by the sheets. */
@Composable
fun NoteField(
    value: String,
    placeholder: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(Spacing.s3),
        contentAlignment = Alignment.TopStart,
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
        }
        androidx.compose.foundation.text.BasicTextField(
            value = value,
            onValueChange = onChange,
            textStyle =
                androidx.compose.ui.text.TextStyle(
                    fontSize = 12.5.sp,
                    color = PantopusColors.appText,
                ),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(PantopusColors.primary600),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
