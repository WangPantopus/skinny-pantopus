@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotateRad
import androidx.compose.ui.graphics.drawscope.translate
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.theme.SkyPalette
import kotlin.math.roundToInt
import kotlin.math.sin

/*
 * The wind in the living sky. The forecast's sustained speed sets how hard it blows: the trees
 * lean and sway, the chimney smoke bends, the clouds drift, rain and snow slant, and from 12 mph
 * streaks of air (from 20 a few leaves too) cross the sky. Under 5 mph it's calm, and none of
 * that moves. With motion off the trees hold a still lean. The scene looks south (the sun rises
 * on the left), so a west wind blows to the left. Parity twin of iOS `SkyWind.swift`; the
 * numbers match.
 */

/** How hard ([mph], as the picture draws it) and which way ([toward]: 1 right, -1 left) the wind blows. */
data class SkyWind(
    val mph: Double,
    val toward: Double,
) {
    /** Under 5 mph: nothing leans, drifts or slants. */
    val calm: Boolean get() = mph < 5

    /** 0 when calm, 1 from 35 mph. */
    val strength: Double get() = ((mph - 5) / 30).coerceIn(0.0, 1.0)

    /** How fast the clouds drift, as a share of a 10 mph breeze's pace. */
    val cloudPace: Double get() = if (calm) 0.0 else mph / 10

    /** How far rain and snow move sideways for each dp they fall. */
    val slant: Double get() = if (calm) 0.0 else minOf(mph, 40.0) * 0.022

    /** Streaks of air from 12 mph: two, then one more every 6 mph, up to five. */
    val streaks: Int get() = if (mph < 12) 0 else minOf(5, 2 + ((mph - 10) / 6).toInt())

    /** How far the two fair-weather clouds sway either side, in dp. */
    val sway: Double get() = if (calm) 0.0 else minOf(4 + mph * 0.8, 20.0)

    /** How quickly they sway: faster in a stronger wind. */
    val swayPace: Double get() = 0.18 * maxOf(1.0, mph / 10)

    /** The trees' lean in radians, toward where the wind blows: a still lean, or one that gusts a little further and back. */
    fun lean(
        time: Double,
        still: Boolean,
    ): Double {
        val bend = toward * strength
        if (still) return bend * 0.2
        val pace = 1.4 + 1.2 * strength
        val gust = 0.6 * sin(time * pace) + 0.4 * sin(time * pace * 0.43 + 1.3)
        return bend * (0.2 + 0.045 * gust)
    }

    companion object {
        /** The 16 compass points, clockwise from north. */
        private val POINTS = listOf("N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW")

        /** A forecast without a speed reads as a light breeze, and a "windy" one blows at 20 or more. */
        fun of(
            mph: Double?,
            from: String?,
            condition: WeatherConditionCode,
        ): SkyWind {
            val windy = condition == WeatherConditionCode.WIND
            val known = mph ?: if (windy) 20.0 else 10.0
            return SkyWind(if (windy) maxOf(known, 20.0) else maxOf(known, 0.0), toward(from))
        }

        /**
         * From the west side (SSW to NNW) the wind blows east, to the left; due north, due south or
         * unknown it blows to the right, the way the clouds always drifted.
         */
        fun toward(direction: String?): Double {
            val index = POINTS.indexOf(direction?.uppercase())
            return if (index >= 9) -1.0 else 1.0
        }

        /** The chip under the reading from 15 mph, as shown and as TalkBack says it: "Wind 18 mph", "wind 18 miles per hour". */
        fun chip(mph: Double?): Pair<String, String>? =
            mph?.roundToInt()?.takeIf { it >= 15 }?.let { "Wind $it mph" to "wind $it miles per hour" }
    }
}

/**
 * Streaks of air crossing the sky, more and faster in a stronger wind, and from 20 mph a few leaves
 * (none from the bare winter tree).
 */
internal fun DrawScope.paintWind(
    scene: SkyScene,
    wind: SkyWind,
    night: Boolean,
    still: Boolean,
    season: SkySeason,
) {
    val moving = if (still) 0.0 else scene.time

    // A position along the wind, as x in the picture: mirrored when it blows to the left.
    fun across(along: Float) = if (wind.toward < 0) scene.width - along else along

    if (wind.mph >= 20 && season != SkySeason.WINTER) {
        val random = SkyRandom(31)
        val color = if (night) SkyPalette.leafNight.copy(alpha = 0.7f) else SkyPalette.leafDay.copy(alpha = 0.85f)
        repeat(4) {
            val span = scene.width + 60.0
            val speed = wind.mph + 35 + random.next() * 35
            val base = 40 + random.next() * 90
            val phase = random.next() * 6.28
            val along = scene.drift(random.next() * span, speed, span, still) - 30
            translate(across(along), (base + sin(moving * 2 + phase) * 8).toFloat()) {
                rotateRad((wind.toward * (moving * 3 + phase)).toFloat(), pivot = Offset.Zero) {
                    drawOval(color, topLeft = Offset(-4f, -2f), size = Size(8f, 4f))
                }
            }
        }
    }
    val streaks = Path()
    val span = scene.width + 160.0
    repeat(wind.streaks) { index ->
        val tail = scene.drift(index * 0.27 * span, 40 + wind.mph * 2.5 + index * 12, span, still) - 120
        val y = 36f + index * 23
        streaks.moveTo(across(tail), y)
        streaks.cubicTo(across(tail + 40), y - 6, across(tail + 70), y + 6, across(tail + 110), y)
    }
    val opacity = (if (night) 0.28 else 0.5) * (0.55 + 0.45 * wind.strength)
    drawPath(streaks, SkyPalette.white.copy(alpha = opacity.toFloat()), style = Stroke(width = 1.6f, cap = StrokeCap.Round))
}
