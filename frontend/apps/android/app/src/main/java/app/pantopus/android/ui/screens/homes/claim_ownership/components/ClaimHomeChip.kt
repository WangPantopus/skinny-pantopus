@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_ownership.components

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Green home-pillar pill identifying the home being claimed. Shared by the
 * Start and Evidence steps of the claim-ownership wizard.
 */
@Composable
fun ClaimHomeChip(
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag("claimOwnershipHomeChip")
                .semantics { contentDescription = "Home, $label" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.home,
        )
        Text(text = "Home · $label", style = PantopusTextStyle.overline, color = PantopusColors.home)
    }
}
