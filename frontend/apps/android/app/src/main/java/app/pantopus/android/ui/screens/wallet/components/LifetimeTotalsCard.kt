@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.10 · "Lifetime" — the two lifetime figures `GET api/wallet` returns
 * alongside the balance (`Wallet.lifetime_received` /
 * `Wallet.lifetime_withdrawals`, backend/routes/wallet.js:61-67). RN renders
 * them beside the balance as "Total Earned" / "Withdrawn"
 * (`WalletTab.tsx:150-159`); the designed hero has no room for them, so they
 * land in their own split card directly under the hero. Values arrive
 * pre-formatted from the mapper — nothing is re-derived here. Mirrors iOS
 * `LifetimeTotalsCard`.
 */
@Composable
fun LifetimeTotalsCard(
    earned: String?,
    withdrawn: String?,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("walletLifetimeTotals"),
        verticalAlignment = Alignment.Top,
    ) {
        Cell(
            icon = PantopusIcon.TrendingUp,
            overline = "Total earned",
            value = earned,
            tag = "walletLifetimeEarned",
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3)
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(PantopusColors.appBorderSubtle),
        )
        Cell(
            icon = PantopusIcon.Landmark,
            overline = "Withdrawn",
            value = withdrawn,
            tag = "walletLifetimeWithdrawn",
            modifier = Modifier.weight(1f),
        )
    }
}

/** A missing figure renders an em-dash rather than a fabricated `$0.00`. */
@Composable
private fun Cell(
    icon: PantopusIcon,
    overline: String,
    value: String?,
    tag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag(tag),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 10.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = overline.uppercase(),
                color = PantopusColors.appTextMuted,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
            )
        }
        Text(
            text = value ?: "—",
            color = PantopusColors.appText,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.25).sp,
        )
    }
}
