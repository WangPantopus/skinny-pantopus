@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
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

/**
 * Backend `workflowSchema` caps `offset_minutes` at 525600 (365 days —
 * backend/routes/scheduling.js:1081); the per-unit stepper ceiling keeps the
 * resolved minutes within it.
 */
private fun maxOffsetAmount(unit: ReminderPreset.Unit): Int =
    when (unit) {
        ReminderPreset.Unit.Minutes -> 999
        ReminderPreset.Unit.Hours -> 8760
        ReminderPreset.Unit.Days -> 365
    }

/**
 * Stream A16 — H4 Trigger Picker (local sheet, no route). Chooses what fires a
 * workflow: a lifecycle radio list (Created / Cancelled / Rescheduled / Started /
 * Ended) and, for the two offset triggers, a before/after timing builder. Maps
 * exactly to the backend triggers — `Started` → `before_start`, `Ended` →
 * `after_end`; the instant triggers carry no offset. Returns the chosen
 * [WorkflowTrigger] + offset minutes to H3. Pure local state — no networking.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TriggerPickerSheet(
    trigger: WorkflowTrigger,
    offsetMinutes: Int,
    accent: Color,
    onApply: (WorkflowTrigger, Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selected by remember { mutableStateOf(trigger) }
    val (initialAmount, initialUnit) = remember(offsetMinutes) { decomposeOffset(offsetMinutes) }
    var amount by remember { mutableStateOf(initialAmount) }
    var unit by remember { mutableStateOf(initialUnit) }

    val usesOffset = selected.usesOffset
    val resolvedMinutes = amount * unit.multiplier
    val isInvalid = usesOffset && amount <= 0

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        dragHandle = null,
    ) {
        Column(modifier = Modifier.fillMaxWidth().testTag("scheduling.workflows.triggerPicker")) {
            AutoSheetHeader(title = "When should this run?", onClose = onDismiss)
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                AutoOverline(text = "Lifecycle", modifier = Modifier.padding(horizontal = 2.dp))
                AutoCard(horizontal = 14.dp, vertical = Spacing.s0) {
                    val triggers = WorkflowTrigger.entries
                    triggers.forEachIndexed { idx, t ->
                        AutoRadioRow(
                            label = t.lifecycleLabel,
                            sub = t.lifecycleDescription,
                            selected = selected == t,
                            accent = accent,
                            icon = t.icon,
                            onTap = { selected = t },
                        )
                        if (idx < triggers.size - 1) AutoRowDivider()
                    }
                }
                if (usesOffset) {
                    AutoOverline(text = "Timing", modifier = Modifier.padding(top = Spacing.s2, start = 2.dp))
                    AutoCard(horizontal = 14.dp, vertical = 12.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            AutoStepper(
                                value = amount,
                                accent = accent,
                                isInvalid = isInvalid,
                                canDecrement = amount > 0,
                                canIncrement = amount < maxOffsetAmount(unit),
                                onDecrement = { amount = (amount - 1).coerceAtLeast(0) },
                                onIncrement = { amount = (amount + 1).coerceAtMost(maxOffsetAmount(unit)) },
                            )
                            AutoSegmented(
                                options = ReminderPreset.Unit.entries.map { unitShort(it) },
                                selectedIndex = ReminderPreset.Unit.entries.indexOf(unit),
                                accent = accent,
                                onSelect = {
                                    unit = ReminderPreset.Unit.entries[it]
                                    amount = amount.coerceAtMost(maxOffsetAmount(unit))
                                },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
                SummaryPill(text = summaryText(selected, usesOffset, resolvedMinutes, isInvalid), isInvalid = isInvalid, accent = accent)
            }
            AutoSheetFooter {
                AutoPrimaryButton(
                    title = "Done",
                    isDisabled = isInvalid,
                    onClick = { onApply(selected, if (usesOffset) resolvedMinutes else 0) },
                )
            }
        }
    }
}

@Composable
private fun SummaryPill(
    text: String,
    isInvalid: Boolean,
    accent: Color,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isInvalid) PantopusColors.errorBg else PantopusColors.primary50)
                .padding(horizontal = Spacing.s3, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 14.dp,
            tint = if (isInvalid) PantopusColors.error else accent,
        )
        Text(
            text = text,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isInvalid) PantopusColors.error else PantopusColors.appTextStrong,
        )
    }
}

private fun summaryText(
    trigger: WorkflowTrigger,
    usesOffset: Boolean,
    resolvedMinutes: Int,
    isInvalid: Boolean,
): String = if (isInvalid) "Pick a number greater than zero" else trigger.summary(if (usesOffset) resolvedMinutes else 0)

private fun unitShort(unit: ReminderPreset.Unit): String =
    when (unit) {
        ReminderPreset.Unit.Minutes -> "min"
        ReminderPreset.Unit.Hours -> "hour"
        ReminderPreset.Unit.Days -> "day"
    }

/** Largest whole unit that represents `minutes` (60 → 1 hour, 1440 → 1 day). */
private fun decomposeOffset(minutes: Int): Pair<Int, ReminderPreset.Unit> {
    val m = minutes.coerceAtLeast(0)
    return when {
        m == 0 -> 1 to ReminderPreset.Unit.Hours
        m % 1440 == 0 -> (m / 1440) to ReminderPreset.Unit.Days
        m % 60 == 0 -> (m / 60) to ReminderPreset.Unit.Hours
        else -> m to ReminderPreset.Unit.Minutes
    }
}
