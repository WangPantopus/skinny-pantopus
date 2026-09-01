@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.invisibleToUser
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * 60dp-tall faux barcode strip rendered from [code]. Two codes that
 * hash to the same widths will look identical; that's intentional —
 * this is a visual affordance, not a scannable artefact.
 */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
fun BarcodeView(
    code: String,
    modifier: Modifier = Modifier,
    height: Dp = 60.dp,
    barColor: Color = PantopusColors.appText,
) {
    val widths = remember(code) { computeBarWidths(code) }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .semantics { invisibleToUser() },
        verticalArrangement = Arrangement.spacedBy(Spacing.s0),
    ) {
        Canvas(modifier = Modifier.fillMaxWidth().height(height)) {
            val totalUnits = widths.sum().toFloat().coerceAtLeast(1f)
            val unit = size.width / totalUnits
            var x = 0f
            widths.forEach { w ->
                val barWidth = unit * w
                drawRect(
                    color = barColor,
                    topLeft = Offset(x, 0f),
                    size = Size(barWidth, size.height),
                )
                x += barWidth + 1f // 1px gap so adjacent identical bars stay distinct
            }
        }
    }
}

private fun computeBarWidths(code: String): List<Int> {
    val seed = code.ifEmpty { "PANTOPUS" }
    val widths = mutableListOf<Int>()
    seed.forEach { c ->
        val v = c.code
        widths += (v % 3) + 1
        widths += ((v / 3) % 4) + 1
        widths += ((v / 7) % 3) + 1
        widths += ((v / 11) % 5) + 1
    }
    return widths
}

@Preview(showBackground = true, widthDp = 360, heightDp = 240)
@Composable
private fun BarcodeViewPreview() {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4),
    ) {
        BarcodeView(code = "PANTO20OFF")
        BarcodeView(code = "1234567890")
        BarcodeView(code = "")
    }
}
