@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Square checkbox with a primary-tinted check, optional inline label,
 * and a 48dp minimum tap target. Use for inline gates (e.g. the
 * certified-mail acknowledgement gate from P18) where Material's
 * [androidx.compose.material3.Checkbox] would feel too heavy.
 *
 * @param isChecked Current state.
 * @param onCheckedChange Fired whenever the user taps the row.
 * @param label Optional trailing label text. When non-blank the whole
 *     row is the tap target; when blank only the 22dp box itself is.
 * @param enabled Disables interaction and dims to 50% when false.
 */
@Composable
fun PantopusCheckbox(
    isChecked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    enabled: Boolean = true,
) {
    val description = label?.takeIf { it.isNotBlank() } ?: "Checkbox"
    Row(
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .alpha(if (enabled) 1f else 0.5f)
                .clickable(enabled = enabled) { onCheckedChange(!isChecked) }
                .semantics {
                    role = Role.Checkbox
                    contentDescription = description
                    stateDescription = if (isChecked) "Checked" else "Not checked"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(
                        if (isChecked) PantopusColors.primary600 else PantopusColors.appSurface,
                    ).border(
                        width = 1.5.dp,
                        color =
                            if (isChecked) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        shape = RoundedCornerShape(Radii.sm),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (isChecked) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        if (!label.isNullOrBlank()) {
            Text(
                text = label,
                style = PantopusTextStyle.small,
                color = PantopusColors.appText,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun PantopusCheckboxPreview() {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
    ) {
        PantopusCheckbox(isChecked = true, onCheckedChange = {}, label = "Checked with label")
        PantopusCheckbox(isChecked = false, onCheckedChange = {}, label = "Unchecked with label")
        PantopusCheckbox(isChecked = true, onCheckedChange = {})
        PantopusCheckbox(
            isChecked = true,
            onCheckedChange = {},
            label = "Disabled checked",
            enabled = false,
        )
    }
}
