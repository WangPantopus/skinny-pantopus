package app.pantopus.android.data.ai

import app.pantopus.android.BuildConfig
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardAction
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/** HTTP 409: `SESSION_SCOPE_CHANGED` (backend/utils/requestSessionScope.js). */
private const val HTTP_CONFLICT = 409

/**
 * The requests an action card may send (AI assistant phase 1 contract, section 4.3, and phase 2 section 8.1): each is
 * an endpoint the app already uses, with `:id` a UUID and `:system` one of a home's six system keys. Anything else is
 * never sent.
 */
internal object AIActionAllowlist {
    const val SESSION_SCOPE_HEADER = "x-pantopus-session-scope"
    private const val UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"

    /** The systems Place keeps an installed year for (`PUT /api/homes/:id/systems/:key`). */
    private const val SYSTEM_KEY = "(?:roof|hvac|water_heater|electrical_panel|sewer_septic|windows)"

    /** Stands in for a `{{response.…}}` placeholder when a follow-up is checked before the first request. */
    const val PLACEHOLDER_STAND_IN = "00000000-0000-0000-0000-000000000000"

    private val RULES: List<Pair<String, Regex>> =
        listOf(
            "POST" to "/api/plans",
            "PATCH" to "/api/plans/:id",
            "POST" to "/api/plans/:id/cancel",
            "POST" to "/api/plans/:id/requests",
            "POST" to "/api/plans/:id/requests/:id/accept",
            "POST" to "/api/plans/:id/requests/:id/decline",
            "POST" to "/api/chat/messages",
            "POST" to "/api/posts/:id/comments",
            "PATCH" to "/api/posts/:id/solve",
            "POST" to "/api/homes/:id/tasks",
            "POST" to "/api/homes/:id/tasks/:id/recurrence",
            "PUT" to "/api/hub/preferences",
            "PUT" to "/api/posts/feed-preferences",
            // Phase 2: a system's installed year, a task's update, a nudge's "Fewer like this", and an appliance for
            // the home's records (the home_asset card, once the assets route was hardened: contract §7.1).
            "PUT" to "/api/homes/:id/systems/:system",
            "PUT" to "/api/homes/:id/tasks/:id",
            "POST" to "/api/ai/nudges/:id/fewer",
            "POST" to "/api/homes/:id/assets",
        ).map { (method, path) -> method to Regex("^" + path.replace(":id", UUID).replace(":system", SYSTEM_KEY) + "$") }

    fun allows(request: ChatAICardRequest): Boolean =
        RULES.any { (method, path) -> method == request.method && path.matches(request.path) } &&
            request.headers.keys.all { it.equals(SESSION_SCOPE_HEADER, ignoreCase = true) } &&
            (request.body?.let { body -> runCatching { JSONObject(body) }.isSuccess } ?: true)

    /** A follow-up whose placeholders aren't filled yet: its shape must already be on the list. */
    fun allowsTemplate(request: ChatAICardRequest): Boolean =
        allows(request.copy(path = AIPlaceholders.PATTERN.replace(request.path, PLACEHOLDER_STAND_IN)))

    private val FEWER_LIKE_THIS = Regex("^/api/ai/nudges/$UUID/fewer$")

    /**
     * A nudge's or the brief's "Fewer like this" (`POST /api/ai/nudges/:id/fewer`), which the server takes on an
     * expired nudge too (phase 2 contract §3.6).
     */
    fun isFewerLikeThis(request: ChatAICardRequest?): Boolean =
        request != null && request.method == "POST" && FEWER_LIKE_THIS.matches(request.path)
}

/** `{{response.a.b}}`: the value at that dot path in the JSON reply of the request just sent. */
internal object AIPlaceholders {
    val PATTERN = Regex("""\{\{\s*response\.([A-Za-z0-9_.-]+)\s*\}\}""")

    /** The raw value at [path] (a JSON string, number or boolean), or null when it is missing. */
    fun valueAt(
        response: JSONObject,
        path: String,
    ): Any? {
        var current: Any = response
        for (key in path.split('.')) {
            val node = current
            current =
                when (node) {
                    is JSONObject -> if (node.isNull(key)) null else node.opt(key)
                    is JSONArray -> key.toIntOrNull()?.let { node.opt(it) }
                    else -> null
                } ?: return null
        }
        return current.takeUnless { it is JSONObject || it is JSONArray || it == JSONObject.NULL }
    }

    /** [template] with every placeholder filled; null when one has no value. */
    fun fill(
        template: String,
        response: JSONObject,
    ): String? {
        var missing = false
        val filled =
            PATTERN.replace(template) { match ->
                valueAt(response, match.groupValues[1])?.toString() ?: run {
                    missing = true
                    ""
                }
            }
        return filled.takeUnless { missing }
    }

    /**
     * A follow-up request filled from [response]: its path and the string values at the top of its body.
     * A value that is only a placeholder keeps the reply's JSON type. Null when a value is missing.
     */
    fun fill(
        request: ChatAICardRequest,
        response: JSONObject,
    ): ChatAICardRequest? {
        val path = fill(request.path, response) ?: return null
        val body = request.body?.let { fillBody(it, response) ?: return null }
        return request.copy(path = path, body = body)
    }

