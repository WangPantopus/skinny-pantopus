@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.wallet.WalletPayoutAccount
import app.pantopus.android.ui.screens.wallet.WalletPayoutCapability
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.10 · "Payout account" — the seller's live Stripe Connect (Express)
 * account, projected from `GET api/payments/connect/account`. Stripe never
 * hands the platform a bank name or last-4 for an Express account, so this
 * card describes the account's capabilities and routes into Stripe's own
 * hosted dashboard (`POST api/payments/connect/dashboard`) rather than
 * inventing bank details. While the account is still verifying, the same slot
 * resumes hosted onboarding. Mirrors iOS `PayoutAccountCard`.
 */
@Composable
fun PayoutAccountCard(
    account: WalletPayoutAccount,
    modifier: Modifier = Modifier,
    onAction: () -> Unit = {},
) {
    val borderColor = if (account.warn) PantopusColors.warningLight else PantopusColors.appBorder
    val shape = RoundedCornerShape(14.dp)

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, borderColor), shape)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("walletPayoutAccount"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            IconTile(warn = account.warn)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = account.headline,
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                )
                Text(
                    text = account.bodyText,
                    color =
                        if (account.warn) {
                            WalletPalette.amberDeep
                        } else {
                            PantopusColors.appTextSecondary
                        },
                    fontSize = 11.sp,
                )
            }
            Spacer(Modifier.width(Spacing.s2))
            AccountActionButton(account = account, onClick = onAction)
        }
        if (account.capabilities.isNotEmpty()) {
            CapabilityGrid(capabilities = account.capabilities)
        }
    }
}

/**
 * RN `PayoutsTab`'s `detailsGrid` — one tile per Stripe capability so the
 * account status reads as detail, not a single boolean. Mirrors iOS
 * `PayoutAccountCard.capabilityGrid`.
 */
@Composable
private fun CapabilityGrid(capabilities: List<WalletPayoutCapability>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        capabilities.forEach { capability ->
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = 10.dp, vertical = Spacing.s2)
                        .testTag("walletPayoutCapability_${capability.key}"),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = capability.label.uppercase(),
                    color = PantopusColors.appTextMuted,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                )
                Text(
                    text = if (capability.enabled) "Enabled" else "Disabled",
                    color =
                        if (capability.enabled) {
                            PantopusColors.success
                        } else {
                            PantopusColors.appTextSecondary
                        },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun IconTile(warn: Boolean) {
    Box(
        modifier =
            Modifier
                .size(width = 44.dp, height = 30.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(if (warn) PantopusColors.warningBg else PantopusColors.successBg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = if (warn) PantopusIcon.AlertCircle else PantopusIcon.Landmark,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2.1f,
            tint = if (warn) WalletPalette.amberDeep else PantopusColors.success,
        )
    }
}

@Composable
private fun AccountActionButton(
    account: WalletPayoutAccount,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .height(30.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (account.warn) WalletPalette.amberDeep else Color.Transparent)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp)
                // The only reachable entry point to the seller's Stripe
                // Express dashboard. Mirrors the iOS accessibility identifier.
                .testTag(if (account.warn) "walletReverifyButton" else "wallet.openDashboardBtn"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ExternalLink,
            contentDescription = null,
            size = 12.dp,
            strokeWidth = 2.2f,
            tint = if (account.warn) Color.White else PantopusColors.primary600,
        )
        Text(
            text = account.actionLabel,
            color = if (account.warn) Color.White else PantopusColors.primary600,
            fontSize = 11.5.sp,
            fontWeight = if (account.warn) FontWeight.Bold else FontWeight.SemiBold,
        )
    }
}
