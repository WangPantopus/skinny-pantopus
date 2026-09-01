@file:Suppress("MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlin.math.PI
import kotlin.math.sin

/**
 * Decorative confetti overlay for celebration heroes (A17.9 Party,
 * A18.2 Approved). Sixty seed-deterministic dots in six brand-adjacent
 * colors, drawn on a 200×140 dp canvas. Compose mirror of iOS
 * `Core/Design/Components/ConfettiSpray.swift`.
 *
 * @param seed Deterministic placement seed. Same seed → byte-identical
 *     output, which is what snapshot tests rely on.
 * @param dotCount Number of dots to draw. Defaults to 60.
 * @param isAnimating `null` (the default) reads the system
 *     reduce-motion flag via [rememberReduceMotion]; pass `false` from
 *     snapshot tests to force the static seed render.
 */
@Composable
fun ConfettiSpray(
    modifier: Modifier = Modifier,
    seed: ULong = 42uL,
    dotCount: Int = 60,
    isAnimating: Boolean? = null,
) {
    val reduceMotion = rememberReduceMotion()
    val active = isAnimating ?: !reduceMotion

    val transition = rememberInfiniteTransition(label = "confetti")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 4_000, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
        label = "phase",
    )

    val drawPhase = if (active) phase else 0f

    val palette =
        remember {
            listOf(
                ConfettiRose,
                PantopusColors.warning,
                PantopusColors.success,
                PantopusColors.primary500,
                PantopusColors.magicBg,
                PantopusColors.business,
            )
        }

    Canvas(
        modifier =
            modifier
                .size(width = 200.dp, height = 140.dp)
                .semantics { },
    ) {
        val rng = SeededRandom(seed)
        repeat(dotCount) {
            val baseX = rng.next() * 200f
            val baseY = rng.next() * 140f
            val radius = 1f + rng.next() * 2.5f
            val colorIndex = (rng.next() * palette.size).toInt() % palette.size
            val dotPhase = rng.next()
            val drift = (sin((drawPhase + dotPhase) * 2.0 * PI) * 6.0).toFloat()
            drawCircle(
                color = palette[colorIndex],
                radius = radius.dp.toPx(),
                center = Offset(x = baseX.dp.toPx(), y = baseY.dp.toPx() + drift.dp.toPx()),
            )
        }
    }
}

/**
 * Rose `#DB2777` — confetti-specific accent without a global token
 * (deferred to category-party / category-records work; see
 * `docs/new-design-parity.md` open question 4).
 */
private val ConfettiRose = Color(0xFFDB2777)

/** Tiny deterministic LCG so snapshot tests are byte-stable across runs. */
private class SeededRandom(seed: ULong) {
    private var state: ULong = seed or 1uL

    /** Returns a uniform `Float` in `[0, 1)`. */
    fun next(): Float {
        state = state * 6_364_136_223_846_793_005uL + 1_442_695_040_888_963_407uL
        val top31 = (state shr 33).toLong()
        return top31.toFloat() / TWO_POW_31
    }

    private companion object {
        // 2^31 — divisor that maps the LCG's top 31 bits onto [0, 1).
        const val TWO_POW_31: Float = 2_147_483_648f
    }
}

@Suppress("UnusedPrivateMember")
@Preview(showBackground = true, widthDp = 360, heightDp = 360, backgroundColor = 0xFFFFFFFF)
@Composable
private fun ConfettiSprayPreview() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .background(PantopusColors.appSurface),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ConfettiSpray(modifier = Modifier.background(PantopusColors.appBg))
        ConfettiSpray(
            seed = 99uL,
            isAnimating = false,
            modifier = Modifier.background(PantopusColors.primary50),
        )
    }
}
