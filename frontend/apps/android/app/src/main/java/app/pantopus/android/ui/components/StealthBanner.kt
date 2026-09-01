@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A14.7 Privacy — the dark "Stealth mode is on" banner pinned above the
 * first group in the stealth frame. A near-black slate card with a
 * sky-tinted eye-off icon disc + a one-line consequence note; no action.
 * Mirror of the iOS `StealthBanner`; driven by primitive params so the
 * shared `GroupedListScreen` can render it from a [GroupedListBanner]
 * with `style == Stealth`.
 *
 * The design slate is `#0b1220`; we use `appText` (`#111827`, the
 * darkest neutral token) to stay token-only.
 */
@Composable
fun StealthBanner(
    icon: PantopusIcon,
    title: String,
    subtitle: String?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag("stealthBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appTextInverse.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.primary300,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
                lineHeight = 18.sp,
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextInverse.copy(alpha = 0.65f),
                    lineHeight = 15.sp,
                )
            }
        }
    }
}
