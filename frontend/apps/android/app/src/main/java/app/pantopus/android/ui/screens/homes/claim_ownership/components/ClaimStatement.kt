@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_ownership.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.4 — optional reviewer statement field with an "Optional" tag and a live
 * character counter, capped at [maxChars]. Bound to the wizard view model's
 * note.
 */
@Composable
fun ClaimStatement(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    maxChars: Int = 500,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Your statement",
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.width(Spacing.s1))
            Text(text = "OPTIONAL", color = PantopusColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text(text = "${value.length}/$maxChars", color = PantopusColors.appTextMuted, fontSize = 11.sp)
        }
        OutlinedTextField(
            value = value,
            onValueChange = { if (it.length <= maxChars) onValueChange(it) },
            placeholder = { Text(placeholder, fontSize = 13.sp, color = PantopusColors.appTextMuted) },
            textStyle = TextStyle(fontSize = 13.sp, color = PantopusColors.appText),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            shape = RoundedCornerShape(Radii.lg),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .testTag("claimOwnership_note"),
        )
    }
}
