package app.pantopus.android.core.routing

import android.content.Context
import android.content.SharedPreferences
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import java.util.UUID

/** Device-local, expiring draft. Saving never creates a Home or a membership. */
object PlacePendingStore {
    internal const val TTL_MS = 24L * 60L * 60L * 1000L
    private var prefs: SharedPreferences? = null

    data class Pending(
        val id: String,
        val label: String,
        val latitude: Double,
        val longitude: Double,
        val expiresAt: Long,
        val userId: String? = null,
    )

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences("pantopus_pending_place", Context.MODE_PRIVATE)
        read()
    }

    internal fun useStorage(storage: SharedPreferences?) {
        prefs = storage
    }

    fun stash(
        suggestion: GeoSuggestion,
        now: Long = System.currentTimeMillis(),
    ): Boolean {
        clear()
        val lat = suggestion.latitude ?: return false
        val lng = suggestion.longitude ?: return false
        if (!valid(suggestion.label, lat, lng)) return false
        return write(Pending(UUID.randomUUID().toString(), suggestion.label, lat, lng, now + TTL_MS))
    }

    fun read(now: Long = System.currentTimeMillis()): Pending? {
        val store = prefs ?: return null
        val id = store.getString("id", null)
        val label = store.getString("label", null).orEmpty()
        val lat = store.getString("lat", null)?.toDoubleOrNull()
        val lng = store.getString("lng", null)?.toDoubleOrNull()
        val expires = store.getLong("expires_at", 0L)
        if (id.isNullOrBlank() || lat == null || lng == null || !valid(label, lat, lng) ||
            expires <= now || expires - now > TTL_MS
        ) {
            clear()
            return null
        }
        return Pending(id, label, lat, lng, expires, store.getString("user_id", null))
    }

    fun bind(
        userId: String,
        now: Long = System.currentTimeMillis(),
    ): Pending? {
        if (userId.isBlank()) return null
        val draft = read(now) ?: return null
        if (draft.userId != null && draft.userId != userId) {
            clear()
            return null
        }
        val bound = draft.copy(userId = userId)
        return bound.takeIf { write(it) }
    }

    fun clear(id: String? = null) {
        if (id != null && prefs?.getString("id", null) != id) return
        prefs?.edit()?.clear()?.apply()
    }

    private fun valid(
        label: String,
        lat: Double,
        lng: Double,
    ): Boolean = label.isNotBlank() && lat.isFinite() && lng.isFinite() && lat in -90.0..90.0 && lng in -180.0..180.0

    private fun write(draft: Pending): Boolean {
        val store = prefs ?: return false
        // Persist before leaving the funnel; a process restart must retain the draft.
        return store.edit().clear()
            .putString("id", draft.id).putString("label", draft.label)
            .putString("lat", draft.latitude.toString()).putString("lng", draft.longitude.toString())
            .putLong("expires_at", draft.expiresAt).putString("user_id", draft.userId).commit()
    }
}
