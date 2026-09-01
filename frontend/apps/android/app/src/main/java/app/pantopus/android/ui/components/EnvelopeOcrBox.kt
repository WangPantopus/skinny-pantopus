@file:Suppress("MagicNumber", "LongMethod", "MatchingDeclarationName", "ModifierMissing")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Tone of an [EnvelopeOcrBox] overlay.
 *
 * - `Clean` — solid 2dp sky border + sky-tinted fill. Used when the OCR
 *   confidence is high enough to trust.
 * - `Unclear` — dashed 2dp amber border + amber-tinted fill with a soft
 *   radial water-stain texture. Used when the scan is smudged / damaged
 *   so the OCR confidence is low.
 */
enum class EnvelopeOcrTone { Clean, Unclear }

/**
 * Bounding-box overlay drawn on top of a scanned envelope preview. Caller
 * supplies the rect in envelope-local coordinates; the primitive renders
 * the overlay only, so it composes inside any positioned overlay.
 *
 * @param rect Bounding rect (offset + size in dp).
 * @param tone [EnvelopeOcrTone.Clean] or [EnvelopeOcrTone.Unclear].
 * @param label Optional uppercase mono pill rendered above the top-left
 *     corner (e.g. `"NAME · 97%"`).
 */
@Composable
fun EnvelopeOcrBox(
    rect: DpRect,
    tone: EnvelopeOcrTone,
    modifier: Modifier = Modifier,
    label: String? = null,
) {
    val accessibilityText =
        buildString {
            append(if (tone == EnvelopeOcrTone.Clean) "OCR bounding box, clean" else "OCR bounding box, unclear")
            if (label != null) append(": ").append(label)
        }
    Box(
        modifier =
            modifier
                .offset(x = rect.left, y = rect.top)
                .size(width = rect.right - rect.left, height = rect.bottom - rect.top)
                .semantics { contentDescription = accessibilityText },
    ) {
        BoxShape(tone = tone)
        if (label != null) {
            LabelPill(
                text = label,
                tone = tone,
                modifier = Modifier.offset(x = (-1).dp, y = (-16).dp),
            )
        }
    }
}

@Composable
private fun BoxShape(tone: EnvelopeOcrTone) {
    val strokeColor = strokeColor(tone)
    val fillColor = fillColor(tone)
    val shape = RoundedCornerShape(Radii.xs)
    val density = LocalDensity.current
    val strokePx = with(density) { 2.dp.toPx() }
    val dashOnPx = with(density) { 4.dp.toPx() }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .clip(shape)
                .background(fillColor)
                .then(
                    if (tone == EnvelopeOcrTone.Unclear) {
                        Modifier.drawBehind {
                            drawWaterStain()
                        }
                    } else {
                        Modifier
                    },
                ).drawBehind {
                    val pathEffect =
                        if (tone == EnvelopeOcrTone.Unclear) {
                            PathEffect.dashPathEffect(floatArrayOf(dashOnPx, dashOnPx), 0f)
                        } else {
                            null
                        }
                    drawRoundRect(
                        color = strokeColor,
                        topLeft = Offset(strokePx / 2, strokePx / 2),
                        size =
                            Size(
                                width = size.width - strokePx,
                                height = size.height - strokePx,
                            ),
                        cornerRadius =
                            androidx.compose.ui.geometry.CornerRadius(
                                with(density) { Radii.xs.toPx() },
                            ),
                        style = Stroke(width = strokePx, pathEffect = pathEffect),
                    )
                },
    )
}

@Composable
private fun LabelPill(
    text: String,
    tone: EnvelopeOcrTone,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(2.dp))
                .background(strokeColor(tone))
                .padding(horizontal = Spacing.s1, vertical = 1.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text.uppercase(),
            style =
                TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 8.sp,
                    letterSpacing = 0.3.sp,
                ),
            color = PantopusColors.appTextInverse,
        )
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawWaterStain() {
    val brush =
        Brush.radialGradient(
            colors =
                listOf(
                    PantopusColors.warning.copy(alpha = 0.35f),
                    PantopusColors.warning.copy(alpha = 0.18f),
                    Color.Transparent,
                ),
            center = Offset(size.width / 2f, size.height / 2f),
            radius = maxOf(size.width, size.height) * 0.6f,
        )
    drawRect(brush = brush, blendMode = BlendMode.Multiply)
}

private fun strokeColor(tone: EnvelopeOcrTone): Color =
    when (tone) {
        EnvelopeOcrTone.Clean -> PantopusColors.primary500
        EnvelopeOcrTone.Unclear -> PantopusColors.warning
    }

private fun fillColor(tone: EnvelopeOcrTone): Color =
    when (tone) {
        EnvelopeOcrTone.Clean -> PantopusColors.primary600.copy(alpha = 0.08f)
        EnvelopeOcrTone.Unclear -> PantopusColors.warning.copy(alpha = 0.12f)
    }
