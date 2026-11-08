package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * The side-menu button (founder decision 2026-10-20): the top screen of every tab carries it, and it opens the one
 * navigation drawer `RootTabScreen` hosts over the whole app. The same look as Place's own menu button. It sits at the
 * top left (founder decision 2026-11-08).
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

/** What the chat button needs from `RootTabScreen`: the unread count and the way to Messages. */
data class MessagesEntry(
    val unread: Int,
    val open: () -> Unit,
)

/**
 * Set by `RootTabScreen` while it shows, for every tab's chat button; null elsewhere (previews, tests), where
 * [MessagesButton] draws nothing.
 */
object MessagesEntryHolder {
    var current: MessagesEntry? by mutableStateOf(null)
}

/**
 * The chat button at the top right of every tab's first screen but Mail's (founder decision 2026-11-08, as Facebook
 * shows Messenger): it carries the unread count the Messages tab had and opens Messages, whose Back returns to the tab
 * it was opened from.
 */
@Composable
fun MessagesButton(
    testTag: String,
    modifier: Modifier = Modifier,
) {
    val entry = MessagesEntryHolder.current ?: return
    val label = if (entry.unread > 0) "Messages, ${entry.unread} unread" else "Messages"
    IconButton(
        onClick = entry.open,
        modifier = modifier.size(Spacing.s12).testTag(testTag).semantics { contentDescription = label },
    ) {
        Box {
            MessagesGlyph(unread = entry.unread > 0)
            if (entry.unread > 0) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 9.dp, y = (-6).dp)
                            .defaultMinSize(minWidth = 16.dp, minHeight = 16.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.error)
                            .border(1.5.dp, Color.White, CircleShape)
                            .padding(horizontal = 3.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (entry.unread > 99) "99+" else entry.unread.toString(),
                        style = PantopusTextStyle.caption.copy(fontSize = 10.sp),
                        color = Color.White,
                    )
                }
            }
        }
    }
}
