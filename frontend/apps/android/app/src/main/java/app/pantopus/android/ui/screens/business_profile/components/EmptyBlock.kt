@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.business_profile.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.6 — dashed, centered empty-section card for the Business Profile.
 * Backs every unfilled section on the newly-claimed + closed secondary
 * frame (About / Hours / Service area / Recent work / Reviews), with an
 * optional CTA ("Hire to review"). Identity-tinted (business violet).
 *
 * Mirror of iOS `Features/BusinessProfile/Components/EmptyBlock.swift`.
 */
@Composable
fun EmptyBlock(
    icon: PantopusIcon,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    ctaLabel: String? = null,
    ctaIcon: PantopusIcon? = null,
    onCta: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .drawBehind {
                    drawRoundRect(
                        color = PantopusColors.appBorder,
                        cornerRadius = CornerRadius(12.dp.toPx(), 12.dp.toPx()),
                        style =
                            Stroke(
                                width = 1.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())),
                            ),
                    )
                }
                .padding(horizontal = 18.dp, vertical = 20.dp)
                .semantics { contentDescription = "$title. $body" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 21.dp,
                strokeWidth = 1.8f,
                tint = PantopusColors.business,
            )
        }
        Text(
            text = title,
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.2).sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 9.dp, bottom = 3.dp),
        )
        Text(
            text = body,
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 248.dp),
        )
        if (ctaLabel != null && onCta != null) {
            Row(
                modifier =
                    Modifier
                        .padding(top = 11.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .drawBehind {
                            drawRoundRect(
                                color = PantopusColors.appBorder,
                                cornerRadius = CornerRadius(8.dp.toPx(), 8.dp.toPx()),
                                style = Stroke(width = 1.dp.toPx()),
                            )
                        }
                        .clickable(onClick = onCta)
                        .testTag("businessProfile.reviews.cta")
                        .padding(horizontal = 13.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (ctaIcon != null) {
                    PantopusIconImage(
                        icon = ctaIcon,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.appText,
                    )
                }
                Text(
                    text = ctaLabel,
                    color = PantopusColors.appText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
