package app.pantopus.android.data.ai

import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-session memory for the Pantopus AI thread's conversation id. The id
 * arrives on the SSE stream ([AIChatStreamEvent.Conversation]) and must
 * outlive the conversation screen's ViewModel so reopening the AI thread
 * continues the same backend conversation instead of forking a new one.
 */
@Singleton
class AIConversationSession
    @Inject
    constructor() {
        /** Last conversation id yielded by the AI chat stream, if any. */
        @Volatile
        var conversationId: String? = null
    }
