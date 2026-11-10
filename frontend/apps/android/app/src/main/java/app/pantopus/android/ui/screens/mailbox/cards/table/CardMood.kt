@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.zIndex
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

/**
 * The mood a card's picture sets on the table (plan Part 7). The apps map collection to mood themselves, by the
 * picture's number: Christmas with Jesus Christ (59–67) is reverence, Christmas with Santa (50–58) is Santa, and every
 * other collection, and any picture not known yet, is nostalgia.
 */
internal enum class CardMood {
    Nostalgia,
    Reverence,
    Santa,
    ;

    /** Snow falls outside the window for nostalgia and Santa. */
    val snows: Boolean get() = this != Reverence

    companion object {
        fun of(
            number: Int?,
            design: String,
        ): CardMood {
            val picture = number ?: design.substringAfterLast('-').toIntOrNull() ?: return Nostalgia
            return when (picture) {
                in 59..67 -> Reverence
                in 50..58 -> Santa
                else -> Nostalgia
            }
        }
    }
}

/** The star stamp on a Christmas with Jesus Christ card, else its own fir, peak or river. */
internal fun cardStamp(
    stamps: Map<MailStamp, Bitmap>,
    star: Bitmap,
    stamp: MailStamp,
    number: Int?,
    design: String,
): Bitmap? = if (CardMood.of(number, design) == CardMood.Reverence) star else stamps[stamp]

/**
 * The mood's light over the table, while it may move (not with animations off or in Battery Saver, like the tilt
 * light): snow's soft shadows drifting down through the patch of window light only, or candlelight's warm glow from the
 * lower left, breathing slowly.
 */
@Composable
internal fun MoodLight(
    state: CardTableState,
    art: CardTableArt,
    on: Boolean,
) {
    val mood = state.mood
    val clock by produceState(0L, on, state.paused) {
        if (!on || state.paused) return@produceState
        while (true) withFrameMillis { value = it }
    }
    if (!on) return
    if (mood.snows) Snow(state, art) { clock } else Candlelight { clock }
}

/** 12 to 18 specks at a time, each 6 to 9 s down the window's light, 10% dark. */
@Composable
private fun Snow(
    state: CardTableState,
    art: CardTableArt,
    clock: () -> Long,
) {
    val density = LocalDensity.current.density
    val flakes = remember { snowFlakes() }
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .zIndex(31f)
                .drawWithCache {
                    val speck = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PantopusColors.tableSnow.toArgb() }
                    // Only where the window's light falls: the light's brightness above its middle grey keeps the specks.
                    val mask =
                        Paint(Paint.FILTER_BITMAP_FLAG).apply {
                            val k = 3f
                            colorFilter =
                                ColorMatrixColorFilter(
                                    ColorMatrix(
                                        floatArrayOf(
                                            0f, 0f, 0f, 0f, 0f,
                                            0f, 0f, 0f, 0f, 0f,
                                            0f, 0f, 0f, 0f, 0f,
                                            0.299f * k, 0.587f * k, 0.114f * k, 0f, -0.55f * k * 255f,
                                        ),
                                    ),
                                )
                            xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
                        }
                    onDrawBehind {
                        val t = clock() / 1000f
                        drawIntoCanvas { canvas ->
                            val native = canvas.nativeCanvas
                            val layer = native.saveLayer(0f, 0f, size.width, size.height, null)
                            for (flake in flakes) {
                                val fall = ((t / flake.seconds + flake.phase) % 1f)
                                val y = fall * size.height * 1.1f - size.height * 0.05f
                                val swing = sin((t / flake.swaySeconds + flake.phase) * 2f * PI.toFloat())
                                val x = flake.x * size.width + swing * flake.sway * density
                                val radius = flake.size * density
                                speck.maskFilter = BlurMaskFilter(radius * 0.7f, BlurMaskFilter.Blur.NORMAL)
                                native.drawCircle(x, y, radius, speck)
                            }
                            val light = roomLightRect(size.width, size.height, density, state.lightX.x, state.lightY.x)
                            native.drawBitmap(art.light, null, light, mask)
                            native.restoreToCount(layer)
                        }
                    }
                },
    )
}

/** Candlelight: a warm glow from the lower left that breathes very slowly, 85 to 100% over about 3.5 s. */
@Composable
private fun Candlelight(clock: () -> Long) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .zIndex(29f)
                .drawWithCache {
                    val glow = Paint(Paint.ANTI_ALIAS_FLAG)
                    val warm = PantopusColors.tableCandle
                    glow.shader =
                        RadialGradient(
                            size.width * -0.08f,
                            size.height * 1.04f,
                            max(size.width, size.height) * 0.95f,
                            intArrayOf(
                                warm.copy(alpha = 0.34f).toArgb(),
                                warm.copy(alpha = 0.12f).toArgb(),
                                warm.copy(alpha = 0f).toArgb(),
                            ),
                            floatArrayOf(0f, 0.45f, 1f),
                            Shader.TileMode.CLAMP,
                        )
                    glow.xfermode = PorterDuffXfermode(PorterDuff.Mode.SCREEN)
                    onDrawBehind {
                        val breath = 0.85f + 0.15f * (0.5f + 0.5f * sin(clock() / 3500f * 2f * PI.toFloat()))
                        glow.alpha = (breath * 255f).toInt()
                        drawIntoCanvas { it.nativeCanvas.drawRect(RectF(0f, 0f, size.width, size.height), glow) }
                    }
                },
    )
}

private class Flake(
    val x: Float,
    val phase: Float,
    val seconds: Float,
    val size: Float,
    val sway: Float,
    val swaySeconds: Float,
)

/** 15 specks, the same every time: about 12 to 18 show in the light at once as they fall. */
private fun snowFlakes(): List<Flake> {
    val random = Random(25)
    return List(15) {
        Flake(
            x = random.nextFloat(),
            phase = random.nextFloat(),
            seconds = 6f + random.nextFloat() * 3f,
            size = 2.5f + random.nextFloat() * 2.5f,
            sway = 6f + random.nextFloat() * 8f,
            swaySeconds = 3f + random.nextFloat() * 3f,
        )
    }
}
