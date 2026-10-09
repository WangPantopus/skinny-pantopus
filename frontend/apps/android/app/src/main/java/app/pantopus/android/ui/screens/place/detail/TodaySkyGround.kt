@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.CornerRadius
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
    /** Bins at the curb, in order: "garbage", "recycling", "yard_waste". */
    private val bins: List<String> = emptyList(),
    private val season: SkySeason = SkySeason.SUMMER,
    /** The home's kind and the far hill's lights. */
    details: SkyDetails = SkyDetails(),
) {
    private val night = moment.phase == SkyPalette.Phase.NIGHT
    private val home = details.home
    private val streetLights = details.streetLights

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
        if (streetLights > 0 && (moment.phase == SkyPalette.Phase.DUSK || night)) paintStreetLights(scene, streetLights)
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
        when (home) {
            SkyHome.HOUSE -> paintHouse(tones, house)
            SkyHome.TOWNHOUSE -> paintTownhouses(HomeLight(scene, moment), tones.house, house)
            SkyHome.APARTMENT -> paintApartment(HomeLight(scene, moment), tones.house, house)
            SkyHome.MOBILE -> paintMobileHome(HomeLight(scene, moment), tones.house, house)
        }
        if (bins.isNotEmpty()) paintBins(tones, house)
        if (cold && !still && home.chimney) paintSmoke(house)
        paintTrees(tones, house)
    }

    /** Bins at the curb left of the house, lit by the porch after dark. */
    private fun DrawScope.paintBins(
        tones: Tones,
        origin: Offset,
    ) {
        val right = origin.x - home.halfWidth - 2
        // At the curb: a little in front of the house.
        val base = origin.y + 8
        if (moment.phase == SkyPalette.Phase.DUSK || night) {
            val width = bins.size * 9f + 12
            drawRect(
                Brush.radialGradient(
                    listOf(SkyPalette.windowGlow.copy(alpha = 0.22f), SkyPalette.windowGlow.copy(alpha = 0f)),
                    Offset(right - width / 2 + 3, base - 5),
                    18f,
                ),
                topLeft = Offset(right - width, base - 22),
                size = Size(width + 6, 26f),
            )
        }
        bins.reversed().forEachIndexed { index, kind ->
            val colour =
                when (kind) {
                    "recycling" -> SkyPalette.binRecycling
                    "yard_waste" -> SkyPalette.binYard
                    else -> SkyPalette.binGarbage
                }
            val tint = colour.mixed(tones.house, if (night) 0.55f else 0.35f)
            val x = right - (index + 1) * 9 + 2
            drawRoundRect(tint, Offset(x, base - 9), Size(7f, 9f), CornerRadius(1.2f))
            drawRoundRect(tint, Offset(x - 0.6f, base - 10.6f), Size(8.2f, 2f), CornerRadius(0.8f))
        }
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

    /**
     * A round tree and a pine to the right of the house; both lean in the wind. The round tree
     * blossoms in spring, turns in autumn and is bare in winter.
     */
    private fun DrawScope.paintTrees(
        tones: Tones,
        origin: Offset,
    ) {
        val lean = if (condition == WeatherConditionCode.WIND && !still) (sin(scene.time * 2.2) * 0.08).toFloat() else 0f
        withTransform({
            // Beside the home, however wide it is.
            translate(origin.x + 11 + home.halfWidth, origin.y + 2)
            rotateRad(lean, pivot = Offset.Zero)
        }) {
            drawRect(tones.house, Offset(-1.5f, -12f), Size(3f, 12f))
            if (season == SkySeason.WINTER) {
                paintBareBranches(tones)
            } else {
                paintCanopy(tones)
                if (season == SkySeason.SPRING) paintBlossom()
                if (season == SkySeason.AUTUMN && !still) paintFallingLeaves()
            }
        }
        withTransform({
            translate(origin.x + 35 + home.halfWidth, origin.y + 3)
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
            drawPath(needles, tones.house.mixed(SkyPalette.pine, if (night) 0.12f else 0.4f))
        }
    }

    /** A leafy crown lit from the upper left over its darker shade side, which turns deep red in autumn. */
    private fun DrawScope.paintCanopy(tones: Tones) {
        val leaf =
            when (season) {
                SkySeason.SPRING -> SkyPalette.treeSpring
                SkySeason.AUTUMN -> SkyPalette.treeAutumn
                else -> SkyPalette.treeSummer
            }
        val amount = if (night) 0.22f else 0.62f
        val shade =
            if (season == SkySeason.AUTUMN) {
                tones.house.mixed(SkyPalette.treeAutumnDeep, if (night) 0.2f else 0.6f)
            } else {
                tones.house.mixed(leaf, amount * 0.6f)
            }
        drawOval(shade, Offset(-10f, -30f), Size(22f, 21f))
        drawOval(tones.house.mixed(leaf, amount), Offset(-11f, -31.5f), Size(17f, 16f))
    }

    private fun DrawScope.paintBareBranches(tones: Tones) {
        val branches =
            Path().apply {
                moveTo(0f, -10f)
                lineTo(0f, -30f)
                // Each twig: where it leaves the trunk, and its tip.
                listOf(
                    floatArrayOf(-16f, -9f, -27f),
                    floatArrayOf(-19f, 8f, -29f),
                    floatArrayOf(-24f, -5f, -33f),
                    floatArrayOf(-25f, 5f, -34f),
                ).forEach { twig ->
                    moveTo(0f, twig[0])
                    lineTo(twig[1], twig[2])
                }
            }
        drawPath(branches, tones.house, style = Stroke(width = 1.6f, cap = StrokeCap.Round))
    }

    private fun DrawScope.paintBlossom() {
        val tint = SkyPalette.blossom.copy(alpha = if (night) 0.35f else 0.9f)
        listOf(-6f to -26f, 3f to -28f, 7f to -22f, -3f to -19f, -8f to -20f, 2f to -16f).forEach { (x, y) ->
            drawCircle(tint, 1.5f, Offset(x, y))
        }
    }

    /** Two leaves drifting down from the canopy on a loop. */
    private fun DrawScope.paintFallingLeaves() {
        repeat(2) { index ->
            val progress = (scene.time * 0.22 + index * 0.5) % 1.0
            withTransform({
                translate((6 - index * 12 + sin(progress * 9 + index) * 4).toFloat(), (-20 + progress * 22).toFloat())
                rotateRad((progress * 6 + index).toFloat(), pivot = Offset.Zero)
            }) {
                val alpha = (if (night) 0.4f else 0.85f) * (1 - progress.toFloat() * 0.7f)
                drawOval(SkyPalette.treeAutumn.copy(alpha = alpha), Offset(-2f, -1f), Size(4f, 2f))
            }
        }
    }

    companion object {
        /** Where the bins stand in a card [width] × [height] dp, for the tap target over them. */
        fun binsCenter(
            width: Float,
            height: Float,
            count: Int,
            home: SkyHome = SkyHome.HOUSE,
        ): Offset =
            // Horizon (34 above the bottom), down 7 to the house's ground line and 8 more to the curb,
            // then up 5 to the bins' middle.
            Offset(width * 0.7f - home.halfWidth - 2 - (count * 9f - 2) / 2, height - 34 + 7 + 8 - 5)
    }
}
