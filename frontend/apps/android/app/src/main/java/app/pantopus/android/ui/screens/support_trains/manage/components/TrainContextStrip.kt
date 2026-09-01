@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANAGE_TRAIN_CONTEXT_STRIP_TAG: String = "manageTrainContextStrip"

/**
 * Warm-amber identity strip that anchors the Manage Train screen.
 * Mirrors the iOS [TrainContextStrip] geometry: a 34dp gradient icon
 * tile + title + calendar-meta line + status chip on the right.
 */
@Composable
fun TrainContextStrip(
    title: String,
    dateRangeLabel: String,
    isActive: Boolean,
    modifier: Modifier = Modifier,
) {
    val stripBackground =
        if (isActive) {
            PantopusColors.warmAmberBg.copy(alpha = 0.55f)
        } else {
            PantopusColors.appSurfaceSunken
        }
    val stripBorder =
        if (isActive) {
            PantopusColors.warmAmber.copy(alpha = 0.35f)
        } else {
            PantopusColors.appBorder
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(stripBackground)
                .border(BorderStroke(1.dp, stripBorder), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag(MANAGE_TRAIN_CONTEXT_STRIP_TAG),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        IconTile(isActive = isActive)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.semantics { heading() },
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Calendar,
                    contentDescription = null,
                    size = 10.dp,
                    tint = dateRangeColor(isActive),
                )
                Text(
                    text = dateRangeLabel,
                    fontSize = 11.sp,
                    color = dateRangeColor(isActive),
                )
            }
        }
        StatusChip(isActive = isActive)
    }
}

@Composable
private fun IconTile(isActive: Boolean) {
    val brush =
        if (isActive) {
            Brush.linearGradient(
                colors = listOf(PantopusColors.warmAmber.copy(alpha = 0.85f), PantopusColors.warmAmber),
            )
        } else {
            Brush.linearGradient(
                colors = listOf(PantopusColors.appTextMuted, PantopusColors.appTextSecondary),
            )
        }
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(brush),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Utensils,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun StatusChip(isActive: Boolean) {
    val pillColor =
        if (isActive) PantopusColors.successBg else PantopusColors.appSurfaceSunken
    val borderColor =
        if (isActive) PantopusColors.successLight else PantopusColors.appBorder
    val labelColor =
        if (isActive) PantopusColors.success else PantopusColors.appTextSecondary
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(pillColor)
                .border(BorderStroke(1.dp, borderColor), RoundedCornerShape(Radii.xs))
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .semantics { contentDescription = if (isActive) "Active" else "Closed" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (isActive) {
            Box(
                modifier =
                    Modifier
                        .size(5.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success),
            )
        }
        Text(
            text = if (isActive) "ACTIVE" else "CLOSED",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = labelColor,
        )
    }
}

private fun dateRangeColor(isActive: Boolean): Color = if (isActive) PantopusColors.warmAmber else PantopusColors.appTextSecondary
