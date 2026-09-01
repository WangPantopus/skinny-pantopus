@file:Suppress("MagicNumber")

package app.pantopus.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * A design-system shadow definition. Mirrors the CSS `box-shadow` spec —
 * `rgba(r,g,b,alpha)` becomes [color] combined with [alpha]; [radius] is the
 * CSS blur radius.
 */
data class PantopusElevation(
    val color: Color,
    val alpha: Float,
    val radius: Dp,
    val offsetX: Dp,
    val offsetY: Dp,
)

/**
 * Canonical elevation tokens. Apply via [Modifier.pantopusShadow].
 *
 * The default Compose `Modifier.shadow` renders the platform's ambient/spot
 * shadow which is darker than the design-system `rgba(0,0,0,0.04–0.10)`
 * spec. [Modifier.pantopusShadow] paints a blurred shadow with the exact
 * opacity below to match the spec.
 */
@Suppress("MagicNumber")
object PantopusElevations {
    /** `0 1px 3px rgba(0,0,0,0.04)`. */
    val sm = PantopusElevation(Color.Black, 0.04f, 3.dp, 0.dp, 1.dp)

    /** `0 2px 6px rgba(0,0,0,0.06)`. */
    val md = PantopusElevation(Color.Black, 0.06f, 6.dp, 0.dp, 2.dp)

    /** `0 4px 12px rgba(0,0,0,0.08)`. */
    val lg = PantopusElevation(Color.Black, 0.08f, 12.dp, 0.dp, 4.dp)

    /** `0 8px 24px rgba(0,0,0,0.10)`. */
    val xl = PantopusElevation(Color.Black, 0.10f, 24.dp, 0.dp, 8.dp)

    /** `0 6px 16px rgba(2,132,199,0.18)`. */
    val primary = PantopusElevation(PantopusColors.primary600, 0.18f, 16.dp, 0.dp, 6.dp)

    /** `0 6px 16px rgba(17,24,39,0.12)` — the A19 legal `BackToTopFab` drop shadow. */
    val fab = PantopusElevation(PantopusColors.appText, 0.12f, 16.dp, 0.dp, 6.dp)
}

/**
 * Draw a design-system shadow behind the composable.
 *
 * Paints a blurred native `Paint` so the rendered color matches the spec's
 * `rgba(r,g,b,alpha)` value exactly — Compose's `Modifier.shadow` uses
 * platform ambient/spot shadow colors and cannot hit the spec.
 *
 * @param elevation Token from [PantopusElevations].
 * @param shape Clip shape for the shadow. Pass a `RoundedCornerShape`
 *     matching the content's corner radius for a faithful drop-shadow;
 *     defaults to a sharp rectangle.
 */
fun Modifier.pantopusShadow(
    elevation: PantopusElevation,
    shape: Shape = RoundedCornerShape(0.dp),
): Modifier =
    this.drawBehind {
        val dx = elevation.offsetX.toPx()
        val dy = elevation.offsetY.toPx()
        val blur = elevation.radius.toPx().coerceAtLeast(0.1f)
        val argb = elevation.color.copy(alpha = elevation.alpha).toArgb()

        val paint =
            android.graphics.Paint().apply {
                isAntiAlias = true
                color = argb
                maskFilter =
                    android.graphics.BlurMaskFilter(
                        blur,
                        android.graphics.BlurMaskFilter.Blur.NORMAL,
                    )
            }

        drawIntoCanvas { canvas ->
            val outline =
                shape.createOutline(
                    size = Size(size.width, size.height),
                    layoutDirection = layoutDirection,
                    density = this,
                )
            val native = canvas.nativeCanvas
            native.save()
            native.translate(dx, dy)
            when (outline) {
                is Outline.Rectangle ->
                    native.drawRect(
                        outline.rect.left,
                        outline.rect.top,
                        outline.rect.right,
                        outline.rect.bottom,
                        paint,
                    )
                is Outline.Rounded ->
                    native.drawRoundRect(
                        outline.roundRect.left,
                        outline.roundRect.top,
                        outline.roundRect.right,
                        outline.roundRect.bottom,
                        outline.roundRect.topLeftCornerRadius.x,
                        outline.roundRect.topLeftCornerRadius.y,
                        paint,
                    )
                is Outline.Generic -> native.drawPath(outline.path.asAndroidPath(), paint)
            }
            native.restore()
        }
    }
