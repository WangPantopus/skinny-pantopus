@file:Suppress("MagicNumber", "MatchingDeclarationName", "LongParameterList", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Optional trailing badge rendered next to a [DataRow] value. */
data class DataRowFlag(
    val text: String,
    val variant: StatusChipVariant = StatusChipVariant.Neutral,
)

/**
 * Read-only label / value row for detail surfaces. Supports an optional
 * secondary line under the label, monospaced values, a mismatch treatment
 * for conflicting external sources, and an optional trailing status flag.
 *
 * @param label Leading caption.
 * @param value Trailing value.
 * @param sub Optional secondary line under the label.
 * @param mono Whether to render the value in a monospaced face.
 * @param mismatch Whether to tint the row amber with a leading rule and alert icon.
 * @param flag Optional trailing status badge.
 */
@Composable
fun DataRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    sub: String? = null,
    mono: Boolean = false,
    mismatch: Boolean = false,
    flag: DataRowFlag? = null,
    testTag: String? = null,
) {
    val ruleWidth = 3.dp
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .background(if (mismatch) PantopusColors.warningBg else androidx.compose.ui.graphics.Color.Transparent)
                .drawBehind {
                    if (mismatch) {
                        drawRect(
                            color = PantopusColors.warning,
                            size = Size(ruleWidth.toPx(), size.height),
                        )
                    }
                }
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) {
                    contentDescription =
                        buildString {
                            append("$label, $value")
                            if (sub != null) append(", $sub")
                            if (mismatch) append(", Sources disagree")
                            if (flag != null) append(", ${flag.text}")
                        }
                },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.widthIn(min = 96.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = label,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            if (sub != null) {
                Text(
                    text = sub,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        Spacer(Modifier.weight(1f))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (mismatch) {
                PantopusIconImage(
                    icon = PantopusIcon.AlertTriangle,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.warning,
                )
            }
            Text(
                text = value,
                style =
                    if (mono) {
                        PantopusTextStyle.body.copy(fontFamily = FontFamily.Monospace)
                    } else {
                        PantopusTextStyle.small
                    },
                color = PantopusColors.appText,
                textAlign = TextAlign.End,
            )
            if (flag != null) {
                StatusChip(text = flag.text, variant = flag.variant)
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun DataRowPreview() {
    Column(
        modifier =
            Modifier
                .padding(Spacing.s4)
                .background(PantopusColors.appBg),
    ) {
        Column(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s3),
        ) {
            DataRow(label = "Year built", value = "1998", mono = true)
            DataRow(label = "Square footage", value = "2,140 sq ft", sub = "Heated area", mono = true)
            DataRow(label = "Bedrooms", value = "2 · county says 3", sub = "Edited Apr 4, 2026", mono = true, mismatch = true)
            DataRow(label = "HOA", value = "Maplewood Ridge", flag = DataRowFlag("Active", StatusChipVariant.Success))
            DataRow(label = "Parcel ID", value = "48-2291-007", flag = DataRowFlag("Verified", StatusChipVariant.Personal))
        }
    }
}
