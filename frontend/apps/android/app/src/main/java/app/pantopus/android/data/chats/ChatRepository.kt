package app.pantopus.android.data.chats

import app.pantopus.android.data.api.models.chats.ChatChangesBody
import app.pantopus.android.data.api.models.chats.ChatChangesResponse
import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatNotificationPreferencesBody
import app.pantopus.android.data.api.models.chats.ChatNotificationPreferencesResponse
import app.pantopus.android.data.api.models.chats.ChatReadResponse
import app.pantopus.android.data.api.models.chats.ChatRoomDetail
import app.pantopus.android.data.api.models.chats.ChatRoomDetailResponse
import app.pantopus.android.data.api.models.chats.ChatSearchResponse
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
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.api.net.Conditional
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.mapFresh
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ChatApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKey
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import retrofit2.HttpException
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection.HTTP_BAD_METHOD
import java.net.HttpURLConnection.HTTP_BAD_REQUEST
import java.net.HttpURLConnection.HTTP_NOT_FOUND
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

/** The largest chat upload (a video) is 100 MB, so a larger download isn't a chat file. */
private const val CHAT_FILE_MAX_BYTES = 100L * 1024 * 1024

/** The Messages list's first page (the route's default). */
private const val CONVERSATIONS_LIMIT = 100
private const val HISTORY_LIMIT = 100
private const val LEGACY_SYNC_QUERY_LIMIT = 6000
private const val REQUEST_HEADERS_TOO_LARGE = 431

