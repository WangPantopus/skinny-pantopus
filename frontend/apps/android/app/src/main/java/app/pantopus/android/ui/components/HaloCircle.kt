@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * Ceremonial tone the halo broadcasts. Drives inner-disc fill, default
 * icon, outer-ring tint, and pulse glow color.
 */
enum class HaloCircleTone {
    /** Success — green inner disc + check. A18.2 / A21.2 confirmation. */
    Success,

    /** Info — primary600 inner disc + clock. A18.4 active-wait. */
    Info,

    /** Warning — amber inner disc + alert-circle. A18.4 action-needed. */
    Warning,

    /** Celebration — sky gradient + badge-check. A18.2 approved / A18.3 verified. */
    Celebration,
    ;

    val defaultIcon: PantopusIcon
        get() =
            when (this) {
                Success -> PantopusIcon.Check
                Info -> PantopusIcon.Clock
                Warning -> PantopusIcon.AlertCircle
                Celebration -> PantopusIcon.BadgeCheck
            }

    val identifier: String
        get() =
            when (this) {
                Success -> "success"
                Info -> "info"
                Warning -> "warning"
                Celebration -> "celebration"
            }
}

/**
 * 96dp ceremonial halo:
 *  - 4dp translucent outer ring,
 *  - 96dp light-bg fill,
 *  - 72dp strong (or sky gradient) inner disc,
 *  - 32dp centered white icon.
 *
 * Pass `isPulsing = true` to add a 3s breathing glow ring. The glow
 * disables automatically when `rememberReduceMotion()` returns true.
 *
 * @param tone Which ceremonial tone to paint.
 * @param icon Optional override; defaults to [HaloCircleTone.defaultIcon].
 * @param isPulsing Show the pulsing glow ring. Honored only when motion is allowed.
 */
@Composable
fun HaloCircle(
    tone: HaloCircleTone,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    isPulsing: Boolean = false,
) {
    val reduceMotion = rememberReduceMotion()
    val glowEnabled = isPulsing && !reduceMotion
    val accent = accentFor(tone)
    val ringStroke = accent.copy(alpha = 0.15f)
    val outerFill = outerFillFor(tone)
    val resolvedIcon = icon ?: tone.defaultIcon

    Box(
        modifier =
            modifier
                .size(104.dp)
                .testTag("haloCircle_${tone.identifier}"),
        contentAlignment = Alignment.Center,
    ) {
        if (isPulsing) {
            PulseGlow(enabled = glowEnabled, tint = accent)
        }

        // 96dp outer fill (light tone bg).
        Box(
            modifier =
                Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(outerFill),
        )

        // 4dp translucent ring just outside the 96dp fill. `Modifier.border`
        // draws stroke inside the 104dp box, so it occupies radii 48–52 —
        // exactly the band outside the 96dp (radius 48) fill.
        Box(
            modifier =
                Modifier
                    .size(104.dp)
                    .border(4.dp, ringStroke, CircleShape),
        )

        // 72dp inner disc — gradient for celebration, solid otherwise.
        InnerDisc(tone = tone, accent = accent)

        // 32dp centered white icon.
        PantopusIconImage(
            icon = resolvedIcon,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2.5f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun PulseGlow(
    enabled: Boolean,
    tint: Color,
) {
    if (!enabled) return
    val transition = rememberInfiniteTransition(label = "haloPulse")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 3000, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
        label = "haloPulsePhase",
    )
    val scale = 1.0f + 0.06f * phase
    val alpha = 0.4f * (1f - phase)
    // 104dp pulse — matches the halo's outer extent so the 6% scale-up
    // expands ~3dp past the static ring rather than vanishing behind it.
    Box(
        modifier =
            Modifier
                .size(104.dp)
                .scale(scale)
                .alpha(alpha)
                .clip(CircleShape)
                .background(tint),
    )
}

@Composable
private fun InnerDisc(
    tone: HaloCircleTone,
    accent: Color,
) {
    when (tone) {
        HaloCircleTone.Celebration ->
            Box(
                modifier =
                    Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.verticalGradient(
                                colors =
                                    listOf(
                                        PantopusColors.primary500,
                                        PantopusColors.primary700,
                                    ),
                            ),
                        ),
            )
        HaloCircleTone.Success, HaloCircleTone.Info, HaloCircleTone.Warning ->
            Box(
                modifier =
                    Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(accent),
            )
    }
}

private fun accentFor(tone: HaloCircleTone): Color =
    when (tone) {
        HaloCircleTone.Success -> PantopusColors.success
        HaloCircleTone.Info -> PantopusColors.primary600
        HaloCircleTone.Warning -> PantopusColors.warning
        HaloCircleTone.Celebration -> PantopusColors.primary600
    }

private fun outerFillFor(tone: HaloCircleTone): Color =
    when (tone) {
        HaloCircleTone.Success -> PantopusColors.successBg
        HaloCircleTone.Info -> PantopusColors.primary50
        HaloCircleTone.Warning -> PantopusColors.warningBg
        HaloCircleTone.Celebration -> PantopusColors.primary50
    }

@Preview(showBackground = true, widthDp = 480, heightDp = 140)
@Composable
private fun HaloCircleTonesPreview() {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
        modifier =
            Modifier
                .background(PantopusColors.appSurface),
    ) {
        HaloCircle(tone = HaloCircleTone.Success)
        HaloCircle(tone = HaloCircleTone.Info)
        HaloCircle(tone = HaloCircleTone.Warning)
        HaloCircle(tone = HaloCircleTone.Celebration)
    }
}

@Preview(showBackground = true, widthDp = 160, heightDp = 140)
@Composable
private fun HaloCirclePulsingPreview() {
    Box(
        modifier =
            Modifier
                .background(PantopusColors.appSurface),
    ) {
        HaloCircle(tone = HaloCircleTone.Info, isPulsing = true)
    }
}
