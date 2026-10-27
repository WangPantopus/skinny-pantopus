package app.pantopus.android.data.ai

import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-session memory for the Pantopus AI thread's conversation id. The id
 * arrives on the SSE stream ([AIChatStreamEvent.Conversation]) and must
 * outlive the conversation screen's ViewModel so reopening the AI thread
 * continues the same backend conversation instead of forking a new one.
 * It is kept with the account it belongs to, as iOS keys its store by user:
 * after signing out and into another account in the same app process, that
 * account restores its own latest conversation instead of asking for this one.
 */
@Singleton
class AIConversationSession
    @Inject
    constructor() {
        /** Last conversation id yielded by the AI chat stream, if any. */
        @Volatile
        var conversationId: String? = null
            private set

        @Volatile
        private var conversationUserId: String? = null

        /** Set by "New chat": reopening the thread must not resume this person's previous conversation. */
        @Volatile
        var freshStartUserId: String? = null

        /** The conversation [userId] has open in this app session; another account's is never handed out. */
        @Synchronized
        fun conversationIdFor(userId: String): String? = conversationId.takeIf { conversationUserId == userId }

        /** Remember [id] (null forgets it) as [userId]'s conversation. */
        @Synchronized
        fun setConversation(
            id: String?,
            userId: String,
        ) {
            conversationId = id
            conversationUserId = userId
        }
    }
