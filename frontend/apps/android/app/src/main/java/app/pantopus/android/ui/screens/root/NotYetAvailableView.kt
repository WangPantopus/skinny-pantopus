@file:Suppress("UnusedPrivateMember", "TopLevelPropertyNaming")

package app.pantopus.android.ui.screens.root

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.tooling.preview.Preview
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** Test tag applied to the placeholder container, for Compose UI tests. */
const val NOT_YET_AVAILABLE_TAG = "notYetAvailable"

/**
 * Placeholder body for destinations whose screen isn't in the app yet.
 * Delegates to the shared [EmptyState] so voice and visual remain
 * consistent. With [onBack] it also carries the shared top bar (title +
 * Back) and a "Go back" button, so a pushed placeholder is never a dead end.
 *
 * @param tabName The destination's display name (e.g. "Nearby"). Never an id.
 * @param icon Pantopus icon for the hero circle.
 * @param accent Background tint for the circle.
 * @param foreground Stroke tint for the icon.
 * @param onBack Pops the placeholder. Null renders the bare empty state.
 */
@Composable
fun NotYetAvailableView(
    tabName: String,
    icon: PantopusIcon,
    accent: Color = PantopusColors.personalBg,
    foreground: Color = PantopusColors.primary600,
    onBack: (() -> Unit)? = null,
) {
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(NOT_YET_AVAILABLE_TAG)) {
        if (onBack != null) {
            ContentDetailTopBar(title = tabName, onBack = onBack)
        }
        Box(modifier = Modifier.fillMaxSize()) {
            EmptyState(
                icon = icon,
                headline = "$tabName isn't in the app yet",
                subcopy = "We're still building this part of Pantopus.",
                ctaTitle = if (onBack != null) "Go back" else null,
                onCta = onBack,
                tint = accent,
                accent = foreground,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 640)
@Composable
private fun NotYetAvailableViewPreview() {
    NotYetAvailableView(tabName = "Nearby", icon = PantopusIcon.Map, onBack = {})
}
