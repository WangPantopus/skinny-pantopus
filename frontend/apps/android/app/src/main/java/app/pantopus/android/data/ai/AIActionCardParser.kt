package app.pantopus.android.data.ai

import app.pantopus.android.ui.screens.inbox.conversation.ChatAIActionCard
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardAction
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardItem
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardLine
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardRequest
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Reads an action card's envelope (AI assistant phase 1 contract, section 4.2), as the `draft` event and the
 * conversation history carry it. Null when it has no id or title. A button whose request (or follow-up)
 * can't be read keeps a null request, so the card says it can't be used instead of sending something else.
 */
internal object AIActionCardParser {
    fun card(envelope: JSONObject): ChatAIActionCard? {
        val id = envelope.text("id") ?: return null
        val title = envelope.text("title") ?: return null
        return ChatAIActionCard(
            id = id,
            card = envelope.text("card") ?: "action",
            title = title,
            lines = lines(envelope.optJSONArray("lines")),
            warnings = envelope.optJSONArray("warnings").objects().mapNotNull { (it as? String)?.trim()?.ifEmpty { null } },
            expiresAt = envelope.text("expires_at")?.let { runCatching { Instant.parse(it) }.getOrNull() },
            actions = envelope.optJSONArray("actions").objects().mapNotNull { (it as? JSONObject)?.let(::action) },
            items = envelope.optJSONArray("items").objects().mapNotNull { (it as? JSONObject)?.let(::item) },
        )
    }

    private fun item(json: JSONObject): ChatAICardItem? {
        val id = json.text("id") ?: return null
        return ChatAICardItem(
            id = id,
            title = json.text("title").orEmpty(),
            lines = lines(json.optJSONArray("lines")),
            actions = json.optJSONArray("actions").objects().mapNotNull { (it as? JSONObject)?.let(::action) },
        )
    }

    private fun action(json: JSONObject): ChatAICardAction? {
        val id = json.text("id") ?: return null
        val label = json.text("label") ?: return null
        val request = request(json.optJSONObject("request"))
        val thenJson = json.optJSONObject("then")
        val then = thenJson?.let { request(it.optJSONObject("request")) }
        val done = json.optJSONObject("done")
        return ChatAICardAction(
            id = id,
            label = label,
            style = json.text("style") ?: "primary",
            // A follow-up that can't be read makes the whole button unusable, never a silent half.
            request = request.takeIf { thenJson == null || then != null },
            then = then,
            doneLabel = done?.text("label"),
            doneLink = done?.text("link"),
        )
    }

    private fun request(json: JSONObject?): ChatAICardRequest? {
        val method = json?.text("method")?.uppercase()
        val path = json?.text("path")
        if (json == null || method == null || path == null) return null
        // A body is a JSON object, sent as is; anything else makes the request unreadable.
        val body = json.opt("body")?.takeUnless { it == JSONObject.NULL }
        if (body != null && body !is JSONObject) return null
        val headers = json.optJSONObject("headers")
        return ChatAICardRequest(
            method = method,
            path = path,
            body = (body as? JSONObject)?.toString(),
            headers = headers?.keys()?.asSequence()?.map { it.toString() }?.associateWith { headers.optString(it) }.orEmpty(),
        )
    }

    private fun lines(array: JSONArray?): List<ChatAICardLine> =
        array.objects().mapNotNull { entry ->
            val line = entry as? JSONObject ?: return@mapNotNull null
            val value = line.text("value") ?: return@mapNotNull null
            ChatAICardLine(label = line.text("label").orEmpty(), value = value)
        }

    private fun JSONArray?.objects(): List<Any?> = if (this == null) emptyList() else (0 until length()).map { opt(it) }

    private fun JSONObject.text(name: String): String? = if (isNull(name)) null else optString(name).trim().ifEmpty { null }
}
