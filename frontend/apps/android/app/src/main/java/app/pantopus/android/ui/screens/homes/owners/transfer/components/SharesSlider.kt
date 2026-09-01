@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.homes.owners.transfer.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors

/**
 * A13.4 — Custom 1–60% slider used by the Transfer Ownership form.
 * Standalone (not the Material `Slider`) because the design needs a
 * primary-toned track with a 24dp ringed thumb and tick dots at fixed
 * preset stops.
 *
 * @param value Current percentage (driven by the host VM).
 * @param onValueChange Emit-on-drag callback.
 * @param range Allowed percentage range. Caller is responsible for
 *     clamping the maximum to the user's stake (60%).
 * @param ticks Preset stops rendered as dots overlaid on the track.
 * @param testTag Compose-UI test tag for the surrounding canvas.
 */
@Composable
fun SharesSlider(
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    range: IntRange = 1..60,
    ticks: List<Int> = listOf(10, 25, 33, 50),
    testTag: String = "sharesSlider",
) {
    val span = (range.last - range.first).coerceAtLeast(1).toFloat()
    val fraction = ((value - range.first).coerceAtLeast(0).toFloat() / span).coerceIn(0f, 1f)

    Canvas(
        modifier =
            modifier
                .fillMaxWidth()
                .height(24.dp)
                .testTag(testTag)
                .semantics {
                    contentDescription = "Share to transfer"
                    stateDescription = "$value percent"
                }
                .pointerInput(range, ticks) {
                    detectTapGestures { tap ->
                        onValueChange(snap(tap.x, size.width.toFloat(), range))
                    }
                }
                .pointerInput(range, ticks) {
                    detectDragGestures(
                        onDrag = { change, _ ->
                            change.consume()
                            onValueChange(snap(change.position.x, size.width.toFloat(), range))
                        },
                    )
                },
    ) {
        val trackHeight = 4f
        val centerY = size.height / 2f
        // Inactive track
        drawRoundRect(
            color = PantopusColors.appSurfaceSunken,
            topLeft = Offset(0f, centerY - trackHeight / 2f),
            size = Size(size.width, trackHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(trackHeight / 2f),
        )
        // Active track
        val activeWidth = size.width * fraction
        drawRoundRect(
            color = PantopusColors.primary600,
            topLeft = Offset(0f, centerY - trackHeight / 2f),
            size = Size(activeWidth, trackHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(trackHeight / 2f),
        )
        // Tick dots
        ticks.forEach { tick ->
            val tickFraction = ((tick - range.first).coerceAtLeast(0).toFloat() / span).coerceIn(0f, 1f)
            val tickX = size.width * tickFraction
            drawCircle(
                color = if (tick <= value) PantopusColors.appTextInverse else PantopusColors.appBorderStrong,
                radius = 2f,
                center = Offset(tickX, centerY),
            )
        }
        // Thumb
        val thumbRadius = 12f
        val thumbX = size.width * fraction
        drawCircle(
            color = PantopusColors.appSurface,
            radius = thumbRadius,
            center = Offset(thumbX, centerY),
        )
        drawCircle(
            color = PantopusColors.primary600,
            radius = thumbRadius,
            center = Offset(thumbX, centerY),
            style = Stroke(width = 2f),
        )
    }
}

private fun snap(
    locationX: Float,
    totalWidth: Float,
    range: IntRange,
): Int {
    if (totalWidth <= 0f) return range.first
    val clamped = locationX.coerceIn(0f, totalWidth)
    val span = (range.last - range.first).toFloat()
    val raw = (clamped / totalWidth) * span + range.first
    return kotlin.math.round(raw).toInt().coerceIn(range.first, range.last)
}
