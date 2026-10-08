@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotateRad
import androidx.compose.ui.graphics.drawscope.withTransform
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.theme.SkyPalette
import app.pantopus.android.ui.theme.SkyPalette.mixed
import kotlin.math.sin

/**
 * The bottom of the living sky: two hills, the resident's house and two trees as silhouettes in the
 * horizon's own colour. Windows glow after dusk (one stays lit late at night), the chimney smokes
 * below 50°F, snow caps the roof and hills, and the trees lean in the wind.
 * Parity twin of iOS `TodaySkyGround.swift`.
 */
internal class TodaySkyGround(
    private val scene: SkyScene,
    private val weather: SkyPalette.Weather,
    private val moment: SkyMoment,
    private val condition: WeatherConditionCode,
    private val cold: Boolean,
    private val still: Boolean,
) {
    private val night = moment.phase == SkyPalette.Phase.NIGHT

    private class Tones(
        val backHill: Color,
        val frontHill: Color,
        val house: Color,
    )

    private fun tones(): Tones {
        val base = scene.sky.bottom
        if (weather == SkyPalette.Weather.SNOW) {
            return if (night) {
                Tones(SkyPalette.snowHillBackNight, SkyPalette.snowHillFrontNight, SkyPalette.snowHouseNight)
            } else {
                Tones(SkyPalette.snowHillBackDay, SkyPalette.snowHillFrontDay, SkyPalette.snowHouseDay)
            }
        }
        return Tones(
            base.mixed(SkyPalette.ink, if (night) 0.45f else 0.42f),
            base.mixed(SkyPalette.ink, if (night) 0.62f else 0.6f),
            base.mixed(SkyPalette.ink, if (night) 0.75f else 0.72f),
        )
    }

    fun paint(scope: DrawScope) = with(scope) { paintGround() }

    private fun DrawScope.paintGround() {
        val tones = tones()
        val w = scene.width
        val h = scene.height
        val y = scene.horizon
        val back =
            Path().apply {
                moveTo(0f, y + 4)
                cubicTo(w * 0.22f, y - 16, w * 0.42f, y - 2, w * 0.6f, y - 10)
                cubicTo(w * 0.78f, y - 18, w * 0.9f, y - 6, w, y - 12)
                lineTo(w, h)
                lineTo(0f, h)
                close()
            }
        drawPath(back, tones.backHill)
        val front =
            Path().apply {
                moveTo(0f, y + 14)
                cubicTo(w * 0.25f, y + 2, w * 0.5f, y + 16, w * 0.72f, y + 6)
                cubicTo(w * 0.86f, y, w * 0.94f, y + 8, w, y + 4)
                lineTo(w, h)
                lineTo(0f, h)
                close()
            }
        drawPath(front, tones.frontHill)
        val house = Offset(w * 0.7f, y + 7)
        paintHouse(tones, house)
        if (cold && !still) paintSmoke(house)
        paintTrees(tones, house)
    }

    /** A 40 × 26 dp house with its door on the ground line at [origin]. */
    private fun DrawScope.paintHouse(
        tones: Tones,
        origin: Offset,
    ) {
        val (x, y) = origin
        // Filled one part at a time so overlapping parts never cancel out.
        drawRect(tones.house, Offset(x - 20, y - 26), Size(40f, 26f))
        drawRect(tones.house, Offset(x + 8, y - 44), Size(6f, 14f))
        val roof =
            Path().apply {
                moveTo(x - 25, y - 25)
                lineTo(x, y - 46)
                lineTo(x + 25, y - 25)
                close()
            }
        drawPath(roof, tones.house)
        if (weather == SkyPalette.Weather.SNOW) {
            val snow =
                Path().apply {
                    moveTo(x - 24, y - 26)
                    lineTo(x, y - 45)
                    lineTo(x + 24, y - 26)
                }
            drawPath(snow, SkyPalette.white, style = Stroke(width = 3f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
        val lit = moment.phase == SkyPalette.Phase.DUSK || night
        if (lit) {
            drawRect(
                brush =
                    Brush.radialGradient(
                        listOf(SkyPalette.windowGlow.copy(alpha = 0.28f), SkyPalette.windowGlow.copy(alpha = 0f)),
                        center = Offset(x, y - 12),
                        radius = 40f,
                    ),
                topLeft = Offset(x - 50, y - 60),
                size = Size(100f, 70f),
            )
        }
        val window = if (lit) SkyPalette.windowGlow else scene.sky.bottom.mixed(SkyPalette.white, 0.15f)
        if (!(lit && moment.lateNight)) drawRect(window, Offset(x - 14, y - 18), Size(8f, 7f))
        drawRect(window, Offset(x + 6, y - 18), Size(8f, 7f))
        val door = if (lit) SkyPalette.windowGlow.copy(alpha = 0.55f) else scene.sky.bottom.mixed(SkyPalette.ink, 0.55f)
        drawRect(door, Offset(x - 3, y - 11), Size(6f, 11f))
    }

    /** Three puffs rising from the chimney on a loop. */
    private fun DrawScope.paintSmoke(origin: Offset) {
        repeat(3) { index ->
            val progress = (scene.time * 0.35 + index / 3.0) % 1.0
            val x = origin.x + 11 + sin(progress * 5 + index) * 3 + progress * 10
            val y = origin.y - 46 - progress * 34
            drawCircle(
                SkyPalette.smoke.copy(alpha = (0.35 * (1 - progress)).toFloat()),
                (3 + progress * 6).toFloat(),
                Offset(x.toFloat(), y.toFloat()),
            )
        }
    }

    /** A round tree and a pine to the right of the house; both lean in the wind. */
    private fun DrawScope.paintTrees(
        tones: Tones,
        origin: Offset,
    ) {
        val lean = if (condition == WeatherConditionCode.WIND && !still) (sin(scene.time * 2.2) * 0.08).toFloat() else 0f
        withTransform({
            translate(origin.x + 36, origin.y + 2)
            rotateRad(lean, pivot = Offset.Zero)
        }) {
            drawRect(tones.house, Offset(-1.5f, -12f), Size(3f, 12f))
            drawCircle(tones.house, 11f, Offset(0f, -20f))
        }
        withTransform({
            translate(origin.x + 60, origin.y + 3)
            rotateRad(lean * 0.7f, pivot = Offset.Zero)
        }) {
            drawRect(tones.house, Offset(-1.5f, -7f), Size(3f, 8f))
            val needles =
                Path().apply {
                    moveTo(-9f, -6f)
                    lineTo(0f, -34f)
                    lineTo(9f, -6f)
                    close()
                }
            drawPath(needles, tones.house)
        }
    }
}
