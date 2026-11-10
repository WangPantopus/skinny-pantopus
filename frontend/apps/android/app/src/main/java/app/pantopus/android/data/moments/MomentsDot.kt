package app.pantopus.android.data.moments

import android.content.Context
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MomentsApi
import app.pantopus.android.data.plans.PlanLocationResolver
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.cos

/**
 * The dot on the Moments tab (contract v3, `GET /api/moments/unseen`): someone near you added a Moment since you last
 * had the tab open. No number, and nothing while Moments is off, signed out, or the read fails.
 *
 * Near you is a box about two miles across around where the map would open: the phone's location when location is
 * already allowed (never asked for here), else the home; with neither there is no dot. What counts went live after the
 * last time the tab was on screen, kept on this phone per account; the first time ever, everything live counts.
 *
 * Read when Moments is found on (at launch and on every foreground, which also tells the server this app can show a
 * connection's new Moment), after the viewer closes, when a `moment_new` push arrives and every 5 minutes while the app
 * is open. Opening the tab clears the dot and moves the time to now; leaving the tab moves it again.
 */
@Singleton
class MomentsDot
    @Inject
    constructor(
        private val api: MomentsApi,
        private val locations: PlanLocationResolver,
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val _shown = MutableStateFlow(false)

        /** True while the tab shows the dot. */
        val shown: StateFlow<Boolean> = _shown.asStateFlow()

        /** The signed-in person while Moments is on for them; null otherwise (no reads, no dot). */
        @Volatile private var account: String? = null

        /** The Moments tab is on screen: nothing it would show is new. */
        @Volatile private var onTab = false

        @Volatile private var reading: Job? = null

        /** [MomentsFeature] says who has Moments on now: the person's id, or null when off or signed out. */
        fun bind(accountId: String?) {
            if (accountId == account) return
            reading?.cancel()
            account = accountId
            _shown.value = false
        }

        /** Asks the server again, unless a read is on its way. */
        fun read() {
            val id = account ?: return
            if (reading?.isActive == true) return
            reading =
                scope.launch {
                    val box = box()
                    if (box == null) {
                        if (account == id) _shown.value = false
                        return@launch
                    }
                    val since = prefs.getString(sinceKey(id), null)
                    val result = safeApiCall { api.unseen(box.south, box.west, box.north, box.east, since) }
                    if (account != id) return@launch
                    _shown.value = !onTab && result is NetworkResult.Success && result.data.count > 0
                }
        }

        /** The Moments tab came on screen ([showing]) or left it. */
        fun tabShown(showing: Boolean) {
            val id = account
            if (showing) {
                onTab = true
                _shown.value = false
            } else if (onTab) {
                onTab = false
            } else {
                return
            }
            id?.let { prefs.edit().putString(sinceKey(it), Instant.now().toString()).apply() }
        }

        /** Where the map would open, as the map finds it: a fix when location is allowed, else the home. */
        private suspend fun box(): Box? {
            val (latitude, longitude) =
                locations.gpsFix()?.let { it.latitude to it.longitude }
                    ?: locations.home()?.let { it.latitude to it.longitude }
                    ?: return null
            val latSpan = HALF_SPAN_M / METERS_PER_DEGREE
            val lngSpan = HALF_SPAN_M / (METERS_PER_DEGREE * cos(Math.toRadians(latitude)).coerceAtLeast(MIN_COS))
            return Box(latitude - latSpan, longitude - lngSpan, latitude + latSpan, longitude + lngSpan)
        }

        private fun sinceKey(accountId: String) = "$accountId.since"

        private data class Box(
            val south: Double,
            val west: Double,
            val north: Double,
            val east: Double,
        )

        private companion object {
            const val PREFS = "pantopus.moments.dot"

            /** A mile each way: about two miles across, a little more than the map shows when it opens. */
            const val HALF_SPAN_M = 1_609.0
            const val METERS_PER_DEGREE = 111_320.0

            /** Keeps the box finite near the poles. */
            const val MIN_COS = 0.01
        }
    }
