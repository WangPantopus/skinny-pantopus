@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.owner_dashboard.OwnerProfileStrength
import app.pantopus.android.ui.screens.businesses.owner_dashboard.OwnerStrengthStep
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii

/**
 * A10.7 — the owner's profile-strength card: a percentage + caption over a
 * completion bar and a "finish these" checklist (done steps strike through;
 * the pending step surfaces an inline "Add" that opens Edit Business Page).
 *
 * This is the strength-meter idiom (a progress bar over a per-item list)
 * applied to page completeness; the shared `StrengthMeter` primitive is
 * password-specific, so the owner page-strength reads as its own card.
 * Mirrors iOS `ProfileStrengthCard.swift`.
 */
@Composable
fun ProfileStrengthCard(
    strength: OwnerProfileStrength,
    onAddStep: (OwnerStrengthStep) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(horizontal = 14.dp)
                .padding(top = 13.dp, bottom = 14.dp)
                .testTag("businessOwner.profileStrength"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = "Profile strength",
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                )
                Text(
                    text = strength.caption,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                )
            }
            Text(
                text = "${strength.percent}%",
                color = PantopusColors.success,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.4).sp,
                modifier = Modifier.semantics { contentDescription = "${strength.percent} percent complete" },
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(7.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(strength.percent.coerceIn(0, 100) / 100f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.success),
            )
        }
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = 11.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            strength.steps.forEach { step ->
                StepRow(step = step, onAdd = { onAddStep(step) })
            }
        }
    }
}

@Composable
private fun StepRow(
    step: OwnerStrengthStep,
    onAdd: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "${step.label}, ${if (step.done) "done" else "to do"}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Checkmark(done = step.done)
        Text(
            text = step.label,
            color = if (step.done) PantopusColors.appTextSecondary else PantopusColors.appText,
            fontSize = 12.5.sp,
            fontWeight = if (step.done) FontWeight.Medium else FontWeight.SemiBold,
            textDecoration = if (step.done) TextDecoration.LineThrough else null,
            modifier = Modifier.weight(1f),
        )
        if (step.ctaLabel != null && !step.done) {
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.businessBg)
                        .clickable(onClick = onAdd)
                        .padding(horizontal = 11.dp, vertical = 4.dp),
            ) {
                Text(
                    text = step.ctaLabel,
                    color = PantopusColors.business,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun Checkmark(done: Boolean) {
    if (done) {
        Box(
            modifier = Modifier.size(18.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 3f,
                tint = PantopusColors.success,
            )
        }
    } else {
        val border = PantopusColors.appBorder
        Box(
            modifier =
                Modifier.size(18.dp).drawBehind {
                    drawCircle(
                        color = border,
                        radius = size.minDimension / 2 - 0.75.dp.toPx(),
                        style =
                            Stroke(
                                width = 1.5.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 2.dp.toPx()), 0f),
                            ),
                    )
                },
        )
    }
}
