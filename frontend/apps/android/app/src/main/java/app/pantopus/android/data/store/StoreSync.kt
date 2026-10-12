package app.pantopus.android.data.store

import android.os.SystemClock
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.realtime.SocketManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import timber.log.Timber
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/** Contract §6: coming back to the app after this long marks every entry out of date. */
private const val AWAY_MS = 15 * 60 * 1000L

private const val EVENT = "sync:changed"

private val UUID = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

/**
 * Instant Screens contract §8, the change signal. `sync:changed {topics}` from the server marks the named entries out
 * of date; after the socket reconnects, every household, Messages and notifications entry is marked (signals may have
 * been missed meanwhile); coming back to the app after 15 minutes marks everything. Screens on show read again through
 * [ScreenStore.changes]. Nothing depends on a signal arriving: the freshness windows still apply.
 */
@Singleton
class StoreSync
    @Inject
    constructor(
        private val socket: SocketManager,
        private val store: ScreenStore,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        private val started = AtomicBoolean(false)

        @Volatile
        private var backgroundedAt = 0L

        /** Starts listening, once per process. */
        fun start() {
            if (!started.compareAndSet(false, true)) return
            scope.launch {
                socket.eventsOf(EVENT).collect { payload ->
                    val topics = topicsOf(payload)
                    if (BuildConfig.DEBUG) Timber.tag("ISStore").d("%s %s", EVENT, topics.map { it.replace(UUID, ":id") })
                    topics.forEach(store::markStale)
                }
            }
            scope.launch {
                socket.eventsOf("notification:new").collect { store.markStale(StoreTopics.NOTIFICATIONS) }
            }
            scope.launch {
                socket.eventsOf("badge:update").collect { store.markStale(StoreTopics.NOTIFICATIONS) }
            }
            scope.launch {
                var connectedBefore = false
                socket.connectionState.collect { state ->
                    if (state != SocketManager.ConnectionState.Connected) return@collect
                    if (connectedBefore) store.markStale(CATCH_UP_KINDS)
                    connectedBefore = true
                }
            }
        }

        /** The app left the foreground. */
        fun backgrounded(now: Long = SystemClock.elapsedRealtime()) {
            backgroundedAt = now
        }

        /** The app came back: after 15 minutes away, everything is read again as screens show it. */
        fun foregrounded(now: Long = SystemClock.elapsedRealtime()) {
            val since = backgroundedAt
            backgroundedAt = 0L
            if (since > 0L && now - since >= AWAY_MS) store.markStale(StoreKind.entries.toSet())
        }

        private companion object {
            /** What a reconnect re-checks: household data, the Messages list and notifications. */
            val CATCH_UP_KINDS: Set<StoreKind> =
                StoreKind.entries.filter { it.tier == StoreTier.HOUSEHOLD || it == StoreKind.NOTIFICATIONS }.toSet()
        }
    }

/** The payload's topic names (`{"topics": ["home:…", "today"], "at": …}`); no content and no names ride along. */
private fun topicsOf(payload: JSONObject): List<String> {
    val topics = payload.optJSONArray("topics") ?: return emptyList()
    return (0 until topics.length()).mapNotNull { index -> topics.optString(index).takeIf { it.isNotBlank() } }
}
