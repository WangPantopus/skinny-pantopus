@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import app.pantopus.android.ui.theme.SkyPalette
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin

/*
 * The sky's rarer pictures, each drawn only when it's true: shooting stars on a
 * meteor shower's peak night, and frost creeping in from the card's corners when
 * it's freezing. Parity twin of iOS `TodaySkyMoments.swift`; the numbers match.
 */

/** One shooting star every few seconds across the upper right of the sky; with motion off, a single faint streak holds still. */
internal fun DrawScope.paintMeteors(
    scene: SkyScene,
    still: Boolean,
) {
    val period = 4.5
    val cycle = if (still) 0.0 else floor(scene.time / period)
    val random = SkyRandom(500 + cycle.toLong())
    val start = 0.3 + random.next() * 1.5
    // A streak lasts 0.8 s.
    val progress = if (still) 0.6 else (scene.time - cycle * period - start) / 0.8
    if (progress < 0 || progress > 1) return
    val x = scene.width * (0.38 + random.next() * 0.34)
    val y = 10 + random.next() * scene.horizon * 0.3
    // Heading down and to the right, away from the reading.
    val angle = PI * (0.12 + random.next() * 0.1)
    val travel = 110 * progress
    val head = Offset((x + cos(angle) * travel).toFloat(), (y + sin(angle) * travel).toFloat())
    val tail = Offset((x + cos(angle) * (travel - 46)).toFloat(), (y + sin(angle) * (travel - 46)).toFloat())
    val fade = (sin(PI * progress) * if (still) 0.6 else 1.0).toFloat()
    drawLine(
        Brush.linearGradient(listOf(SkyPalette.white.copy(alpha = 0f), SkyPalette.white.copy(alpha = 0.9f * fade)), tail, head),
        tail,
        head,
        strokeWidth = 1.6f,
        cap = StrokeCap.Round,
    )
    drawCircle(SkyPalette.white.copy(alpha = fade), 1.6f, head)
}

/** Frost from three corners (never the top left, where the reading sits): a pale haze and a few crystals with side shoots. */
internal fun DrawScope.paintFrost(scene: SkyScene) {
    val corners = listOf(Offset(scene.width, 0f), Offset(0f, scene.height), Offset(scene.width, scene.height))
    val random = SkyRandom(41)
    val crystals = Path()
    corners.forEach { corner ->
        drawRect(
            Brush.radialGradient(listOf(SkyPalette.frost.copy(alpha = 0.38f), SkyPalette.frost.copy(alpha = 0f)), corner, 64f),
            size = Size(scene.width, scene.height),
        )
        val inward = atan2((scene.height / 2 - corner.y).toDouble(), (scene.width / 2 - corner.x).toDouble())
        repeat(7) {
            val angle = inward + (random.next() - 0.5) * 1.4
            val length = 18 + random.next() * 26
            val offset = random.next() * 8
            val startX = corner.x + cos(angle) * offset
            val startY = corner.y + sin(angle) * offset
            crystals.moveTo(startX.toFloat(), startY.toFloat())
            crystals.lineTo((startX + cos(angle) * length).toFloat(), (startY + sin(angle) * length).toFloat())
            val midX = startX + cos(angle) * length * 0.55
            val midY = startY + sin(angle) * length * 0.55
            listOf(-0.6, 0.6).forEach { side ->
                crystals.moveTo(midX.toFloat(), midY.toFloat())
                crystals.lineTo((midX + cos(angle + side) * length * 0.35).toFloat(), (midY + sin(angle + side) * length * 0.35).toFloat())
            }
        }
    }
    drawPath(crystals, SkyPalette.frost.copy(alpha = 0.55f), style = Stroke(width = 0.9f, cap = StrokeCap.Round))
}
