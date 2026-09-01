package app.pantopus.android.data.chats

import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatStatsResponse
import app.pantopus.android.data.api.models.chats.ConversationTopicsResponse
import app.pantopus.android.data.api.models.chats.CreateDirectChatBody
import app.pantopus.android.data.api.models.chats.CreateDirectChatResponse
import app.pantopus.android.data.api.models.chats.EditChatMessageBody
import app.pantopus.android.data.api.models.chats.FindOrCreateTopicBody
import app.pantopus.android.data.api.models.chats.FindOrCreateTopicResponse
import app.pantopus.android.data.api.models.chats.ReactToChatMessageBody
import app.pantopus.android.data.api.models.chats.ReactToChatMessageResponse
import app.pantopus.android.data.api.models.chats.SendChatMessageBody
import app.pantopus.android.data.api.models.chats.SendChatMessageResponse
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ChatApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the chat endpoints in the [NetworkResult] taxonomy. */
@Singleton
class ChatRepository
    @Inject
    constructor(
        private val api: ChatApi,
    ) {
        suspend fun unifiedConversations(limit: Int = 100): NetworkResult<UnifiedConversationsResponse> =
            safeApiCall { api.unifiedConversations(limit) }

        suspend fun stats(): NetworkResult<ChatStatsResponse> = safeApiCall { api.stats() }

        suspend fun roomMessages(
            roomId: String,
            before: String? = null,
            after: String? = null,
            limit: Int = 60,
        ): NetworkResult<ChatMessagesResponse> = safeApiCall { api.roomMessages(roomId, limit, before, after) }

        suspend fun conversationMessages(
            otherUserId: String,
            before: String? = null,
            after: String? = null,
            limit: Int = 60,
            topicId: String? = null,
        ): NetworkResult<ChatMessagesResponse> = safeApiCall { api.conversationMessages(otherUserId, limit, before, after, topicId) }

        suspend fun createDirectChat(otherUserId: String): NetworkResult<CreateDirectChatResponse> =
            safeApiCall { api.createDirectChat(CreateDirectChatBody(otherUserId)) }

        suspend fun sendMessage(body: SendChatMessageBody): NetworkResult<SendChatMessageResponse> = safeApiCall { api.sendMessage(body) }

        suspend fun editMessage(
            messageId: String,
            messageText: String,
        ): NetworkResult<SendChatMessageResponse> = safeApiCall { api.editMessage(messageId, EditChatMessageBody(messageText)) }

        suspend fun deleteMessage(messageId: String): NetworkResult<Unit> = safeApiCall { api.deleteMessage(messageId) }

        suspend fun reactToMessage(
            messageId: String,
            reaction: String,
        ): NetworkResult<ReactToChatMessageResponse> = safeApiCall { api.reactToMessage(messageId, ReactToChatMessageBody(reaction)) }

        suspend fun markRoomRead(roomId: String): NetworkResult<Unit> = safeApiCall { api.markRoomRead(roomId) }

        suspend fun markConversationRead(otherUserId: String): NetworkResult<Unit> = safeApiCall { api.markConversationRead(otherUserId) }

        suspend fun conversationTopics(otherUserId: String): NetworkResult<ConversationTopicsResponse> =
            safeApiCall { api.conversationTopics(otherUserId) }

        suspend fun findOrCreateTopic(
            otherUserId: String,
            body: FindOrCreateTopicBody,
        ): NetworkResult<FindOrCreateTopicResponse> = safeApiCall { api.findOrCreateTopic(otherUserId, body) }
    }
