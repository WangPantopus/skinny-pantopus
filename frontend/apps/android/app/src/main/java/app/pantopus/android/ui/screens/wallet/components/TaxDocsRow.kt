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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import app.pantopus.android.ui.screens.wallet.WalletTaxDocs
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.10 — single tax-docs row. File-text icon tile + "Tax documents"
 * + body line + chevron. `ready` lights the home-green icon tile, a
 * `New` chip beside the title, and the "1099-NEC … ready" body copy.
 */
@Composable
fun TaxDocsRow(
    docs: WalletTaxDocs,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    val shape = RoundedCornerShape(14.dp)
    val description =
        if (docs.ready) "Tax documents, new: ${docs.bodyText}" else "Tax documents: ${docs.bodyText}"

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape)
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics { contentDescription = description }
                .testTag("walletTaxDocsRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        IconTile(ready = docs.ready)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = "Tax documents",
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                )
                if (docs.ready) NewChip()
            }
            Text(
                text = docs.bodyText,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun IconTile(ready: Boolean) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (ready) PantopusColors.homeBg else PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FileText,
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2f,
            tint = if (ready) PantopusColors.homeDark else PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun NewChip() {
    Box(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.homeBg)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = "NEW",
            color = PantopusColors.homeDark,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
        )
    }
}
