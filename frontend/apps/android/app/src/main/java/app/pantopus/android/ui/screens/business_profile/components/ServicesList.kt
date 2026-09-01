@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.business_profile.components

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
import androidx.compose.material3.HorizontalDivider
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
import app.pantopus.android.ui.screens.business_profile.BusinessServiceRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.6 — the Services card: priced rows with a business-tinted glyph
 * tile, name + meta, and a right-aligned price + unit.
 *
 * Mirror of iOS `Features/BusinessProfile/Components/ServicesList.swift`.
 */
@Composable
fun ServicesList(
    services: List<BusinessServiceRow>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .testTag("businessProfile.services"),
    ) {
        services.forEachIndexed { index, service ->
            ServiceRow(service)
            if (index != services.lastIndex) {
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    modifier = Modifier.padding(horizontal = 14.dp),
                )
            }
        }
    }
}

@Composable
private fun ServiceRow(service: BusinessServiceRow) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics { contentDescription = "${service.name}, ${service.priceLabel}" },
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
                icon = service.icon,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = service.name,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            if (!service.detail.isNullOrEmpty()) {
                Text(
                    text = service.detail,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = service.priceLabel,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.2).sp,
            )
            if (!service.unit.isNullOrEmpty()) {
                Text(
                    text = service.unit,
                    color = PantopusColors.appTextMuted,
                    fontSize = 10.sp,
                )
            }
        }
    }
}