    /** A body's top-level string values filled in; null when one has no value or the body isn't an object. */
    private fun fillBody(
        raw: String,
        response: JSONObject,
    ): String? {
        val json = runCatching { JSONObject(raw) }.getOrNull() ?: return null
        val missing =
            json.keys().asSequence().map { it.toString() }.toList().any { key ->
                val value = json.opt(key) as? String ?: return@any false
                val whole = PATTERN.matchEntire(value.trim())
                val filled: Any? = if (whole != null) valueAt(response, whole.groupValues[1]) else fill(value, response)
                filled?.let { json.put(key, it) }
                filled == null
            }
        return json.toString().takeUnless { missing }
    }
}

/**
 * Sends an action card's request with the signed-in API client (its auth, refresh and step-up handling),
 * after checking it against [AIActionAllowlist]; then its follow-up, and fills in the "Open" link
 * (AI assistant phase 1 contract, section 4.3).
 */
@Singleton
class AIActionRunner
    @Inject
    constructor(
        private val client: OkHttpClient,
    ) {
        sealed interface Outcome {
            /** [link] is filled in (or null); [note] says a follow-up didn't happen. */
            data class Done(
                val link: String?,
                val note: String?,
            ) : Outcome

            /** The server's message, or why the request couldn't reach it. */
            data class Failed(val message: String) : Outcome

            /** Off the allowlist: nothing was sent. */
            data object NotAllowed : Outcome

            /** `409 SESSION_SCOPE_CHANGED`: the card came from an earlier sign-in. */
            data object SessionChanged : Outcome
        }

        private sealed interface Sent {
            data class Ok(val json: JSONObject) : Sent

            data class Refused(val outcome: Outcome) : Sent
        }

        suspend fun run(action: ChatAICardAction): Outcome =
            withContext(Dispatchers.IO) {
                val request = action.request
                if (request == null || !AIActionAllowlist.allows(request)) return@withContext Outcome.NotAllowed
                val then = action.then
                if (then != null && !AIActionAllowlist.allowsTemplate(then)) return@withContext Outcome.NotAllowed
                val first =
                    when (val sent = send(request)) {
                        is Sent.Ok -> sent.json
                        is Sent.Refused -> return@withContext sent.outcome
                    }
                var second: JSONObject? = null
                var note: String? = null
                if (then != null) {
                    val filled = AIPlaceholders.fill(then, first)?.takeIf(AIActionAllowlist::allows)
                    if (filled == null) {
                        note = REPEAT_NOT_SET
                    } else {
                        when (val sent = send(filled)) {
                            is Sent.Ok -> second = sent.json
                            is Sent.Refused ->
                                note = listOfNotNull(REPEAT_NOT_SET, (sent.outcome as? Outcome.Failed)?.message).joinToString(" ")
                        }
                    }
                }
                // The link comes from the first reply; a placeholder only the follow-up's reply holds is read there.
                val link =
                    action.doneLink?.let { template ->
                        AIPlaceholders.fill(template, first) ?: second?.let { AIPlaceholders.fill(template, it) }
                    }
                Outcome.Done(link = link, note = note)
            }

        private fun send(request: ChatAICardRequest): Sent {
            val body = (request.body ?: "{}").toRequestBody(JSON)
            val builder =
                Request
                    .Builder()
                    .url(BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/') + request.path)
                    .method(request.method, body)
                    .header("Accept", "application/json")
            // The allowlist let through only the session-scope header.
            request.headers.values.forEach { builder.header(AIActionAllowlist.SESSION_SCOPE_HEADER, it) }
            return try {
                client.newCall(builder.build()).execute().use { response ->
                    val text = response.body?.string().orEmpty()
                    val json = runCatching { JSONObject(text) }.getOrNull()
                    if (response.isSuccessful) {
                        Sent.Ok(json ?: JSONObject())
                    } else {
                        Sent.Refused(refusal(response.code, json))
                    }
                }
            } catch (_: IOException) {
                Sent.Refused(Outcome.Failed("Couldn't reach Pantopus. Check your connection and try again."))
            }
        }

        private fun refusal(
            code: Int,
            json: JSONObject?,
        ): Outcome {
            val errorText = json?.text("error")
            if (code == HTTP_CONFLICT && (json?.text("code") == SESSION_SCOPE_CHANGED || errorText == SESSION_SCOPE_CHANGED)) {
                return Outcome.SessionChanged
            }
            val message =
                json?.text("message")
                    ?: json?.optJSONObject("error")?.text("message")
                    ?: errorText
                    ?: "That didn't work. Try again."
            return Outcome.Failed(message)
        }

        private fun JSONObject.text(name: String): String? = (opt(name) as? String)?.trim()?.ifEmpty { null }

        private companion object {
            val JSON = "application/json".toMediaType()
            const val SESSION_SCOPE_CHANGED = "SESSION_SCOPE_CHANGED"
            const val REPEAT_NOT_SET = "The repeat wasn't set."
        }
    }
