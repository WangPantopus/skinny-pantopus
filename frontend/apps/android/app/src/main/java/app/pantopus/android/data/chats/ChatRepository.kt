package app.pantopus.android.data.chats

import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatRoomDetailResponse
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
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ChatApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/** The largest chat upload (a video) is 100 MB, so a larger download isn't a chat file. */
private const val CHAT_FILE_MAX_BYTES = 100L * 1024 * 1024

/** The Messages list's first page (the route's default). */
private const val CONVERSATIONS_LIMIT = 100

/** Wraps the chat endpoints in the [NetworkResult] taxonomy. */
@Singleton
class ChatRepository
    @Inject
    constructor(
        private val api: ChatApi,
        private val store: ScreenStore,
    ) {
        /**
         * The Messages list through the screens' store (fresh for 30 seconds; [force] reads now). The Messages tab and
         * its badge share it, so a visit right after launch sends nothing.
         */
        suspend fun conversationsStored(force: Boolean = false): Stored<UnifiedConversationsResponse> =
            // Founder decision 7: the list (names, previews, unread counts) is saved on the phone; history never is.
            store.read(StoreKeys.conversations, force, persist = true) { etag ->
                conditionalApiCall { api.unifiedConversationsConditional(limit = CONVERSATIONS_LIMIT, etag = etag) }
            }

        /** The stored Messages list as it is now, without a request. */
        fun conversationsCopy(): UnifiedConversationsResponse? = store.peek(StoreKeys.conversations).data

        /** Marks the Messages list out of date (a new conversation arrived, the live connection came back). */
        fun conversationsChanged() = store.markStale(StoreTopics.CHATS)

        /** An own edit to a conversation (contract §8: a message sent or read, a chat created): the list reads again. */
        private fun <T> NetworkResult<T>.chatsChanged(): NetworkResult<T> = also { if (it is NetworkResult.Success) conversationsChanged() }

        suspend fun unifiedConversations(limit: Int = 100): NetworkResult<UnifiedConversationsResponse> =
            safeApiCall { api.unifiedConversations(limit) }

        suspend fun stats(): NetworkResult<ChatStatsResponse> = safeApiCall { api.stats() }

        suspend fun room(roomId: String): NetworkResult<ChatRoomDetailResponse> = safeApiCall { api.room(roomId) }

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
            safeApiCall { api.createDirectChat(CreateDirectChatBody(otherUserId)) }.chatsChanged()

        suspend fun sendMessage(body: SendChatMessageBody): NetworkResult<SendChatMessageResponse> =
            safeApiCall { api.sendMessage(body) }.chatsChanged()

        suspend fun editMessage(
            messageId: String,
            messageText: String,
        ): NetworkResult<SendChatMessageResponse> =
            safeApiCall { api.editMessage(messageId, EditChatMessageBody(messageText)) }.chatsChanged()

        suspend fun deleteMessage(messageId: String): NetworkResult<Unit> = safeApiCall { api.deleteMessage(messageId) }.chatsChanged()

        /** Streams a chat attachment into [destination], so it can be opened in another app. */
        suspend fun downloadFile(
            fileId: String,
            destination: File,
        ): NetworkResult<Unit> =
            safeApiCall {
                val response = api.downloadFile(fileId)
                if (!response.isSuccessful) {
                    response.errorBody()?.close()
                    throw HttpException(response)
                }
                // IOExceptions, so safeApiCall reports them as a failed download.
                val body = response.body() ?: throw IOException("chat file response has no body")
                body.use {
                    if (body.contentLength() > CHAT_FILE_MAX_BYTES) throw IOException("chat file is too large")
                    withContext(Dispatchers.IO) {
                        body.byteStream().use { input ->
                            destination.outputStream().use { output ->
                                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                                var total = 0L
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read < 0) break
                                    total += read
                                    if (total > CHAT_FILE_MAX_BYTES) throw IOException("chat file is too large")
                                    output.write(buffer, 0, read)
                                }
                            }
                        }
                    }
                }
            }

        suspend fun reactToMessage(
            messageId: String,
            reaction: String,
            reacted: Boolean? = null,
        ): NetworkResult<ReactToChatMessageResponse> =
            safeApiCall { api.reactToMessage(messageId, ReactToChatMessageBody(reaction, reacted)) }

        suspend fun markRoomRead(roomId: String): NetworkResult<Unit> = safeApiCall { api.markRoomRead(roomId) }.chatsChanged()

        suspend fun markConversationRead(otherUserId: String): NetworkResult<Unit> =
            safeApiCall { api.markConversationRead(otherUserId) }.chatsChanged()

        suspend fun conversationTopics(otherUserId: String): NetworkResult<ConversationTopicsResponse> =
            safeApiCall { api.conversationTopics(otherUserId) }

        suspend fun findOrCreateTopic(
            otherUserId: String,
            body: FindOrCreateTopicBody,
        ): NetworkResult<FindOrCreateTopicResponse> = safeApiCall { api.findOrCreateTopic(otherUserId, body) }
    }
