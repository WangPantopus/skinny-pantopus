@file:Suppress("MagicNumber", "LongMethod", "MatchingDeclarationName", "ModifierMissing")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private const val MAX_LENGTH = 6

/**
 * Normalises raw keyboard input from the hidden [BasicTextField]: uppercases
 * and clamps to [MAX_LENGTH]. Fires `onComplete` exactly once on the
 * `< MAX_LENGTH → MAX_LENGTH` transition. Exposed as an internal top-level
 * function so the auto-advance / backspace / completion-once contract can
 * be unit-tested on the JVM without spinning up a real keyboard.
 */
internal fun processCodeInputChange(
    current: String,
    incoming: String,
    onValueChange: (String) -> Unit,
    onComplete: ((String) -> Unit)? = null,
) {
    val filtered = incoming.uppercase().take(MAX_LENGTH)
    if (filtered != current) {
        val wasIncomplete = current.length < MAX_LENGTH
        onValueChange(filtered)
        if (filtered.length == MAX_LENGTH && wasIncomplete) {
            onComplete?.invoke(filtered)
        }
    }
}

/**
 * Six-character monospace code field. Renders six visual boxes backed by a
 * single hidden [BasicTextField] so the keyboard auto-advances and
 * backspace clears the prior box without juggling six discrete focus
 * states. The locked variant overlays a "Code unlocks on delivery" pill
 * for A12.7's in-transit frame.
 *
 * @param value Current bound string (clamped to [MAX_LENGTH] on change).
 * @param onValueChange Change handler; receives the uppercased, clamped value.
 * @param isDisabled Renders the locked overlay and blocks input.
 * @param lockedCaption Caption shown inside the locked overlay.
 * @param onComplete Fired exactly once when the value transitions from
 *     fewer than 6 characters to exactly 6.
 * @param fieldTestTag Test tag applied to the underlying [BasicTextField].
 */
@Composable
fun CodeInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    isDisabled: Boolean = false,
    lockedCaption: String = "Code unlocks on delivery",
    onComplete: ((String) -> Unit)? = null,
    fieldTestTag: String? = null,
) {
    val focusRequester = remember { FocusRequester() }
    var isFocused by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier =
            modifier
                .semantics {
                    contentDescription = "Verification code"
                    stateDescription =
                        when {
                            isDisabled -> "Locked"
                            value.isEmpty() -> "Empty"
                            else -> "${value.length} of $MAX_LENGTH characters entered"
                        }
                }.then(
                    if (!isDisabled) {
                        Modifier.clickable(
                            interactionSource = interactionSource,
                            indication = null,
                        ) { focusRequester.requestFocus() }
                    } else {
                        Modifier
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.alpha(if (isDisabled) 0.5f else 1f),
        ) {
            for (index in 0 until MAX_LENGTH) {
                CodeInputBox(
                    character = value.getOrNull(index),
                    isCaretSlot = isFocused && !isDisabled && index == value.length && index < MAX_LENGTH,
                    isDisabled = isDisabled,
                )
            }
        }

        // Hidden input — receives keys, drives the visible boxes.
        BasicTextField(
            value = value,
            onValueChange = { incoming ->
                processCodeInputChange(
                    current = value,
                    incoming = incoming,
                    onValueChange = onValueChange,
                    onComplete = onComplete,
                )
            },
            enabled = !isDisabled,
            singleLine = true,
            cursorBrush = SolidColor(Color.Transparent),
            keyboardOptions =
                KeyboardOptions(
                    keyboardType = KeyboardType.Ascii,
                    capitalization = KeyboardCapitalization.Characters,
                    autoCorrectEnabled = false,
                ),
            textStyle = TextStyle(color = Color.Transparent),
            modifier =
                Modifier
                    .size(1.dp)
                    .alpha(0.01f)
                    .focusRequester(focusRequester)
                    .onFocusChanged { isFocused = it.isFocused }
                    .then(if (fieldTestTag != null) Modifier.testTag(fieldTestTag) else Modifier),
        )

        if (isDisabled) {
            LockedOverlay(caption = lockedCaption)
        }
    }
}

@Composable
private fun CodeInputBox(
    character: Char?,
    isCaretSlot: Boolean,
    isDisabled: Boolean,
) {
    val filled = character != null
    val borderColor =
        when {
            isCaretSlot -> PantopusColors.primary600
            filled -> PantopusColors.appBorderStrong
            else -> PantopusColors.appBorder
        }
    val background =
        if (isDisabled) PantopusColors.appSurfaceSunken else PantopusColors.appSurface
    val outerShape = RoundedCornerShape(Radii.md)

    Box(
        modifier =
            Modifier
                .width(44.dp)
                .height(56.dp)
                .clip(outerShape)
                .background(background)
                .then(
                    if (isCaretSlot) {
                        Modifier.border(
                            width = 2.dp,
                            color = PantopusColors.primary600,
                            shape = outerShape,
                        )
                    } else {
                        Modifier.border(
                            width = 1.5.dp,
                            color = borderColor,
                            shape = outerShape,
                        )
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (filled) {
            Text(
                text = character.toString(),
                style =
                    TextStyle(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                    ),
                color = if (isDisabled) PantopusColors.appTextMuted else PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun LockedOverlay(caption: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface.copy(alpha = 0.85f))
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                ).padding(horizontal = Spacing.s3, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = caption,
            style =
                TextStyle(
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                ),
            color = PantopusColors.appTextSecondary,
        )
    }
}
