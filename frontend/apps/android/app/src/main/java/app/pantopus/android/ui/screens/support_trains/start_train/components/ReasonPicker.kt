@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.start_train.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainReason
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.11 — Six-tile reason picker for step 1. Renders
 * `StartSupportTrainReason.entries` as a 3×2 grid: everyday-help reasons on
 * the first row (meal train · ride · errand), life moments on the second
 * (surgery · baby · loss). The selected tile fills with the warm-amber
 * identity accent.
 */
@Composable
internal fun ReasonPicker(
    selected: StartSupportTrainReason,
    onSelect: (StartSupportTrainReason) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "WHAT'S THE OCCASION?",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        StartSupportTrainReason.entries.chunked(3).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                row.forEach { reason ->
                    ReasonTile(
                        reason = reason,
                        isSelected = reason == selected,
                        onClick = { onSelect(reason) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun ReasonTile(
    reason: StartSupportTrainReason,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            modifier
                .heightIn(min = 80.dp)
                .clip(shape)
                .background(if (isSelected) PantopusColors.warmAmberBg else PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.warmAmber else PantopusColors.appBorder,
                    shape = shape,
                )
                .clickable { onClick() }
                .padding(vertical = Spacing.s3, horizontal = Spacing.s1)
                .testTag("startSupportTrainReason_${reason.wire}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (isSelected) PantopusColors.warmAmber else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = reason.icon,
                contentDescription = null,
                size = 15.dp,
                tint = if (isSelected) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
            )
        }
        Text(
            text = reason.title,
            style = PantopusTextStyle.caption.copy(fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold),
            color = if (isSelected) PantopusColors.warmAmber else PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
    }
}
