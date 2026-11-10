package app.pantopus.android.data.moments

import android.content.Context
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MomentsApi
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Moments' switch: the server flag `moments` from `GET /api/feature-flags/moments` (which honors the beta-user and
 * internal-team lists), read when someone signs in and every time the app comes to the foreground, as Plans does.
 *
 * Off: no Moments tab. The last answer is kept per account so a relaunch draws the bar the right way at once; the
 * re-check follows. A failed read keeps the last answer (every Moments route answers 404 while the flag is off, so
 * nothing private can show), and a Moments route that answers `MOMENTS_UNAVAILABLE` has the flag read again at once, so
 * the tab leaves without waiting for the next foreground.
 */
@Singleton
class MomentsFeature
    @Inject
    constructor(
        private val api: MomentsApi,
        private val auth: AuthRepository,
        private val posting: MomentsPosting,
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val _on = MutableStateFlow(false)
        private val _settled = MutableStateFlow(false)
        private var started = false

        @Volatile private var reading: Job? = null

        @Volatile private var userId: String? = null

        /** Moments is on for the signed-in person (off while signed out). */
        val on: StateFlow<Boolean> = _on.asStateFlow()

        /**
         * True once [on] holds the signed-in person's answer (the one kept from last time, then the re-check); the tab
         * bar waits for it before moving anyone off the Moments tab.
         */
        val settled: StateFlow<Boolean> = _settled.asStateFlow()

        /** The signed-in person's id, to tell their own Moments and viewers apart. */
        val viewerId: String? get() = userId

        /** Starts following sign-in and sign-out. Safe to call more than once. */
        @Synchronized
        fun start() {
            if (started) return
            started = true
            scope.launch {
                auth.state.collect { state ->
                    val id = (state as? AuthRepository.State.SignedIn)?.user?.id
                    if (id == userId) return@collect
                    userId = id
                    if (id == null) {
                        reading?.cancel()
                        _on.value = false
                        _settled.value = false
                    } else {
                        _on.value = prefs.getBoolean(id, false)
                        _settled.value = true
                        refresh()
                    }
                }
            }
        }

        /** The app came to the foreground: read the flag again. */
        fun foregrounded() {
            if (userId != null) refresh()
        }

        /** Reads the flag now. */
        fun refresh() {
            val id = userId ?: return
            if (reading?.isActive == true) return
            reading =
                scope.launch {
                    val answer =
                        when (val result = safeApiCall { api.flag(FLAG) }) {
                            is NetworkResult.Success -> result.data.enabled
                            is NetworkResult.Failure -> null
                        } ?: return@launch
                    if (userId != id) return@launch
                    _on.value = answer
                    prefs.edit().putBoolean(id, answer).apply()
                    // A photo or video the app was closed on goes up now (its Moment is still waiting for it).
                    if (answer) posting.resume(id)
                }
        }

        private companion object {
            const val PREFS = "pantopus.moments.flag"
            const val FLAG = "moments"
        }
    }
