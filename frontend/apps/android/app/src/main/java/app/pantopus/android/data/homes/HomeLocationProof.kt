package app.pantopus.android.data.homes

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import app.pantopus.android.data.location.awaitLocationOrNull
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import java.math.BigDecimal
import java.math.RoundingMode
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One reading of where the phone is, for the location check (FASTVERIFY phase 5). It goes to the server once and is
 * never kept on the phone. [mocked] is Android's own word that a test or mock provider made the fix.
 */
data class HomeLocationReading(
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double,
    val mocked: Boolean,
) {
    /** Never prints where the phone was. */
    override fun toString(): String = "HomeLocationReading(hidden)"

    /**
     * The reading as the proof binds it (the server rebuilds the same text from the posted fields):
     * `{"latitude":…,"longitude":…,"accuracy_m":…,"mocked":…,"platform":"android"}`, in that order, no spaces, the
     * numbers as sent ([latitudeSent], [longitudeSent], [accuracySent]).
     */
    fun bindingJson(): String =
        "{\"latitude\":${plain(latitudeSent)},\"longitude\":${plain(longitudeSent)},\"accuracy_m\":${plain(accuracySent)}," +
            "\"mocked\":$mocked,\"platform\":\"android\"}"

    /** Six decimals (about 10 cm) are all a fix carries; the same numbers go in the body and the binding. */
    val latitudeSent: Double get() = round(latitude, COORDINATE_DECIMALS)
    val longitudeSent: Double get() = round(longitude, COORDINATE_DECIMALS)
    val accuracySent: Double get() = round(accuracyM, ACCURACY_DECIMALS)

    private companion object {
        const val COORDINATE_DECIMALS = 6
        const val ACCURACY_DECIMALS = 1

        fun round(
            value: Double,
            decimals: Int,
        ): Double = BigDecimal(value).setScale(decimals, RoundingMode.HALF_UP).toDouble()

        /** A JSON number as JavaScript's JSON.stringify writes it: no trailing zeros, no exponent. */
        fun plain(value: Double): String = BigDecimal(value.toString()).stripTrailingZeros().toPlainString()
    }
}

/**
 * Reads the phone's location once, fresh, at high accuracy, and asks Google Play for a Play Integrity token bound to
 * the challenge and that reading (classic request, nonce = URL-safe Base64 of SHA-256(challenge + reading JSON), as
 * developer.android.com/google/play/integrity/classic describes). Uses the app's existing when-in-use location
 * permission; never asks for background location.
 */
@Singleton
class HomeLocationProof
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        fun hasPermission(): Boolean =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        /** A fresh fix (never a last-known one), or null without permission, a fix, or in [timeoutMillis]. */
        @SuppressLint("MissingPermission")
        suspend fun read(timeoutMillis: Long = READ_TIMEOUT_MS): HomeLocationReading? {
            if (!hasPermission()) return null
            val cancellation = CancellationTokenSource()
            return try {
                withTimeoutOrNull(timeoutMillis) {
                    LocationServices
                        .getFusedLocationProviderClient(context)
                        .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
                        .awaitLocationOrNull()
                }?.toReading()
            } catch (_: SecurityException) {
                null
            } finally {
                cancellation.cancel()
            }
        }

        /**
         * A Play Integrity token whose nonce binds [challenge] and [reading]; null when Google Play can't give one (an
         * emulator, a debug build, no Play services, a timeout). The server then counts the reading only on a rig that
         * trusts the client.
         */
        suspend fun integrityToken(
            challenge: String,
            reading: HomeLocationReading,
        ): String? {
            val nonce = nonce(challenge, reading)
            return runCatching {
                withTimeoutOrNull(TOKEN_TIMEOUT_MS) {
                    IntegrityManagerFactory
                        .create(context)
                        .requestIntegrityToken(IntegrityTokenRequest.builder().setNonce(nonce).build())
                        .await()
                        .token()
                }
            }.getOrNull()
        }

        private fun Location.toReading(): HomeLocationReading? {
            if (!latitude.isFinite() || !longitude.isFinite()) return null
            val mock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) isMock else isFromMockProviderCompat()
            return HomeLocationReading(latitude, longitude, if (hasAccuracy()) accuracy.toDouble() else NO_ACCURACY, mock)
        }

        @Suppress("DEPRECATION")
        private fun Location.isFromMockProviderCompat(): Boolean = isFromMockProvider

        companion object {
            private const val READ_TIMEOUT_MS = 20_000L
            private const val TOKEN_TIMEOUT_MS = 60_000L

            /** A fix with no accuracy reads as too rough. */
            private const val NO_ACCURACY = 9_999.0

            /** URL-safe Base64 (no padding, no wrap) of SHA-256(challenge + reading JSON). */
            fun nonce(
                challenge: String,
                reading: HomeLocationReading,
            ): String {
                val digest = MessageDigest.getInstance("SHA-256").digest((challenge + reading.bindingJson()).toByteArray(Charsets.UTF_8))
                return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            }
        }
    }
