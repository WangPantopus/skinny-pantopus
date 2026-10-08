@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors

/**
 * The canvas's ballot-box glyph (Board: Place: Your ballot card): the box,
 * the ballot sheet and the slot, on a 24-unit grid. Not a Lucide icon —
 * the canvas draws its own three strokes, reproduced here from its path
 * data (2-unit stroke, round caps and joins). Parity twin of iOS
 * `BallotGlyph.swift`.
 */
private const val GLYPH_PATH = "M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M9 11V4h6v7 M8 16h8"
private const val GLYPH_GRID = 24f

@Composable
fun BallotGlyph(
    modifier: Modifier = Modifier,
    size: Dp = 19.dp,
    color: Color = PantopusColors.home,
) {
    val path = remember { PathParser().parsePathString(GLYPH_PATH).toPath() }
    Canvas(modifier = modifier.size(size)) {
        scale(scale = this.size.minDimension / GLYPH_GRID, pivot = Offset.Zero) {
            drawPath(path, color, style = Stroke(width = 2f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

/** 34dp rounded tile, home-green, radius 9 — the Place section tile. */
@Composable
fun BallotTile(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.size(34.dp).clip(RoundedCornerShape(9.dp)).background(PantopusColors.homeBg),
        contentAlignment = Alignment.Center,
    ) {
        BallotGlyph()
    }
}
