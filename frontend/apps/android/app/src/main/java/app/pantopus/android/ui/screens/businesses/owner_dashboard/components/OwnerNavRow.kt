@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * C3 — a generic owner-dashboard entry-point card, the same geometry as
 * `TeamSummaryRow` but parameterised so the money + legal sections
 * (Payments, Invoices, Legal & verification) share one implementation
 * instead of cloning it three times. Mirrors iOS `OwnerNavRow`.
 */
@Composable
fun OwnerNavRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String,
    testTagValue: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag(testTagValue),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = subtitle,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}
