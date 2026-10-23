package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.chats.ChatChangesBody
import app.pantopus.android.data.api.models.chats.ChatChangesResponse
import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatNotificationPreferencesBody
import app.pantopus.android.data.api.models.chats.ChatNotificationPreferencesResponse
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
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

/**
 * Chat endpoints under `/api/chat/[*]` from `backend/routes/chats.js`.
 * Mounted at `/api/chat` (see `backend/app.js:325`).
 */
@Suppress("TooManyFunctions") // declarative Retrofit endpoint list — one function per route
interface ChatApi {
    /** `GET /api/chat/unified-conversations`. */
    @Headers("Cache-Control: no-store")
    @GET("api/chat/unified-conversations")
    suspend fun unifiedConversations(
        @Query("limit") limit: Int = 100,
        @Query("before") before: String? = null,
        @Query("q") query: String? = null,
    ): UnifiedConversationsResponse

    /** [unifiedConversations] for the screens' store: sends the stored ETag; a 304 means the copy is current. */
    @GET("api/chat/unified-conversations")
    suspend fun unifiedConversationsConditional(
        @Query("limit") limit: Int,
        @Header("If-None-Match") etag: String?,
    ): Response<UnifiedConversationsResponse>

    @Headers("Cache-Control: no-store")
    @GET("api/chat/search")
    suspend fun searchMessages(
        @Query("q") query: String,
        @Query("before") before: String? = null,
        @Query("limit") limit: Int = 50,
    ): ChatSearchResponse

    @Headers("Cache-Control: no-store")
    @GET("api/chat/rooms/{roomId}/messages/{messageId}/context")
    suspend fun roomMessageContext(
        @Path("roomId") roomId: String,
        @Path("messageId") messageId: String,
        @Query("asBusinessUserId") asBusinessUserId: String? = null,
    ): ChatMessagesResponse

    @Headers("Cache-Control: no-store")
    @GET("api/chat/conversations/{otherUserId}/messages/{messageId}/context")
    suspend fun conversationMessageContext(
        @Path("otherUserId") otherUserId: String,
        @Path("messageId") messageId: String,
    ): ChatMessagesResponse

    @PATCH("api/chat/conversations/{otherUserId}/preferences")
    suspend fun conversationPreferences(
        @Path("otherUserId") otherUserId: String,
        @Body body: ChatNotificationPreferencesBody,
    ): ChatNotificationPreferencesResponse

    @PATCH("api/chat/rooms/{roomId}/preferences")
    suspend fun roomPreferences(
        @Path("roomId") roomId: String,
        @Body body: ChatNotificationPreferencesBody,
    ): ChatNotificationPreferencesResponse

    /** `GET /api/chat/stats`. */
    @GET("api/chat/stats")
    suspend fun stats(): ChatStatsResponse

    /**
     * `GET /api/chat/rooms/:roomId` — the room's type and participants, for
     * participants only. A chat link names only the room; this tells a
     * direct room's other person apart.
     */
    @GET("api/chat/rooms/{roomId}")
    suspend fun room(
        @Path("roomId") roomId: String,
        @Query("asBusinessUserId") asBusinessUserId: String? = null,
    ): ChatRoomDetailResponse

    /** `GET /api/chat/rooms/:roomId/messages` — route `chats.js:1340`. */
    @GET("api/chat/rooms/{roomId}/messages")
    suspend fun roomMessages(
        @Path("roomId") roomId: String,
        @Query("limit") limit: Int = 60,
        @Query("before") before: String? = null,
        @Query("after") after: String? = null,
        @Query("asBusinessUserId") asBusinessUserId: String? = null,
        @Query("sync") sync: Boolean? = null,
    ): ChatMessagesResponse

    /** `GET /api/chat/conversations/:otherUserId/messages` — route `chats.js:1157`. */
    @GET("api/chat/conversations/{otherUserId}/messages")
    suspend fun conversationMessages(
        @Path("otherUserId") otherUserId: String,
        @Query("limit") limit: Int = 60,
        @Query("before") before: String? = null,
        @Query("after") after: String? = null,
        @Query("topicId") topicId: String? = null,
        @Query("sync") sync: Boolean? = null,
    ): ChatMessagesResponse

    @GET("api/chat/rooms/{roomId}/messages")
    suspend fun roomMessagesConditional(
        @Path("roomId") roomId: String,
        @Query("limit") limit: Int,
        @Header("If-None-Match") etag: String?,
        @Query("asBusinessUserId") asBusinessUserId: String? = null,
        @Query("sync") sync: Boolean? = true,
    ): Response<ChatMessagesResponse>

