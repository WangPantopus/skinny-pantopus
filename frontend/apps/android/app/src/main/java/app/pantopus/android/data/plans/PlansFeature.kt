package app.pantopus.android.data.plans

import android.content.Context
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PlansApi
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/** The two server flags (brief section 3). [playdates] only counts when [plans] is on. */
data class PlansFlags(
    val plans: Boolean = false,
    val playdates: Boolean = false,
) {
    val playdatesOn: Boolean get() = plans && playdates
}

/**
 * Nearby Plans' switch. Reads `plans` and `plans_playdates` from `GET /api/feature-flags/:flagName` (which honors
 * the internal-team and beta-user lists) when someone signs in and every time the app comes to the foreground.
 *
 * Off: Nearby is today's screen and no Plans entry point, card, notification or deep link shows. The last answer
 * is kept per account so a relaunch opens Nearby the right way at once; the re-check follows. A failed read keeps
 * the last answer (every Plans route also answers 404 while the flag is off, so nothing private can show).
 */
@Singleton
class PlansFeature
    @Inject
    constructor(
        private val api: PlansApi,
        private val auth: AuthRepository,
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val _flags = MutableStateFlow(PlansFlags())
        private var started = false

        @Volatile private var reading: Job? = null

        @Volatile private var userId: String? = null

        @Volatile private var user: UserDto? = null

        /** The current answer for the signed-in person (off while signed out). */
        val flags: StateFlow<PlansFlags> = _flags.asStateFlow()

        private val _settled = MutableStateFlow(false)

        /**
         * True once [flags] holds the signed-in person's answer (the one kept from last time, then the re-check);
         * false while signed out and in the moment after sign-in or a relaunch before it is read. The tab bar waits
         * for it before moving anyone off the Plans tab.
         */
        val settled: StateFlow<Boolean> = _settled.asStateFlow()

        /** True when Plans is on for the signed-in person right now. */
        val isOn: Boolean get() = _flags.value.plans

        /** The signed-in person's id (to tell "you" apart in a plan's people), or null while signed out. */
        val viewerId: String? get() = userId

        /** The signed-in person, for the host preview's name and avatar. */
        val viewer: UserDto? get() = user

        /** Starts following sign-in and sign-out. Safe to call more than once. */
        fun start() {
            if (started) return
            started = true
            DeepLinkRouter.bindPlansEnabledProvider { isOn }
            scope.launch {
                auth.state.collect { state ->
                    val signedIn = state as? AuthRepository.State.SignedIn
                    user = signedIn?.user
                    val id = signedIn?.user?.id
                    if (id == userId) return@collect
                    userId = id
                    if (id == null) {
                        reading?.cancel()
                        _flags.value = PlansFlags()
                        _settled.value = false
                    } else {
                        _flags.value = remembered(id)
                        _settled.value = true
                        refresh()
                    }
                }
            }
        }

        /** The app came to the foreground: re-check both flags. */
        fun foregrounded() {
            if (userId != null) refresh()
        }

        /** Re-reads both flags now. */
        fun refresh() {
            val id = userId ?: return
            if (reading?.isActive == true) return
            reading =
                scope.launch {
                    val plans = async { read(FLAG_PLANS) }
                    val playdates = async { read(FLAG_PLAYDATES) }
                    val plansOn = plans.await()
                    val playdatesOn = playdates.await()
                    if (userId != id) return@launch
                    val current = _flags.value
                    val next =
                        PlansFlags(
                            plans = plansOn ?: current.plans,
                            playdates = playdatesOn ?: current.playdates,
                        )
                    _flags.value = next
                    remember(id, next)
                }
        }

        private suspend fun read(name: String): Boolean? =
            when (val result = safeApiCall { api.flag(name) }) {
                is NetworkResult.Success -> result.data.enabled
                is NetworkResult.Failure -> null
            }

        private fun remembered(id: String): PlansFlags {
            val raw = prefs.getString(id, null) ?: return PlansFlags()
            return PlansFlags(plans = raw.startsWith("1"), playdates = raw.endsWith("1"))
        }

        private fun remember(
            id: String,
            flags: PlansFlags,
        ) {
            prefs.edit().putString(id, "${if (flags.plans) 1 else 0}${if (flags.playdates) 1 else 0}").apply()
        }

        private companion object {
            const val PREFS = "pantopus.plans.flags"
            const val FLAG_PLANS = "plans"
            const val FLAG_PLAYDATES = "plans_playdates"
        }
    }
