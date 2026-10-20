package app.pantopus.android.data.ai

import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.ai.AIConversationMessagesResponse
import app.pantopus.android.data.api.models.ai.AIConversationsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.ui.screens.compose.pulse.PulseComposeDraftFields
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIDraftCard
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIDraftPrefill
import app.pantopus.android.ui.screens.inbox.conversation.ChatAILink
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIPickupSchedule
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
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/** The hourly limit (backend/middleware/rateLimiter.js aiChatLimiter). */
private const val HTTP_TOO_MANY_REQUESTS = 429

/**
 * Draft cards this app shows beyond the original ones (`cards` in the chat request): pickup days, action
 * cards and link buttons (AI assistant phase 1 contract, sections 3 to 5).
 */
private val AI_CARDS = listOf("pickup_schedule", "action", "link")

/** A turn may take 45 seconds and eight tool rounds (contract section 8); a quiet stretch must not end it. */
private const val STREAM_READ_TIMEOUT_SECONDS = 60L

/** What the stream says for the assistant's daily budget and its off switch when the server sends no message. */
private val AI_ERROR_TEXT =
    mapOf(
        "AI_BUDGET" to "Pantopus AI has done a lot today. Try again tomorrow.",
        "AI_DISABLED" to "Pantopus AI is paused right now.",
    )

/** The server's own words for [AI_ERROR_TEXT]'s errors; null for any other error. */
private fun aiErrorMessage(json: JSONObject?): String? {
    json ?: return null
    val code = listOf(json.text("code"), json.text("error")).firstOrNull { it in AI_ERROR_TEXT } ?: return null
    return json.text("message") ?: AI_ERROR_TEXT.getValue(code)
}

/** A pickup-days card's schedule; null for other drafts, or when the draft lacks the home or the garbage day. */
private fun pickupOf(
    type: String,
    draft: JSONObject,
): ChatAIPickupSchedule? {
    if (type != "pickup_schedule") return null
    val homeId = draft.text("home_id") ?: return null
    val weekday = draft.text("garbage_weekday") ?: return null
    return ChatAIPickupSchedule(
        homeId = homeId,
        garbageWeekday = weekday,
        recyclingFrequency = draft.text("recycling_frequency") ?: "not_set",
        recyclingNextDate = draft.text("recycling_next_date"),
    )
}

/** What "Use draft" carries into the composer it opens: a post's text and fields, or a Support Train's story. */
private fun prefillOf(
    type: String,
    draft: JSONObject,
): ChatAIDraftPrefill? =
    when (type) {
        "post" ->
            draft.text("content")?.let {
                ChatAIDraftPrefill(it, postType = draft.text("postType"), title = draft.text("title"), post = postFieldsOf(draft))
            }
        "support_train" -> draft.text("story")?.let { ChatAIDraftPrefill(it) }
        else -> null
    }

/** A post draft's type and its event, deal, lost-and-found and heads-up fields, for the Pulse composer (contract section 8). */
private fun postFieldsOf(draft: JSONObject): PulseComposeDraftFields =
    PulseComposeDraftFields(
        postType = draft.text("postType"),
        eventDate = draft.text("eventDate"),
        eventEndDate = draft.text("eventEndDate"),
        eventVenue = draft.text("eventVenue"),
        dealExpiresAt = draft.text("dealExpiresAt"),
        lostFoundType = draft.text("lostFoundType"),
        safetyAlertKind = draft.text("safetyAlertKind"),
    )

/** A text field, or null when it is missing, blank or JSON null (`optString` reads JSON null as "null"). */
private fun JSONObject.text(name: String): String? = if (isNull(name)) null else optString(name).trim().ifEmpty { null }

sealed interface AIChatStreamEvent {
    data class Conversation(val id: String) : AIChatStreamEvent

    /** What the assistant is doing while a tool runs ("Drafting your post…"). */
    data class Status(val message: String) : AIChatStreamEvent

    data class TextDelta(val delta: String) : AIChatStreamEvent

    data class Draft(val draft: ChatAIDraftCard) : AIChatStreamEvent

    /** A button to a screen of the app, under the reply it follows (contract section 5). */
    data class Link(val link: ChatAILink) : AIChatStreamEvent

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
                .readTimeout(STREAM_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .build()
        }

