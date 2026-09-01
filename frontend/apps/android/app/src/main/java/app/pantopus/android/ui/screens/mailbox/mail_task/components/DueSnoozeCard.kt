@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskDue
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSnoozeOption
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 — the due-date + quick-snooze card (open frame). A calendar
 * block (accent month header + day numeral + weekday), the due label +
 * reminder sub-line + a "Closes Fri 5:00 PM" caption, and a 3-up
 * quick-snooze row (This evening / Tomorrow AM / Pick a time).
 */
@Composable
fun DueSnoozeCard(
    due: MailTaskDue,
    options: List<MailTaskSnoozeOption>,
    onSnooze: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    MailTaskAccentCard(modifier = modifier.testTag("mailTask_dueCard")) {
        Column {
            Header(due = due)
            Spacer(modifier = Modifier.height(Spacing.s3))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                CalendarBlock(due = due)
                DueDetail(due = due)
            }
            // Quick-snooze options have no backend source on the live task
            // fetch; the row only renders when seeded (sample previews).
            if (options.isNotEmpty()) {
                Spacer(modifier = Modifier.height(Spacing.s3))
                SnoozeRow(options = options, onSnooze = onSnooze)
            }
        }
    }
}

@Composable
private fun Header(due: MailTaskDue) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = "DUE DATE",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Box(
                modifier =
                    Modifier
                        .width(6.dp)
                        .height(6.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.error),
            )
            Text(text = due.left, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.error)
        }
    }
}

@Composable
private fun CalendarBlock(due: MailTaskDue) {
    Column(
        modifier =
            Modifier
                .width(58.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = due.month,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp,
            color = PantopusColors.appTextInverse,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.categoryTask)
                    .padding(vertical = 3.dp),
        )
        Column(
            modifier = Modifier.padding(top = Spacing.s1, bottom = 5.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(text = due.day, fontSize = 24.sp, fontWeight = FontWeight.Black, color = PantopusColors.appText)
            Text(
                text = due.weekday,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun DueDetail(due: MailTaskDue) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = "${due.label} · ${due.time}",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.Bell,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(text = due.reminderLabel, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
        Text(
            text = due.closesLabel,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun SnoozeRow(
    options: List<MailTaskSnoozeOption>,
    onSnooze: (String) -> Unit,
) {
    Column {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Spacer(modifier = Modifier.height(Spacing.s3))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            options.forEach { option ->
                SnoozeButton(option = option, onSnooze = onSnooze, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SnoozeButton(
    option: MailTaskSnoozeOption,
    onSnooze: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .clickable { onSnooze(option.id) }
                .padding(horizontal = Spacing.s1, vertical = Spacing.s2)
                .testTag("mailTask_snooze_${option.id}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = option.icon,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.categoryTask,
        )
        Text(
            text = option.label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = option.whenLabel ?: " ",
            fontSize = 9.5.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}
