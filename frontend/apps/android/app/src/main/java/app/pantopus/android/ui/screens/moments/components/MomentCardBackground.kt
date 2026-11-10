@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/** A text card's background (boards V3 and P2): one of six, each a 160° gradient. [wire] is the API's name. */
enum class MomentCardBackground(
    val wire: String,
    val label: String,
    val top: Color,
    val bottom: Color,
) {
    Teal("teal", "Teal", PantopusColors.momentCardTealTop, PantopusColors.momentCardTealBottom),
    Sky("sky", "Sky", PantopusColors.momentCardSkyTop, PantopusColors.momentCardSkyBottom),
    Green("green", "Green", PantopusColors.momentCardGreenTop, PantopusColors.momentCardGreenBottom),
    Amber("amber", "Amber", PantopusColors.momentCardAmberTop, PantopusColors.momentCardAmberBottom),
    Rose("rose", "Rose", PantopusColors.momentCardRoseTop, PantopusColors.momentCardRoseBottom),
    Slate("slate", "Slate", PantopusColors.momentCardSlateTop, PantopusColors.momentCardSlateBottom),
    ;

    companion object {
        fun fromWire(value: String?): MomentCardBackground = entries.firstOrNull { it.wire == value } ?: Teal
    }
}

/** Paints [background]'s 160° gradient behind the content, as CSS `linear-gradient(160deg, top, bottom)` does. */
fun Modifier.momentCardGradient(background: MomentCardBackground): Modifier =
    drawBehind {
        // CSS angles start at "to top" and turn clockwise; the line runs through the middle, long enough to reach
        // the corners.
        val radians = Math.toRadians(160.0)
        val dirX = sin(radians).toFloat()
        val dirY = -cos(radians).toFloat()
        val half = (abs(size.width * dirX) + abs(size.height * dirY)) / 2f
        val center = Offset(size.width / 2f, size.height / 2f)
        drawRect(
            brush =
                Brush.linearGradient(
                    colors = listOf(background.top, background.bottom),
                    start = Offset(center.x - dirX * half, center.y - dirY * half),
                    end = Offset(center.x + dirX * half, center.y + dirY * half),
                ),
        )
    }
