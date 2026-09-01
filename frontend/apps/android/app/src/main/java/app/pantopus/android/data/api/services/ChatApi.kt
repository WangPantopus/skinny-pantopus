package app.pantopus.android.data.api.services

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
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Chat endpoints under `/api/chat/[*]` from `backend/routes/chats.js`.
 * Mounted at `/api/chat` (see `backend/app.js:325`).
 */
@Suppress("TooManyFunctions") // declarative Retrofit endpoint list — one function per route
interface ChatApi {
    /** `GET /api/chat/unified-conversations`. */
    @GET("api/chat/unified-conversations")
    suspend fun unifiedConversations(
        @Query("limit") limit: Int = 100,
    ): UnifiedConversationsResponse

    /** `GET /api/chat/stats`. */
    @GET("api/chat/stats")
    suspend fun stats(): ChatStatsResponse

    /** `GET /api/chat/rooms/:roomId/messages` — route `chats.js:1340`. */
    @GET("api/chat/rooms/{roomId}/messages")
    suspend fun roomMessages(
        @Path("roomId") roomId: String,
        @Query("limit") limit: Int = 60,
        @Query("before") before: String? = null,
        @Query("after") after: String? = null,
    ): ChatMessagesResponse

    /** `GET /api/chat/conversations/:otherUserId/messages` — route `chats.js:1157`. */
    @GET("api/chat/conversations/{otherUserId}/messages")
    suspend fun conversationMessages(
        @Path("otherUserId") otherUserId: String,
        @Query("limit") limit: Int = 60,
        @Query("before") before: String? = null,
        @Query("after") after: String? = null,
        @Query("topicId") topicId: String? = null,
    ): ChatMessagesResponse

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
    ): Unit

    /** `POST /api/chat/conversations/:otherUserId/read` — route `chats.js:1265`. */
    @POST("api/chat/conversations/{otherUserId}/read")
    suspend fun markConversationRead(
        @Path("otherUserId") otherUserId: String,
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
