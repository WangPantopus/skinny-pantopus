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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
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
 * The Wallet's way to the invoices businesses sent you (`ReceivedInvoicesScreen`): receipt icon tile + "Invoices" +
 * body line + chevron, in [TaxDocsRow]'s geometry. Mirrors iOS `InvoicesRow.swift`.
 */
@Composable
fun InvoicesRow(
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics { contentDescription = "Invoices: pay or look back at invoices from businesses you hire" }
                .testTag("walletInvoicesRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ReceiptText,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = "Invoices",
                color = PantopusColors.appText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = "Pay or look back at invoices from businesses you hire",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 2,
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
