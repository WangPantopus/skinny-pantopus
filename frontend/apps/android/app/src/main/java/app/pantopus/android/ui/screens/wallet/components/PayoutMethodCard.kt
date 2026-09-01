@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "FunctionNaming")

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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.wallet.WalletPayoutMethod
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.10 — debit-card-shaped tile (44×30) with `CHASE` 8pt white text
 * + bank label + last4 mono + meta line. Default state surfaces the
 * green flash + "Instant payout · 1–3 minutes" meta and a text
 * `Manage` button; warn state recolours the card amber, swaps the
 * meta line to "Verification expired …", and exposes a dark-amber
 * `Re-verify` button.
 */
@Composable
fun PayoutMethodCard(
    method: WalletPayoutMethod,
    modifier: Modifier = Modifier,
    onManage: () -> Unit = {},
    onReverify: () -> Unit = {},
) {
    val borderColor = if (method.warn) PantopusColors.warningLight else PantopusColors.appBorder
    val shape = RoundedCornerShape(14.dp)

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, borderColor), shape)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("walletPayoutMethod"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ChaseTile(warn = method.warn)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = method.bankLabel,
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                )
                Text(
                    text = "•••• ${method.last4}",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = if (method.warn) PantopusIcon.AlertCircle else PantopusIcon.Zap,
                    contentDescription = null,
                    size = 11.dp,
                    strokeWidth = 2.3f,
                    tint = if (method.warn) WalletPalette.amberDeep else PantopusColors.home,
                )
                Text(
                    text = method.bodyText,
                    color =
                        if (method.warn) {
                            WalletPalette.amberDeep
                        } else {
                            PantopusColors.appTextSecondary
                        },
                    fontSize = 11.sp,
                    maxLines = 1,
                )
            }
        }
        Spacer(Modifier.width(Spacing.s2))
        if (method.warn) {
            ReverifyButton(onClick = onReverify)
        } else {
            ManageButton(onClick = onManage)
        }
    }
}

@Composable
private fun ChaseTile(warn: Boolean) {
    val brush =
        if (warn) {
            Brush.linearGradient(
                colors = listOf(PantopusColors.warningBg, PantopusColors.warningLight),
            )
        } else {
            Brush.linearGradient(
                colors = listOf(WalletPalette.chaseBlueDark, WalletPalette.chaseBlueLight),
            )
        }
    Box(
        modifier =
            Modifier
                .size(width = 44.dp, height = 30.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(brush),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "CHASE",
            color = if (warn) WalletPalette.amberDeep else Color.White,
            fontSize = 8.5.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.5.sp,
        )
    }
}

@Composable
private fun ManageButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .height(30.dp)
                .clip(RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s1)
                // Block 3C — "Manage" opens the seller's Stripe Express dashboard.
                .testTag("wallet.openDashboardBtn"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Manage",
            color = PantopusColors.primary600,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun ReverifyButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .height(30.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(WalletPalette.amberDeep)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp)
                .testTag("walletReverifyButton"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Re-verify",
            color = Color.White,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.05).sp,
        )
    }
}
