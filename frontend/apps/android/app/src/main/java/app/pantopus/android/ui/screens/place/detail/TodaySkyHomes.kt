@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import app.pantopus.android.ui.theme.SkyPalette
import app.pantopus.android.ui.theme.SkyPalette.mixed

/*
 * The resident's own kind of home in the scene (a house, a row of townhouses, a small apartment
 * block, a mobile home), and the street lighting up after dark: warm windows along the far hill,
 * more of them as more verified homes join the block. The lights follow the k-anonymous density
 * bucket, never a count, so nothing can be read back from them. Parity twin of iOS
 * `TodaySkyHomes.swift`; the numbers match.
 */

/** The shape the scene draws for the resident's home. */
enum class SkyHome(
    /** Half the width it takes on the ground, for the bins and the trees. */
    val halfWidth: Float,
    val chimney: Boolean,
) {
    HOUSE(25f, true),
    TOWNHOUSE(38f, true),
    APARTMENT(26f, false),
    MOBILE(29f, false),
    ;

    companion object {
        /** From the home record's `home_type`; a house when it's unknown. */
        fun of(homeType: String?): SkyHome =
            when (homeType) {
                "townhouse" -> TOWNHOUSE
                "apartment", "condo", "studio", "multi_unit" -> APARTMENT
                "mobile_home", "trailer", "rv" -> MOBILE
                else -> HOUSE
            }
    }
}

object SkyStreet {
    /** Lights on the far hill for the block's density bucket: none, a couple, a few, many. */
    fun lights(bucket: String?): Int =
        when (bucket) {
            "forming" -> 2
            "few" -> 4
            "growing" -> 7
            else -> 0
        }

    /**
     * Where the lights go, in the order they appear: along the far hill's right-hand curve past the
     * pine (how far along it), and how far below its crest, so they gather like a hillside of windows.
     */
    internal val SPOTS = listOf(0.8 to 3f, 0.9 to 6f, 0.72 to 4f, 0.85 to 8f, 0.96 to 4f, 0.76 to 9f, 0.68 to 7f)
}

/** The light the home drawings share: lamps after dusk, plain glass by day. */
internal class HomeLight(
    private val scene: SkyScene,
    val moment: SkyMoment,
) {
    val lit = moment.phase == SkyPalette.Phase.DUSK || moment.phase == SkyPalette.Phase.NIGHT

    fun window(lit: Boolean): Color = if (lit) SkyPalette.windowGlow else scene.sky.bottom.mixed(SkyPalette.white, 0.15f)

    val door: Color
        get() = if (lit) SkyPalette.windowGlow.copy(alpha = 0.55f) else scene.sky.bottom.mixed(SkyPalette.ink, 0.55f)
}

private fun DrawScope.porchGlow(
    light: HomeLight,
    origin: Offset,
    width: Float,
) {
    if (!light.lit) return
    drawRect(
        Brush.radialGradient(
            listOf(SkyPalette.windowGlow.copy(alpha = 0.28f), SkyPalette.windowGlow.copy(alpha = 0f)),
            center = Offset(origin.x, origin.y - 12),
            radius = 40f,
        ),
        topLeft = Offset(origin.x - width, origin.y - 60),
        size = Size(width * 2, 70f),
    )
}

/** One house of the row: walls and a gable. */
private fun DrawScope.townhouse(
    center: Float,
    width: Float,
    ground: Float,
    tone: Color,
) {
    drawRect(tone, Offset(center - width / 2, ground - 25), Size(width, 25f))
    val roof =
        Path().apply {
            moveTo(center - width / 2 - 2, ground - 24)
            lineTo(center, ground - 40)
            lineTo(center + width / 2 + 2, ground - 24)
            close()
        }
    drawPath(roof, tone)
}

