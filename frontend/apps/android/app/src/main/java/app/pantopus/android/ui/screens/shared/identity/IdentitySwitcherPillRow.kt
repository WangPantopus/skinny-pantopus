@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.identity

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii

/**
 * Render-only choice for the switcher. Feature code projects its own
 * identity enum into this so the component stays generic.
 */
@Immutable
data class IdentityOption(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val accent: Color,
)

/**
 * Equal-width identity switcher pill row. Pass three or more
 * `IdentityOption`s; the active one fills with its accent colour and
 * renders icon + label in inverse text. Used by the Me tab today;
 * Identity Center reuses the same component with a different option
 * list.
 */
@Composable
fun IdentitySwitcherPillRow(
    options: List<IdentityOption>,
    activeId: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    identifierPrefix: String = "identityPill",
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(3.dp)
                .testTag("${identifierPrefix}Row"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        options.forEach { option ->
            val isActive = option.id == activeId
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (isActive) option.accent else Color.Transparent)
                        .clickable { onSelect(option.id) }
                        .testTag("${identifierPrefix}_${option.id}"),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    PantopusIconImage(
                        icon = option.icon,
                        contentDescription = null,
                        size = 11.dp,
                        strokeWidth = 2.4f,
                        tint = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    )
                    Text(
                        text = option.label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    )
                }
            }
        }
    }
}
