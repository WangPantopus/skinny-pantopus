package app.pantopus.android.data.chats

import app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

data class ChatBadgeSnapshot(
    val serverTotalUnread: Int = 0,
    val rows: List<ConversationRowContent> = emptyList(),
    val serverUnmutedUnread: Int? = null,
    val initialized: Boolean = false,
)

/** Shared badge snapshot so the chat list can drive muted-unread exclusion. */
@Singleton
class ChatBadgeCoordinator
    @Inject
    constructor() {
        private val _snapshot = MutableStateFlow(ChatBadgeSnapshot())
        val snapshot: StateFlow<ChatBadgeSnapshot> = _snapshot.asStateFlow()

        fun publish(
            serverTotalUnread: Int,
            rows: List<ConversationRowContent>,
            serverUnmutedUnread: Int? = null,
        ) {
            _snapshot.value = ChatBadgeSnapshot(serverTotalUnread, rows, serverUnmutedUnread, initialized = true)
        }

        /** Sign-out: the last account's unread total and conversation rows go. */
        fun reset() {
            _snapshot.value = ChatBadgeSnapshot()
        }
    }
