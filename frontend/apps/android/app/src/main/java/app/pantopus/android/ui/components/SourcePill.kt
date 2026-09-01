@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Colour tone for a provenance / verification source pill. */
enum class SourcePillTone(
    val background: Color,
    val foreground: Color,
    val a11yWord: String,
) {
    Success(PantopusColors.successBg, PantopusColors.success, "verified"),
    Warning(PantopusColors.warningBg, PantopusColors.warning, "needs review"),
    Error(PantopusColors.errorBg, PantopusColors.error, "conflict"),
    Neutral(PantopusColors.appSurfaceSunken, PantopusColors.appTextSecondary, "neutral"),
}

/**
 * Small status pill for source verification rows.
 *
 * @param text Visible pill label.
 * @param tone Semantic tint.
 * @param icon Optional leading Pantopus icon.
 */
@Composable
fun SourcePill(
    text: String,
    tone: SourcePillTone = SourcePillTone.Neutral,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "$text, ${tone.a11yWord}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = Radii.lg,
                tint = tone.foreground,
            )
        }
        Text(text = text, style = PantopusTextStyle.overline, color = tone.foreground)
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun SourcePillPreview() {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.padding(Spacing.s4)) {
        SourcePill("Verified", SourcePillTone.Success, icon = PantopusIcon.Check)
        SourcePill("Needs review", SourcePillTone.Warning, icon = PantopusIcon.AlertTriangle)
        SourcePill("Conflict", SourcePillTone.Error, icon = PantopusIcon.AlertCircle)
    }
}
