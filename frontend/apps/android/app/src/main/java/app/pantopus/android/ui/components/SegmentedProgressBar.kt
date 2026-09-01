@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Segmented wizard-style progress bar.
 *
 * @param currentStep 1-indexed position. Clamped to `0..totalSteps`.
 * @param totalSteps Total segments; must be > 0.
 * @param fillColor Colour used for filled segments. Defaults to
 *     [PantopusColors.primary600] so existing call sites render
 *     identically; `WizardShell` passes `identity.accent` to paint
 *     home / business / warm-amber variants.
 */
@Composable
fun SegmentedProgressBar(
    currentStep: Int,
    totalSteps: Int,
    modifier: Modifier = Modifier,
    fillColor: Color = PantopusColors.primary600,
) {
    val total = totalSteps.coerceAtLeast(1)
    val done = currentStep.coerceIn(0, total)

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Step $done of $total" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        repeat(total) { index ->
            Spacer(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(6.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (index < done) fillColor else PantopusColors.appSurfaceSunken,
                        ),
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 120)
@Composable
private fun SegmentedProgressBarPreview() {
    androidx.compose.foundation.layout.Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.padding(Spacing.s4),
    ) {
        SegmentedProgressBar(currentStep = 0, totalSteps = 4)
        SegmentedProgressBar(currentStep = 2, totalSteps = 4)
        SegmentedProgressBar(currentStep = 4, totalSteps = 4)
    }
}
