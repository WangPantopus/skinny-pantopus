@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageServiceChip
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.max

/**
 * P4.2 — A13.10 Edit Business Page. Flow row of service chips with a
 * trailing dashed "Add service" pseudo-chip. `isFresh` paints the chip
 * with the amber tone instead of identity violet.
 */
@Composable
fun EditBusinessServiceChipsEditor(
    chips: List<EditBusinessPageServiceChip>,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                .padding(Spacing.s2)
                .testTag("editBusinessPage.services"),
    ) {
        ChipFlow {
            chips.forEach { chip -> ServiceChip(chip = chip) }
            AddServiceChip()
        }
    }
}

@Composable
private fun ServiceChip(chip: EditBusinessPageServiceChip) {
    val fg = if (chip.isFresh) PantopusColors.warmAmber else PantopusColors.businessDark
    val bg = if (chip.isFresh) PantopusColors.warmAmberBg else PantopusColors.businessBg
    val border =
        if (chip.isFresh) {
            PantopusColors.warning.copy(alpha = 0.4f)
        } else {
            PantopusColors.business.copy(alpha = 0.25f)
        }
    Row(
        modifier =
            Modifier
                .padding(end = 6.dp, bottom = 6.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.pill))
                .padding(start = 11.dp, end = 5.dp, top = 7.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = iconFor(chip.iconKey),
            contentDescription = null,
            size = 13.dp,
            tint = fg,
        )
        Text(
            text = chip.label,
            style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            color = fg,
        )
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = 11.dp,
            tint = fg,
            strokeWidth = 2.5f,
        )
    }
}

@Composable
private fun AddServiceChip() {
    Row(
        modifier =
            Modifier
                .padding(end = 6.dp, bottom = 6.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .padding(horizontal = 11.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Add service",
            style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium),
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
internal fun ChipFlow(content: @Composable () -> Unit) {
    Layout(content = content) { measurables, constraints ->
        val maxWidth = constraints.maxWidth
        val placeables = measurables.map { it.measure(constraints) }
        val rows = mutableListOf<MutableList<androidx.compose.ui.layout.Placeable>>()
        var current = mutableListOf<androidx.compose.ui.layout.Placeable>()
        var currentWidth = 0
        placeables.forEach { p ->
            if (currentWidth + p.width > maxWidth && current.isNotEmpty()) {
                rows += current
                current = mutableListOf()
                currentWidth = 0
            }
            current += p
            currentWidth += p.width
        }
        if (current.isNotEmpty()) rows += current
        val totalHeight = rows.sumOf { row -> row.maxOf { it.height } }
        layout(maxWidth, max(totalHeight, 1)) {
            var y = 0
            rows.forEach { row ->
                var x = 0
                row.forEach { p ->
                    p.placeRelative(x, y)
                    x += p.width
                }
                y += row.maxOf { it.height }
            }
        }
    }
}

private fun iconFor(key: String): PantopusIcon =
    when (key) {
        "utensils" -> PantopusIcon.Utensils
        "shopping-bag" -> PantopusIcon.ShoppingBag
        "trees" -> PantopusIcon.Trees
        "wifi" -> PantopusIcon.Wifi
        "paw-print" -> PantopusIcon.PawPrint
        "clock" -> PantopusIcon.Clock
        "sparkles" -> PantopusIcon.Sparkles
        else -> PantopusIcon.Tag
    }
