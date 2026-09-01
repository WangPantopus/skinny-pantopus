@file:Suppress("MagicNumber", "LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Which channel a [ChannelChip] represents. `letter` is the glyph stamped
 * inside the chip; `fullName` is the spoken accessibility name.
 */
enum class ChannelGlyph(
    val letter: String,
    val fullName: String,
) {
    P(letter = "P", fullName = "Push"),
    E(letter = "E", fullName = "Email"),
    S(letter = "S", fullName = "SMS"),
}

/**
 * Three-way state for a [ChannelChip]. `Locked` is a "forced on,
 * untoggleable" state used for Emergency alerts (push); it draws a small
 * lock glyph in the corner and ignores tap.
 */
enum class ChannelState { On, Off, Locked }

/**
 * 22dp mono-letter chip. Tap toggles state; locked state ignores tap.
 *
 * @param glyph Which channel letter (P / E / S) to stamp inside the chip.
 * @param state Current state — On / Off / Locked.
 * @param onTap Tap handler; ignored when state is Locked or null.
 */
@Composable
fun ChannelChip(
    glyph: ChannelGlyph,
    state: ChannelState,
    modifier: Modifier = Modifier,
    onTap: (() -> Unit)? = null,
    chipTestTag: String? = null,
) {
    val shape = RoundedCornerShape(Radii.sm)
    Box(
        modifier =
            modifier
                .size(22.dp)
                .clip(shape)
                .background(fillColor(state))
                .border(width = 1.dp, color = borderColor(state), shape = shape)
                .channelTapTarget(state = state, onTap = onTap)
                .semantics {
                    contentDescription = "${glyph.fullName} notifications"
                    stateDescription =
                        when (state) {
                            ChannelState.On -> "On"
                            ChannelState.Off -> "Off"
                            ChannelState.Locked -> "Locked on"
                        }
                }.then(if (chipTestTag != null) Modifier.testTag(chipTestTag) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = glyph.letter,
            style =
                TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                ),
            color = foregroundColor(state),
        )
        if (state == ChannelState.Locked) {
            LockBadge()
        }
    }
}

private fun Modifier.channelTapTarget(
    state: ChannelState,
    onTap: (() -> Unit)?,
): Modifier =
    when {
        state == ChannelState.Locked ->
            pointerInput(Unit) {
                detectTapGestures(onTap = {})
            }
        onTap != null -> clickable { onTap() }
        else -> this
    }

/**
 * Three-chip row layout (P / E / S) — the standard A14.5 notifications
 * row trailing slot. The Bool initialiser is the common case (on/off
 * only); the rich constructor surfaces per-chip locked state for rows
 * like "Emergency alerts" where push can't be muted.
 */
@Composable
fun ChannelTriad(
    p: Boolean,
    e: Boolean,
    s: Boolean,
    modifier: Modifier = Modifier,
    onTap: ((ChannelGlyph) -> Unit)? = null,
) {
    ChannelTriad(
        p = if (p) ChannelState.On else ChannelState.Off,
        e = if (e) ChannelState.On else ChannelState.Off,
        s = if (s) ChannelState.On else ChannelState.Off,
        modifier = modifier,
        onTap = onTap,
    )
}

@Composable
fun ChannelTriad(
    p: ChannelState,
    e: ChannelState,
    s: ChannelState,
    modifier: Modifier = Modifier,
    onTap: ((ChannelGlyph) -> Unit)? = null,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ChannelChip(glyph = ChannelGlyph.P, state = p, onTap = onTap?.let { { it(ChannelGlyph.P) } })
        ChannelChip(glyph = ChannelGlyph.E, state = e, onTap = onTap?.let { { it(ChannelGlyph.E) } })
        ChannelChip(glyph = ChannelGlyph.S, state = s, onTap = onTap?.let { { it(ChannelGlyph.S) } })
    }
}

@Composable
private fun LockBadge() {
    Box(
        modifier =
            Modifier
                .offset(x = 8.dp, y = (-8).dp)
                .size(11.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(width = 0.5.dp, color = PantopusColors.primary300, shape = CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 7.dp,
            tint = PantopusColors.primary700,
        )
    }
}

private fun fillColor(state: ChannelState): Color =
    when (state) {
        ChannelState.On -> PantopusColors.primary600
        ChannelState.Off -> PantopusColors.appSurface
        ChannelState.Locked -> PantopusColors.primary100
    }

private fun borderColor(state: ChannelState): Color =
    when (state) {
        ChannelState.On -> PantopusColors.primary600
        ChannelState.Off -> PantopusColors.appBorder
        ChannelState.Locked -> PantopusColors.primary300
    }

private fun foregroundColor(state: ChannelState): Color =
    when (state) {
        ChannelState.On -> PantopusColors.appTextInverse
        ChannelState.Off -> PantopusColors.appTextMuted
        ChannelState.Locked -> PantopusColors.primary700
    }
