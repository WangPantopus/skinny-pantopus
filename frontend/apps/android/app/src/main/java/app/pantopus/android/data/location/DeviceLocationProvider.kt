package app.pantopus.android.data.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Production location provider backed by Google Play services fused
 * location. Returns the device's best-known coordinate when runtime
 * permission is granted.
 */
@Singleton
class DeviceLocationProvider
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : LocationProvider {
        private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

        @Volatile
        private var cached: UserCoordinate? = null

        override fun cachedCoordinate(): UserCoordinate? = cached

        override suspend fun requestCurrent(timeoutMillis: Long): UserCoordinate? {
            if (!hasLocationPermission()) return cached

            val fresh =
                withTimeoutOrNull(timeoutMillis) {
                    try {
                        fusedClient
                            .getCurrentLocation(
                                Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                                CancellationTokenSource().token,
                            ).await()
                            ?.toUserCoordinate()
                    } catch (_: SecurityException) {
                        null
                    }
                }

            if (fresh != null) {
                cached = fresh
                return fresh
            }

            val lastKnown =
                try {
                    fusedClient.lastLocation.await()?.toUserCoordinate()
                } catch (_: SecurityException) {
                    null
                }

            if (lastKnown != null) {
                cached = lastKnown
            }
            return lastKnown ?: cached
        }

        private fun hasLocationPermission(): Boolean {
            val fine =
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                ) == PackageManager.PERMISSION_GRANTED
            val coarse =
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ) == PackageManager.PERMISSION_GRANTED
            return fine || coarse
        }

        private fun Location.toUserCoordinate(): UserCoordinate =
            UserCoordinate(
                latitude = latitude,
                longitude = longitude,
                accuracyMeters = maxOf(accuracy.toDouble(), 0.0),
            )
    }
