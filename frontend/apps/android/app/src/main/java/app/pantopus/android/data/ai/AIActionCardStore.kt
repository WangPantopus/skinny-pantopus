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
 * this, so it shows as done instead of offering the same request again. It holds only card and button ids,
 * in-app links and short notes, and it outlives sign-out on purpose: "Post plan", a reply and "Message everyone" carry no
 * idempotency key, so offering them again after signing back in would send them twice (iOS keeps them too).
 *
 * Since phase 3 the server keeps each card's state too (phase 3 contract §4.4): a report that didn't reach it waits
 * here, marked unreported with the account it belongs to, until the thread opens again.
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

        /**
         * What one person's tap did to a card, for `POST /api/ai/cards/:cardId/state`: `done` with the button
         * ([itemId] null for the card's own buttons) and the link it showed, or `dismissed` for "Not now".
         */
        data class Report(
            val userId: String,
            val cardId: String,
            val status: String,
            val itemId: String? = null,
            val actionId: String? = null,
            val link: String? = null,
        )

        /** Kept before it is sent, so a report the app quits during isn't lost. */
        @Synchronized
        fun markUnreported(report: Report) {
            val kept = reports().filterNot { it.toReport() == report } + report.toJson()
            prefs.edit { putString(KEY_UNREPORTED, JSONArray(kept.takeLast(MAX_UNREPORTED)).toString()) }
        }

        /** Reached the server, or one it will never take: it isn't sent again. */
        @Synchronized
        fun markReported(report: Report) {
            val kept = reports().filterNot { it.toReport() == report }
            prefs.edit { putString(KEY_UNREPORTED, JSONArray(kept).toString()) }
        }

        /** [userId]'s reports still waiting, oldest first; another account's stay for that account. */
        @Synchronized
        fun unreported(userId: String): List<Report> = reports().mapNotNull { it.toReport() }.filter { it.userId == userId }

        /** A deleted conversation's cards: nothing of them stays on the phone. */
        @Synchronized
        fun forget(cardIds: Set<String>) {
            if (cardIds.isEmpty()) return
            val kept = entries().filterNot { it.optString(KEY_CARD) in cardIds }
            val waiting = reports().filterNot { it.optString(KEY_CARD) in cardIds }
            prefs.edit {
                putString(KEY_ENTRIES, JSONArray(kept).toString())
                putString(KEY_UNREPORTED, JSONArray(waiting).toString())
            }
        }

        private fun append(entry: JSONObject) {
            val kept = (entries() + entry).takeLast(MAX_ENTRIES)
            prefs.edit { putString(KEY_ENTRIES, JSONArray(kept).toString()) }
        }

        private fun entries(): List<JSONObject> = list(KEY_ENTRIES)

        private fun reports(): List<JSONObject> = list(KEY_UNREPORTED)

        private fun list(key: String): List<JSONObject> {
            val raw = prefs.getString(key, null) ?: return emptyList()
            val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
            return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
        }

        private fun Report.toJson(): JSONObject =
            JSONObject()
                .put(KEY_USER, userId)
                .put(KEY_CARD, cardId)
                .put(KEY_STATUS, status)
                .apply {
                    itemId?.let { put(KEY_SCOPE, it) }
                    actionId?.let { put(KEY_ACTION, it) }
                    link?.let { put(KEY_LINK, it) }
                }

        private fun JSONObject.toReport(): Report? {
            val userId = text(KEY_USER) ?: return null
            val cardId = text(KEY_CARD) ?: return null
            val status = text(KEY_STATUS) ?: return null
            return Report(userId, cardId, status, itemId = text(KEY_SCOPE), actionId = text(KEY_ACTION), link = text(KEY_LINK))
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
            const val KEY_UNREPORTED = "unreported"
            const val KEY_USER = "user"
            const val KEY_STATUS = "status"
            const val MAX_ENTRIES = 300
            const val MAX_UNREPORTED = 100
        }
    }
