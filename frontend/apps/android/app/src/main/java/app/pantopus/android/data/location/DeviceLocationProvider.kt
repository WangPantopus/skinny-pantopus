package app.pantopus.android.data.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

/** Current device permission and one acquisition budget cover both Fused reads. */
@Singleton
class DeviceLocationProvider internal constructor(
    private val fusedClient: FusedLocationProviderClient,
    private val permissionGranted: () -> Boolean,
    private val currentMillis: () -> Long,
) : LocationProvider {
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) : this(
        LocationServices.getFusedLocationProviderClient(context),
        { hasLocationPermission(context) },
        System::currentTimeMillis,
    )

    private data class CachedCoordinate(val coordinate: UserCoordinate, val recordedAt: Long)

    @Volatile
    private var cached: CachedCoordinate? = null

    override fun cachedCoordinate(): UserCoordinate? {
        if (!permissionGranted()) {
            cached = null
            return null
        }
        return cached?.takeIf { isRecent(it.recordedAt) }?.coordinate
    }

    override suspend fun requestCurrent(timeoutMillis: Long): UserCoordinate? {
        if (!permissionGranted()) {
            cached = null
            return null
        }
        if (timeoutMillis <= 0) return null
        val cancellation = CancellationTokenSource()
        val result =
            try {
                withTimeoutOrNull(timeoutMillis) {
                    // Explicit user acquisition must also work when GPS is the only source.
                    val fresh =
                        fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
                            .await()?.validated()
                    if (!permissionGranted()) return@withTimeoutOrNull null
                    fresh ?: fusedClient.lastLocation.await()?.validated()
                }
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
        return CachedCoordinate(UserCoordinate(latitude, longitude, accuracy.toDouble()), time)
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
    }
}
