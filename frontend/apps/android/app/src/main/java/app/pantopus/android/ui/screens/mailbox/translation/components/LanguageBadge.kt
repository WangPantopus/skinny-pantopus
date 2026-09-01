@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.translation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.translation.TranslationLanguages
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The "ES → EN" language badge. Source / target code pills plus a detection
 * line that flips from "Auto-detected · 98% match" to "Confirmed
 * translation" once confirmed. Mirrors iOS `LanguageBadge`.
 */
@Composable
fun LanguageBadge(
    languages: TranslationLanguages,
    confirmed: Boolean,
) {
    val confidence = languages.confidence
    val detail =
        when {
            confirmed -> "Confirmed translation"
            confidence != null -> "Auto-detected, $confidence percent match"
            else -> "Auto-detected"
        }
    TranslationCard(
        modifier =
            Modifier
                .semantics {
                    contentDescription =
                        "${languages.sourceName} to ${languages.targetName}. $detail"
                }
                .testTag("translation_languageBadge"),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                LangPill(code = languages.sourceCode, accent = false)
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextMuted,
                )
                LangPill(code = languages.targetCode, accent = true)
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = "${languages.sourceName} → ${languages.targetName}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                DetectionLine(confirmed = confirmed, confidence = languages.confidence)
            }
        }
    }
}

@Composable
private fun DetectionLine(
    confirmed: Boolean,
    confidence: Int?,
) {
    // The translator only reports a confidence on surfaces that measure
    // one; without it the badge says "Auto-detected" and stops there.
    val label =
        when {
            confirmed -> "Confirmed translation"
            confidence != null -> "Auto-detected · $confidence% match"
            else -> "Auto-detected"
        }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = if (confirmed) PantopusIcon.BadgeCheck else PantopusIcon.ScanLine,
            contentDescription = null,
            size = 12.dp,
            tint = if (confirmed) PantopusColors.success else PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun LangPill(
    code: String,
    accent: Boolean,
) {
    Box(
        modifier =
            Modifier
                .defaultMinSize(minWidth = 38.dp)
                .height(34.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (accent) PantopusColors.categoryTranslation else PantopusColors.appSurfaceSunken)
                .then(
                    if (accent) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    },
                )
                .padding(horizontal = Spacing.s2),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = code,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            color = if (accent) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
    }
}
