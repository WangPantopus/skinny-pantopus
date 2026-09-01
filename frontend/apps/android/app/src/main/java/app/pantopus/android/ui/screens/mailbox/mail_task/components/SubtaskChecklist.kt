@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.mail_task.components

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSampleData
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSubtask
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 — the tappable subtask checklist. A "STEPS" header with an
 * "Add step" affordance over a divider-separated list of rows. Each row
 * has a 20dp checkbox (success-green when checked), a label struck
 * through when complete, and a hint shown only while incomplete. Taps
 * persist to local state via [onToggle].
 */
@Composable
fun SubtaskChecklist(
    subtasks: List<MailTaskSubtask>,
    allDone: Boolean,
    onToggle: (String) -> Unit,
    onAddStep: () -> Unit,
    modifier: Modifier = Modifier,
) {
    MailTaskAccentCard(modifier = modifier.testTag("mailTask_checklist")) {
        Column {
            Header(onAddStep = onAddStep)
            subtasks.forEachIndexed { index, subtask ->
                if (index > 0) {
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
                }
                ChecklistRow(subtask = subtask, allDone = allDone, onToggle = onToggle)
            }
        }
    }
}

@Composable
private fun Header(onAddStep: () -> Unit) {
    Row(
        modifier = Modifier.padding(bottom = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "STEPS",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.weight(1f))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .clickable { onAddStep() }
                    .testTag("mailTask_checklist_addStep")
                    .padding(2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.categoryTask,
            )
            Text(text = "Add step", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.categoryTask)
        }
    }
}

@Composable
private fun ChecklistRow(
    subtask: MailTaskSubtask,
    allDone: Boolean,
    onToggle: (String) -> Unit,
) {
    val checked = allDone || subtask.isDone
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = !allDone) { onToggle(subtask.id) }
                .padding(vertical = 11.dp)
                .testTag("mailTask_step_${subtask.id}"),
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .padding(top = 1.dp)
                    .size(20.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .then(
                        if (checked) {
                            Modifier.background(PantopusColors.success)
                        } else {
                            Modifier
                                .background(PantopusColors.appSurface)
                                .border(2.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.sm))
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = subtask.label,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (checked) PantopusColors.appTextSecondary else PantopusColors.appText,
                textDecoration = if (checked) TextDecoration.LineThrough else TextDecoration.None,
            )
            if (!checked) {
                Text(text = subtask.hint, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, widthDp = 390)
@Composable
private fun SubtaskChecklistPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        SubtaskChecklist(
            subtasks = MailTaskSampleData.task().subtasks,
            allDone = false,
            onToggle = {},
            onAddStep = {},
        )
    }
}
