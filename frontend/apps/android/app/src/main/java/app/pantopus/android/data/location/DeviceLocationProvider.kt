package app.pantopus.android.data.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.altitude.AltitudeConverter
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import androidx.core.location.LocationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

/** Android 14's own sea-level converter, in a class of its own so an older phone never loads it. */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
private object SeaLevel {
    private val converter by lazy { AltitudeConverter() }

    /** Adds the height above mean sea level to [fix]. Reads storage the first time: call it off the main thread. */
    fun addTo(
        context: Context,
        fix: Location,
    ) = converter.addMslAltitudeToLocation(context, fix)
}

/** Current device permission and one acquisition budget cover both Fused reads. */
@Singleton
class DeviceLocationProvider internal constructor(
    private val fusedClient: FusedLocationProviderClient,
    private val permissionGranted: () -> Boolean,
    private val currentMillis: () -> Long,
    private val heightOf: suspend (Location) -> HeightReading? = { null },
) : LocationProvider {
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) : this(
        LocationServices.getFusedLocationProviderClient(context),
        { hasLocationPermission(context) },
        System::currentTimeMillis,
        { fix -> seaLevelHeight(context, fix) },
    )

    /** [fix] is what Android gave: kept so its height can be worked out when a caller asks ([cachedHeight]). */
    private data class CachedCoordinate(val coordinate: UserCoordinate, val recordedAt: Long, val fix: Location? = null)

    @Volatile
    private var cached: CachedCoordinate? = null

    override fun cachedCoordinate(): UserCoordinate? {
        if (!permissionGranted()) {
            cached = null
            return null
        }
        return cached?.takeIf { isRecent(it.recordedAt) }?.coordinate
    }

    override suspend fun cachedHeight(): HeightReading? {
        if (!permissionGranted()) return null
        return cached?.takeIf { isRecent(it.recordedAt) }?.fix?.let { heightOf(it) }
    }

    override suspend fun requestCurrent(timeoutMillis: Long): UserCoordinate? {
        if (!permissionGranted()) {
            cached = null
            return null
        }
        if (timeoutMillis <= 0) return null
        val cancellation = CancellationTokenSource()
        var lastKnown: CachedCoordinate? = null
        val result =
            try {
                withTimeoutOrNull(timeoutMillis) {
                    // A first GPS fix can take longer than the budget, so a recent last fix is read alongside it.
                    val lastKnownRead = launch { lastKnown = fusedClient.lastLocation.await()?.validated() }
                    // Explicit user acquisition must also work when GPS is the only source.
                    val fresh =
                        fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
                            .await()?.validated()
                    if (fresh == null) lastKnownRead.join() else lastKnownRead.cancel()
                    fresh ?: lastKnown
                } ?: lastKnown
            } catch (_: SecurityException) {
                cached = null
                null
            } finally {
                // Task.await cancellation alone does not cancel the Fused request.
                cancellation.cancel()
            }
        if (!permissionGranted()) {
            cached = null
            return null
        }
        if (result != null) cached = result
        return cachedCoordinate()
    }

    private fun isRecent(recordedAt: Long): Boolean = currentMillis() - recordedAt in -CLOCK_SKEW_MILLIS..MAX_AGE_MILLIS

    private fun Location.validated(): CachedCoordinate? {
        val validPosition =
            latitude.isFinite() && latitude in -LATITUDE_LIMIT..LATITUDE_LIMIT &&
                longitude.isFinite() && longitude in -LONGITUDE_LIMIT..LONGITUDE_LIMIT
        val validAccuracy = hasAccuracy() && accuracy.isFinite() && accuracy >= 0
        if (!isRecent(time) || !validPosition || !validAccuracy) {
            return null
        }
        return CachedCoordinate(UserCoordinate(latitude, longitude, accuracy.toDouble()), time, this)
    }

    private companion object {
        const val MAX_AGE_MILLIS = 120_000L
        const val CLOCK_SKEW_MILLIS = 5_000L
        const val LATITUDE_LIMIT = 90.0
        const val LONGITUDE_LIMIT = 180.0

        fun hasLocationPermission(context: Context): Boolean =
            listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }

        /**
         * How high [fix] says the phone is, above mean sea level. Android's own altitude counts from the WGS84
         * ellipsoid, which sits about 20 m off sea level around Vancouver, WA, so it is used only once the phone has
         * turned it into a sea-level height: Android 14 and later do that themselves. An older phone gives none unless
         * the fix already came with one, and "Show elevation" is then not offered for where you are.
         */
        suspend fun seaLevelHeight(
            context: Context,
            fix: Location,
        ): HeightReading? {
            if (!fix.hasAltitude()) return null
            if (!LocationCompat.hasMslAltitude(fix) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // It reads the phone's geoid model from storage the first time: off the main thread, and never fatal.
                withContext(Dispatchers.IO) { runCatching { SeaLevel.addTo(context, fix) } }
            }
            if (!LocationCompat.hasMslAltitude(fix)) return null
            val accuracy =
                when {
                    LocationCompat.hasMslAltitudeAccuracy(fix) -> LocationCompat.getMslAltitudeAccuracyMeters(fix).toDouble()
                    LocationCompat.hasVerticalAccuracy(fix) -> LocationCompat.getVerticalAccuracyMeters(fix).toDouble()
                    else -> null
                }
            return HeightReading(
                meters = LocationCompat.getMslAltitudeMeters(fix),
                accuracyMeters = accuracy,
                speedMps = if (fix.hasSpeed()) fix.speed.toDouble() else null,
            )
        }
    }
}
