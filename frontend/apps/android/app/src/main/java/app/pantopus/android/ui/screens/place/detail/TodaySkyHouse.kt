@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import app.pantopus.android.ui.theme.SkyPalette
import app.pantopus.android.ui.theme.SkyPalette.mixed
import kotlin.math.roundToInt

/*
 * The resident's house in the living sky, drawn from its county record ([SkyHome], from the Your
 * Home section's outline): one, one and a half, two or three storeys, a gable, hip or flat roof, an
 * attached or detached garage with a door per car or a carport, a chimney when it has a fireplace,
 * and a pool. With nothing on record it is the scene's first house: 40 × 26 dp under a gable, with a
 * chimney. All one silhouette in the horizon's colour; only the windows, the door and the garage
 * doors catch the light. Parity twin of iOS `TodaySkyHouse.swift`; the numbers match.
 */

/** The house with its door on the ground line at [origin]. */
internal fun DrawScope.paintHouse(
    home: SkyHome,
    light: HomeLight,
    house: Color,
    snow: Boolean,
    origin: Offset,
) {
    val (x, y) = origin
    val top = y - home.wallHeight
    paintGarage(home, light, house, snow, origin)
    // Filled one part at a time so overlapping parts never cancel out.
    drawRect(house, Offset(x - home.width / 2, top), Size(home.width, home.wallHeight))
    if (home.chimney) {
        drawRect(house, home.chimneyTop(origin), Size(6f, if (home.roof == SkyHome.Roof.FLAT) 12f else 14f))
    }
    drawPath(roofPath(home.roof, x - home.width / 2, x + home.width / 2, top, 20f), house)
    if (snow) drawSnow(snowLine(home.roof, x - home.width / 2, x + home.width / 2, top, 20f))
    if (light.lit) {
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
    paintWindows(home, light, origin)
    drawRect(light.door, Offset(x - 3, y - 11), Size(6f, 11f))
    if (home.pool) {
        val night = light.moment.phase == SkyPalette.Phase.NIGHT
        val water =
            SkyPalette.pool.mixed(
                house,
                when {
                    night -> 0.7f
                    light.lit -> 0.45f
                    else -> 0.25f
                },
            )
        drawRoundRect(water, Offset(x + home.width / 2 - 1, y + 1.5f), Size(16f, 3.5f), CornerRadius(1.5f))
    }
}

/**
 * A row of windows a storey (the first house has one), lamp-lit after dusk; late at night only the
 * top row's last window stays lit.
 */
private fun DrawScope.paintWindows(
    home: SkyHome,
    light: HomeLight,
    origin: Offset,
) {
    val (x, y) = origin
    val stories = home.stories ?: 1.0
    val rows =
        when {
            stories >= 2.5 -> 3
            stories >= 2 -> 2
            else -> 1
        }
    val glass = light.window(light.lit)
    val late = light.lit && light.moment.lateNight
    repeat(rows) { row ->
        val columns = mutableListOf(x - home.width / 2 + 6, x + home.width / 2 - 14)
        // Wide upper floors get a middle window over the door.
        if (row > 0 && home.width >= 44) columns.add(1, x - 4)
        columns.forEachIndexed { index, left ->
            val keeps = row == rows - 1 && index == columns.lastIndex
            if (!late || keeps) drawRect(glass, Offset(left, y - 18 - row * 16f), Size(8f, 7f))
        }
    }
    // A storey and a half: the attic window in the gable.
    if (stories > 1 && stories < 2 && home.roof == SkyHome.Roof.GABLE && !late) {
        drawRect(glass, Offset(x - 3, y - home.wallHeight - 10), Size(6f, 6f))
    }
}

/**
 * An attached or detached garage left of the house with a door per car, under a roof like the
 * house's; or a carport, a roof on two posts.
 */
private fun DrawScope.paintGarage(
    home: SkyHome,
    light: HomeLight,
    house: Color,
    snow: Boolean,
    origin: Offset,
) {
    val (x, y) = origin
    when (home.garage) {
        SkyHome.Garage.NONE -> Unit
        SkyHome.Garage.CARPORT -> {
            val left = x - home.width / 2 - 20
            drawRect(house, Offset(left, y - 17), Size(21f, 2.5f))
            listOf(left + 1, left + 10).forEach { drawRect(house, Offset(it, y - 15), Size(1.6f, 15f)) }
        }
        SkyHome.Garage.ATTACHED, SkyHome.Garage.DETACHED -> {
            val attached = home.garage == SkyHome.Garage.ATTACHED
            val width = home.garageWidth
            val left = x - home.width / 2 - width - if (attached) 0f else 5f
            val top = y - 18
            // An attached garage tucks under the house's wall, so no seam shows.
            drawRect(house, Offset(left, top), Size(width + if (attached) 2f else 0f, 18f))
            drawPath(roofPath(home.roof, left, left + width, top, 9f), house)
            if (snow) drawSnow(snowLine(home.roof, left, left + width, top, 9f))
            val doors = home.garageSpaces
            val doorWidth = if (doors == 1) 10f else 9f
            val span = doors * doorWidth + (doors - 1) * 2
            val panel = light.garageDoor(house)
            repeat(doors) { index ->
                drawRect(panel, Offset(left + (width - span) / 2 + index * (doorWidth + 2), y - 11), Size(doorWidth, 11f))
            }
        }
    }
}

/**
 * The roof over walls from [left] to [right] whose top is at [top]: a gable [ridge] dp high, a lower
 * hip, or a flat slab.
 */
internal fun roofPath(
    roof: SkyHome.Roof,
    left: Float,
    right: Float,
    top: Float,
    ridge: Float,
): Path =
    Path().apply {
        if (roof == SkyHome.Roof.FLAT) {
            addRect(Rect(left - 2, top - 3, right + 2, top + 1))
        } else {
            val line = roofLine(roof, left - 5, right + 5, top + 1, ridge)
            moveTo(line.first().x, line.first().y)
            line.drop(1).forEach { lineTo(it.x, it.y) }
            close()
        }
    }

/**
 * The roof's top edge from eave to eave: up to the ridge (a gable) or to a short flat top 14 dp in
 * from each eave (a hip, 0.65 as high).
 */
private fun roofLine(
    roof: SkyHome.Roof,
    left: Float,
    right: Float,
    top: Float,
    ridge: Float,
): List<Offset> {
    if (roof == SkyHome.Roof.HIP) {
        val rise = (ridge * 0.65f).roundToInt().toFloat()
        val inset = minOf(14f, (right - left) / 2 - 2)
        return listOf(Offset(left, top), Offset(left + inset, top - rise), Offset(right - inset, top - rise), Offset(right, top))
    }
    return listOf(Offset(left, top), Offset((left + right) / 2, top - ridge - 1), Offset(right, top))
}

/** Where snow lies on the roof over walls from [left] to [right]: along its top edge. */
private fun snowLine(
    roof: SkyHome.Roof,
    left: Float,
    right: Float,
    top: Float,
    ridge: Float,
): List<Offset> =
    if (roof == SkyHome.Roof.FLAT) {
        listOf(Offset(left - 1, top - 3), Offset(right + 1, top - 3))
    } else {
        roofLine(roof, left - 4, right + 4, top, ridge - 2)
    }

private fun DrawScope.drawSnow(line: List<Offset>) {
    val snow =
        Path().apply {
            moveTo(line.first().x, line.first().y)
            line.drop(1).forEach { lineTo(it.x, it.y) }
        }
    drawPath(snow, SkyPalette.white, style = Stroke(width = 3f, cap = StrokeCap.Round, join = StrokeJoin.Round))
}
