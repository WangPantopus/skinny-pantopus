package app.pantopus.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

private const val GRID = 24f
private const val LINE_WIDTH = 1.75f
private const val DOT_RADIUS = 1.15f
private const val DOT_Y = 11f
private const val BUBBLE_PATH = "M4.09 14.86A8.8 8.8 0 1 1 9.87 19.54C7.35 18.91 5.8 20.6 3.5 21.3C3.9 19.4 4.3 17.2 4.09 14.86Z"

private val bubble: Path by lazy { PathParser().parsePathString(BUBBLE_PATH).toPath() }
private val dotCenters = listOf(Offset(8.1f, DOT_Y), Offset(12f, DOT_Y), Offset(15.9f, DOT_Y))

/**
 * The Messages button's bubble (founder decision 2026-11-08, option "Sky"): one drawing on Android, iOS and web in
 * place of the three system icons they used. At rest it is a pale-blue bubble outlined in the brand blue with three
 * dots; with unread messages it fills solid with white dots. The unread count stays the red badge [MessagesButton]
 * draws over it.
 */
@Composable
fun MessagesGlyph(
    unread: Boolean,
    modifier: Modifier = Modifier,
    size: Dp = Spacing.s6,
) {
    val fill = if (unread) PantopusColors.primary600 else PantopusColors.primary100
    val dot = if (unread) PantopusColors.appTextInverse else PantopusColors.primary600
    Canvas(modifier = modifier.size(size)) {
        val unit = this.size.width / GRID
        withTransform({ scale(unit, unit, pivot = Offset.Zero) }) {
            drawPath(bubble, fill)
            drawPath(
                bubble,
                PantopusColors.primary600,
                style = Stroke(width = LINE_WIDTH, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
            dotCenters.forEach { drawCircle(dot, radius = DOT_RADIUS, center = it) }
        }
    }
}
