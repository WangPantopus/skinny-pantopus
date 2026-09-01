package app.pantopus.android.ui.screens.notifications

import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * S5 — Personal / Audience (Beacon) firewall zone selector.
 *
 * The `ListOfRows` shell renders exactly one filter strip (tabs OR
 * chips), and Notifications already spends that slot on the
 * All / Unread / Read filter. The zone selector therefore rides in the
 * shell's `customHeader` slot as a segmented control, mirroring the iOS
 * `NotificationsZoneStrip` view.
 *
 * Only rendered when the account actually has a Beacon stream (or the
 * route asked for a specific zone) — see
 * `NotificationsViewModel.showsZoneStrip`.
 */
@Composable
fun NotificationsZoneStrip(
    zones: List<NotificationsZone>,
    selected: NotificationsZone,
    onSelect: (NotificationsZone) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("notifications.zoneStrip"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s1),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            zones.forEach { zone ->
                val active = zone == selected
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(32.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(
                                if (active) PantopusColors.primary600 else PantopusColors.appSurface,
                            )
                            .clickable { onSelect(zone) }
                            .testTag("notifications.zone.${zone.rawValue}")
                            .semantics { contentDescription = "${zone.label} notifications" },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = zone.label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color =
                            if (active) {
                                PantopusColors.appTextInverse
                            } else {
                                PantopusColors.appTextSecondary
                            },
                    )
                }
            }
        }
    }
}
