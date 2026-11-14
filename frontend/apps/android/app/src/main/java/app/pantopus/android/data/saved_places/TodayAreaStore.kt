@file:Suppress("PackageNaming")

package app.pantopus.android.data.saved_places

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.saved_places.AreaTodayBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.SavedPlacesApi
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.store.StoreKind
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.abs
import kotlin.math.sign

/**
 * An account's area (TABCARD §4): the point rounded to two decimal places (about a kilometre), what the server calls it
 * ("Vancouver, WA"; null until the first answer names it) and when the phone read the fix (epoch milliseconds).
 */
data class TodayArea(
    val latitude: Double,
    val longitude: Double,
    val label: String? = null,
    val city: String? = null,
    val readAt: Long,
) {
    fun samePoint(other: TodayArea?): Boolean = other != null && latitude == other.latitude && longitude == other.longitude

    companion object {
        /** Two decimal places, half away from zero: nothing finer is ever sent or kept. */
        fun rounded(value: Double): Double = sign(value) * Math.round(abs(value) * POINT_SCALE) / POINT_SCALE

        private const val POINT_SCALE = 100.0
    }
}

/** The area's Today: the same answer a saved address's Today has, the area as the server named it, and when it came. */
data class TodayAreaAnswer(
    val today: PlaceIntelligence,
    val area: TodayArea,
    val fetchedAt: Long,
)

/**
 * The city around someone with no address on Pantopus yet (TABCARD §4, drawing TodayNoAddress). "Use my location" on
 * Today reads one fix, rounds it to two decimal places and keeps it on this phone for the signed-in account only, with
 * the city's name and when it was read. Today and Place's address-first screen show that city's sky, sun and air from
 * `POST /api/saved-places/area/today`, which stores nothing. The exact fix never leaves this class, and another account
 * never sees this one's area or its answer. Parity twin of iOS `TodayAreaStore`.
 */
