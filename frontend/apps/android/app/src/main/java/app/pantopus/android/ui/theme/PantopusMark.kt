@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Which colour build of the perforation mark to draw.
 *
 * The window and the perforations are always a genuine knockout — whatever
 * sits behind the mark shows through them — so [Reverse] works on a coloured
 * ground even with a white check: the ground reads through the window.
 */
enum class MarkVariant {
    /** Follows [isSystemInDarkTheme]. */
    Auto,

    /** Forced light build — sky body on a light ground. */
    Light,

    /** Forced dark build — lighter sky body on a dark ground. */
    Dark,

    /** White body and white check, for coloured grounds (app-icon tile, ceremonial banners). */
    Reverse,
}

// Canonical geometry, on the 64-unit design grid the mark is drawn from.
private const val DESIGN_GRID = 64f
private const val BODY_INSET = 4f
private const val BODY_SPAN = 56f
private const val BODY_RADIUS = 13f
private const val PERFORATION_RADIUS = 4.5f
private const val WINDOW_ORIGIN = 20f
private const val WINDOW_SPAN = 24f
private const val WINDOW_RADIUS = 4f
private const val CHECK_STROKE = 4.4f

/** The eight punched-out perforation centres, clockwise from the top-left notch. */
private val PERFORATIONS =
    listOf(
        Offset(23.5f, 4f),
        Offset(40.5f, 4f),
        Offset(23.5f, 60f),
        Offset(40.5f, 60f),
        Offset(4f, 23.5f),
        Offset(4f, 40.5f),
        Offset(60f, 23.5f),
        Offset(60f, 40.5f),
    )

/** Check vertices: `M26 32.4 L30.2 36.6 L38.2 26.8`. */
private val CHECK_POINTS =
    listOf(
        Offset(26f, 32.4f),
        Offset(30.2f, 36.6f),
        Offset(38.2f, 26.8f),
    )

// Below this the check is illegible, so a solid plug stands in for it.
private val PLUG_THRESHOLD = 20.dp
private const val PLUG_ORIGIN = 26f
private const val PLUG_SPAN = 12f
private const val PLUG_RADIUS = 3f

// Lockup proportions.
private const val LOCKUP_GAP_RATIO = 1f / 3f
private const val WORDMARK_RATIO = 0.83f
private const val WORDMARK_TRACKING = -0.02f

/**
 * Optical centring nudge, as a fraction of the mark height. A text line box
 * centres roughly 0.34em above its baseline while the x-height band centres
 * near 0.26em, so the wordmark rides slightly high next to the mark; lifting
 * the mark's neighbour by the difference (scaled through [WORDMARK_RATIO])
 * seats the two on the x-height instead of the bounding box.
 */
private const val WORDMARK_OPTICAL_NUDGE = -0.064f

/**
 * The Pantopus perforation mark: a stamp body with a knocked-out window and a
 * verification check — mail, what is shown, and proof.
 *
 * All geometry scales from the 64-unit design grid, so the mark is identical
 * at every size. Do not rotate it, fill the window, or recolour it to another
 * identity pillar; business violet and warning amber are product states, not
 * brand colours.
 *
 * @param size edge length of the square mark. 16.dp is the floor; at or below
 *   [PLUG_THRESHOLD] the check is replaced by a solid plug automatically.
 * @param contentDescription label for the mark standing alone. Leave null when
 *   it sits beside the "Pantopus" wordmark — the text carries the name there.
 */
