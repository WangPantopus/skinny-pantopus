@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.business_profile.components

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.business_profile.BusinessCategoryAccent
import app.pantopus.android.ui.screens.business_profile.BusinessCategoryChip
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.6 — the category-chip row under the stat strip. The lead category
 * carries a per-type accent (cleaning green, handyman orange, pet red, or
 * business violet); the rest are neutral pills.
 *
 * Mirror of iOS `Features/BusinessProfile/Components/CategoryRow.swift`.
 */
@Composable
fun CategoryRow(
    categories: List<BusinessCategoryChip>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .horizontalScroll(rememberScrollState())
                .testTag("businessProfile.categories"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        categories.forEach { chip ->
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(background(chip.accent))
                        .padding(horizontal = 9.dp, vertical = 4.dp)
                        .semantics { contentDescription = chip.label },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (chip.icon != null) {
                    PantopusIconImage(
                        icon = chip.icon,
                        contentDescription = null,
                        size = 11.dp,
                        strokeWidth = 2.2f,
                        tint = foreground(chip.accent),
                    )
                }
                Text(
                    text = chip.label,
                    color = foreground(chip.accent),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private fun background(accent: BusinessCategoryAccent): Color =
    when (accent) {
        BusinessCategoryAccent.Business -> PantopusColors.businessBg
        BusinessCategoryAccent.Cleaning -> PantopusColors.successBg
        BusinessCategoryAccent.Handyman -> PantopusColors.warningBg
        BusinessCategoryAccent.Pet -> PantopusColors.errorBg
        BusinessCategoryAccent.Neutral -> PantopusColors.appSurfaceSunken
    }

private fun foreground(accent: BusinessCategoryAccent): Color =
    when (accent) {
        BusinessCategoryAccent.Business -> PantopusColors.business
        BusinessCategoryAccent.Cleaning -> PantopusColors.cleaning
        BusinessCategoryAccent.Handyman -> PantopusColors.handyman
        BusinessCategoryAccent.Pet -> PantopusColors.petCare
        BusinessCategoryAccent.Neutral -> PantopusColors.appTextSecondary
    }