/** Wraps the chat endpoints in the [NetworkResult] taxonomy. */
@Singleton
@Suppress("TooManyFunctions") // Existing chat endpoint wrappers and their bounded memory copies share one repository.
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
            // The list and the separately encrypted recent-history window both survive a process restart.
            store.read(StoreKeys.conversations, force, persist = true) { etag ->
                conditionalApiCall { api.unifiedConversationsConditional(limit = CONVERSATIONS_LIMIT, etag = etag) }
            }

        /** The stored Messages list as it is now, without a request. */
        fun conversationsCopy(): UnifiedConversationsResponse? = store.peek(StoreKeys.conversations).data

        /** Capture while binding the socket, before an event can be delayed across an account or access change. */
        fun badgeUpdater(): () -> (suspend (Int, Int?) -> Boolean) = store.chatBadgeUpdater()

        /** Marks the Messages list out of date (a new conversation arrived, the live connection came back). */
        fun conversationsChanged() = store.markStale(StoreTopics.CHATS)

        /** A live inbox change invalidates saved previews/counts without refetching message history. */
        fun inboxChanged() = store.markStale(StoreTopics.CHAT_LIST)

        /** Ordinary successful mutations retain the offline inbox while marking it for revalidation. */
        private fun <T> NetworkResult<T>.chatsChanged(): NetworkResult<T> =
            also {
                if (it is NetworkResult.Success) {
                    store.markEdited(StoreTopics.CHAT_LIST, retainChatList = true)
                    // Reading/sending a message must not cancel a history access check already in flight.
                    store.markStale(StoreTopics.CHATS)
                }
            }

        suspend fun unifiedConversations(
            limit: Int = 100,
            force: Boolean = false,
        ): NetworkResult<UnifiedConversationsResponse> {
            val stored = conversationsStored(force)
            return stored.data?.let { NetworkResult.Success(it.copy(conversations = it.conversations.take(limit))) } ?: stored.asResult()
        }

        suspend fun conversationsPage(
            before: String? = null,
            query: String? = null,
        ): NetworkResult<UnifiedConversationsResponse> =
            safeApiCall { api.unifiedConversations(limit = CONVERSATIONS_LIMIT, before = before, query = query) }

        suspend fun searchMessages(
            query: String,
            before: String? = null,
        ): NetworkResult<ChatSearchResponse> = safeApiCall { api.searchMessages(query, before) }

        suspend fun roomMessageContext(
            roomId: String,
            messageId: String,
            asBusinessUserId: String? = null,
        ): NetworkResult<ChatMessagesResponse> = safeApiCall { api.roomMessageContext(roomId, messageId, asBusinessUserId) }

        suspend fun conversationMessageContext(
            otherUserId: String,
            messageId: String,
        ): NetworkResult<ChatMessagesResponse> = safeApiCall { api.conversationMessageContext(otherUserId, messageId) }

        suspend fun stats(): NetworkResult<ChatStatsResponse> = safeApiCall { api.stats() }

        suspend fun room(
            roomId: String,
            asBusinessUserId: String? = null,
        ): NetworkResult<ChatRoomDetailResponse> = safeApiCall { api.room(roomId, asBusinessUserId) }

        /** A person reply may use an older direct room, but never a different audience or represented identity. */
        fun replyRoomAllowed(
            target: ChatSendTarget,
            roomId: String,
            room: ChatRoomDetail,
        ): Boolean {
            if (room.isActive != true) return false
            val participants = room.participants.orEmpty()
            val active = participants.filter { it.isActive == true && it.leftAt == null }
            return when (target.kind) {
                "room" -> roomId == target.id
                "person" ->
                    room.type == "direct" && participants.none { it.isActive == null } && active.size == 2 &&
                        active.mapNotNull { it.userId }.toSet() == setOf(target.asBusinessUserId ?: target.accountId, target.id)
                else -> false
            }
        }

        suspend fun validateReplyRoom(
            target: ChatSendTarget,
            roomId: String,
        ): NetworkResult<Unit> =
            when (val result = room(roomId, target.asBusinessUserId)) {
                is NetworkResult.Failure -> result
                is NetworkResult.Success ->
                    if (replyRoomAllowed(target, roomId, result.data.room)) {
                        NetworkResult.Success(Unit)
                    } else {
                        NetworkResult.Failure(
                            NetworkError.ClientError(HTTP_BAD_REQUEST, "Open the original conversation to reply to this message."),
                        )
                    }
            }

        suspend fun roomMessages(
            roomId: String,
            before: String? = null,
            after: String? = null,
            limit: Int = HISTORY_LIMIT,
            force: Boolean = false,
            asBusinessUserId: String? = null,
        ): NetworkResult<ChatMessagesResponse> {
            if (force || before != null || after != null) {
                return safeApiCall {
                    api.roomMessages(
                        roomId,
                        limit,
                        before,
                        after,
                        asBusinessUserId,
                        sync = before == null && after == null,
                    )
                }
                    .forgetRefusedHistory(StoreKeys.roomMessages(roomId, HISTORY_LIMIT, asBusinessUserId))
            }
            val count = limit.coerceIn(1, HISTORY_LIMIT)
            val stored =
                store.read(StoreKeys.roomMessages(roomId, count, asBusinessUserId), force, persist = true) { etag ->
                    conditionalApiCall { api.roomMessagesConditional(roomId, count, etag, asBusinessUserId) }.mapFresh(::boundedHistory)
                }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun roomMessagesCopy(
            roomId: String,
            asBusinessUserId: String? = null,
        ): ChatMessagesResponse? = store.peek(StoreKeys.roomMessages(roomId, HISTORY_LIMIT, asBusinessUserId)).data

        suspend fun conversationMessages(
            otherUserId: String,
            before: String? = null,
            after: String? = null,
            limit: Int = HISTORY_LIMIT,
            topicId: String? = null,
            force: Boolean = false,
        ): NetworkResult<ChatMessagesResponse> {
            if (force || before != null || after != null) {
                return safeApiCall {
                    api.conversationMessages(
                        otherUserId,
                        limit,
                        before,
                        after,
                        topicId,
                        sync = before == null && after == null,
                    )
                }
                    .forgetRefusedHistory(StoreKeys.conversationMessages(otherUserId, topicId, HISTORY_LIMIT))
            }
            val count = limit.coerceIn(1, HISTORY_LIMIT)
            val stored =
                store.read(StoreKeys.conversationMessages(otherUserId, topicId, count), force, persist = true) { etag ->
                    conditionalApiCall { api.conversationMessagesConditional(otherUserId, count, topicId, etag) }.mapFresh(::boundedHistory)
                }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun conversationMessagesCopy(
            otherUserId: String,
            topicId: String?,
        ): ChatMessagesResponse? = store.peek(StoreKeys.conversationMessages(otherUserId, topicId, HISTORY_LIMIT)).data

        fun roomHistoryUpdater(
            roomId: String,
            asBusinessUserId: String? = null,
        ): (ChatMessagesResponse) -> Unit = historyUpdater(StoreKeys.roomMessages(roomId, HISTORY_LIMIT, asBusinessUserId))

        fun conversationHistoryUpdater(
            otherUserId: String,
            topicId: String?,
        ): (ChatMessagesResponse) -> Unit = historyUpdater(StoreKeys.conversationMessages(otherUserId, topicId, HISTORY_LIMIT))

        fun historyAccessRetirer(): suspend (Set<String>) -> Unit = store.chatAccessRetirer()

        private fun historyUpdater(key: StoreKey<ChatMessagesResponse>): (ChatMessagesResponse) -> Unit {
            val update = store.memoryUpdater(key)
            return { response -> update(boundedHistory(response)) }
        }

        /** Pagination and reconnect bypass the first-page store; an access refusal still retires that copy. */
        private fun NetworkResult<ChatMessagesResponse>.forgetRefusedHistory(
            key: StoreKey<ChatMessagesResponse>,
        ): NetworkResult<ChatMessagesResponse> =
            also {
                if (it is NetworkResult.Failure &&
                    (it.error.refusesStoredCopy)
                ) {
                    store.remove(key)
                }
            }

        private fun boundedHistory(response: ChatMessagesResponse): ChatMessagesResponse {
            if (response.messages.size <= HISTORY_LIMIT) return response
            val messages = response.messages.takeLast(HISTORY_LIMIT)
            val oldest = messages.first()
            val timestamp = oldest.createdAt.replace("+00:00", "Z").replace("+0000", "Z")
            return response.copy(messages = messages, hasMore = true, nextCursor = "$timestamp|${oldest.id}")
        }

        suspend fun roomChanges(
            roomId: String,
            cursor: Map<String, Long>,
            until: Map<String, Long>?,
            asBusinessUserId: String?,
            readMessageIds: List<String>? = null,
        ): NetworkResult<ChatChangesResponse> =
            readChanges(
                ChatChangesBody(cursor, until, asBusinessUserId, readMessageIds = readMessageIds),
                post = { api.roomChangesPost(roomId, it) },
                legacy = { encodedCursor, encodedUntil -> api.roomChanges(roomId, encodedCursor, encodedUntil, asBusinessUserId) },
            )

        suspend fun conversationChanges(
            otherUserId: String,
            cursor: Map<String, Long>,
            until: Map<String, Long>?,
            readMessageIds: List<String>? = null,
        ): NetworkResult<ChatChangesResponse> =
            readChanges(
                ChatChangesBody(cursor, until, readMessageIds = readMessageIds),
                post = { api.conversationChangesPost(otherUserId, it) },
                legacy = { encodedCursor, encodedUntil -> api.conversationChanges(otherUserId, encodedCursor, encodedUntil) },
            )

        private suspend fun readChanges(
            body: ChatChangesBody,
            post: suspend (ChatChangesBody) -> ChatChangesResponse,
            legacy: suspend (String, String?) -> ChatChangesResponse,
        ): NetworkResult<ChatChangesResponse> {
            val result = receiptCompatibleChanges(body, safeApiCall { post(body) })
            if (result !is NetworkResult.Failure || result.error.code !in listOf(HTTP_NOT_FOUND, HTTP_BAD_METHOD)) return result
            val cursor = JSONObject(body.cursor).toString()
            val until = body.until?.let { JSONObject(it).toString() }
            val encodedSize = URLEncoder.encode(cursor, "UTF-8").length + (until?.let { URLEncoder.encode(it, "UTF-8").length } ?: 0)
            // A server without POST support can still recover small maps. Larger maps use the existing
            // bounded history reconciliation instead of repeating an oversized GET or truncating rooms.
            if (encodedSize > LEGACY_SYNC_QUERY_LIMIT) return NetworkResult.Success(ChatChangesResponse(resetRequired = true))
            val fallback = safeApiCall { legacy(cursor, until) }
            return if (fallback is NetworkResult.Failure &&
                fallback.error.code in listOf(HTTP_NOT_FOUND, HTTP_BAD_METHOD, REQUEST_HEADERS_TOO_LARGE)
            ) {
                NetworkResult.Success(ChatChangesResponse(resetRequired = true))
            } else {
                fallback
            }
        }

        /** A missing receipt projection requires canonical history before the recovery cursor can advance. */
        private fun receiptCompatibleChanges(
            body: ChatChangesBody,
            result: NetworkResult<ChatChangesResponse>,
        ): NetworkResult<ChatChangesResponse> {
            if (body.readMessageIds == null) return result
            return when (result) {
                is NetworkResult.Success ->
                    if (result.data.messageReadReceipts == null) {
                        NetworkResult.Success(result.data.copy(resetRequired = true))
                    } else {
                        result
                    }
                is NetworkResult.Failure -> {
                    val error = result.error
                    val unsupportedField =
                        error is NetworkError.ClientError && error.code == HTTP_BAD_REQUEST &&
                            error.body?.contains("readMessageIds") == true
                    if (unsupportedField || error.code in listOf(HTTP_NOT_FOUND, HTTP_BAD_METHOD)) {
                        NetworkResult.Success(ChatChangesResponse(resetRequired = true))
                    } else {
                        result
                    }
                }
            }
        }

        suspend fun createDirectChat(otherUserId: String): NetworkResult<CreateDirectChatResponse> =
            safeApiCall { api.createDirectChat(CreateDirectChatBody(otherUserId)) }.chatsChanged()

        suspend fun sendMessage(body: SendChatMessageBody): NetworkResult<SendChatMessageResponse> =
            safeApiCall { api.sendMessage(body) }.chatsChanged()

        suspend fun editMessage(
            messageId: String,
            messageText: String,
            target: ChatSendTarget? = null,
        ): NetworkResult<SendChatMessageResponse> = contentChanged(target) { api.editMessage(messageId, EditChatMessageBody(messageText)) }

        suspend fun deleteMessage(
            messageId: String,
            target: ChatSendTarget? = null,
        ): NetworkResult<Unit> = contentChanged(target) { api.deleteMessage(messageId) }

        private suspend fun <T> contentChanged(
            target: ChatSendTarget?,
            write: suspend () -> T,
        ): NetworkResult<T> {
            val update = store.chatContentUpdater(StoreKeys.conversations, target?.accountId)
            return safeApiCall { write() }.also { result ->
                if (result is NetworkResult.Success) {
                    update { copy ->
                        val matches: (UnifiedConversationDto) -> Boolean = { row ->
                            when (target?.kind) {
                                "person" -> row.otherParticipantId == target.id
                                "room" -> row.id == target.id || row.roomIds?.contains(target.id) == true
                                else -> false
                            }
                        }
                        // Unknown or missing scope keeps conservative retirement rather than retaining stale content.
                        copy.takeIf { it.conversations.any(matches) }?.copy(
                            conversations = copy.conversations.map { if (matches(it)) it.copy(lastMessagePreview = null) else it },
                        )
                    }
                }
            }
        }

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

        suspend fun markRoomRead(
            roomId: String,
            asBusinessUserId: String? = null,
            throughMessageId: String? = null,
        ): NetworkResult<Unit> =
            readWithInboxProjection(
                matches = { row ->
                    asBusinessUserId == null && (row.id == roomId || row.roomIds == listOf(roomId))
                },
            ) {
                api.markRoomRead(
                    roomId,
                    buildMap {
                        asBusinessUserId?.let { put("asBusinessUserId", it) }
                        throughMessageId?.let { put("throughMessageId", it) }
                    },
                )
            }

        suspend fun markConversationRead(
            otherUserId: String,
            throughMessageId: String? = null,
            throughMessageIds: Map<String, String>? = null,
        ): NetworkResult<Unit> =
            readWithInboxProjection(matches = { it.otherParticipantId == otherUserId }) {
                api.markConversationRead(
                    otherUserId,
                    buildMap {
                        throughMessageIds?.let { put("throughMessageIds", it) }
                            ?: throughMessageId?.let { put("throughMessageId", it) }
                    },
                )
            }

        suspend fun markRoomTopicRead(
            roomId: String,
            topicId: String,
            asBusinessUserId: String?,
            throughMessageId: String,
        ): NetworkResult<Unit> =
            readWithInboxProjection(
                matches = { row -> asBusinessUserId == null && (row.id == roomId || row.roomIds == listOf(roomId)) },
                expectedTopicId = topicId,
            ) {
                api.markRoomTopicRead(
                    roomId,
                    topicId,
                    buildMap {
                        put("throughMessageId", throughMessageId)
                        asBusinessUserId?.let { put("asBusinessUserId", it) }
                    },
                )
            }

        suspend fun markConversationTopicRead(
            otherUserId: String,
            topicId: String,
            throughMessageIds: Map<String, String>,
        ): NetworkResult<Unit> =
            readWithInboxProjection(matches = { it.otherParticipantId == otherUserId }, expectedTopicId = topicId) {
                api.markConversationTopicRead(otherUserId, topicId, mapOf("throughMessageIds" to throughMessageIds))
            }

        private suspend fun readWithInboxProjection(
            matches: (UnifiedConversationDto) -> Boolean,
            expectedTopicId: String? = null,
            read: suspend () -> ChatReadResponse,
        ): NetworkResult<Unit> {
            val update = store.chatReadUpdater(StoreKeys.conversations)
            return when (val result = safeApiCall { read() }) {
                is NetworkResult.Failure -> result
                is NetworkResult.Success -> {
                    if (expectedTopicId != null && (result.data.topicId != expectedTopicId || result.data.readScope != "topic")) {
                        return NetworkResult.Failure(
                            NetworkError.ClientError(
                                java.net.HttpURLConnection.HTTP_BAD_GATEWAY,
                                "Topic read response was not scoped",
                            ),
                        )
                    }
                    val count = result.data.unreadCount?.takeIf { it >= 0 }
                    update { copy ->
                        // A scoped count cannot establish global totals or mixed-muted unread counts.
                        if (count == null) {
                            copy
                        } else {
                            copy.copy(
                                conversations =
                                    copy.conversations.map { row ->
                                        if (matches(row)) row.copy(totalUnread = count) else row
                                    },
                            )
                        }
                    }
                    NetworkResult.Success(Unit)
                }
            }
        }

        suspend fun setConversationNotifications(
            otherUserId: String,
            enabled: Boolean,
        ): NetworkResult<ChatNotificationPreferencesResponse> =
            safeApiCall { api.conversationPreferences(otherUserId, ChatNotificationPreferencesBody(enabled)) }.chatsChanged()

        suspend fun setRoomNotifications(
            roomId: String,
            enabled: Boolean,
            asBusinessUserId: String? = null,
        ): NetworkResult<ChatNotificationPreferencesResponse> =
            safeApiCall { api.roomPreferences(roomId, ChatNotificationPreferencesBody(enabled, asBusinessUserId)) }.chatsChanged()

        fun conversationTopicsCopy(otherUserId: String): ConversationTopicsResponse? =
            store.peek(StoreKeys.conversationTopics(otherUserId)).data

        suspend fun conversationTopics(otherUserId: String): NetworkResult<ConversationTopicsResponse> {
            val stored =
                store.read(StoreKeys.conversationTopics(otherUserId), persist = true) {
                    safeApiCall { Conditional.Fresh(api.conversationTopics(otherUserId), null) }
                }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        suspend fun findOrCreateTopic(
            otherUserId: String,
            body: FindOrCreateTopicBody,
        ): NetworkResult<FindOrCreateTopicResponse> = safeApiCall { api.findOrCreateTopic(otherUserId, body) }
    }
