@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotateRad
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.theme.SkyPalette
import app.pantopus.android.ui.theme.SkyPalette.mixed
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Draws the living sky for [TodaySkyHero]: sky gradient, stars, sun or moon,
 * clouds, rain, snow, fog, wind, lightning, then the hills, the house and its
 * trees. Pure drawing in dp units (the caller scales the canvas): the same
 * inputs always give the same picture, and [still] gives the motionless one.
 * Parity twin of iOS `TodaySkyPainter.swift` and `TodaySkyGround.swift`; the numbers match.
 */

/** The scene's finer details: the meteor shower, smoke and rain, and the home and its street. */
data class SkyDetails(
    /** A meteor shower's peak night: shooting stars whatever the note says. */
    val meteorShower: Boolean = false,
    /** Wildfire smoke, 0 (none) to 0.85: an amber veil and a dim red sun. */
    val smoke: Double = 0.0,
    /** How hard it rains, 0 (a light shower) to 1 (a downpour). */
    val rain: Double = 0.5,
    /** The resident's kind of home (`TodaySkyHomes.kt`). */
    val home: SkyHome = SkyHome.HOUSE,
    /** Lights on the far hill after dusk, from the block's density bucket. */
    val streetLights: Int = 0,
)

class TodaySkyPainter(
    private val condition: WeatherConditionCode,
    private val moment: SkyMoment,
    /** The current temperature, °F: smoke from the chimney below 50, frost at 32. */
    private val temperature: Double,
    /** Today's note, when it has a picture: bins at the curb. */
    private val note: SkyNote?,
    private val season: SkySeason,
    private val still: Boolean,
    private val details: SkyDetails = SkyDetails(),
) {
    private val smoke = details.smoke
    private val weather = skyWeather(condition)
    private val night = moment.phase == SkyPalette.Phase.NIGHT

    /** The day's first and last golden hour warm the horizon until dawn's or dusk's own sky takes over (up to 0.5). */
    private val goldenWarmth =
        if (moment.phase == SkyPalette.Phase.DAY) {
            val evening = (moment.minutes - (moment.sunset - 60)) / 20
            val morning = (moment.sunrise + 60 - moment.minutes) / 20
            (maxOf(evening, morning).coerceIn(0.0, 1.0) * 0.5).toFloat()
        } else {
            0f
        }

    fun paint(
        scope: DrawScope,
        width: Float,
        height: Float,
        time: Double,
    ) {
        val scene = SkyScene(width, height, if (still) 2.0 else time, SkyPalette.sky(moment.phase, weather))
        val clear = weather == SkyPalette.Weather.CLEAR || weather == SkyPalette.Weather.PARTLY
        with(scope) {
            paintSky(scene)
            if (night && clear) paintStars(scene)
            if (night && clear && details.meteorShower) paintMeteors(scene, still)
            if (night) paintMoon(scene) else paintSun(scene)
            paintClouds(scene)
            paintRain(scene)
            paintSnow(scene)
            if (condition == WeatherConditionCode.WIND) paintWind(scene)
            if (weather == SkyPalette.Weather.STORM && !still) paintLightning(scene)
            if (smoke > 0) paintSmoke(scene, smoke, night)
            TodaySkyGround(scene, weather, moment, condition, temperature < 50, still, note?.bins.orEmpty(), season, details).paint(this)
            // Fog hugs the ground, in front of the house and below the reading.
            paintFog(scene)
            paintScrim(scene)
            if (temperature <= 32) paintFrost(scene)
        }
    }

    private fun DrawScope.paintSky(scene: SkyScene) {
        drawRect(
            brush =
                Brush.verticalGradient(
                    0f to scene.sky.top,
                    0.55f to scene.sky.mid.mixed(SkyPalette.sunLow, goldenWarmth * 0.25f),
                    1f to scene.sky.bottom.mixed(SkyPalette.sunLow, goldenWarmth * 0.6f),
                    startY = 0f,
                    endY = scene.horizon + 10f,
                ),
            size = Size(scene.width, scene.height),
        )
    }

    private fun DrawScope.paintStars(scene: SkyScene) {
        val random = SkyRandom(7)
        repeat(46) {
            val x = random.next() * scene.width
            val y = random.next() * scene.horizon * 0.8
            val radius = 0.5 + random.next() * 1.1
            val speed = 0.6 + random.next() * 1.6
            val offset = random.next() * 6.28
            val twinkle = if (still) 0.75 else 0.45 + 0.55 * (0.5 + 0.5 * sin(scene.time * speed + offset))
            drawCircle(SkyPalette.white.copy(alpha = (0.85 * twinkle).toFloat()), radius.toFloat(), Offset(x.toFloat(), y.toFloat()))
        }
    }

    private fun DrawScope.paintSun(scene: SkyScene) {
        // The sun rides the right half of the sky: low at dawn and dusk, high at noon.
        val fraction = moment.dayFraction
        val x = (scene.width * (0.56 + 0.32 * fraction)).toFloat()
        val y = (scene.horizon - 18 - sin(PI * fraction) * (scene.horizon - 58)).toFloat()
        val warm = moment.phase == SkyPalette.Phase.DAWN || moment.phase == SkyPalette.Phase.DUSK
        // In the golden hour the sun warms and a wide halo of gold spreads around it.
        val lit = if (warm) SkyPalette.sunLow else SkyPalette.sunHigh.mixed(SkyPalette.sunLow, goldenWarmth * 2)
        // Through smoke the sun is a dim red disc without rays.
        val core = lit.mixed(SkyPalette.smokeSun, (smoke * 1.2).toFloat())
        val veiled = weather != SkyPalette.Weather.CLEAR && weather != SkyPalette.Weather.PARTLY
        glow(scene, Offset(x, y), if (smoke > 0) 56f else 78f, core, if (veiled) 0.22f else 0.45f)
        if (veiled) return
        if (smoke > 0) {
            drawCircle(core.copy(alpha = 0.9f), 16f, Offset(x, y))
            return
        }
        if (goldenWarmth > 0f) glow(scene, Offset(x, y), 130f, SkyPalette.sunLow, goldenWarmth * 0.7f)
        translate(x, y) {
            rotateRad(if (still) 0f else (scene.time * 0.12).toFloat(), pivot = Offset.Zero) {
                repeat(12) { index ->
                    val angle = index / 12.0 * 2 * PI
                    val pulse = if (still) 0.0 else sin(scene.time * 1.4 + index) * 2
                    drawLine(
                        core.copy(alpha = 0.55f),
                        Offset((cos(angle) * 25).toFloat(), (sin(angle) * 25).toFloat()),
                        Offset((cos(angle) * (33 + pulse)).toFloat(), (sin(angle) * (33 + pulse)).toFloat()),
                        strokeWidth = 2f,
                        cap = StrokeCap.Round,
                    )
                }
            }
        }
        drawCircle(core, 18f, Offset(x, y))
        drawCircle(SkyPalette.white.copy(alpha = 0.35f), 8f, Offset(x - 5, y - 5))
    }

    private fun DrawScope.paintMoon(scene: SkyScene) {
        if (weather == SkyPalette.Weather.WET || weather == SkyPalette.Weather.SNOW || weather == SkyPalette.Weather.STORM) return
        val center = Offset(scene.width * 0.8f, 50f)
        val veiled = weather == SkyPalette.Weather.OVERCAST || weather == SkyPalette.Weather.FOG
        // A full moon lights up more of the sky.
        val full = abs(moment.moonPhase - 0.5) < 0.034
        glow(
            scene,
            center,
            if (full) 92f else 70f,
            SkyPalette.moonGlow,
            if (veiled) {
                0.12f
            } else if (full) {
                0.3f
            } else {
                0.22f
            },
        )
        if (veiled) return
        drawCircle(SkyPalette.moonShadow.copy(alpha = 0.13f), 17f, center)
        val disc = moonPath(center, 17f, moment.moonPhase)
        drawPath(disc, SkyPalette.moon)
        // Faint maria on the lit part, so it reads as the moon and not a lamp.
        clipPath(disc) {
            MARIA.forEach { (dx, dy, radius) ->
                drawCircle(SkyPalette.moonShadow.copy(alpha = 0.45f), radius, Offset(center.x + dx, center.y + dy))
            }
        }
    }

    private fun DrawScope.paintClouds(scene: SkyScene) {
        when (weather) {
            SkyPalette.Weather.CLEAR -> Unit
            SkyPalette.Weather.PARTLY -> paintPuffs(scene)
            else -> paintDeck(scene)
        }
    }

    /** Two puffs near the sun or moon; they sway rather than cross the reading. */
    private fun DrawScope.paintPuffs(scene: SkyScene) {
        val tint =
            when (moment.phase) {
                SkyPalette.Phase.NIGHT -> SkyPalette.cloudNight
                SkyPalette.Phase.DAWN -> SkyPalette.cloudDawn
                SkyPalette.Phase.DUSK -> SkyPalette.cloudDusk
                SkyPalette.Phase.DAY -> SkyPalette.white
            }

        fun sway(offset: Double) = if (still) 0f else (sin(scene.time * 0.18 + offset) * 12).toFloat()
        cloud(scene.width * 0.5f + sway(0.0), 70f, 96f, tint, if (night) 0.9f else 0.88f)
        cloud(scene.width * 0.74f + sway(2.0), 92f, 120f, tint, if (night) 0.95f else 0.97f)
    }

    /** A deck across the top, close to the sky's own colour so the reading stays legible. */
    private fun DrawScope.paintDeck(scene: SkyScene) {
        val storm = weather == SkyPalette.Weather.STORM
        val deck =
            if (storm) scene.sky.top.mixed(SkyPalette.black, 0.1f) else scene.sky.top.mixed(SkyPalette.white, if (night) 0.08f else 0.16f)
        val lower =
            if (storm) scene.sky.mid.mixed(SkyPalette.black, 0.05f) else scene.sky.mid.mixed(SkyPalette.white, if (night) 0.06f else 0.2f)
        DECK.forEach { layer ->
            val span = scene.width + layer.width
            val x = scene.drift((layer.start * span).toDouble(), layer.speed, span.toDouble(), still) - layer.width
            cloud(x, layer.y, layer.width, if (layer.upper) deck else lower, if (layer.upper) 0.95f else 0.9f)
        }
    }

    private fun DrawScope.paintRain(scene: SkyScene) {
        if (weather != SkyPalette.Weather.WET && weather != SkyPalette.Weather.STORM) return
        val random = SkyRandom(11)
        // Fewer streaks for a passing shower, more for a downpour.
        val base =
            when {
                weather == SkyPalette.Weather.STORM -> 90
                condition == WeatherConditionCode.SLEET -> 40
                else -> 70
            }
        val count = (base * (0.6 + 0.8 * details.rain)).toInt()
        val path = Path()
        repeat(count) {
            val start = random.next() * (scene.width + 40)
            val speed = 380 + random.next() * 160
            val length = 9 + random.next() * 7
            val offset = random.next() * scene.height
            val fall = (offset + if (still) 0.0 else scene.time * speed) % (scene.height + length)
            val y = fall - length
            val x = start - (y + length) * 0.22
            path.moveTo(x.toFloat(), y.toFloat())
            path.lineTo((x - length * 0.22).toFloat(), (y + length).toFloat())
        }
        val color = if (night) SkyPalette.rainNight.copy(alpha = 0.45f) else SkyPalette.rainDay.copy(alpha = 0.55f)
        drawPath(path, color, style = Stroke(width = 1.2f, cap = StrokeCap.Round))
    }

    private fun DrawScope.paintSnow(scene: SkyScene) {
        if (weather != SkyPalette.Weather.SNOW && condition != WeatherConditionCode.SLEET) return
        val random = SkyRandom(23)
        val moving = if (still) 0.0 else scene.time
        repeat(if (condition == WeatherConditionCode.SLEET) 26 else 55) {
            val start = random.next() * scene.width
            val speed = 18 + random.next() * 24
            val radius = 1 + random.next() * 1.7
            val offset = random.next() * scene.height
            val amplitude = 5 + random.next() * 9
            val frequency = 0.5 + random.next() * 0.8
            val phase = random.next() * 6.28
            val opacity = 0.65 + random.next() * 0.3
            val y = (offset + moving * speed) % (scene.height + 8) - 4
            val x = start + sin(moving * frequency + phase) * amplitude
            drawCircle(SkyPalette.white.copy(alpha = opacity.toFloat()), radius.toFloat(), Offset(x.toFloat(), y.toFloat()))
        }
    }

    /**
     * Soft puffs of fog drifting along the ground, in front of the house and below the reading:
     * stretched radial glows, so no band ever shows an edge.
     */
    private fun DrawScope.paintFog(scene: SkyScene) {
        if (weather != SkyPalette.Weather.FOG) return
        val tint = if (night) SkyPalette.fogNight else SkyPalette.fogDay
        val glow = Brush.radialGradient(listOf(tint.copy(alpha = if (night) 0.22f else 0.45f), tint.copy(alpha = 0f)), Offset.Zero, 13f)
        val span = scene.width * 1.6
        repeat(6) { index ->
            val speed = if (index % 2 == 0) 7.0 else -5.0
            val x = scene.drift(index * span / 6.0, speed, span.toDouble(), still) - scene.width * 0.3f
            withTransform({
                translate(x, scene.horizon - 12 + (index % 3) * 12)
                scale(9f, 1f, pivot = Offset.Zero)
            }) {
                drawCircle(glow, radius = 13f, center = Offset.Zero)
            }
        }
    }

    private fun DrawScope.paintWind(scene: SkyScene) {
        val random = SkyRandom(31)
        val moving = if (still) 0.0 else scene.time
        repeat(4) {
            val span = scene.width + 60.0
            val speed = 55 + random.next() * 35
            val base = 40 + random.next() * 90
            val phase = random.next() * 6.28
            val x = scene.drift(random.next() * span, speed, span, still) - 30
            val y = (base + sin(moving * 2 + phase) * 8).toFloat()
            translate(x, y) {
                rotateRad((moving * 3 + phase).toFloat(), pivot = Offset.Zero) {
                    val color = if (night) SkyPalette.leafNight.copy(alpha = 0.7f) else SkyPalette.leafDay.copy(alpha = 0.85f)
                    drawOval(color, topLeft = Offset(-4f, -2f), size = Size(8f, 4f))
                }
            }
        }
        val streaks = Path()
        repeat(4) { index ->
            val span = scene.width + 160.0
            val x = scene.drift(index * 0.27 * span, 70.0 + index * 12, span, still) - 120
            val y = 40f + index * 26
            streaks.moveTo(x, y)
            streaks.cubicTo(x + 40, y - 6, x + 70, y + 6, x + 110, y)
        }
        drawPath(streaks, SkyPalette.white.copy(alpha = if (night) 0.28f else 0.5f), style = Stroke(width = 1.6f, cap = StrokeCap.Round))
    }

    /**
     * A soft double flash about every seven seconds: well under the three flashes a second that
     * photosensitivity guidance allows, and never drawn while motion is off (the painter is [still]).
     */
    private fun DrawScope.paintLightning(scene: SkyScene) {
        val period = 7.0
        val cycle = floor(scene.time / period)
        val random = SkyRandom(100 + cycle.toLong())
        val since = scene.time - cycle * period - (1 + random.next() * 4)
        val opacity =
            when {
                since >= 0 && since < 0.09 -> 0.28f
                since >= 0.17 && since < 0.25 -> 0.18f
                else -> 0f
            }
        if (opacity == 0f) return
        drawRect(SkyPalette.lightning.copy(alpha = opacity), size = Size(scene.width, scene.height))
        val x = (scene.width * (0.35 + random.next() * 0.5)).toFloat()
        val bolt =
            Path().apply {
                moveTo(x, 40f)
                lineTo(x - 8, 70f)
                lineTo(x + 4, 72f)
                lineTo(x - 6, scene.horizon - 20)
            }
        drawPath(bolt, SkyPalette.bolt.copy(alpha = 0.9f), style = Stroke(width = 2f))
    }

    /**
     * Darkens the left of the sky so the white reading keeps its contrast: with it every scene gives
     * the temperature and condition (large text) at least 3:1 and "NOW" 4.5:1; the chips carry their own backing.
     */
    private fun DrawScope.paintScrim(scene: SkyScene) {
        drawRect(
            brush =
                Brush.horizontalGradient(
                    listOf(SkyPalette.scrim.copy(alpha = 0.4f), SkyPalette.scrim.copy(alpha = 0f)),
                    startX = 0f,
                    endX = scene.width * 0.8f,
                ),
            size = Size(scene.width * 0.8f, scene.horizon),
        )
    }

    // ── Shapes ─────────────────────────────────────────────────

    private fun DrawScope.glow(
        scene: SkyScene,
        center: Offset,
        radius: Float,
        color: Color,
        opacity: Float,
    ) {
        drawRect(
            brush = Brush.radialGradient(listOf(color.copy(alpha = opacity), color.copy(alpha = 0f)), center = center, radius = radius),
            size = Size(scene.width, scene.height),
        )
    }

    /** A cloud [width] dp wide sitting on a flat base at [y], lit from above. */
    private fun DrawScope.cloud(
        x: Float,
        y: Float,
        width: Float,
        color: Color,
        opacity: Float,
    ) {
        withTransform({
            translate(x, y)
            scale(width, width, pivot = Offset.Zero)
        }) {
            drawPath(
                UNIT_CLOUD,
                Brush.verticalGradient(
                    listOf(color.mixed(SkyPalette.white, 0.22f).copy(alpha = opacity), color.copy(alpha = opacity)),
                    startY = -0.56f,
                    endY = 0f,
                ),
            )
        }
    }

    /** One cloud of the overcast deck: start (fraction of its track), base line, width, drift speed, row. */
    private class DeckCloud(
        val start: Float,
        val y: Float,
        val width: Float,
        val speed: Double,
        val upper: Boolean,
    )

    companion object {
        /** The moon's dark seas: offset from its centre and radius, in dp. */
        private val MARIA = listOf(Triple(-5f, -4f, 4.5f), Triple(4f, 2f, 3.5f), Triple(-1f, 7f, 2.8f), Triple(6f, -6f, 2f))

        private val DECK =
            listOf(
                DeckCloud(0f, 24f, 150f, 5.0, true),
                DeckCloud(0.3f, 18f, 170f, 5.0, true),
                DeckCloud(0.62f, 26f, 160f, 5.0, true),
                DeckCloud(0.9f, 20f, 140f, 5.0, true),
                DeckCloud(0.12f, 52f, 130f, 9.0, false),
                DeckCloud(0.5f, 60f, 150f, 9.0, false),
                DeckCloud(0.82f, 50f, 120f, 9.0, false),
            )

        /** A cloud one unit wide on a flat base at y = 0: four puffs and a base bar, unioned once. */
        private val UNIT_CLOUD: Path by lazy {
            var shape = Path().apply { addRect(Rect(0.2f, -0.14f, 0.86f, 0f)) }
            listOf(0.2f to 0.2f, 0.45f to 0.28f, 0.7f to 0.22f, 0.86f to 0.14f).forEach { (center, radius) ->
                val puff = Path().apply { addOval(Rect(center - radius, -2 * radius, center + radius, 0f)) }
                shape = Path().apply { op(shape, puff, PathOperation.Union) }
            }
            shape
        }

        /** The lit part of the moon for a phase (0 new → 0.5 full → 1 new); waxing lights the right side. */
        fun moonPath(
            center: Offset,
            radius: Float,
            phase: Double,
        ): Path {
            val terminator = cos(2 * PI * phase)
            val waxing = phase < 0.5
            val steps = 40
            val path = Path()
            for (step in 0..steps) {
                val y = -radius + 2 * radius * step / steps.toFloat()
                val edge = sqrt((radius * radius - y * y).coerceAtLeast(0f))
                val x = center.x + if (waxing) edge else -edge
                if (step == 0) path.moveTo(x, center.y + y) else path.lineTo(x, center.y + y)
            }
            for (step in steps downTo 0) {
                val y = -radius + 2 * radius * step / steps.toFloat()
                val edge = sqrt((radius * radius - y * y).coerceAtLeast(0f))
                path.lineTo(center.x + ((if (waxing) terminator else -terminator) * edge).toFloat(), center.y + y)
            }
            path.close()
            return path
        }
    }
}

/** Geometry and time shared by every layer of the sky, in dp. */
internal class SkyScene(
    val width: Float,
    val height: Float,
    val time: Double,
    val sky: SkyPalette.Sky,
) {
    val horizon = height - 34f

    /** A position that drifts at [speed] dp a second and wraps over [span]. */
    fun drift(
        base: Double,
        speed: Double,
        span: Double,
        still: Boolean,
    ): Float {
        val raw = (base + if (still) 0.0 else time * speed) % span
        return (if (raw < 0) raw + span else raw).toFloat()
    }
}

/** The scene's deterministic random numbers, so stars and raindrops keep their places (same sequence as iOS). */
class SkyRandom(seed: Long) {
    private var state = seed and 0xFFFFFFFFL

    fun next(): Double {
        state = (state * 1_664_525L + 1_013_904_223L) and 0xFFFFFFFFL
        return state / 4_294_967_296.0
    }
}
