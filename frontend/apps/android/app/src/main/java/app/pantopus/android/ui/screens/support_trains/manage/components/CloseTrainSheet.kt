@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.manage.CloseTrainSheetContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANAGE_TRAIN_CLOSE_SHEET_TAG: String = "manageTrainCloseSheet"
const val MANAGE_TRAIN_CLOSE_SHEET_SCRIM_TAG: String = "manageTrainCloseSheetScrim"
const val MANAGE_TRAIN_CLOSE_SHEET_CANCEL_TAG: String = "manageTrainCloseSheetCancel"
const val MANAGE_TRAIN_CLOSE_SHEET_CONFIRM_TAG: String = "manageTrainCloseSheetConfirm"
const val MANAGE_TRAIN_THANK_YOU_FIELD_TAG: String = "manageTrainThankYouField"

/**
 * The destructive Close-train confirmation bottom sheet. Mirrors the
 * iOS [CloseTrainSheet] composition: red archive header + 3-cell
 * summary card + italic recipient testimonial + 66dp thank-you note
 * textarea + Cancel/Close action row in a 1:1.4 ratio.
 */
@Composable
fun CloseTrainSheet(
    content: CloseTrainSheetContent,
    thankYouNote: String,
    onUpdateThankYouNote: (String) -> Unit,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(
                    start = Spacing.s4,
                    end = Spacing.s4,
                    top = Spacing.s4,
                    bottom = Spacing.s5,
                )
                .testTag(MANAGE_TRAIN_CLOSE_SHEET_TAG),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Header(daysEarlyLabel = content.daysEarlyLabel)
        SummaryCard(content = content)
        ThankYouBlock(
            value = thankYouNote,
            onValueChange = onUpdateThankYouNote,
        )
        ActionRow(onCancel = onCancel, onConfirm = onConfirm)
    }
}

@Composable
private fun Header(daysEarlyLabel: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(PantopusColors.errorBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Archive,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.error,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Close support train?",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = daysEarlyLabel,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun SummaryCard(content: CloseTrainSheetContent) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceMuted)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "WHAT HELPERS WILL SEE",
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            SummaryStat(value = content.mealsDelivered, label = "Meals delivered", modifier = Modifier.weight(1f))
            SummaryStat(value = content.neighborsHelped, label = "Neighbors helped", modifier = Modifier.weight(1f))
            SummaryStat(value = content.coverageDays, label = "Of coverage", modifier = Modifier.weight(1f))
        }
        Text(
            text = content.recipientQuote,
            fontSize = 12.5.sp,
            fontStyle = FontStyle.Italic,
            color = PantopusColors.appTextStrong,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        )
    }
}

@Composable
private fun SummaryStat(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = value,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = label,
            fontSize = 10.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ThankYouBlock(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Thank-you note (optional)",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(66.dp)
                    .testTag(MANAGE_TRAIN_THANK_YOU_FIELD_TAG),
            placeholder = {
                Text(
                    text = "A few words for everyone who showed up…",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                )
            },
            textStyle = TextStyle(fontSize = 13.5.sp, color = PantopusColors.appText),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                ),
        )
    }
}

@Composable
private fun ActionRow(
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    // The design source gives the destructive CTA `flex: 1.4` while Cancel
    // sits at `flex: 1`. Use `BoxWithConstraints` to compute the explicit
    // widths from the row's measured width minus the inter-button gap.
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2)) {
        val gap = Spacing.s2
        val totalFlex = 1f + 1.4f
        val cancelWidth = (maxWidth - gap) * (1f / totalFlex)
        val confirmWidth = (maxWidth - gap) * (1.4f / totalFlex)
        Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
            Box(
                modifier =
                    Modifier
                        .width(cancelWidth)
                        .height(46.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                        .clickable(onClick = onCancel)
                        .testTag(MANAGE_TRAIN_CLOSE_SHEET_CANCEL_TAG),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Cancel",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
            Row(
                modifier =
                    Modifier
                        .width(confirmWidth)
                        .height(46.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.error)
                        .clickable(onClick = onConfirm)
                        .testTag(MANAGE_TRAIN_CLOSE_SHEET_CONFIRM_TAG),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Archive,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Spacer(modifier = Modifier.width(Spacing.s1))
                Text(
                    text = "Close & thank",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
