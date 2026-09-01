package app.pantopus.android.data.ai

import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.ai.AIConversationsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIDraftCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.job
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

sealed interface AIChatStreamEvent {
    data class Conversation(val id: String) : AIChatStreamEvent

    data class TextDelta(val delta: String) : AIChatStreamEvent

    data class Draft(val draft: ChatAIDraftCard) : AIChatStreamEvent

    data class Error(val message: String) : AIChatStreamEvent

    data object Done : AIChatStreamEvent
}

@Singleton
class AIChatRepository
    @Inject
    constructor(
        private val client: OkHttpClient,
        private val tokenStorage: TokenStorage,
        private val api: AIApi,
    ) {
        // HttpLoggingInterceptor at Level.BODY (debug builds) buffers the
        // whole response before returning it to the caller, which turns the
        // SSE stream into a single blob delivered only after generation
        // finishes — the chat sits on "Thinking…" the entire time.
        private val streamingClient: OkHttpClient by lazy {
            client
                .newBuilder()
                .apply { interceptors().removeAll { it is HttpLoggingInterceptor } }
                .build()
        }

        /**
         * List the user's AI conversations (metadata only — newest-updated
         * first). Route `backend/routes/ai.js:358`. Used to restore the
         * latest conversation id across app relaunches.
         */
        suspend fun conversations(): NetworkResult<AIConversationsResponse> = safeApiCall { api.conversations() }

        fun streamChat(
            message: String,
            conversationId: String?,
            images: List<String> = emptyList(),
        ): Flow<AIChatStreamEvent> =
            flow {
                val requestBody =
                    JSONObject()
                        .put("message", message)
                        .apply {
                            if (!conversationId.isNullOrBlank()) put("conversationId", conversationId)
                            if (images.isNotEmpty()) put("images", org.json.JSONArray(images))
                        }
                        .toString()
                        .toRequestBody("application/json".toMediaType())
                val builder =
                    Request
                        .Builder()
                        .url(BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/') + "/api/ai/chat")
                        .post(requestBody)
                        .header("Accept", "text/event-stream")
                        .header("Content-Type", "application/json")
                tokenStorage.accessToken()?.let { builder.header("Authorization", "Bearer $it") }
                val request = builder.build()
                val call = streamingClient.newCall(request)
                // The blocking execute/read below can't observe coroutine
                // cancellation on its own — tear the HTTP call (and the
                // server-side generation) down as soon as the collecting
                // job is cancelled (Stop button, screen exit).
                currentCoroutineContext().job.invokeOnCompletion { call.cancel() }
                try {
                    call.execute().use { response ->
                        if (!response.isSuccessful) {
                            emit(AIChatStreamEvent.Error("Failed to connect to AI."))
                            return@flow
                        }
                        val source = response.body?.source() ?: return@flow
                        var eventName: String? = null
                        var data: String? = null
                        while (!source.exhausted()) {
                            val line = source.readUtf8Line() ?: break
                            when {
                                line.startsWith("event: ") -> eventName = line.removePrefix("event: ").trim()
                                line.startsWith("data: ") -> data = line.removePrefix("data: ")
                                line.isEmpty() && eventName != null && data != null -> {
                                    parseEvent(eventName!!, data!!)?.let { emit(it) }
                                    eventName = null
                                    data = null
                                }
                            }
                        }
                    }
                } catch (error: IOException) {
                    // call.cancel() surfaces as an IOException from the
                    // blocking read — rethrow it as cancellation (not a
                    // stream failure) when the job was cancelled.
                    currentCoroutineContext().ensureActive()
                    throw error
                }
            }.flowOn(Dispatchers.IO)

        private fun parseEvent(
            eventName: String,
            data: String,
        ): AIChatStreamEvent? {
            val json = runCatching { JSONObject(data) }.getOrNull() ?: return null
            return when (eventName) {
                "conversation" -> json.optString("conversationId").takeIf { it.isNotBlank() }?.let(AIChatStreamEvent::Conversation)
                "text_delta" -> AIChatStreamEvent.TextDelta(json.optString("delta"))
                "draft" -> parseDraft(json)?.let(AIChatStreamEvent::Draft)
                "error" -> AIChatStreamEvent.Error(json.optString("message", json.optString("error", "AI error.")))
                "done" -> AIChatStreamEvent.Done
                else -> null
            }
        }

        private fun parseDraft(json: JSONObject): ChatAIDraftCard? {
            val type = json.optString("type", "draft")
            val valid = json.optBoolean("valid", true)
            val draft = json.optJSONObject("draft") ?: JSONObject()
            val title =
                draft.optString("title").takeIf { it.isNotBlank() }
                    ?: draft.optString("summary").takeIf { it.isNotBlank() }
                    ?: draft.optString("content").takeIf { it.isNotBlank() }
                    ?: "${type.replaceFirstChar { it.uppercase() }} draft"
            val summary =
                draft.optString("description").takeIf { it.isNotBlank() }
                    ?: draft.optString("content").takeIf { it.isNotBlank() }
                    ?: draft.optString("summary").takeIf { it.isNotBlank() }
            val price =
                when {
                    draft.has("price") -> "$${draft.opt("price")}"
                    draft.has("amount") -> "$${draft.opt("amount")}"
                    else -> null
                }
            return ChatAIDraftCard(
                id = "${type}_${java.util.UUID.randomUUID()}",
                type = type,
                title = title,
                summary = summary,
                priceLabel = price,
                valid = valid,
            )
        }
    }
