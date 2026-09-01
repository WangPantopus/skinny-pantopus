@file:Suppress(
    "MagicNumber",
    "UnusedPrivateMember",
    "MatchingDeclarationName",
    "LongMethod",
    "LongParameterList",
    "VariableNaming",
)

package app.pantopus.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Postage-stamp primitive for A17.11 Stamps. Mirrors iOS
 * `Core/Design/Components/PerforatedStamp.swift`: an [ink]-filled rectangle
 * with a perforated (toothed) edge, an engraved hairline double-frame, and
 * an artwork slot ([content], defaulting to [ForeverArt]). [used] overlays a
 * [Postmark] cancellation.
 *
 * The perforated edge is a vector even-odd fill (the paper rect XOR a row of
 * edge-centred circles), so it stays crisp at mdpi→xxxhdpi with no banding
 * and no per-pixel shader. It renders statically — no animation, nothing to
 * gate behind reduced motion — and is a single clipped draw layer, within
 * the per-frame budget in `docs/android/perf_budgets.md`.
 *
 * @param ink Paper ink — pass a token (e.g. [PantopusColors.categoryStamps]);
 *     the philatelic series palette lands with the A17.11 screen (B2.1).
 * @param width / height Paper size.
 * @param toothRadius Perforation bite radius (design default 4.5dp).
 * @param toothGap Target spacing between bite centres (design default 12dp).
 * @param used Overlays a [Postmark] cancellation when true.
 * @param content Artwork drawn over the ink (inside the perforations).
 */
@Composable
fun PerforatedStamp(
    ink: Color,
    width: Dp,
    height: Dp,
    modifier: Modifier = Modifier,
    toothRadius: Dp = 4.5.dp,
    toothGap: Dp = 12.dp,
    used: Boolean = false,
    content: @Composable BoxScope.() -> Unit = { ForeverArt(small = width < 80.dp) },
) {
    val label = if (used) "Postage stamp, used" else "Postage stamp"
    Box(
        modifier =
            modifier
                .size(width, height)
                .clip(RectangleShape)
                .drawBehind {
                    val radiusPx = toothRadius.toPx()
                    val perforated =
                        Path().apply {
                            fillType = PathFillType.EvenOdd
                            addRect(Rect(0f, 0f, size.width, size.height))
                            perforationCentres(size, toothGap.toPx()).forEach { centre ->
                                addOval(
                                    Rect(
                                        centre.x - radiusPx,
                                        centre.y - radiusPx,
                                        centre.x + radiusPx,
                                        centre.y + radiusPx,
                                    ),
                                )
                            }
                        }
                    drawPath(path = perforated, color = ink)

                    // Engraved hairline double-frame — white 30%, inset 7dp.
                    val inset = 7.dp.toPx()
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.30f),
                        topLeft = Offset(inset, inset),
                        size = Size(size.width - inset * 2, size.height - inset * 2),
                        cornerRadius = CornerRadius(2.dp.toPx()),
                        style = Stroke(width = 1.dp.toPx()),
                    )
                }
                .semantics { contentDescription = label }
                .testTag("perforatedStamp"),
        contentAlignment = Alignment.Center,
    ) {
        content()
        if (used) {
            Postmark(modifier = Modifier.size(width * 0.78f, height * 0.60f))
        }
    }
}

/**
 * Evenly-distributed bite centres along all four edges — `round(edge / gap)`
 * teeth on a half-step margin so corners never land a half-cut bite and
 * opposite edges stay symmetric.
 */
private fun perforationCentres(
    size: Size,
    gapPx: Float,
): List<Offset> {
    val centres = mutableListOf<Offset>()
    val columns = max(1, (size.width / gapPx).roundToInt())
    val rows = max(1, (size.height / gapPx).roundToInt())
    val stepX = size.width / columns
    val stepY = size.height / rows
    for (index in 0 until columns) {
        val x = stepX * (index + 0.5f)
        centres += Offset(x, 0f)
        centres += Offset(x, size.height)
    }
    for (index in 0 until rows) {
        val y = stepY * (index + 0.5f)
        centres += Offset(0f, y)
        centres += Offset(size.width, y)
    }
    return centres
}

/**
 * Default stamp artwork — the Local · Forever-series emblem. White ink on
 * the stamp's colour; [small] scales it for sheet cells / rail tiles.
 */
@Composable
fun ForeverArt(
    modifier: Modifier = Modifier,
    small: Boolean = false,
) {
    val white = Color.White.copy(alpha = 0.95f)
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .padding(
                    horizontal = if (small) 6.dp else 10.dp,
                    vertical = if (small) 9.dp else 12.dp,
                ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = "PANTOPUS POST",
            color = white.copy(alpha = 0.92f),
            fontSize = if (small) 6.sp else 7.5.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = if (small) 0.6.sp else 0.9.sp,
        )
        ForeverEmblem(small = small, tint = white)
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "FOREVER",
                color = white,
                fontSize = if (small) 9.sp else 12.5.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = if (small) 0.7.sp else 1.1.sp,
            )
            Text(
                text = "LOCAL · 1 SEND",
                color = white.copy(alpha = 0.80f),
                fontSize = if (small) 5.5.sp else 7.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = if (small) 0.8.sp else 1.1.sp,
            )
        }
    }
}