/** Three attached houses; the resident's is the middle one, with the chimney, and the neighbours' sit a shade darker. */
internal fun DrawScope.paintTownhouses(
    light: HomeLight,
    house: Color,
    origin: Offset,
) {
    val (x, y) = origin
    val side = house.mixed(SkyPalette.ink, 0.12f)
    townhouse(x - 26, 24f, y, side)
    townhouse(x + 26, 24f, y, side)
    townhouse(x, 28f, y, house)
    drawRect(house, Offset(x + 8, y - 42), Size(5f, 12f))
    porchGlow(light, origin, 44f)
    drawRect(light.window(light.lit), Offset(x - 10, y - 18), Size(7f, 6f))
    drawRect(light.window(light.lit && !light.moment.lateNight), Offset(x + 3, y - 18), Size(7f, 6f))
    // The neighbours' windows stay dark: only the resident's home is lit.
    listOf(x - 26, x + 26).forEach { drawRect(light.window(false), Offset(it - 4, y - 17), Size(8f, 6f)) }
    drawRect(light.door, Offset(x - 3, y - 10), Size(6f, 10f))
}

/** A small three-storey block with a flat roof; the resident's window is the warm one, a few others glow dimmer after dusk. */
internal fun DrawScope.paintApartment(
    light: HomeLight,
    house: Color,
    origin: Offset,
) {
    val (x, y) = origin
    drawRect(house, Offset(x - 26, y - 50), Size(52f, 50f))
    drawRect(house, Offset(x - 28, y - 52), Size(56f, 3f))
    porchGlow(light, origin, 48f)
    val random = SkyRandom(77)
    repeat(3) { row ->
        repeat(4) { column ->
            // Draw the dice for every window, so the lit ones never move.
            val neighbour = random.next() < 0.35
            val color =
                when {
                    row == 1 && column == 1 -> light.window(light.lit)
                    light.lit && neighbour -> SkyPalette.windowGlow.copy(alpha = 0.45f)
                    else -> light.window(false)
                }
            drawRect(color, Offset(x - 21 + column * 11f, y - 44 + row * 12f), Size(7f, 6f))
        }
    }
    drawRect(light.door, Offset(x - 4, y - 9), Size(8f, 9f))
}

/** A long, low home on a skirt. */
internal fun DrawScope.paintMobileHome(
    light: HomeLight,
    house: Color,
    origin: Offset,
) {
    val (x, y) = origin
    drawRoundRect(house, Offset(x - 29, y - 20), Size(58f, 17f), CornerRadius(3f))
    drawRect(house.mixed(SkyPalette.ink, 0.2f), Offset(x - 26, y - 3), Size(52f, 3f))
    porchGlow(light, origin, 46f)
    listOf(x - 22, x - 8, x + 12).forEachIndexed { index, left ->
        val late = index == 0 && light.moment.lateNight
        drawRect(light.window(light.lit && !late), Offset(left, y - 15), Size(8f, 5f))
    }
    drawRect(light.door, Offset(x + 3, y - 15), Size(6f, 12f))
}

/** After dusk, warm windows along the far hill: the verified homes on the block, as many as the density bucket allows. */
internal fun DrawScope.paintStreetLights(
    scene: SkyScene,
    count: Int,
) {
    val w = scene.width
    val y = scene.horizon
    // The far hill's right-hand curve, as drawn in the ground.
    val p = listOf(Offset(w * 0.6f, y - 10), Offset(w * 0.78f, y - 18), Offset(w * 0.9f, y - 6), Offset(w, y - 12))
    SkyStreet.SPOTS.take(count).forEach { (at, drop) ->
        val t = at.toFloat()
        val u = 1 - t
        val x = u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x
        val crest = u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y
        val center = Offset(x, crest + drop)
        drawCircle(
            Brush.radialGradient(listOf(SkyPalette.windowGlow.copy(alpha = 0.3f), SkyPalette.windowGlow.copy(alpha = 0f)), center, 6f),
            6f,
            center,
        )
        drawRect(SkyPalette.windowGlow, Offset(center.x - 1.2f, center.y - 1), Size(2.4f, 2f))
    }
}
