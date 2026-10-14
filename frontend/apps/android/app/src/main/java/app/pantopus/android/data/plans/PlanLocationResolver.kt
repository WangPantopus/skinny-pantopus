package app.pantopus.android.data.plans

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.ViewingLocationRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** Where Plans looks from. Never shown to anyone else: hosts and guests only ever see a distance band. */
data class PlanLocation(
    val latitude: Double,
    val longitude: Double,
    /** The town for the area pill ("Camas"); null when unknown. */
    val label: String?,
    val source: Source,
) {
    enum class Source { GPS, HOME, SAVED_PLACE }
}

/** A fresh GPS fix: proof that a host is nearby (decision D2). It never becomes the pin. */
data class PlanGpsFix(
    val latitude: Double,
    val longitude: Double,
    val at: Instant,
)

/**
 * Picks the point Plans browses from (brief section 7: a home, a saved place, or GPS no older than 5 minutes).
 * The person's own choice wins: once they tap "Use my home instead" Plans keeps using the home until they ask for
 * their location.
 */
@Singleton
class PlanLocationResolver
    @Inject
    constructor(
        private val gps: LocationProvider,
        private val viewing: ViewingLocationRepository,
        private val savedPlaces: SavedPlacesRepository,
        @ApplicationContext private val context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /** True when the person chose their home (or a saved place) over their location. */
        var prefersHome: Boolean
            get() = prefs.getBoolean(KEY_PREFERS_HOME, false)
            set(value) = prefs.edit().putBoolean(KEY_PREFERS_HOME, value).apply()

        fun hasLocationPermission(): Boolean =
            listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }

        /** The point to browse from now, or null when there is none yet (board F5). */
        suspend fun resolve(): PlanLocation? {
            if (prefersHome) return home() ?: if (hasLocationPermission()) fromGps() else null
            if (!hasLocationPermission()) return null
            // Location is allowed but no fix came in time (indoors, a cold start): browse from the home or a saved
            // place meanwhile instead of asking again for a permission the person already gave.
            return fromGps() ?: home()
        }

        /** The person's home or, without one, their first saved place. */
        suspend fun home(): PlanLocation? {
            val payload = (viewing.current() as? NetworkResult.Success)?.data ?: viewing.currentCopy()
            payload?.homes?.firstOrNull { it.latitude != null && it.longitude != null }?.let { home ->
                return PlanLocation(home.latitude!!, home.longitude!!, home.city, PlanLocation.Source.HOME)
            }
            val saved = savedPlaces.listCopy() ?: (savedPlaces.listStored().data)
            saved?.savedPlaces?.firstOrNull()?.let { place ->
                return PlanLocation(place.latitude, place.longitude, place.city ?: place.label, PlanLocation.Source.SAVED_PLACE)
            }
            return null
        }

        /** True when the person has a home or a saved place to fall back on. */
        suspend fun hasHome(): Boolean = home() != null

        /**
         * A fresh fix for the host check (the server takes GPS no older than 5 minutes). The provider keeps a fix for
         * at most 2 minutes, so a cached one is still inside the window.
         */
        suspend fun gpsFix(): PlanGpsFix? {
            if (!hasLocationPermission()) return null
            val coordinate = gps.cachedCoordinate() ?: gps.requestCurrent(FIX_TIMEOUT_MS) ?: return null
            return PlanGpsFix(coordinate.latitude, coordinate.longitude, Instant.now())
        }

        private suspend fun fromGps(): PlanLocation? {
            val coordinate = gps.cachedCoordinate() ?: gps.requestCurrent(FIX_TIMEOUT_MS) ?: return null
            val payload = viewing.currentCopy() ?: (viewing.current() as? NetworkResult.Success)?.data
            val label = payload?.viewingLocation?.city ?: payload?.homes?.firstOrNull()?.city
            return PlanLocation(coordinate.latitude, coordinate.longitude, label, PlanLocation.Source.GPS)
        }

        private companion object {
            const val PREFS = "pantopus.plans.location"
            const val KEY_PREFERS_HOME = "prefers_home"
            const val FIX_TIMEOUT_MS = 6_000L
        }
    }
