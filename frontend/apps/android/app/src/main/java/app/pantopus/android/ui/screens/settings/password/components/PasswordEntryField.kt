@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.settings.password.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.14 — masked password input. Extends the [PantopusTextField][app.pantopus.android.ui.components.PantopusTextField]
 * visual vocabulary with an optional leading status icon (lock), a reveal
 * toggle (eye / eye-off), a "revealed" monospace mode for sanity-checking a
 * strong password, a helper line, and the shared default/valid/error states.
 * Mirrors the iOS `PasswordEntryField` (the design's `PasswordField` atom —
 * named `PasswordEntryField` to match iOS, where the Auth feature owns the
 * plain `PasswordField` name).
 */
@Composable
fun PasswordEntryField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    state: PantopusFieldState = PantopusFieldState.Default,
    isRequired: Boolean = false,
    leftIcon: PantopusIcon? = null,
    helper: String? = null,
    revealedByDefault: Boolean = false,
    fieldTestTag: String? = null,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    var revealOverride by remember { mutableStateOf<Boolean?>(null) }
    val isRevealed = revealOverride ?: revealedByDefault

    Column(
        modifier =
            modifier.semantics {
                contentDescription =
                    passwordFieldDescription(
                        label = label,
                        state = state,
                        isRequired = isRequired,
                    )
            },
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PasswordFieldLabel(label = label, isRequired = isRequired)
        PasswordInputRow(
            value = value,
            onValueChange = onValueChange,
            placeholder = placeholder,
            state = state,
            leftIcon = leftIcon,
            isFocused = isFocused,
            isRevealed = isRevealed,
            interactionSource = interactionSource,
            fieldTestTag = fieldTestTag,
            onToggleReveal = { revealOverride = !isRevealed },
        )
        PasswordFieldSupportText(state = state, helper = helper)
    }
}

@Composable
private fun PasswordFieldLabel(
    label: String,
    isRequired: Boolean,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        if (isRequired) {
            Text(text = "*", style = PantopusTextStyle.caption, color = PantopusColors.error)
        }
    }
}

@Composable
private fun PasswordInputRow(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    state: PantopusFieldState,
    leftIcon: PantopusIcon?,
    isFocused: Boolean,
    isRevealed: Boolean,
    interactionSource: MutableInteractionSource,
    fieldTestTag: String?,
    onToggleReveal: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.md)

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 46.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(
                    width = passwordFieldBorderWidth(state, isFocused),
                    color = borderColor(state, isFocused),
                    shape = shape,
                )
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (leftIcon != null) {
            PasswordLeadingIcon(icon = leftIcon, state = state)
        }
        PasswordTextInput(
            value = value,
            onValueChange = onValueChange,
            placeholder = placeholder,
            isRevealed = isRevealed,
            interactionSource = interactionSource,
            fieldTestTag = fieldTestTag,
            modifier = Modifier.weight(1f),
        )
        PasswordStatusIcon(state = state)
        PasswordRevealButton(
            isRevealed = isRevealed,
            fieldTestTag = fieldTestTag,
            onToggleReveal = onToggleReveal,
        )
    }
}

@Composable
private fun PasswordLeadingIcon(
    icon: PantopusIcon,
    state: PantopusFieldState,
) {
    PantopusIconImage(
        icon = icon,
        contentDescription = null,
        size = Radii.xl,
        tint = if (state is PantopusFieldState.Error) PantopusColors.error else PantopusColors.appTextSecondary,
    )
}

@Composable
private fun PasswordTextInput(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    isRevealed: Boolean,
    interactionSource: MutableInteractionSource,
    fieldTestTag: String?,
    modifier: Modifier = Modifier,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        textStyle = passwordTextStyle(isRevealed),
        cursorBrush = SolidColor(PantopusColors.primary600),
        singleLine = true,
        interactionSource = interactionSource,
        visualTransformation = passwordVisualTransformation(isRevealed),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        modifier = modifier.optionalTestTag(fieldTestTag),
        decorationBox = { inner ->
            PasswordPlaceholder(value = value, placeholder = placeholder)
            inner()
        },
    )
}

@Composable
private fun PasswordPlaceholder(
    value: String,
    placeholder: String,
) {
    if (value.isEmpty()) {
        Text(text = placeholder, style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
    }
}

@Composable
private fun PasswordStatusIcon(state: PantopusFieldState) {
    when (state) {
        PantopusFieldState.Valid ->
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.success,
            )
        is PantopusFieldState.Error ->
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.error,
            )
        PantopusFieldState.Default -> Unit
    }
}

@Composable
private fun PasswordRevealButton(
    isRevealed: Boolean,
    fieldTestTag: String?,
    onToggleReveal: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clickable { onToggleReveal() }
                .semantics { contentDescription = if (isRevealed) "Hide password" else "Show password" }
                .optionalTestTag(fieldTestTag?.let { "${it}_reveal" }),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = if (isRevealed) PantopusIcon.EyeOff else PantopusIcon.Eye,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun PasswordFieldSupportText(
    state: PantopusFieldState,
    helper: String?,
) {
    when {
        state is PantopusFieldState.Error -> PasswordErrorText(message = state.message)
        helper != null -> PasswordHelperText(text = helper, isValid = state is PantopusFieldState.Valid)
    }
}

@Composable
private fun PasswordErrorText(message: String) {
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun PasswordHelperText(
    text: String,
    isValid: Boolean,
) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = if (isValid) PantopusColors.success else PantopusColors.appTextSecondary,
    )
}

private fun passwordFieldDescription(
    label: String,
    state: PantopusFieldState,
    isRequired: Boolean,
): String {
    val base =
        when (state) {
            is PantopusFieldState.Error -> "$label, error: ${state.message}"
            PantopusFieldState.Valid -> "$label, valid"
            PantopusFieldState.Default -> label
        }

    return if (isRequired) "$base, required" else base
}

private fun passwordFieldBorderWidth(
    state: PantopusFieldState,
    isFocused: Boolean,
) = when {
    isFocused -> 2.dp
    state is PantopusFieldState.Default -> 1.dp
    else -> 1.5.dp
}

private fun passwordTextStyle(isRevealed: Boolean) =
    if (isRevealed) {
        PantopusTextStyle.body.copy(
            color = PantopusColors.appText,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.5.sp,
        )
    } else {
        PantopusTextStyle.body.copy(color = PantopusColors.appText)
    }

private fun passwordVisualTransformation(isRevealed: Boolean) =
    if (isRevealed) {
        VisualTransformation.None
    } else {
        PasswordVisualTransformation()
    }

private fun Modifier.optionalTestTag(tag: String?) = if (tag != null) testTag(tag) else this

private fun borderColor(
    state: PantopusFieldState,
    isFocused: Boolean,
): Color =
    when (state) {
        is PantopusFieldState.Error -> PantopusColors.error
        PantopusFieldState.Valid -> PantopusColors.success
        PantopusFieldState.Default -> if (isFocused) PantopusColors.primary600 else PantopusColors.appBorder
    }
