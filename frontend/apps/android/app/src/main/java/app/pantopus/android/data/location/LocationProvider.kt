package app.pantopus.android.data.location

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import javax.inject.Singleton

/**
 * How long automatic feed and map loads wait for a device fix when the person's Home (or, on the map, a saved place)
 * can stand in, so they don't wait for a full GPS acquisition. With nothing to fall back to, the device location is
 * the only area there is, and they keep the usual window.
 */
const val PASSIVE_LOCATION_TIMEOUT_MILLIS = 400L

/**
 * Best-known coordinate hint. `accuracyMeters` lets callers decide
 * whether to render a "you are here" disc or just a neighborhood-level
 * halo on the map.
 */
data class UserCoordinate(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double,
)

/**
 * How high a fix, or an album photo, says the phone was: metres above mean sea level, with how far off that may be and
 * the phone's speed when the source says. A Moment's "Show height" sends it.
 */
data class HeightReading(
    val meters: Double,
    val accuracyMeters: Double? = null,
    val speedMps: Double? = null,
)

/**
 * Provider interface — abstracted so view-models can inject a fixed
 * coordinate in tests without dragging in FusedLocationProviderClient.
 */
interface LocationProvider {
    /** Last cached coordinate, if any. Synchronous, no permission flow. */
    fun cachedCoordinate(): UserCoordinate?

    /**
     * Request a fresh coordinate within [timeoutMillis]. A recent cached
     * coordinate may be used while permission remains granted. Denied
     * permission returns null and clears the provider's cache.
     */
    suspend fun requestCurrent(timeoutMillis: Long = 4_000L): UserCoordinate?

    /**
     * The height of the fix [cachedCoordinate] answers with, above mean sea level; null when the phone has none it can
     * vouch for. Worked out only when asked (a Moment's "Show height"), so no other location read pays for it.
     */
    suspend fun cachedHeight(): HeightReading? = null
}

/**
 * Hardcoded-fallback provider. Returns a downtown Manhattan anchor so
 * the map renders during development — replace with a CoreLocation /
 * FusedLocation-backed implementation in a later pass.
 */
@Singleton
class FallbackLocationProvider
    @Inject
    constructor() : LocationProvider {
        private val fallback = UserCoordinate(latitude = 40.7484, longitude = -73.9857, accuracyMeters = 100.0)

        override fun cachedCoordinate(): UserCoordinate? = fallback

        override suspend fun requestCurrent(timeoutMillis: Long): UserCoordinate? = fallback
    }

/** Hilt binding for the device location provider. */
@Module
@InstallIn(SingletonComponent::class)
abstract class LocationProviderModule {
    @Binds
    @Singleton
    abstract fun bindLocationProvider(impl: DeviceLocationProvider): LocationProvider
}
