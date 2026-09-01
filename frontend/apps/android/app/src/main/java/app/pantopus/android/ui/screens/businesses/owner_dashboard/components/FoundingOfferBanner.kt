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
import app.pantopus.android.ui.screens.businesses.owner_dashboard.OwnerFoundingOffer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * First-50 "Founding Business" offer banner on the owner dashboard.
 * Mirrors RN `src/app/businesses/[id]/index.tsx:194-228` — headline,
 * "<n> spots left — Claim yours!", a claim CTA, and a dismiss ✕ that hides
 * the banner for this business permanently.
 *
 * Warning tokens throughout (the design's amber card); no hex literals.
 * Mirrors iOS `FoundingOfferBanner.swift`.
 */
@Composable
fun FoundingOfferBanner(
    offer: OwnerFoundingOffer,
    onClaim: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.warning, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .padding(Spacing.s4)
                .testTag("businessOwner.foundingBanner"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.PartyPopper,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.warning,
            )
            Text(
                text = "Founding Business Offer",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.1).sp,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onDismiss)
                        .testTag("businessOwner.foundingDismiss"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Dismiss founding offer",
                    size = 16.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }

        Text(
            text = spotsLabel(offer.slotsRemaining),
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )

        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.s2)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warning)
                    .clickable(enabled = !offer.isClaiming, onClick = onClaim)
                    .padding(vertical = Spacing.s3)
                    .testTag("businessOwner.foundingClaim"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (offer.isClaiming) "Claiming…" else "Claim Founding Slot",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

private fun spotsLabel(remaining: Int): String {
    val noun = if (remaining == 1) "spot" else "spots"
    return "$remaining $noun left — Claim yours!"
}
