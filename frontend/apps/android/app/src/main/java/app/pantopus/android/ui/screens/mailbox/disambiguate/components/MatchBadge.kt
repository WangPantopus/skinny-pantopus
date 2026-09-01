@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.disambiguate.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.disambiguate.MailMatchTier
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.15 Disambiguate — tiny uppercase badge tagging a candidate's
 * OCR-vs-record match strength: Strong match (success), Partial (amber),
 * Weak (neutral). Mirrors the iOS `MatchBadge`.
 */
@Composable
fun MatchBadge(
    tier: MailMatchTier,
    percent: Int,
    modifier: Modifier = Modifier,
) {
    val palette = matchPalette(tier)
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(palette.background)
                .border(1.dp, palette.border, RoundedCornerShape(Radii.xs))
                .padding(horizontal = Spacing.s2, vertical = 2.dp)
                .semantics { contentDescription = "${tier.word}, $percent percent match" },
    ) {
        Text(
            text = "${tier.word} · $percent%".uppercase(),
            style =
                TextStyle(
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.1.sp,
                ),
            color = palette.foreground,
        )
    }
}

private data class MatchPalette(val background: Color, val foreground: Color, val border: Color)

private fun matchPalette(tier: MailMatchTier): MatchPalette =
    when (tier) {
        MailMatchTier.Strong ->
            MatchPalette(PantopusColors.successBg, PantopusColors.success, PantopusColors.successLight)
        MailMatchTier.Partial ->
            MatchPalette(PantopusColors.warmAmberBg, PantopusColors.warmAmber, PantopusColors.warningLight)
        MailMatchTier.Weak ->
            MatchPalette(PantopusColors.appSurfaceSunken, PantopusColors.appTextSecondary, PantopusColors.appBorder)
    }