@Singleton
class TodayAreaStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val api: SavedPlacesApi,
        private val moshi: Moshi,
        private val auth: AuthRepository,
        private val location: LocationProvider,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val fetching = Mutex()
        private val _revision = MutableStateFlow(0L)

        /** Bumped on every write, so screens showing an area follow it. */
        val revision: StateFlow<Long> = _revision.asStateFlow()

        fun account(): String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        /** The signed-in account's area; null before "Use my location". */
        fun area(): TodayArea? = account()?.let(::area)

        private fun area(account: String): TodayArea? {
            val raw = prefs.getString(KEY + account, null) ?: return null
            return runCatching {
                val json = JSONObject(raw)
                TodayArea(
                    latitude = TodayArea.rounded(json.getDouble("latitude")),
                    longitude = TodayArea.rounded(json.getDouble("longitude")),
                    label = json.text("label"),
                    city = json.text("city"),
                    readAt = json.getLong("read_at"),
                )
            }.getOrNull()
        }

        fun hasPermission(): Boolean =
            listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }

        /**
         * "Use my location" once the system allows it: one fix, its rounded point kept for this account (the name comes
         * with Today's answer). False when location is refused or off, or no fix came.
         */
        suspend fun locate(): Boolean {
            val account = account()
            if (account == null || !hasPermission()) return false
            val fix = location.requestCurrent(LOCATE_TIMEOUT_MS)
            if (fix == null || account() != account) return false
            keep(fix.latitude, fix.longitude, account)
            return true
        }

        /**
         * Today showing an area over an hour old while location stays allowed: one quiet fix, never a question. The
         * area that should show now when its rounded point moved; null when it didn't (or no fix came).
         */
        suspend fun refreshIfOld(now: Long = System.currentTimeMillis()): TodayArea? {
            val account = account()
            val kept = account?.let(::area)
            val old = kept != null && now - kept.readAt > maxAgeMs()
            if (account == null || !old || !hasPermission()) return null
            val fix = location.requestCurrent(REFRESH_TIMEOUT_MS)
            if (fix == null || account() != account) return null
            return if (keep(fix.latitude, fix.longitude, account)) area(account) else null
        }

        /** Keeps the rounded point; true when it moved. */
        private fun keep(
            latitude: Double,
            longitude: Double,
            account: String,
        ): Boolean {
            val point = TodayArea(TodayArea.rounded(latitude), TodayArea.rounded(longitude), readAt = System.currentTimeMillis())
            val kept = area(account)
            if (kept != null && kept.samePoint(point)) {
                write(kept.copy(readAt = point.readAt), account)
                return false
            }
            write(point, account)
            return true
        }

        private fun write(
            area: TodayArea,
            account: String,
        ) {
            val json =
                JSONObject()
                    .put("latitude", area.latitude)
                    .put("longitude", area.longitude)
                    .put("label", area.label ?: JSONObject.NULL)
                    .put("city", area.city ?: JSONObject.NULL)
                    .put("read_at", area.readAt)
            prefs.edit().putString(KEY + account, json.toString()).apply()
            _revision.value++
        }

        /** The kept answer for this account's point while it is fresh (Today's ten minutes, never past midnight there). */
        fun keptToday(
            area: TodayArea,
            now: Long = System.currentTimeMillis(),
        ): TodayAreaAnswer? {
            val account = account() ?: return null
            val kept = synchronized(answers) { answers[answerKey(account, area)] } ?: return null
            return kept.first.takeIf { now < kept.second }
        }

        /**
         * Today for [area]: the kept answer while fresh, else one request (shared by Today and Place). [force] for pull
         * to refresh and Try again. An answer that lands for another account is dropped.
         */
        suspend fun today(
            area: TodayArea,
            force: Boolean = false,
        ): NetworkResult<TodayAreaAnswer> {
            val account = account() ?: return NetworkResult.Failure(NetworkError.Unauthorized)
            if (!force) keptToday(area)?.let { return NetworkResult.Success(it) }
            return fetching.withLock {
                if (!force) keptToday(area)?.let { return@withLock NetworkResult.Success(it) }
                fetch(area, account)
            }
        }

        private suspend fun fetch(
            area: TodayArea,
            account: String,
        ): NetworkResult<TodayAreaAnswer> {
            val body = AreaTodayBody(TodayArea.rounded(area.latitude), TodayArea.rounded(area.longitude))
            val raw =
                when (val result = safeApiCall { api.areaToday(body).use { it.string() } }) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> return result
                }
            if (account() != account) return NetworkResult.Failure(NetworkError.Unauthorized)
            val answer =
                decode(raw, area) ?: return NetworkResult.Failure(NetworkError.Decoding(IllegalStateException("No Today in the answer")))
            keepAnswer(answer, account)
            return NetworkResult.Success(answer)
        }

        /** Kept in memory for Today and Place, and the area's name kept with its point. */
        private fun keepAnswer(
            answer: TodayAreaAnswer,
            account: String,
        ) {
            val zone = answer.today.homeZone ?: ZoneId.systemDefault()
            val midnight =
                Instant.ofEpochMilli(answer.fetchedAt).atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
            synchronized(answers) {
                answers.keys.removeAll { !it.startsWith("$account|") }
                answers[answerKey(account, answer.area)] = answer to minOf(answer.fetchedAt + StoreKind.TODAY.freshForMs, midnight)
            }
            // The name comes with the answer, for the point still kept.
            val kept = area(account)?.takeIf { it.samePoint(answer.area) } ?: return
            if (kept.label != answer.area.label || kept.city != answer.area.city) {
                write(kept.copy(label = answer.area.label, city = answer.area.city), account)
            }
        }

        /**
         * The answer is a saved place's Today plus `area`. A point with no town ("Near you") has no city or state, which
         * a saved place always has: those read as empty rather than failing the whole Today. Null when it can't be read.
         */
        private fun decode(
            raw: String,
            asked: TodayArea,
        ): TodayAreaAnswer? =
            runCatching {
                val json = JSONObject(raw)
                json.optJSONObject("place")?.let { place ->
                    PLACE_TEXT.forEach { key -> if (place.isNull(key)) place.put(key, "") }
                }
                val today = moshi.adapter(PlaceIntelligence::class.java).fromJson(json.toString()) ?: error("No Today in the answer")
                val named = json.optJSONObject("area")
                val label = named?.text("label") ?: today.place.label.ifBlank { null }
                val city = named?.text("city") ?: today.place.city.ifBlank { null }
                TodayAreaAnswer(today, asked.copy(label = label, city = city), System.currentTimeMillis())
            }.getOrNull()

        companion object {
            private const val PREFS = "pantopus.today_area"
            private const val KEY = "area."
            private val PLACE_TEXT = listOf("label", "line1", "city", "state")

            /**
             * "Use my location" and the quiet hourly read wait up to this long for a fix. A first GPS fix after a cold
             * start took over four seconds on the emulator, and the kept city stays on screen meanwhile.
             */
            private const val LOCATE_TIMEOUT_MS = 8_000L
            private const val REFRESH_TIMEOUT_MS = 8_000L

            /** How old an area may get before Today reads the fix again: an hour. */
            private const val MAX_AGE_MS = 60 * 60 * 1000L

            /** The intent extra a debug build reads to shorten [MAX_AGE_MS] (TABCARD §4 check), in seconds. */
            const val DEBUG_MAX_AGE_EXTRA = "PANTOPUS_DEBUG_AREA_MAX_AGE"

            @Volatile
            private var debugMaxAgeMs: Long? = null

            /** Debug builds only: the launch's `PANTOPUS_DEBUG_AREA_MAX_AGE` (seconds), or none. A release build ignores it. */
            fun takeDebugMaxAge(raw: String?) {
                if (!BuildConfig.DEBUG) return
                debugMaxAgeMs = raw?.trim()?.toLongOrNull()?.takeIf { it >= 0 }?.times(MILLIS_PER_SECOND)
            }

            private const val MILLIS_PER_SECOND = 1000L

            fun maxAgeMs(): Long = debugMaxAgeMs?.takeIf { BuildConfig.DEBUG } ?: MAX_AGE_MS

            /** The last answer per account and point, with when it stops being fresh. */
            private val answers = mutableMapOf<String, Pair<TodayAreaAnswer, Long>>()

            private fun answerKey(
                account: String,
                area: TodayArea,
            ) = "$account|${area.latitude},${area.longitude}"

            /** Sign-out: no area's Today stays in memory for the next person (each account's own area stays under its id). */
            fun forgetAnswers() {
                synchronized(answers) { answers.clear() }
            }
        }
    }

/** A text value that may be missing or JSON null. */
private fun JSONObject.text(key: String): String? = if (isNull(key)) null else optString(key).ifBlank { null }