    @GET("api/chat/conversations/{otherUserId}/messages")
    suspend fun conversationMessagesConditional(
        @Path("otherUserId") otherUserId: String,
        @Query("limit") limit: Int,
        @Query("topicId") topicId: String?,
        @Header("If-None-Match") etag: String?,
        @Query("sync") sync: Boolean? = true,
    ): Response<ChatMessagesResponse>

    @Headers("Cache-Control: no-store")
    @GET("api/chat/rooms/{roomId}/changes")
    suspend fun roomChanges(
        @Path("roomId") roomId: String,
        @Query("cursor") cursor: String,
        @Query("until") until: String? = null,
        @Query("asBusinessUserId") asBusinessUserId: String? = null,
        @Query("limit") limit: Int = 200,
    ): ChatChangesResponse

    @Headers("Cache-Control: no-store")
    @GET("api/chat/conversations/{otherUserId}/changes")
    suspend fun conversationChanges(
        @Path("otherUserId") otherUserId: String,
        @Query("cursor") cursor: String,
        @Query("until") until: String? = null,
        @Query("limit") limit: Int = 200,
    ): ChatChangesResponse

    @Headers("Cache-Control: no-store")
    @POST("api/chat/rooms/{roomId}/changes")
    suspend fun roomChangesPost(
        @Path("roomId") roomId: String,
        @Body body: ChatChangesBody,
    ): ChatChangesResponse

    @Headers("Cache-Control: no-store")
    @POST("api/chat/conversations/{otherUserId}/changes")
    suspend fun conversationChangesPost(
        @Path("otherUserId") otherUserId: String,
        @Body body: ChatChangesBody,
    ): ChatChangesResponse

    /**
     * `POST /api/chat/direct` — find-or-create the 1:1 direct room with
     * another user. Idempotent server-side (`get_or_create_direct_chat`),
     * so safe to call before every first send in a person thread.
     * Route `chats.js:871`.
     */
    @POST("api/chat/direct")
    suspend fun createDirectChat(
        @Body body: CreateDirectChatBody,
    ): CreateDirectChatResponse

    /** `POST /api/chat/messages` — route `chats.js:1438`. */
    @POST("api/chat/messages")
    suspend fun sendMessage(
        @Body body: SendChatMessageBody,
    ): SendChatMessageResponse

    /** `PUT /api/chat/messages/:id` — route `chats.js:1774`. */
    @PUT("api/chat/messages/{id}")
    suspend fun editMessage(
        @Path("id") id: String,
        @Body body: EditChatMessageBody,
    ): SendChatMessageResponse

    /** `DELETE /api/chat/messages/:id` — route `chats.js:1850`. */
    @DELETE("api/chat/messages/{id}")
    suspend fun deleteMessage(
        @Path("id") id: String,
    ): Unit

    /**
     * `GET /api/chat/files/:fileId` — checks room membership, then redirects to a
     * short-lived signed URL (OkHttp drops the bearer on that cross-host hop).
     */
    @Streaming
    @Headers("Cache-Control: no-store")
    @GET("api/chat/files/{fileId}")
    suspend fun downloadFile(
        @Path("fileId") fileId: String,
    ): Response<ResponseBody>

    /** `POST /api/chat/messages/:id/react` — route `chats.js:2558`. */
    @POST("api/chat/messages/{id}/react")
    suspend fun reactToMessage(
        @Path("id") id: String,
        @Body body: ReactToChatMessageBody,
    ): ReactToChatMessageResponse

    /** `POST /api/chat/rooms/:roomId/read` — route `chats.js:1953`. */
    @POST("api/chat/rooms/{roomId}/read")
    suspend fun markRoomRead(
        @Path("roomId") roomId: String,
        @Body body: Map<String, String> = emptyMap(),
    ): Unit

    /** `POST /api/chat/conversations/:otherUserId/read` — route `chats.js:1265`. */
    @POST("api/chat/conversations/{otherUserId}/read")
    suspend fun markConversationRead(
        @Path("otherUserId") otherUserId: String,
        @Body body: Map<String, @JvmSuppressWildcards Any> = emptyMap(),
    ): Unit

    /** `GET /api/chat/conversations/:otherUserId/topics` — route `chats.js:2466`. */
    @GET("api/chat/conversations/{otherUserId}/topics")
    suspend fun conversationTopics(
        @Path("otherUserId") otherUserId: String,
    ): ConversationTopicsResponse

    /** `POST /api/chat/conversations/:otherUserId/topics` — route `chats.js:2398`. */
    @POST("api/chat/conversations/{otherUserId}/topics")
    suspend fun findOrCreateTopic(
        @Path("otherUserId") otherUserId: String,
        @Body body: FindOrCreateTopicBody,
    ): FindOrCreateTopicResponse
}
