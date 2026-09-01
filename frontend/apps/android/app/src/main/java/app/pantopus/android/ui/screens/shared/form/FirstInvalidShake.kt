@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.shared.form

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlin.math.PI
import kotlin.math.sin

/**
 * Apply a 240ms, 3-oscillation, 1dp horizontal shake whenever [trigger]
 * changes. Mirrors the iOS `formShakeOnChange(of:)` modifier
 * (`Features/Shared/Form/FormShell.swift:312-319`). Gated off
 * [rememberReduceMotion], which reads `Settings.Global.ANIMATOR_DURATION_SCALE`
 * — when animations are disabled the modifier is a no-op so reduced-motion
 * users don't see motion they opted out of.
 *
 * Use on the form content (typically the same node that hosts the
 * `FormShell` body) so every field shifts together on the first invalid
 * submit, surfacing the failed validation without flashing colour.
 */
@Composable
fun Modifier.formShakeOnChange(trigger: Int): Modifier {
    val reduceMotion = rememberReduceMotion()
    val phase = remember { Animatable(0f) }
    LaunchedEffect(trigger) {
        if (trigger == 0 || reduceMotion) return@LaunchedEffect
        phase.snapTo(0f)
        phase.animateTo(targetValue = 1f, animationSpec = tween(durationMillis = 240))
    }
    return this.graphicsLayer {
        translationX =
            if (reduceMotion) {
                0f
            } else {
                sin(phase.value * PI.toFloat() * 3f) * density
            }
    }
}
