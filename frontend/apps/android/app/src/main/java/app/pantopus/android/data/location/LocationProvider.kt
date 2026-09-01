package app.pantopus.android.data.location

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import javax.inject.Singleton

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
 * Provider interface — abstracted so view-models can inject a fixed
 * coordinate in tests without dragging in FusedLocationProviderClient.
 */
interface LocationProvider {
    /** Last cached coordinate, if any. Synchronous, no permission flow. */
    fun cachedCoordinate(): UserCoordinate?

    /**
     * Request a fresh coordinate. Returns the cached value (or null) if
     * permission is denied or the OS doesn't return within
     * [timeoutMillis]. The real production wiring should swap this for
     * a FusedLocationProviderClient-backed implementation once the
     * permission flow lands.
     */
    suspend fun requestCurrent(timeoutMillis: Long = 4_000L): UserCoordinate?
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
