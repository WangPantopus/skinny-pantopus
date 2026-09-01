@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * 36dp pill-shaped chip.
 *
 * @param icon Leading Pantopus icon.
 * @param label Trailing text.
 * @param isActive True = filled primary; false = neutral surface with border.
 */
@Composable
fun ActionChip(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isActive: Boolean = false,
) {
    val fg = if (isActive) PantopusColors.appTextInverse else PantopusColors.appText
    val bg = if (isActive) PantopusColors.primary600 else PantopusColors.appSurface
    val border = if (isActive) Color.Transparent else PantopusColors.appBorder

    Row(
        modifier =
            modifier
                .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                .heightIn(min = 36.dp)
                .pantopusShadow(
                    if (isActive) PantopusElevations.primary else PantopusElevations.sm,
                    shape = RoundedCornerShape(Radii.lg),
                ).clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .then(
                    if (border == Color.Transparent) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, border, RoundedCornerShape(Radii.lg))
                    },
                ).clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                    selected = isActive
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = Radii.xl, tint = fg)
        Text(text = label, style = PantopusTextStyle.small, color = fg)
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun ActionChipPreview() {
    Row(
        modifier = Modifier.padding(Spacing.s4).background(PantopusColors.appBg),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ActionChip(icon = PantopusIcon.PlusCircle, label = "Post gig", onClick = {}, isActive = true)
        ActionChip(icon = PantopusIcon.Search, label = "Search", onClick = {})
    }
}
