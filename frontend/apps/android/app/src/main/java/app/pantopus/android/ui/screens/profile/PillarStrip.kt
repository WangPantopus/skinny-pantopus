@file:Suppress("MagicNumber", "MatchingDeclarationName", "LongParameterList", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Profile / persona "strength" strip: a labelled percentage with a
 * proportional fill bar. Used by the Professional Profile and Edit Persona
 * surfaces. `tint` accepts an identity pillar colour (Personal / Home /
 * Business) and defaults to primary.
 *
 * @param title Leading label (e.g. "Profile strength").
 * @param percent 0–100; values outside the range are clamped.
 * @param tint Fill + percentage colour.
 * @param caption Optional hint rendered under the bar.
 */
@Composable
fun PillarStrip(
    title: String,
    percent: Int,
    modifier: Modifier = Modifier,
    tint: Color = PantopusColors.primary600,
    caption: String? = null,
    testTag: String? = null,
) {
    val clamped = percent.coerceIn(0, 100)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .semantics(mergeDescendants = true) {
                    contentDescription =
                        if (caption != null) "$title, $clamped percent. $caption" else "$title, $clamped percent"
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = title, style = PantopusTextStyle.small, color = PantopusColors.appText)
            Spacer(Modifier.weight(1f))
            Text(text = "$clamped%", style = PantopusTextStyle.small, color = tint)
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(Spacing.s2)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(clamped / 100f)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(tint),
            )
        }
        if (caption != null) {
            Text(text = caption, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun PillarStripPreview() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        PillarStrip(
            title = "Profile strength",
            percent = 82,
            tint = PantopusColors.business,
            caption = "Add service areas to reach 100%",
        )
        PillarStrip(title = "Personal", percent = 45, tint = PantopusColors.personal)
        PillarStrip(title = "Home", percent = 100, tint = PantopusColors.home, caption = "Complete")
    }
}
