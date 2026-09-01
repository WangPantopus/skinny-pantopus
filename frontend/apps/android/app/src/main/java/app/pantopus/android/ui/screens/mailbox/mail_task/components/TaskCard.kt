@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.mail_task.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskContent
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.roundToInt

/**
 * A17.12 — the task hero. An accent-striped card carrying the priority
 * flag (or a "Completed" pill when done), an "Auto-created" sparkles
 * eyebrow, a 26dp checkbox + title (struck through when done), the case
 * reference, a 1-of-3 progress bar, and a due/done chip.
 */
@Composable
fun TaskCard(
    content: MailTaskContent,
    modifier: Modifier = Modifier,
) {
    val done = content.isDone
    val accent = if (done) PantopusColors.success else PantopusColors.categoryTask

    MailTaskAccentCard(accent = accent, modifier = modifier.testTag("mailTask_taskCard")) {
        Column(modifier = Modifier.padding(start = 6.dp)) {
            TopRow(content = content)
            Spacer(modifier = Modifier.height(Spacing.s3))
            TitleRow(content = content)
            // The step checklist has no backend source on the live path, so
            // hide the progress bar when there are no subtasks.
            if (content.totalSteps > 0) {
                Spacer(modifier = Modifier.height(14.dp))
                Progress(content = content, accent = accent)
            }
            Spacer(modifier = Modifier.height(14.dp))
            DueChip(content = content)
        }
    }
}

@Composable
private fun TopRow(content: MailTaskContent) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (content.isDone) {
            Pill(
                icon = PantopusIcon.CheckCircle,
                label = "Completed",
                background = PantopusColors.successBg,
                foreground = PantopusColors.success,
            )
        } else {
            Pill(
                icon = PantopusIcon.Flag,
                label = content.priority.label,
                background = content.priority.background,
                foreground = content.priority.foreground,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Auto-created",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun Pill(
    icon: PantopusIcon,
    label: String,
    background: Color,
    foreground: Color,
) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = foreground)
        Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = foreground)
    }
}

@Composable
private fun TitleRow(content: MailTaskContent) {
    Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Checkbox(done = content.isDone)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = content.title,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                textDecoration = if (content.isDone) TextDecoration.LineThrough else TextDecoration.None,
            )
            Text(
                text = content.reference,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun Checkbox(done: Boolean) {
    Box(
        modifier =
            Modifier
                .padding(top = 1.dp)
                .size(26.dp)
                .clip(RoundedCornerShape(Radii.md))
                .then(
                    if (done) {
                        Modifier.background(PantopusColors.success)
                    } else {
                        Modifier
                            .background(PantopusColors.appSurface)
                            .border(2.dp, PantopusColors.categoryTask, RoundedCornerShape(Radii.md))
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (done) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun Progress(
    content: MailTaskContent,
    accent: Color,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "${content.finishedSteps} of ${content.totalSteps} steps ${if (content.isDone) "done" else "complete"}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "${(content.progress * 100).roundToInt()}%",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        MailTaskProgressTrack(progress = content.progress, accent = accent)
    }
}

/** Simple horizontal progress track — accent fill over a sunken rail. */
@Composable
fun MailTaskProgressTrack(
    progress: Float,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(7.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(progress.coerceIn(0f, 1f))
                    .height(7.dp)
                    .clip(CircleShape)
                    .background(accent),
        )
    }
}

@Composable
private fun DueChip(content: MailTaskContent) {
    if (content.isDone) {
        val completion = content.completion
        Chip(
            icon = PantopusIcon.CheckCircle,
            tint = PantopusColors.success,
            background = PantopusColors.successBg,
            border = PantopusColors.successLight,
            bold = completion?.stamp ?: "Completed",
            trailing = completion?.let { "· ${it.note}" }.orEmpty(),
        )
    } else {
        // No backend due date → no chip rather than a faked one.
        val due = content.due
        if (due != null) {
            Chip(
                icon = PantopusIcon.Clock,
                tint = PantopusColors.error,
                background = PantopusColors.errorBg,
                border = PantopusColors.errorLight,
                bold = due.label,
                trailing =
                    "· ${titleCase(due.weekday)} ${titleCase(due.month)} " +
                        "${due.day} · ${due.time}",
            )
        }
    }
}

@Composable
private fun Chip(
    icon: PantopusIcon,
    tint: Color,
    background: Color,
    border: Color,
    bold: String,
    trailing: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(background)
                .border(1.dp, border, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = tint)
        Text(text = bold, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = tint)
        Text(text = trailing, fontSize = 12.sp, color = tint, maxLines = 1)
    }
}

/** White card with a 4dp leading accent strip — the shared task shell. */
@Composable
fun MailTaskAccentCard(
    modifier: Modifier = Modifier,
    accent: Color? = null,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        if (accent != null) {
            Box(
                modifier =
                    Modifier
                        .width(4.dp)
                        .matchParentSize()
                        .background(accent),
            )
        }
        Box(modifier = Modifier.padding(14.dp)) { content() }
    }
}

/** "FRI" → "Fri", "MAY" → "May". */
private fun titleCase(value: String): String = value.lowercase().replaceFirstChar { it.uppercaseChar() }

@Preview(showBackground = true, widthDp = 390, name = "Open")
@Composable
private fun TaskCardOpenPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        TaskCard(content = MailTaskSampleData.task())
    }
}

@Preview(showBackground = true, widthDp = 390, name = "Done")
@Composable
private fun TaskCardDonePreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        TaskCard(content = MailTaskSampleData.task(done = true))
    }
}
