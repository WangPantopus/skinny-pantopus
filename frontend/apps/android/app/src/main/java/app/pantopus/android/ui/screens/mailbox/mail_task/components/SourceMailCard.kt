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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSampleData
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSourceMail
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 — "Pulled from this mail" card. A section overline over a
 * tappable card (orange accent strip) showing the originating mail's
 * trust + category chips, sender overline, title, snippet, and an "Open
 * original mail" footer row. The whole card taps through to the source
 * mail detail.
 */
@Composable
fun SourceMailCard(
    source: MailTaskSourceMail,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "PULLED FROM THIS MAIL",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s1),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .clickable { onOpen() }
                    .testTag("mailTask_sourceMail"),
        ) {
            Box(modifier = Modifier.width(4.dp).matchParentSize().background(PantopusColors.handyman))
            Column(modifier = Modifier.padding(start = 18.dp, top = Spacing.s3, end = 14.dp, bottom = Spacing.s3)) {
                ChipRow(source = source)
                Spacer(modifier = Modifier.height(7.dp))
                Text(
                    text = source.sender.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                    color = PantopusColors.appTextSecondary,
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = source.title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Spacer(modifier = Modifier.height(Spacing.s1))
                Text(
                    text = source.snippet,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextStrong,
                    lineHeight = 17.sp,
                )
                Spacer(modifier = Modifier.height(10.dp))
                Footer()
            }
        }
    }
}

@Composable
private fun ChipRow(source: MailTaskSourceMail) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(PantopusColors.successBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.success,
            )
            Text(text = "Verified", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.success)
        }
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(PantopusColors.handyman))
            Text(
                text = source.categoryLabel,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(text = source.time, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun Footer() {
    Column {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Spacer(modifier = Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.MailOpen,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.categoryTask,
            )
            Text(
                text = "Open original mail",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.categoryTask,
            )
            Spacer(modifier = Modifier.weight(1f))
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, widthDp = 390)
@Composable
private fun SourceMailCardPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        SourceMailCard(source = requireNotNull(MailTaskSampleData.task().source), onOpen = {})
    }
}
