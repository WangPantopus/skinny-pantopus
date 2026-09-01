@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet.components

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
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.10 — amber "bank verification expired" card pinned above the
 * BalanceHero in the hold variant. Shield-alert disc + bold headline
 * + 3-line reassurance body ("earnings keep landing — they're safe").
 */
@Composable
fun HoldBanner(
    headline: String,
    body: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.warmAmberBg)
                .border(BorderStroke(1.dp, PantopusColors.warningLight), shape)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics { contentDescription = "$headline. $body" }
                .testTag("walletHoldBanner"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.warning),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldAlert,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2.3f,
                tint = Color.White,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = headline,
                color = WalletPalette.amberDeep,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.15).sp,
            )
            Text(
                text = body,
                color = WalletPalette.amberDeep.copy(alpha = 0.92f),
                fontSize = 11.5.sp,
            )
        }
    }
}
