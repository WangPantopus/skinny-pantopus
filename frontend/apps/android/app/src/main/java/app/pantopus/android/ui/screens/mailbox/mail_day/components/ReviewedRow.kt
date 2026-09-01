@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_day.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_day.MailDayRoutedTint
import app.pantopus.android.ui.screens.mailbox.mail_day.ReviewedMailAction
import app.pantopus.android.ui.screens.mailbox.mail_day.ReviewedMailDayItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.16 — compact reviewed-today row. 36dp MailThumb (dimmed for
 * junked / returned actions) + label (line-through for junked) + meta
 * line carrying the routed-to chip / action label + time. The latest
 * row carries an [UndoCountdown] chip in the trailing slot; the earlier
 * rows fall back to a small icon-only undo button.
 */
@Composable
fun ReviewedRow(
    item: ReviewedMailDayItem,
    isLast: Boolean,
    onUndo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val isJunked = item.action == ReviewedMailAction.Junked
    val isReturned = item.action == ReviewedMailAction.Returned
    val dimThumb = isJunked || isReturned
    val rowBackground =
        if (item.undoCountdown != null) PantopusColors.warningBg else Color.Transparent

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(rowBackground)
                .testTag("mailDayReviewed.${item.id}")
                .semantics(mergeDescendants = true) {
                    contentDescription = item.accessibilityLabel()
                },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = 10.dp),
        ) {
            MailThumb(kind = item.kind, size = 36.dp, dim = dimThumb)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text(
                    text = item.label,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    textDecoration = if (isJunked) TextDecoration.LineThrough else null,
                    overflow = TextOverflow.Ellipsis,
                    maxLines = 1,
                )
                MetaLine(item = item)
            }
            if (item.undoCountdown != null) {
                UndoCountdown(seconds = item.undoCountdown, onClick = onUndo)
            } else {
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clickable(onClick = onUndo)
                            .testTag("mailDayReviewedUndo.${item.id}")
                            .semantics { contentDescription = "Undo" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.RefreshCw,
                        contentDescription = null,
                        size = 14.dp,
                        strokeWidth = 2.2f,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        if (!isLast) {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        }
    }
}

@Composable
private fun MetaLine(item: ReviewedMailDayItem) {
    val (icon, iconColor) =
        when (item.action) {
            ReviewedMailAction.Routed -> PantopusIcon.ArrowRight to PantopusColors.appTextStrong
            ReviewedMailAction.Junked -> PantopusIcon.Trash2 to PantopusColors.error
            ReviewedMailAction.Returned -> PantopusIcon.RefreshCw to PantopusColors.appTextSecondary
        }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 10.dp,
            strokeWidth = 2.4f,
            tint = iconColor,
        )
        when (item.action) {
            ReviewedMailAction.Routed -> {
                val routedTo = item.routedTo
                val tint = item.routedTint
                if (routedTo != null && tint != null) {
                    RoutedChip(label = routedTo, tint = tint)
                }
            }
            ReviewedMailAction.Junked ->
                Text(
                    text = "Junked",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            ReviewedMailAction.Returned ->
                Text(
                    text = "Returned to sender",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
        }
        Text(
            text = "· ${item.whenLabel}",
            fontSize = 11.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun RoutedChip(
    label: String,
    tint: MailDayRoutedTint,
) {
    Text(
        text = label,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appText,
        modifier =
            Modifier
                .background(tint.background, shape = CircleShape)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    )
}

private fun ReviewedMailDayItem.accessibilityLabel(): String =
    when (action) {
        ReviewedMailAction.Routed -> "$label. Routed to ${routedTo ?: "—"}, $whenLabel."
        ReviewedMailAction.Junked -> "$label. Junked, $whenLabel."
        ReviewedMailAction.Returned -> "$label. Returned to sender, $whenLabel."
    }
