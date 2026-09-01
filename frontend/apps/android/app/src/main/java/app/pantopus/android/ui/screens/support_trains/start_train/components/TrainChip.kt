@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.start_train.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.11 — Warm-amber "Support train" identity pill anchoring step 1 of
 * the wizard. Uses the warm-amber identity pillar so the chip reads as the
 * same accent the shell paints the progress rail and primary CTA in.
 */
@Composable
internal fun TrainChip() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warmAmberBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag("startSupportTrainChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Heart,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.warmAmber,
        )
        Text(
            text = "SUPPORT TRAIN",
            style = PantopusTextStyle.overline,
            color = PantopusColors.warmAmber,
        )
    }
}
