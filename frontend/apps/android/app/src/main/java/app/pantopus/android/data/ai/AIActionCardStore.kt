package app.pantopus.android.data.ai

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The assistant's action cards this phone has finished or set aside (AI assistant phase 1 contract,
 * section 4.3): which button of a card (or of one of its rows) succeeded, with the screen it opened,
 * and which cards got "Not now". A card restored from the conversation's history after a relaunch reads
 * this, so it shows as done instead of offering the same request again. Cleared at sign-out.
 */
@Singleton
class AIActionCardStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /** A button that succeeded: [scope] is the card's own scope or a row's id. */
        data class Done(
            val scope: String,
            val actionId: String,
            val link: String?,
            val note: String?,
        )

        /** The finished buttons of [cardId], one per scope. */
        @Synchronized
        fun done(cardId: String): List<Done> =
            entries()
                .filter { it.optString(KEY_CARD) == cardId && !it.optBoolean(KEY_DISMISSED) }
                .map {
                    Done(
                        scope = it.optString(KEY_SCOPE),
                        actionId = it.optString(KEY_ACTION),
                        link = it.text(KEY_LINK),
                        note = it.text(KEY_NOTE),
                    )
                }

        @Synchronized
        fun isDismissed(cardId: String): Boolean = entries().any { it.optString(KEY_CARD) == cardId && it.optBoolean(KEY_DISMISSED) }

        @Synchronized
        fun markDone(
            cardId: String,
            done: Done,
        ) {
            append(
                JSONObject()
                    .put(KEY_CARD, cardId)
                    .put(KEY_SCOPE, done.scope)
                    .put(KEY_ACTION, done.actionId)
                    .apply {
                        done.link?.let { put(KEY_LINK, it) }
                        done.note?.let { put(KEY_NOTE, it) }
                    },
            )
        }

        @Synchronized
        fun dismiss(cardId: String) {
            if (!isDismissed(cardId)) append(JSONObject().put(KEY_CARD, cardId).put(KEY_DISMISSED, true))
        }

        @Synchronized
        fun clear() {
            prefs.edit { remove(KEY_ENTRIES) }
        }

        private fun append(entry: JSONObject) {
            val kept = (entries() + entry).takeLast(MAX_ENTRIES)
            prefs.edit { putString(KEY_ENTRIES, JSONArray(kept).toString()) }
        }

        private fun entries(): List<JSONObject> {
            val raw = prefs.getString(KEY_ENTRIES, null) ?: return emptyList()
            val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
            return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
        }

        private fun JSONObject.text(name: String): String? = if (isNull(name)) null else optString(name).ifEmpty { null }

        private companion object {
            const val PREFS = "pantopus.ai.cards"
            const val KEY_ENTRIES = "entries"
            const val KEY_CARD = "card"
            const val KEY_SCOPE = "scope"
            const val KEY_ACTION = "action"
            const val KEY_LINK = "link"
            const val KEY_NOTE = "note"
            const val KEY_DISMISSED = "dismissed"
            const val MAX_ENTRIES = 300
        }
    }
