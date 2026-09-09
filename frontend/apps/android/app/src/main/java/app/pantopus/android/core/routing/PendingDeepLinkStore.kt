@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import android.content.Context
import android.content.SharedPreferences

/**
 * SharedPreferences-backed one-shot stash for a content deep link that
 * arrived while signed out, or a post arrival still awaiting its first load.
 * In-progress arrivals are bound to the original account so a server-ended
 * session can resume after reauthentication without crossing accounts.
 * Survives process death with a 24h TTL; explicit logout always clears it.
 *
 * Call [init] once from [app.pantopus.android.PantopusApplication].
 */
object PendingDeepLinkStore {
    private const val PREFS = "pantopus_pending_deep_link"
    private const val KEY_PATH = "path"
    private const val KEY_TIMESTAMP_MS = "timestamp_ms"
    private const val KEY_USER_ID = "expected_user_id"
    private const val KEY_REAUTHENTICATING = "awaiting_reauthentication"

    /** 24 hours — matches the product TTL for deferred post-login replay. */
    private const val TTL_MS = 24L * 60L * 60L * 1000L

    @Volatile
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /** Persist a normalized `pantopus://…` / `https://…` path for later replay. */
    @Synchronized
    fun stash(
        path: String,
        expectedUserId: String? = null,
    ) {
        val trimmed = path.trim()
        if (trimmed.isEmpty()) return
        prefsOrNull()?.edit()?.apply {
            putString(KEY_PATH, trimmed)
            putLong(KEY_TIMESTAMP_MS, System.currentTimeMillis())
            putString(KEY_USER_ID, expectedUserId)
            putBoolean(KEY_REAUTHENTICATING, false)
            apply()
        }
    }

    /** Non-consuming read. Returns `null` (and clears) when missing or expired. */
    @Synchronized
    fun peek(): String? = readValidPath()

    /** Read and clear (one-shot). Returns `null` when missing or expired. */
    @Synchronized
    fun take(userId: String? = null): String? {
        val path = readValidPath() ?: return null
        val expectedUserId = prefsOrNull()?.getString(KEY_USER_ID, null)
        clear()
        return path.takeIf { expectedUserId == null || expectedUserId == userId }
    }

    /** Keep only this account's explicit arrival, without extending its TTL. */
    @Synchronized
    fun retainForReauthentication(userId: String?) {
        val path = readValidPath()
        val expectedUserId = prefsOrNull()?.getString(KEY_USER_ID, null)
        if (path == null || userId == null || expectedUserId != userId) {
            clear()
        } else {
            prefsOrNull()?.edit()?.putBoolean(KEY_REAUTHENTICATING, true)?.apply()
        }
    }

    /** Ignore late UI completion after auth handoff, or for a newer arrival. */
    @Synchronized
    internal fun completeArrival(
        userId: String,
        matches: (String) -> Boolean,
    ) {
        val path = readValidPath() ?: return
        val store = prefsOrNull() ?: return
        if (store.getString(KEY_USER_ID, null) == userId &&
            !store.getBoolean(KEY_REAUTHENTICATING, false) && matches(path)
        ) {
            clear()
        }
    }

    @Synchronized
    fun clear() {
        prefsOrNull()?.edit()?.clear()?.apply()
    }

    private fun readValidPath(): String? {
        val store = prefsOrNull() ?: return null
        val path = store.getString(KEY_PATH, null)?.takeIf { it.isNotBlank() }
        if (path == null) {
            clear()
            return null
        }
        val stamped = store.getLong(KEY_TIMESTAMP_MS, 0L)
        val now = System.currentTimeMillis()
        if (stamped <= 0L || now - stamped > TTL_MS) {
            clear()
            return null
        }
        return path
    }

    private fun prefsOrNull(): SharedPreferences? = prefs
}