/** Three concentric rings + a centred serif "P". */
@Composable
private fun ForeverEmblem(
    small: Boolean,
    tint: Color,
) {
    val outer = if (small) 30.dp else 42.dp
    val mid = if (small) 21.dp else 30.dp
    val inner = if (small) 12.dp else 17.dp
    Box(
        modifier =
            Modifier
                .size(outer)
                .drawBehind {
                    val strokePx = 1.dp.toPx()
                    listOf(outer, mid, inner).forEach { diameter ->
                        drawCircle(
                            color = tint.copy(alpha = 0.45f),
                            radius = (diameter.toPx() - strokePx) / 2f,
                            center = Offset(size.width / 2f, size.height / 2f),
                            style = Stroke(width = strokePx),
                        )
                    }
                },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "P",
            color = tint,
            fontSize = if (small) 9.sp else 13.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Serif,
        )
    }
}

/**
 * Circular cancellation drawn over a `used` stamp — concentric date-ring +
 * four wavy cancellation lines + "PANTOPUS / USED". Self-contained: bakes
 * the design's 0.55 opacity and −14° tilt.
 */
@Composable
fun Postmark(modifier: Modifier = Modifier) {
    Canvas(
        modifier =
            modifier.graphicsLayer {
                alpha = 0.55f
                rotationZ = -14f
            },
    ) {
        // Uniform-fit the 90×70 design viewbox, centred.
        val scale = min(size.width / 90f, size.height / 70f)
        val originX = (size.width - 90f * scale) / 2f
        val originY = (size.height - 70f * scale) / 2f
        val at = { x: Float, y: Float -> Offset(originX + x * scale, originY + y * scale) }
        val ink = Color.White

        // Concentric date-ring (r 22 + r 16, centred at 45,35).
        listOf(22f, 16f).forEach { radius ->
            drawCircle(
                color = ink,
                radius = radius * scale,
                center = at(45f, 35f),
                style = Stroke(width = max(1f, 2f * scale)),
            )
        }

        // Four wavy cancellation lines.
        listOf(20f, 26f, 32f, 38f).forEach { waveY ->
            val wave =
                Path().apply {
                    val start = at(2f, waveY)
                    moveTo(start.x, start.y)
                    var x = 2f
                    var dipUp = true
                    while (x < 90f) {
                        val controlY = waveY + if (dipUp) -5f else 5f
                        val control = at(x + 11f, controlY)
                        val end = at(x + 22f, waveY)
                        quadraticTo(control.x, control.y, end.x, end.y)
                        x += 22f
                        dipUp = !dipUp
                    }
                }
            drawPath(wave, color = ink.copy(alpha = 0.9f), style = Stroke(width = max(0.75f, 1.6f * scale)))
        }

        // Cancellation text via the native canvas (baseline-anchored, centred).
        drawIntoCanvas { canvas ->
            val paint =
                android.graphics.Paint().apply {
                    isAntiAlias = true
                    color = android.graphics.Color.WHITE
                    textAlign = android.graphics.Paint.Align.CENTER
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    textSize = 6.5f * scale
                }
            val name = at(45f, 33f)
            canvas.nativeCanvas.drawText("PANTOPUS", name.x, name.y, paint)
            paint.typeface = android.graphics.Typeface.DEFAULT
            paint.textSize = 5.5f * scale
            val used = at(45f, 42f)
            canvas.nativeCanvas.drawText("USED", used.x, used.y, paint)
        }
    }
}

// MARK: - Previews

@Preview(showBackground = true, widthDp = 360, heightDp = 140)
@Composable
private fun PerforatedStampInkVariantsPreview() {
    // Preview inks demonstrate the primitive across hues; the philatelic
    // series palette (Local/Express/Civic/Spring/Business) lands with the
    // A17.11 Stamps screen (B2.1).
    Row(
        modifier =
            Modifier
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PerforatedStamp(ink = PantopusColors.categoryStamps, width = 64.dp, height = 84.dp)
        PerforatedStamp(ink = PantopusColors.rose, width = 64.dp, height = 84.dp)
        PerforatedStamp(ink = PantopusColors.magic, width = 64.dp, height = 84.dp)
        PerforatedStamp(ink = PantopusColors.home, width = 64.dp, height = 84.dp)
        PerforatedStamp(ink = PantopusColors.warmAmber, width = 64.dp, height = 84.dp)
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 200)
@Composable
private fun PerforatedStampUsedPreview() {
    Row(
        modifier =
            Modifier
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        PerforatedStamp(ink = PantopusColors.categoryStamps, width = 104.dp, height = 132.dp)
        PerforatedStamp(ink = PantopusColors.categoryStamps, width = 104.dp, height = 132.dp, used = true)
    }
}
