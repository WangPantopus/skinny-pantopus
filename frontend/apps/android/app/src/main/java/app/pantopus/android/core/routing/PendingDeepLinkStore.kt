@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import android.content.Context
import android.content.SharedPreferences
import androidx.annotation.VisibleForTesting
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi

@JsonClass(generateAdapter = true)
internal data class PendingContentArrival(
    val version: Int = 1,
    val path: String,
    val timestampMs: Long,
    val expectedUserId: String?,
    val awaitingReauthentication: Boolean = false,
)

/** Device-only encrypted handoff. Legacy links migrate without extending their original lifetime. */
object PendingDeepLinkStore {
    private val adapter = Moshi.Builder().build().adapter(PendingContentArrival::class.java).serializeNulls()
    private val storage = PendingContentArrivalPreferences()

    @Synchronized
    fun init(context: Context) = storage.init(context)

    /** No write succeeds unless the original is durably protected. */
    @Synchronized
    fun stash(
        path: String,
        expectedUserId: String? = null,
    ): Boolean =
        safely(false) {
            val trimmed = path.trim()
            if (trimmed.isEmpty()) return@safely false
            val arrival = PendingContentArrival(path = trimmed, timestampMs = System.currentTimeMillis(), expectedUserId = expectedUserId)
            if (!storage.write(adapter.toJson(arrival))) return@safely false
            storage.clearLegacy()
            true
        }

    @Synchronized
    fun peek(now: Long = System.currentTimeMillis()): String? = safely(null) { read(now)?.path }

    @Synchronized
    fun take(
        userId: String? = null,
        now: Long = System.currentTimeMillis(),
    ): String? =
        safely(null) {
            val arrival = read(now) ?: return@safely null
            if (!storage.clearProtected()) return@safely null
            arrival.path.takeIf { arrival.expectedUserId == null || arrival.expectedUserId == userId }
        }

    @Synchronized
    fun retainForReauthentication(userId: String?) {
        safely(Unit) {
            val arrival = read(System.currentTimeMillis())
            if (arrival == null || userId == null || arrival.expectedUserId != userId) {
                storage.clearProtected()
            } else {
                storage.write(adapter.toJson(arrival.copy(awaitingReauthentication = true)))
            }
        }
    }

    @Synchronized
    internal fun completeArrival(
        userId: String,
        matches: (String) -> Boolean,
    ) {
        safely(Unit) {
            val arrival = read(System.currentTimeMillis()) ?: return@safely
            if (arrival.expectedUserId == userId && !arrival.awaitingReauthentication && matches(arrival.path)) storage.clearProtected()
        }
    }

    @Synchronized
    fun clear() {
        safely(Unit) { storage.clearProtected() }
    }

    private fun read(now: Long): PendingContentArrival? {
        val bytes = storage.raw()
        val arrival =
            if (bytes != null) {
                // Corrupt or unavailable protected state never falls back to an older plaintext link.
                checkNotNull(adapter.fromJson(bytes)).also { check(it.version == 1 && it.path.isNotBlank()) }
            } else {
                storage.migrate(adapter, now) ?: return null
            }
        if (!arrival.isFresh(now)) {
            storage.clearProtected()
            return null
        }
        return arrival
    }

    private inline fun <T> safely(
        fallback: T,
        action: () -> T,
    ): T =
        try {
            action()
        } catch (_: Exception) {
            fallback
        }

    @VisibleForTesting
    @Synchronized
    internal fun bindForTesting(
        protected: SharedPreferences,
        oldPreferences: SharedPreferences? = null,
    ) {
        storage.bindForTesting(protected, oldPreferences)
    }
}

private const val ARRIVAL_TTL_MS = 24L * 60L * 60L * 1000L

private fun PendingContentArrival.isFresh(now: Long): Boolean = timestampMs > 0L && now - timestampMs <= ARRIVAL_TTL_MS

/** Owns durable preference writes, their uncertain memory cache and legacy migration. */
private class PendingContentArrivalPreferences {
    private var context: Context? = null
    private var prefs: SharedPreferences? = null
    private var legacy: SharedPreferences? = null
    private var uncertain = false
    private var uncertainValue: String? = null

    fun init(context: Context) {
        if (this.context != null) return
        this.context = context.applicationContext
        legacy = context.applicationContext.getSharedPreferences("pantopus_pending_deep_link", Context.MODE_PRIVATE)
    }

    fun migrate(
        adapter: com.squareup.moshi.JsonAdapter<PendingContentArrival>,
        now: Long,
    ): PendingContentArrival? {
        val old = legacy ?: return null
        val path = old.getString("path", null)?.takeIf(String::isNotBlank) ?: return null
        val record =
            PendingContentArrival(
                path = path,
                timestampMs = old.getLong("timestamp_ms", 0L),
                expectedUserId = old.getString("expected_user_id", null),
                awaitingReauthentication = old.getBoolean("awaiting_reauthentication", false),
            )
        if (!record.isFresh(now)) {
            clearLegacy()
            return null
        }
        return if (write(adapter.toJson(record))) {
            clearLegacy()
            record
        } else {
            null
        }
    }

    fun raw(): String? = if (uncertain) uncertainValue else protected().getString("arrival-v1", null)

    fun write(value: String?): Boolean {
        val previous = raw()
        val edit = protected().edit()
        if (value == null) edit.remove("arrival-v1") else edit.putString("arrival-v1", value)
        if (!edit.commit()) {
            // A failed commit can still replace the SharedPreferences memory cache.
            uncertain = true
            uncertainValue = previous
            return false
        }
        uncertain = false
        uncertainValue = null
        return true
    }

    fun clearProtected(): Boolean = clearLegacy() && write(null)

    fun clearLegacy(): Boolean = legacy?.let { if (it.all.isEmpty()) true else it.edit().clear().commit() } ?: true

    private fun protected(): SharedPreferences {
        prefs?.let { return it }
        val app = checkNotNull(context)
        val master = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        return EncryptedSharedPreferences.create(
            app,
            "private_pending_deep_link_v1",
            master,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        ).also { prefs = it }
    }

    fun bindForTesting(
        protected: SharedPreferences,
        oldPreferences: SharedPreferences?,
    ) {
        prefs = protected
        legacy = oldPreferences
        uncertain = false
        uncertainValue = null
    }
}
