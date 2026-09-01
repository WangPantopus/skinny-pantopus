@file:Suppress("UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.screens.inbox

import androidx.compose.runtime.Composable
import app.pantopus.android.ui.screens.inbox.chat.ChatListScreen
import app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent

/**
 * Chat list tab (Inbox). Hosts [ChatListScreen]; the nav host wires
 * conversation-detail / compose / search destinations through the
 * callback parameters until T2.2 ships the real chat conversation
 * screen.
 */
@Composable
fun InboxScreen(
    onOpenConversation: (ConversationRowContent) -> Unit = {},
    onCompose: () -> Unit = {},
    onOpenSearch: () -> Unit = {},
) {
    ChatListScreen(
        onOpenConversation = onOpenConversation,
        onCompose = onCompose,
        onOpenSearch = onOpenSearch,
    )
}
