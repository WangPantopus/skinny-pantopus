@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.polish

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The H15 verify-frame inputs, built to the H14 accessibility contract: the
 * 6-box code field is a row of decorative boxes backed by a single real,
 * labelled [BasicTextField] (so TalkBack and OTP autofill reach it), targets
 * stay ≥48dp, and the focused box carries a visible focus ring. Tokens only.
 */

private val CODE_BOX_WIDTH = 44.dp
private val CODE_BOX_HEIGHT = 48.dp
private val FIELD_MIN_HEIGHT = 48.dp

/**
 * A 6-box one-time-code entry. The boxes are decorative ([clearAndSetSemantics]);
 * one transparent labelled [BasicTextField] overlays them to capture digits,
 * carry the "Verification code" label, and surface the number-pad keyboard.
 */
@Composable
fun CodeBoxField(
    code: String,
    onCodeChange: (String) -> Unit,
    accent: Color,
    modifier: Modifier = Modifier,
    length: Int = CODE_LENGTH,
) {
    var focused by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.clearAndSetSemantics {},
        ) {
            repeat(length) { index ->
                val digit = code.getOrNull(index)?.toString().orEmpty()
                val isCursor = index == code.length && focused
                CodeBox(digit = digit, filled = digit.isNotEmpty(), isCursor = isCursor, accent = accent)
            }
        }
        BasicTextField(
            value = code,
            onValueChange = onCodeChange,
            modifier =
                Modifier
                    .matchParentSize()
                    .onFocusChanged { focused = it.isFocused }
                    .alpha(0.01f)
                    .testTag("scheduling.notificationPrompt.code")
                    .semantics { contentDescription = "Verification code" },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            cursorBrush = SolidColor(Color.Transparent),
            textStyle = PantopusTextStyle.h3.copy(color = Color.Transparent),
        )
    }
}

@Composable
private fun CodeBox(
    digit: String,
    filled: Boolean,
    isCursor: Boolean,
    accent: Color,
) {
    Box(
        modifier =
            Modifier
                .width(CODE_BOX_WIDTH)
                .height(CODE_BOX_HEIGHT)
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appSurfaceSunken)
                .border(
                    width = if (filled) 1.5.dp else 1.dp,
                    color = if (filled) accent else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.sm),
                )
                .a11yFocusRing(active = isCursor, accent = accent),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = digit, style = PantopusTextStyle.h3, color = PantopusColors.appText)
    }
}

/** Phone-number field with a fixed +1 country chip leading the digits input. */
@Composable
fun PhoneEntryField(
    phone: String,
    onPhoneChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Box(
            modifier =
                Modifier
                    .height(FIELD_MIN_HEIGHT)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3)
                    .clearAndSetSemantics {},
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "+1", style = PantopusTextStyle.body, color = PantopusColors.appText)
        }
        BasicTextField(
            value = phone,
            onValueChange = onPhoneChange,
            modifier =
                Modifier
                    .weight(1f)
                    .height(FIELD_MIN_HEIGHT)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm))
                    .padding(horizontal = Spacing.s3)
                    .testTag("scheduling.notificationPrompt.phone")
                    .semantics { contentDescription = "Phone number, United States" },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            cursorBrush = SolidColor(accentCursor()),
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (phone.isEmpty()) {
                        Text(
                            text = "Phone number",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                            textAlign = TextAlign.Start,
                        )
                    }
                    inner()
                }
            },
        )
    }
}

private fun accentCursor(): Color = PantopusColors.primary600
