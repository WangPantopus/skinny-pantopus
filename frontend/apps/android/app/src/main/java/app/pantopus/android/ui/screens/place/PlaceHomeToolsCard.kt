package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.messaging.PlaceActionRowLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * "Home tools" on Your Place: the row into the full Home tools and, under it, the household shortcuts. With none (a
 * guest, a private setup, or before the access is read) it is the single row. Parity twin of iOS `PlaceHomeToolsCard`.
 */
@Composable
fun PlaceHomeToolsCard(
    shortcuts: List<PlaceHomeShortcut>,
    onOpen: () -> Unit,
    onShortcut: (PlaceHomeShortcut) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().placeCard()) {
        PlaceActionRowLabel(
            icon = PantopusIcon.Home,
            title = "Home tools",
            subtitle = "Tasks and tools for your household.",
            modifier = Modifier.clickable(onClick = onOpen).testTag("place.homeTools"),
        )
        if (shortcuts.isNotEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp)) {
                shortcuts.forEach { shortcut ->
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .heightIn(min = 48.dp)
                                .clickable(role = Role.Button) { onShortcut(shortcut) }
                                .padding(vertical = 10.dp)
                                .testTag("place.homeTools.${shortcut.tag}"),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        PlaceIconTile(icon = shortcut.icon, tone = PlaceTileTone.HOME, size = 30.dp)
                        Text(
                            text = shortcut.title,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appTextStrong,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}