        /**
         * List the user's AI conversations (metadata only — newest-updated
         * first). Route `backend/routes/ai.js:358`. Used to restore the
         * latest conversation id across app relaunches.
         */
        suspend fun conversations(): NetworkResult<AIConversationsResponse> = safeApiCall { api.conversations() }

        /**
         * One conversation's earlier turns, so a restored thread shows what
         * the assistant remembers. Route `backend/routes/ai.js:365`.
         */
        suspend fun conversationMessages(id: String): NetworkResult<AIConversationMessagesResponse> =
            safeApiCall { api.conversationMessages(id) }

        /** A restored draft (`GET …/messages`) as the card a streamed one becomes. */
        fun draftCard(
            type: String,
            fields: Map<String, Any?>,
        ): ChatAIDraftCard? = parseDraft(JSONObject().put("type", type).put("valid", true).put("draft", JSONObject(fields)))

        /** A restored link button; null without a label or a URL. */
        fun link(
            label: String?,
            url: String?,
        ): ChatAILink? {
            val text = label?.trim()?.ifEmpty { null } ?: return null
            return url?.trim()?.ifEmpty { null }?.let { ChatAILink(label = text, url = it) }
        }

        /** Delete one conversation for good. Route `backend/routes/ai.js:451`. */
        suspend fun deleteConversation(id: String): NetworkResult<Unit> = safeApiCall { api.deleteConversation(id) }

        /**
         * One turn of the assistant over server-sent events. [context] says which screen the thread was
         * opened from (contract section 6); it goes with every message while the thread keeps it.
         */
        fun streamChat(
            message: String,
            conversationId: String?,
            images: List<String> = emptyList(),
            context: AIScreenContext? = null,
        ): Flow<AIChatStreamEvent> =
            flow {
                val requestBody =
                    JSONObject()
                        .put("message", message)
                        .apply {
                            if (!conversationId.isNullOrBlank()) put("conversationId", conversationId)
                            if (images.isNotEmpty()) put("images", org.json.JSONArray(images))
                            // The cards this app shows beyond the original ones; the server offers
                            // the matching tools only to apps that list them.
                            put("cards", org.json.JSONArray(AI_CARDS))
                            context?.let { put("context", it.toRequestJson()) }
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
                            // The daily budget, the off switch and the hourly limit are not connection problems.
                            val refusal = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrNull()
                            emit(
                                AIChatStreamEvent.Error(
                                    aiErrorMessage(refusal)
                                        ?: if (response.code == HTTP_TOO_MANY_REQUESTS) {
                                            "You've reached this hour's limit for Pantopus AI. Please try again later."
                                        } else {
                                            "Failed to connect to AI."
                                        },
                                ),
                            )
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
                "status" -> json.optString("message").takeIf { it.isNotBlank() }?.let(AIChatStreamEvent::Status)
                "text_delta" -> AIChatStreamEvent.TextDelta(json.optString("delta"))
                "draft" -> parseDraft(json)?.let(AIChatStreamEvent::Draft)
                "link" -> link(json.text("label"), json.text("url"))?.let(AIChatStreamEvent::Link)
                "error" -> AIChatStreamEvent.Error(aiErrorMessage(json) ?: json.text("message") ?: json.text("error") ?: "AI error.")
                "done" -> AIChatStreamEvent.Done
                else -> null
            }
        }

        private fun parseDraft(json: JSONObject): ChatAIDraftCard? {
            val type = json.optString("type", "draft")
            val valid = json.optBoolean("valid", true)
            val draft = json.optJSONObject("draft") ?: JSONObject()
            if (type == "action") {
                val card = AIActionCardParser.card(draft) ?: return null
                return ChatAIDraftCard(id = "action_${card.id}", type = type, title = card.title, valid = valid, action = card)
            }
            val story = draft.text("story")
            val content = draft.text("content")
            val title =
                if (type == "support_train") {
                    "Support Train"
                } else {
                    draft.text("title")
                        ?: draft.text("summary")
                        ?: content
                        ?: "${type.replaceFirstChar { it.uppercase() }} draft"
                }
            val summary = draft.text("description") ?: content ?: draft.text("summary") ?: story
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
                prefill = prefillOf(type, draft),
                pickup = pickupOf(type, draft),
            )
        }
    }
