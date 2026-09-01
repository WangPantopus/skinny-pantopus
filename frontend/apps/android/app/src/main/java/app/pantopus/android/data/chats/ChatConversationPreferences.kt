package app.pantopus.android.data.chats

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONArray
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Device-local mute/hide state for the chat list. Keys match Expo mobile
 * (`@chat_hidden_conversations`, `@chat_muted_conversations`) and use
 * `person:` / `room:` conversation ids.
 */
@Singleton
class ChatConversationPreferences
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun hiddenKeys(): Set<String> = decodeSet(prefs.getString(HIDDEN_STORAGE_KEY, null))

        fun mutedKeys(): Set<String> = decodeSet(prefs.getString(MUTED_STORAGE_KEY, null))

        fun hide(
            key: String,
            unreadBaseline: Int,
        ) {
            val next = hiddenKeys().toMutableSet().apply { add(key) }
            persist(HIDDEN_STORAGE_KEY, next)
            val baselines = hiddenUnreadBaselines().toMutableMap().apply { put(key, unreadBaseline) }
            persistHiddenBaselines(baselines)
        }

        fun unhide(keys: Collection<String>) {
            if (keys.isEmpty()) return
            val next = hiddenKeys().toMutableSet().apply { removeAll(keys.toSet()) }
            persist(HIDDEN_STORAGE_KEY, next)
            val baselines = hiddenUnreadBaselines().toMutableMap().apply { keys.forEach(::remove) }
            persistHiddenBaselines(baselines)
        }

        fun shouldAutoUnhide(
            key: String,
            currentUnread: Int,
        ): Boolean {
            if (key !in hiddenKeys()) return false
            return currentUnread > (hiddenUnreadBaselines()[key] ?: 0)
        }

        fun toggleMute(key: String): Boolean {
            val next = mutedKeys().toMutableSet()
            val nowMuted =
                if (next.contains(key)) {
                    next.remove(key)
                    false
                } else {
                    next.add(key)
                    true
                }
            persist(MUTED_STORAGE_KEY, next)
            return nowMuted
        }

        private fun persist(
            key: String,
            values: Set<String>,
        ) {
            val array = JSONArray()
            values.sorted().forEach(array::put)
            prefs.edit().putString(key, array.toString()).apply()
        }

        private fun decodeSet(raw: String?): Set<String> =
            runCatching {
                if (raw.isNullOrBlank()) {
                    emptySet()
                } else {
                    val array = JSONArray(raw)
                    buildSet {
                        for (index in 0 until array.length()) {
                            array.optString(index).takeIf { it.isNotEmpty() }?.let(::add)
                        }
                    }
                }
            }.getOrDefault(emptySet())

        private fun hiddenUnreadBaselines(): Map<String, Int> {
            val raw = prefs.getString(HIDDEN_UNREAD_BASELINE_KEY, null) ?: return emptyMap()
            return runCatching {
                val array = JSONArray(raw)
                buildMap {
                    for (index in 0 until array.length()) {
                        val entry = array.optJSONObject(index) ?: continue
                        val key = entry.optString("key")
                        if (key.isNotEmpty()) put(key, entry.optInt("unread"))
                    }
                }
            }.getOrDefault(emptyMap())
        }

        private fun persistHiddenBaselines(map: Map<String, Int>) {
            val array = JSONArray()
            map.entries.sortedBy { it.key }.forEach { (key, unread) ->
                array.put(org.json.JSONObject().put("key", key).put("unread", unread))
            }
            prefs.edit().putString(HIDDEN_UNREAD_BASELINE_KEY, array.toString()).apply()
        }

        companion object {
            const val PREFS_NAME = "pantopus.chat.prefs"
            const val HIDDEN_STORAGE_KEY = "@chat_hidden_conversations"
            const val MUTED_STORAGE_KEY = "@chat_muted_conversations"
            private const val HIDDEN_UNREAD_BASELINE_KEY = "@chat_hidden_unread_baselines"

            fun personKey(participantId: String): String = "person:$participantId"

            fun roomKey(roomId: String): String = "room:$roomId"
        }
    }

object ChatUnreadBadgeMath {
    fun adjustedTotal(
        serverTotal: Int,
        rows: List<app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent>,
        mutedKeys: Set<String>,
    ): Int {
        val mutedUnread =
            rows
                .filter { mutedKeys.contains(it.storageKey) }
                .sumOf { it.unread }
        return (serverTotal - mutedUnread).coerceAtLeast(0)
    }
}
