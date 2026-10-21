package app.pantopus.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * The side-menu button (founder decision 2026-10-20): the top screen of every tab carries it, and it opens the one
 * navigation drawer `RootTabScreen` hosts over the whole app. The same look as Place's own menu button.
 */
@Composable
fun NavigationMenuButton(
    onClick: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    IconButton(onClick = onClick, modifier = modifier.size(Spacing.s12).testTag(testTag)) {
        PantopusIconImage(
            icon = PantopusIcon.Menu,
            contentDescription = "Menu",
            size = Spacing.s5,
            tint = PantopusColors.appText,
        )
    }
}
