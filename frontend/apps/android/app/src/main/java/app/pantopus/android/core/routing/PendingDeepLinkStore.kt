@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import android.content.Context
import android.content.SharedPreferences

/**
 * SharedPreferences-backed one-shot stash for a content deep link that
 * arrived while signed out. Survives process death with a 24h TTL.
 * Mirrors iOS `PendingDeepLinkStore` / RN `pendingDeepLink.ts` (Workstream 1.4).
 *
 * Cleared on consume, sign-out, expired read, or when the router rejects
 * the destination as non-deferrable (OAuth callback, auth-owned reset/
 * verify, [DeepLinkRouter.Destination.Unknown]).
 *
 * Call [init] once from [app.pantopus.android.PantopusApplication].
 */
object PendingDeepLinkStore {
    private const val PREFS = "pantopus_pending_deep_link"
    private const val KEY_PATH = "path"
    private const val KEY_TIMESTAMP_MS = "timestamp_ms"

    /** 24 hours — matches the product TTL for deferred post-login replay. */
    private const val TTL_MS = 24L * 60L * 60L * 1000L

    @Volatile
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /** Persist a normalized `pantopus://…` / `https://…` path for later replay. */
    fun stash(path: String) {
        val trimmed = path.trim()
        if (trimmed.isEmpty()) return
        prefsOrNull()?.edit()?.apply {
            putString(KEY_PATH, trimmed)
            putLong(KEY_TIMESTAMP_MS, System.currentTimeMillis())
            apply()
        }
    }

    /** Non-consuming read. Returns `null` (and clears) when missing or expired. */
    fun peek(): String? = readValidPath()

    /** Read and clear (one-shot). Returns `null` when missing or expired. */
    fun take(): String? {
        val path = readValidPath() ?: return null
        clear()
        return path
    }

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
