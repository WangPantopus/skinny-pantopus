package app.pantopus.android.ui.screens.place.launch

import android.content.Context
import app.pantopus.android.data.api.models.geo.GeoSuggestion

/**
 * The signed-out preview is non-persistent (the §4 anti-leak rule), so
 * when a stranger hits the wall we stash the resolved address in
 * SharedPreferences and save it once they land back in the authed app
 * (consumed once). Mirrors the iOS `PlacePendingStore` / web
 * sessionStorage `pendingPlace`.
 */
object PlacePendingStore {
    private const val PREFS = "pantopus_pending_place"

    data class Pending(
        val street: String,
        val city: String,
        val state: String,
        val zip: String,
        val latitude: Double?,
        val longitude: Double?,
    )

    fun stash(
        context: Context,
        suggestion: GeoSuggestion,
    ) {
        // secondary_text is "City, ST, ZIP" (Mapbox); primary_text is the street line.
        val parts = (suggestion.secondaryText ?: "").split(",").map { it.trim() }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            putString("street", suggestion.primaryText)
            putString("city", parts.getOrNull(0).orEmpty())
            putString("state", parts.getOrNull(1).orEmpty())
            putString("zip", parts.getOrNull(2).orEmpty())
            putString("lat", suggestion.latitude?.toString())
            putString("lng", suggestion.longitude?.toString())
            apply()
        }
    }

    /** Read and CONSUME the pending place (one-shot). */
    fun take(context: Context): Pending? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val street = prefs.getString("street", null) ?: return null
        val pending =
            Pending(
                street = street,
                city = prefs.getString("city", "").orEmpty(),
                state = prefs.getString("state", "").orEmpty(),
                zip = prefs.getString("zip", "").orEmpty(),
                latitude = prefs.getString("lat", null)?.toDoubleOrNull(),
                longitude = prefs.getString("lng", null)?.toDoubleOrNull(),
            )
        prefs.edit().clear().apply()
        return pending
    }
}
