@file:Suppress("UnusedPrivateMember", "TopLevelPropertyNaming")

package app.pantopus.android.ui.screens.root

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.tooling.preview.Preview
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** Test tag applied to the placeholder container, for Compose UI tests. */
const val NOT_YET_AVAILABLE_TAG = "notYetAvailable"

/**
 * Placeholder body for tabs whose designed UI hasn't landed yet. Delegates
 * to the shared [EmptyState] so voice and visual remain consistent.
 *
 * @param tabName The tab's display name (e.g. "Nearby").
 * @param icon Pantopus icon for the hero circle.
 * @param accent Background tint for the circle.
 * @param foreground Stroke tint for the icon.
 */
@Composable
fun NotYetAvailableView(
    tabName: String,
    icon: PantopusIcon,
    accent: Color = PantopusColors.personalBg,
    foreground: Color = PantopusColors.primary600,
) {
    Box(modifier = Modifier.fillMaxSize().testTag(NOT_YET_AVAILABLE_TAG)) {
        EmptyState(
            icon = icon,
            headline = "$tabName isn't here yet",
            subcopy = "We're still designing this tab. Check back soon.",
            tint = accent,
            accent = foreground,
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 640)
@Composable
private fun NotYetAvailableViewPreview() {
    NotYetAvailableView(tabName = "Nearby", icon = PantopusIcon.Map)
}
