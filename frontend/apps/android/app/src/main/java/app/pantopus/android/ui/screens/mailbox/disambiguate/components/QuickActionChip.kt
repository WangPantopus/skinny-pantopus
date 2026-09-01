@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.disambiguate.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.15 Disambiguate — 44dp "Who is this for?" shortcut chip. The primary
 * variant (sky) backs "This is me"; the neutral variant backs "Route to…".
 * Mirrors the iOS `QuickActionChip`.
 */
@Composable
fun QuickActionChip(
    icon: PantopusIcon,
    label: String,
    isPrimary: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val foreground = if (isPrimary) PantopusColors.primary700 else PantopusColors.appTextStrong
    val background = if (isPrimary) PantopusColors.primary50 else PantopusColors.appSurface
    val border: Color = if (isPrimary) PantopusColors.primary200 else PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .border(1.dp, border, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 15.dp,
            tint = foreground,
        )
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = foreground,
        )
    }
}
