@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import app.pantopus.android.ui.components.DestructiveButton
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val NO_SHOW_TAG = "scheduling.markNoShow"

/** One candidate (a single booking row) for the no-show flow. */
data class NoShowTarget(
    val bookingId: String,
    val name: String,
)

/** The full state the host VM drives the [NoShowSheet] from. */
data class NoShowSheetState(
    val targets: List<NoShowTarget>,
    val selectedIds: Set<String>,
    val note: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
) {
    val isGroup: Boolean get() = targets.size > 1
    val canConfirm: Boolean get() = selectedIds.isNotEmpty() && !submitting
}

/**
 * E6 Mark No-Show — a centered confirmation dialog (EventDetail-delete DNA), not
 * a tall sheet. 1:1 shows a calm body; a group booking swaps in a multi-select
 * who-no-showed roster + optional note. Only presented after the booking's start
 * time; on confirm it marks each selected booking no-show and feeds the
 * post-meeting follow-up.
 */
@Composable
internal fun NoShowSheet(
    state: NoShowSheetState,
    onToggle: (String) -> Unit,
    onNoteChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    accent: Color = PantopusColors.primary600,
) {
    Dialog(onDismissRequest = { if (!state.submitting) onDismiss() }) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = 320.dp)
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s5)
                    .testTag(NO_SHOW_TAG),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            ExtrasIconDisc(icon = PantopusIcon.UserX, tint = PantopusColors.error, background = PantopusColors.errorBg)
            Text(
                text = if (state.isGroup) "Who didn't show?" else "Mark as no-show?",
                style = ExtrasType.header,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
            Text(
                text =
                    if (state.isGroup) {
                        "Select the attendees who didn't attend."
                    } else {
                        "This closes the booking. You can still message the invitee or send a rebook link afterward."
                    },
                style = if (state.isGroup) ExtrasType.body125 else ExtrasType.body13,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )

            if (state.isGroup) {
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    state.targets.forEach { target ->
                        NoShowAttendeeRow(
                            target = target,
                            selected = target.bookingId in state.selectedIds,
                            onClick = { onToggle(target.bookingId) },
                            accent = accent,
                        )
                    }
                }
                ExtrasInputField(
                    value = state.note,
                    onValueChange = onNoteChange,
                    placeholder = "Add a note (optional)",
                    leadingIcon = PantopusIcon.MessageSquare,
                )
            }

            state.error?.let { ExtrasInlineError(message = it, centered = true) }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                GhostButton(title = "Keep open", onClick = onDismiss, modifier = Modifier.weight(1f), isEnabled = !state.submitting)
                DestructiveButton(
                    title = if (state.isGroup) "Mark ${state.selectedIds.size} as no-show" else "Mark no-show",
                    onClick = onConfirm,
                    modifier = Modifier.weight(1f),
                    isLoading = state.submitting,
                    isEnabled = state.canConfirm,
                )
            }
        }
    }
}

@Composable
private fun NoShowAttendeeRow(
    target: NoShowTarget,
    selected: Boolean,
    onClick: () -> Unit,
    accent: Color = PantopusColors.primary600,
) {
    val border = if (selected) PantopusColors.error else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) PantopusColors.errorBg else PantopusColors.appSurface)
                .border(if (selected) 1.5.dp else 1.dp, border, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("$NO_SHOW_TAG.attendee.${target.bookingId}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        InitialsAvatar(name = target.name, diameter = 34.dp, accent = accent)
        Text(
            text = target.name,
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(if (selected) PantopusColors.error else PantopusColors.appSurface)
                    .border(1.5.dp, if (selected) PantopusColors.error else PantopusColors.appBorderStrong, RoundedCornerShape(Radii.sm)),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextInverse)
            }
        }
    }
}
