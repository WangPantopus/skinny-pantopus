@file:Suppress("PackageNaming", "MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.vacation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.vacation.VacationHeldItem
import app.pantopus.android.ui.screens.mailbox.vacation.VacationHoldSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A14.8 active-variant "Currently held" ledger. Vertical list of icon-
 * tile + label + sub + count rows separated by hairline dividers.
 * Mirrors `Features/Mailbox/Vacation/Components/HeldList.swift`.
 */
@Composable
fun HeldList(
    items: List<VacationHeldItem>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("vacationHeldList"),
    ) {
        items.forEachIndexed { index, item ->
            HeldRow(item)
            if (index < items.size - 1) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Spacer(modifier = Modifier.width(Spacing.s4))
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(1.dp)
                                .background(PantopusColors.appBorderSubtle),
                    )
                }
            }
        }
    }
}

@Composable
private fun HeldRow(item: VacationHeldItem) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("vacationHeldRow.${item.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        IconTile(icon = item.icon.glyph)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = item.label,
                color = PantopusColors.appText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = item.sub,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
            )
        }
        Text(
            text = "${item.count}",
            color = PantopusColors.appText,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun IconTile(icon: PantopusIcon) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextStrong,
        )
    }
}

private val VacationHeldItem.Icon.glyph: PantopusIcon
    get() =
        when (this) {
            VacationHeldItem.Icon.Packages -> PantopusIcon.Package
            VacationHeldItem.Icon.Mail -> PantopusIcon.Mail
            VacationHeldItem.Icon.Forwarded -> PantopusIcon.ArrowUpRight
            VacationHeldItem.Icon.Civic -> PantopusIcon.AlertTriangle
        }

@Preview(showBackground = true, widthDp = 390, heightDp = 320)
@Composable
private fun HeldListPreview() {
    Box(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s3),
    ) {
        HeldList(items = VacationHoldSampleData.activeHold.heldItems)
    }
}
