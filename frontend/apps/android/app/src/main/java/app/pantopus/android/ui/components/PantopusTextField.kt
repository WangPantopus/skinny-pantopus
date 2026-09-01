@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Validation state for [PantopusTextField]. */
sealed interface PantopusFieldState {
    data object Default : PantopusFieldState

    data object Valid : PantopusFieldState

    data class Error(
        val message: String,
    ) : PantopusFieldState
}

/**
 * 44dp token-styled text field with validation visuals.
 *
 * @param label Caption rendered above the field.
 * @param value Current text.
 * @param onValueChange Change handler.
 * @param placeholder Hint shown when [value] is empty.
 * @param state Validation state.
 * @param isSecure True renders as a password field.
 * @param keyboardType Hint for the soft keyboard.
 */
@Composable
fun PantopusTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    state: PantopusFieldState = PantopusFieldState.Default,
    isRequired: Boolean = false,
    isDirty: Boolean = false,
    isSecure: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    fieldTestTag: String? = null,
    containerColor: Color = PantopusColors.appSurface,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val border = borderColor(state, isFocused)

    Column(
        modifier =
            modifier.semantics {
                val base =
                    when (state) {
                        is PantopusFieldState.Error -> "$label, error: ${state.message}"
                        PantopusFieldState.Valid -> "$label, valid"
                        PantopusFieldState.Default -> label
                    }
                contentDescription = if (isRequired) "$base, required" else base
            },
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            if (isRequired) {
                Text(
                    text = "*",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                )
            }
            if (isDirty) {
                Box(
                    modifier =
                        Modifier
                            .padding(start = Spacing.s1)
                            .size(6.dp)
                            .background(PantopusColors.warning, CircleShape),
                )
            }
        }
        Row(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(containerColor)
                    .border(
                        width = if (isFocused) 2.dp else 1.dp,
                        color = border,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                interactionSource = interactionSource,
                visualTransformation =
                    if (isSecure) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                // Test tag must land directly on BasicTextField — that's the
                // node that owns the editable's RequestFocus / SetText
                // semantic actions. Putting it on the outer wrapper meant
                // performTextInput failed with "(RequestFocus is defined)".
                modifier =
                    Modifier
                        .weight(1f)
                        .then(if (fieldTestTag != null) Modifier.testTag(fieldTestTag) else Modifier),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = placeholder,
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            when (state) {
                PantopusFieldState.Valid ->
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
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
        if (state is PantopusFieldState.Error) {
            Text(
                text = state.message,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

private fun borderColor(
    state: PantopusFieldState,
    isFocused: Boolean,
): Color =
    when (state) {
        is PantopusFieldState.Error -> PantopusColors.error
        PantopusFieldState.Valid -> PantopusColors.success
        PantopusFieldState.Default ->
            if (isFocused) PantopusColors.primary600 else PantopusColors.appBorder
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 320)
@Composable
private fun PantopusTextFieldPreview() {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4),
    ) {
        PantopusTextField(label = "Email", value = "", onValueChange = {}, placeholder = "you@pantopus.app")
        PantopusTextField(
            label = "Email",
            value = "alice@pantopus.app",
            onValueChange = {},
            state = PantopusFieldState.Valid,
        )
        PantopusTextField(
            label = "Email",
            value = "not-an-email",
            onValueChange = {},
            state = PantopusFieldState.Error("Please enter a valid email address"),
        )
    }
}
