package app.pantopus.android.data.moments

import android.os.SystemClock
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MomentsApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Who has Moments to watch, for the rings around profile pictures. A circle that comes on screen asks about its
 * person; the asks of one screenful go to the server together (`GET /api/moments/people`, contract v3.7), and an
 * answer is kept for a minute. The server decides who may see what, by the map's rules: someone with nothing for you
 * to watch simply has no ring. Used from the main thread only.
 */
@Singleton
class MomentsPeopleRings
    @Inject
    constructor(
        private val api: MomentsApi,
        private val repository: MomentsRepository,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        private val _rings = MutableStateFlow<Map<String, MomentRingDto>>(emptyMap())

        /** The ring of each person who has Moments you may see, by account id. */
        val rings: StateFlow<Map<String, MomentRingDto>> = _rings.asStateFlow()

        private var account: String? = null
        private val answeredAt = HashMap<String, Long>()
        private val waiting = LinkedHashSet<String>()
        private var sending: Job? = null

        /** A server from before this read: it isn't asked again until the app starts again. */
        private var unsupported = false

        init {
            // A Moment posted or deleted, a person muted or blocked: every ring is read again.
            scope.launch {
                repository.changes.collect {
                    val known = answeredAt.keys.toList().takeLast(MOST_PER_REQUEST)
                    answeredAt.clear()
                    if (known.isNotEmpty()) {
                        waiting += known
                        gather()
                    }
                }
            }
        }

        /**
         * A circle showing [userId] is on screen for [viewerId] (the signed-in person): their ring is read unless it
         * was within the last minute.
         */
        fun want(
            userId: String,
            viewerId: String?,
        ) {
            if (userId.isBlank() || viewerId.isNullOrBlank() || unsupported) return
            if (viewerId != account) reset(viewerId)
            val at = answeredAt[userId]
            if (at != null && SystemClock.elapsedRealtime() - at < KEEP_MS) return
            waiting += userId
            gather()
        }

        /** Another account signed in: nothing read for the last one is shown to this one. */
        private fun reset(newAccount: String) {
            account = newAccount
            unsupported = false
            _rings.value = emptyMap()
            answeredAt.clear()
            waiting.clear()
            sending?.cancel()
            sending = null
        }

        private fun gather() {
            if (sending != null) return
            val asker = account
            sending =
                scope.launch {
                    // The circles of one screenful appear within a moment of each other: their asks go as one request.
                    delay(GATHER_MS)
                    send(asker)
                    sending = null
                    if (waiting.isNotEmpty() && asker == account) gather()
                }
        }

        private suspend fun send(asker: String?) {
            val ids = waiting.take(MOST_PER_REQUEST)
            waiting.removeAll(ids.toSet())
            if (ids.isEmpty() || asker != account) return
            // Marked before the answer, so a circle that scrolls back in meanwhile doesn't ask twice.
            val now = SystemClock.elapsedRealtime()
            ids.forEach { answeredAt[it] = now }
            when (val result = safeApiCall { api.people(ids.joinToString(",")) }) {
                is NetworkResult.Success -> {
                    if (asker != account) return
                    val answered = result.data.rings.filter { it.moments.isNotEmpty() }.associateBy { it.author.id }
                    _rings.update { current -> current - ids.toSet() + answered }
                }
                is NetworkResult.Failure ->
                    if (result.error is NetworkError.NotFound) {
                        unsupported = true
                    } else {
                        // No connection, or Moments just went off: no rings change; they are asked about again later.
                        ids.forEach { answeredAt.remove(it) }
                    }
            }
        }

        private companion object {
            const val KEEP_MS = 60_000L
            const val GATHER_MS = 120L
            const val MOST_PER_REQUEST = 100
        }
    }
