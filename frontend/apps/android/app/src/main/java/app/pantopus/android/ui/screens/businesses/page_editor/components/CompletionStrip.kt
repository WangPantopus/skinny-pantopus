@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageSetupItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * P4.2 — A13.10 Edit Business Page. Setup-mode strip that replaces
 * [EditBusinessIdentityStrip]. Renders a violet progress meter + chip
 * row showing which sections are filled vs pending.
 */
@Composable
fun EditBusinessCompletionStrip(
    done: Int,
    total: Int,
    items: List<EditBusinessPageSetupItem>,
    modifier: Modifier = Modifier,
) {
    val pct: Float = if (total > 0) done.toFloat() / total.toFloat() else 0f
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.businessBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("editBusinessPage.completionStrip")
                .semantics { contentDescription = "Setup progress, $done of $total sections complete" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.business),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Building2,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text(
                text = "Setup · $done of $total",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.businessDark,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "${(pct * 100).roundToInt()}%",
                style =
                    TextStyle(
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    ),
                color = PantopusColors.businessDark,
            )
        }
        ProgressBar(pct = pct)
        ChipFlow(items = items)
    }
}

@Composable
private fun ProgressBar(pct: Float) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(PantopusColors.appSurface),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(pct.coerceIn(0f, 1f))
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(
                        Brush.horizontalGradient(
                            colors =
                                listOf(
                                    PantopusColors.business,
                                    PantopusColors.businessDark,
                                ),
                        ),
                    ),
        )
    }
}

@Composable
private fun ChipFlow(items: List<EditBusinessPageSetupItem>) {
    FlowRow {
        items.forEach { item ->
            CompletionChip(item = item)
        }
    }
}

@Composable
private fun CompletionChip(item: EditBusinessPageSetupItem) {
    val borderColor =
        if (item.done) PantopusColors.successLight else PantopusColors.appBorder
    val bg = if (item.done) PantopusColors.successBg else PantopusColors.appSurface
    val fg = if (item.done) PantopusColors.success else PantopusColors.appTextSecondary
    Row(
        modifier =
            Modifier
                .padding(end = 4.dp, bottom = 4.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(
                    width = 1.dp,
                    color = borderColor,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .padding(horizontal = 7.dp, vertical = 2.dp)
                .wrapContentSize()
                .semantics {
                    contentDescription = "${item.label}, ${if (item.done) "done" else "pending"}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = if (item.done) PantopusIcon.Check else PantopusIcon.Circle,
            contentDescription = null,
            size = 9.dp,
            tint = fg,
            strokeWidth = 3f,
        )
        Text(
            text = item.label,
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
            color = fg,
        )
    }
}

/**
 * Minimal flow-row layout — wraps children onto multiple rows L→R.
 * Used by the completion-strip chip cluster and the service-chip cluster
 * in the body. Avoids adding a new dependency for two screens of usage.
 */
@Composable
private fun FlowRow(content: @Composable () -> Unit) {
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
