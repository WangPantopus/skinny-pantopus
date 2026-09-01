@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.disambiguate.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.EnvelopeOcrTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.15 Disambiguate — strip below the scanned-envelope card summarising the
 * OCR read. `Clean` tone (success bg + check + reassurance) when the scan is
 * clean; `Unclear` tone (amber bg + alert + re-scan suggestion) otherwise.
 * Mirrors the iOS `OcrStrip`.
 */
@Composable
fun OcrStrip(
    tone: EnvelopeOcrTone,
    detected: String,
    confidence: Int,
    sub: String,
    modifier: Modifier = Modifier,
) {
    val palette = ocrPalette(tone)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(palette.background)
                .border(1.dp, palette.border, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics {
                    contentDescription =
                        "OCR detected $detected, $confidence percent confidence. $sub"
                },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, palette.border, RoundedCornerShape(Radii.md)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = palette.icon,
                contentDescription = null,
                size = 16.dp,
                tint = palette.accent,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "OCR detected",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "“$detected”",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(palette.pillBackground)
                    .border(1.dp, palette.pillBorder, RoundedCornerShape(Radii.pill))
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        ) {
            Text(
                text = "$confidence%",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = palette.pillForeground,
            )
        }
    }
}

private data class OcrPalette(
    val background: Color,
    val border: Color,
    val accent: Color,
    val icon: PantopusIcon,
    val pillBackground: Color,
    val pillForeground: Color,
    val pillBorder: Color,
)

private fun ocrPalette(tone: EnvelopeOcrTone): OcrPalette =
    when (tone) {
        EnvelopeOcrTone.Clean ->
            OcrPalette(
                background = PantopusColors.successBg,
                border = PantopusColors.successLight,
                accent = PantopusColors.success,
                icon = PantopusIcon.CheckCircle,
                pillBackground = PantopusColors.successBg,
                pillForeground = PantopusColors.success,
                pillBorder = PantopusColors.successLight,
            )
        EnvelopeOcrTone.Unclear ->
            OcrPalette(
                background = PantopusColors.warningBg,
                border = PantopusColors.warningLight,
                accent = PantopusColors.warning,
                icon = PantopusIcon.AlertTriangle,
                pillBackground = PantopusColors.warmAmberBg,
                pillForeground = PantopusColors.warmAmber,
                pillBorder = PantopusColors.warningLight,
            )
    }
