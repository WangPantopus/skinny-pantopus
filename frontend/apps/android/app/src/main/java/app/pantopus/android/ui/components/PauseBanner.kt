@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A14.5 Notifications — the warm-amber banner that replaces the Master
 * card while notifications are paused. A `bell-off` icon disc + a
 * countdown headline + a reassurance subline + a neutral "Resume" pill.
 * Mirror of the iOS `PauseBanner`; driven by primitive params so the
 * shared `GroupedListScreen` can render it from a `GroupedListBanner`.
 */
@Composable
fun PauseBanner(
    icon: PantopusIcon,
    title: String,
    subtitle: String?,
    actionLabel: String,
    modifier: Modifier = Modifier,
    onAction: () -> Unit = {},
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .testTag("pauseBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.warningLight),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.warning,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.warning,
                lineHeight = 18.sp,
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    fontSize = 11.5.sp,
                    color = PantopusColors.warning,
                    lineHeight = 15.sp,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                    .clickable(role = Role.Button, onClickLabel = actionLabel, onClick = onAction)
                    .padding(horizontal = 11.dp, vertical = 5.dp)
                    .testTag("pauseBannerAction"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = actionLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}
