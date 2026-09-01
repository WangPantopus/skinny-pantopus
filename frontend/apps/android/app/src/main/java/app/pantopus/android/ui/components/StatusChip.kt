@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

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
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Semantic variant for [StatusChip]. */
enum class StatusChipVariant(
    val background: Color,
    val foreground: Color,
    val a11yWord: String,
) {
    Success(PantopusColors.successBg, PantopusColors.success, "success"),
    Warning(PantopusColors.warningBg, PantopusColors.warning, "warning"),
    ErrorVariant(PantopusColors.errorBg, PantopusColors.error, "error"),
    Info(PantopusColors.infoBg, PantopusColors.info, "info"),
    Personal(PantopusColors.personalBg, PantopusColors.personal, "personal"),
    Home(PantopusColors.homeBg, PantopusColors.home, "home"),
    Business(PantopusColors.businessBg, PantopusColors.business, "business"),
    Neutral(PantopusColors.appSurfaceSunken, PantopusColors.appTextSecondary, "neutral"),
}

/**
 * Pill chip with tinted background + foreground.
 *
 * @param text Visible label.
 * @param variant Semantic tint.
 * @param icon Optional leading Pantopus icon.
 */
@Composable
fun StatusChip(
    text: String,
    variant: StatusChipVariant = StatusChipVariant.Neutral,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(variant.background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "$text, ${variant.a11yWord}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = variant.foreground,
            )
        }
        Text(text = text, style = PantopusTextStyle.caption, color = variant.foreground)
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun StatusChipPreview() {
    androidx.compose.foundation.layout.Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.padding(Spacing.s4),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            StatusChip("Paid", StatusChipVariant.Success, icon = PantopusIcon.Check)
            StatusChip("Due", StatusChipVariant.Warning)
            StatusChip("Overdue", StatusChipVariant.ErrorVariant, icon = PantopusIcon.AlertCircle)
            StatusChip("Info", StatusChipVariant.Info)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            StatusChip("Personal", StatusChipVariant.Personal)
            StatusChip("Home", StatusChipVariant.Home)
            StatusChip("Business", StatusChipVariant.Business)
            StatusChip("Neutral")
        }
    }
}