@Composable
fun PantopusMark(
    size: Dp,
    variant: MarkVariant = MarkVariant.Auto,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val bodyColor =
        when (variant) {
            MarkVariant.Auto -> if (isSystemInDarkTheme()) PantopusColors.primary400 else PantopusColors.primary600
            MarkVariant.Light -> PantopusColors.primary600
            MarkVariant.Dark -> PantopusColors.primary400
            MarkVariant.Reverse -> PantopusColors.appTextInverse
        }
    val checkColor = if (variant == MarkVariant.Reverse) PantopusColors.appTextInverse else PantopusColors.brandCheck
    val label =
        if (contentDescription == null) {
            Modifier.clearAndSetSemantics { }
        } else {
            Modifier.semantics { this.contentDescription = contentDescription }
        }

    Canvas(modifier = modifier.size(size).then(label)) {
        val scale = this.size.width / DESIGN_GRID
        drawPath(path = stencilPath(scale), color = bodyColor)
        if (size > PLUG_THRESHOLD) {
            drawPath(
                path = checkPath(scale),
                color = checkColor,
                style = Stroke(width = CHECK_STROKE * scale, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
        } else {
            drawRoundRect(
                color = bodyColor,
                topLeft = Offset(PLUG_ORIGIN * scale, PLUG_ORIGIN * scale),
                size = Size(PLUG_SPAN * scale, PLUG_SPAN * scale),
                cornerRadius = CornerRadius(PLUG_RADIUS * scale),
            )
        }
    }
}

/**
 * The mark locked up with the "Pantopus" wordmark.
 *
 * @param size height of the mark; the wordmark and the gap derive from it.
 */
@Composable
fun PantopusLockup(
    size: Dp,
    variant: MarkVariant = MarkVariant.Auto,
    modifier: Modifier = Modifier,
    wordmarkColor: Color? = null,
) {
    val resolvedWordmark =
        wordmarkColor ?: when (variant) {
            MarkVariant.Auto -> if (isSystemInDarkTheme()) PantopusColors.appTextInverse else PantopusColors.appText
            MarkVariant.Light -> PantopusColors.appText
            MarkVariant.Dark, MarkVariant.Reverse -> PantopusColors.appTextInverse
        }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(size * LOCKUP_GAP_RATIO),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusMark(size = size, variant = variant)
        Text(
            text = "Pantopus",
            fontSize = (size.value * WORDMARK_RATIO).sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = WORDMARK_TRACKING.em,
            color = resolvedWordmark,
            modifier = Modifier.offset(y = size * WORDMARK_OPTICAL_NUDGE),
        )
    }
}

/**
 * The stamp body with the eight perforations and the window subtracted out.
 * Difference — not an overdraw in the background colour — so the knockouts are
 * genuinely transparent and whatever sits behind the mark shows through.
 */
private fun stencilPath(scale: Float): Path {
    val body =
        Path().apply {
            addRoundRect(
                RoundRect(
                    rect =
                        Rect(
                            left = BODY_INSET * scale,
                            top = BODY_INSET * scale,
                            right = (BODY_INSET + BODY_SPAN) * scale,
                            bottom = (BODY_INSET + BODY_SPAN) * scale,
                        ),
                    cornerRadius = CornerRadius(BODY_RADIUS * scale),
                ),
            )
        }
    val knockouts =
        Path().apply {
            PERFORATIONS.forEach { center ->
                addOval(Rect(center = center * scale, radius = PERFORATION_RADIUS * scale))
            }
            addRoundRect(
                RoundRect(
                    rect =
                        Rect(
                            left = WINDOW_ORIGIN * scale,
                            top = WINDOW_ORIGIN * scale,
                            right = (WINDOW_ORIGIN + WINDOW_SPAN) * scale,
                            bottom = (WINDOW_ORIGIN + WINDOW_SPAN) * scale,
                        ),
                    cornerRadius = CornerRadius(WINDOW_RADIUS * scale),
                ),
            )
        }
    return Path().apply { op(body, knockouts, PathOperation.Difference) }
}

/** The verification check, drawn on top of the body and inside the window. */
private fun checkPath(scale: Float): Path =
    Path().apply {
        CHECK_POINTS.forEachIndexed { index, point ->
            val scaled = point * scale
            if (index == 0) moveTo(scaled.x, scaled.y) else lineTo(scaled.x, scaled.y)
        }
    }
