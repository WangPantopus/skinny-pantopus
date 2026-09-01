@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.gig

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Render-only category tile for Paparazzi. Mirrors the production
 * [CategoryTile] visuals without depending on a view-model so the
 * snapshot stays purely declarative.
 */
@Composable
internal fun StaticCategoryTile(
    category: GigComposeCategory,
    isSelected: Boolean,
) {
    val icon =
        when (category) {
            GigComposeCategory.Handyman -> PantopusIcon.Hammer
            GigComposeCategory.Cleaning -> PantopusIcon.Sparkles
            GigComposeCategory.Moving -> PantopusIcon.Package
            GigComposeCategory.PetCare -> PantopusIcon.PawPrint
            GigComposeCategory.ChildCare -> PantopusIcon.Heart
            GigComposeCategory.Tutoring -> PantopusIcon.Lightbulb
            GigComposeCategory.Delivery -> PantopusIcon.Send
            GigComposeCategory.Tech -> PantopusIcon.Zap
            GigComposeCategory.Other -> PantopusIcon.MoreHorizontal
        }
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    val bg = if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface
    val tint = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 88.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .border(width = if (isSelected) 2.dp else 1.dp, color = borderColor, shape = RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2, alignment = Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 22.dp, tint = tint)
        Text(text = category.label, style = PantopusTextStyle.caption, color = PantopusColors.appText)
    }
}

/** Render-only radio row mirroring the production radio chrome. */
@Composable
internal fun StaticRadioRow(
    label: String,
    subcopy: String,
    isSelected: Boolean,
) {
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(width = if (isSelected) 2.dp else 1.dp, color = borderColor, shape = RoundedCornerShape(Radii.md))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(width = 2.dp, color = borderColor, shape = CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (isSelected) {
                Box(
                    modifier =
                        Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.primary600),
                )
            }
        }
        Column {
            Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText)
            Text(text = subcopy, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

/** Static label/value pair used inside `FormFieldsBlock` snapshots. */
@Composable
internal fun StaticLabeledValue(
    label: String,
    value: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(text = label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                    .padding(Spacing.s3),
        ) {
            Text(text = value, style = PantopusTextStyle.body, color = PantopusColors.appText)
        }
    }
}
