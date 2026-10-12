package app.pantopus.android.data.store

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.os.SystemClock
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.net.Conditional
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

/** Contract §6 "Memory": at most this many entries… */
private const val MAX_ENTRIES = 200

/** …and an entry nobody has used for 30 minutes goes. */
private const val IDLE_MS = 30 * 60 * 1000L

/**
 * The app's one cache of server replies for screens (Instant Screens contract §6): a [StateFlow] per [StoreKey],
 * scoped to this server and the signed-in account. Screens read from here and never keep their own copy.
 *
 * - **Read:** the copy in memory shows at once; a request goes out only when the copy is out of date (its kind's
 *   "fresh for" window passed, or a topic marked it) or the read is forced (pull to refresh, Retry).
 * - **One request per key:** concurrent reads share the one in flight, which finishes even if the screen that
 *   started it leaves, so the next visit finds the reply.
 * - **Conditional:** a read sends the stored ETag; a 304 keeps the copy and counts it as checked now.
 * - **Failures:** a 401, 403 or 404 deletes the entry, so the screen shows the server's answer; other failures keep
 *   the copy and marks it.
 * - **Late replies are dropped:** a reply that lands after [wipe], or after the account or session changed, never
 *   writes into the new state (generation number plus the account and session marker captured at the start).
 * - **Memory:** at most [MAX_ENTRIES] entries, unused ones go after 30 minutes, and a memory warning trims the store
 *   to what screens are showing.
 *
 * Sensitive replies (contract §5) never enter the store: their screens keep calling the repository directly.
 */
@Singleton
@Suppress("TooManyFunctions") // Read, write, invalidation and eviction share the same account/generation lock.
class ScreenStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val tokens: TokenStorage,
        private val auth: Provider<AuthRepository>,
        private val saved: SavedCopies,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        // Least recently used first (access order); guarded by itself.
        private val slots = LinkedHashMap<String, Slot>(MAX_ENTRIES, LOAD_FACTOR, true)

        @Volatile
        private var generation = 0L

        // Guards the saved copy: a write checks the generation and the entry's edits under it, and a wipe or a delete
        // runs under it, so a write queued before them can't put a copy back afterwards.
        private val diskLock = Any()

        private val _changes = MutableStateFlow(0L)

        /**
         * Moves whenever a topic or a kind marks entries out of date (contract §8): screens on show read again, and a
         * read answers the entries nobody marked without a request.
         */
        val changes: StateFlow<Long> = _changes.asStateFlow()

        private class Slot(
            val key: StoreKey<*>,
        ) {
            val state = MutableStateFlow(Stored<Any>())
            var etag: String? = null
            var stale = false

            /** Own edits (`put`, `remove`) and ended access: a read that started before one never overwrites it. */
            @Volatile
            var edits = 0L

            /** Topic marks: a reply to a read that started before one is kept but stays out of date. */
            var marks = 0L

            /** The entry may be written to the phone (its kind allows it, and the last reader said the viewer may). */
            @Volatile
            var persist = false
            var inFlight: Deferred<Unit>? = null
            var lastUsed = SystemClock.elapsedRealtime()

            val removable: Boolean get() = state.subscriptionCount.value == 0 && inFlight?.isActive != true

            fun markStaleLocked() {
                stale = true
                marks++
            }

            /** An evicted slot cannot finish a queued disk write after a newer slot has refused the same key. */
            fun retire() {
                edits++
                persist = false
                inFlight?.cancel()
            }
        }

        /** What a read captured when it started (see [settle]). */
        private data class Ticket(
            val generation: Long,
            val identity: String?,
            val edits: Long,
            val marks: Long,
        )

        init {
            context.registerComponentCallbacks(
                object : ComponentCallbacks2 {
                    // Every level but "the UI went away" is the phone asking for memory back.
                    override fun onTrimMemory(level: Int) {
                        if (level != ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) trimToVisible()
                    }

                    override fun onConfigurationChanged(newConfig: Configuration) = Unit

                    @Deprecated("Deprecated in Java")
                    override fun onLowMemory() = trimToVisible()
                },
            )
        }

        /** The entry's live state, for a screen to collect. Asking sends nothing; [read] fills it. */
        fun <T : Any> state(key: StoreKey<T>): StateFlow<Stored<T>> {
            val account = accountId() ?: return MutableStateFlow(Stored())
            return synchronized(slots) { slotLocked(key, account).state }.cast()
        }

        /** The entry as it is now, without a request. */
        fun <T : Any> peek(key: StoreKey<T>): Stored<T> = state(key).value

        /** True while the entry's copy is fresh and no topic marked it out of date: a read would send nothing. */
        fun isCurrent(key: StoreKey<*>): Boolean {
            val account = accountId() ?: return false
            return synchronized(slots) {
                val slot = slots["$account|${key.id}"] ?: return@synchronized false
                !slot.stale && slot.state.value.isFresh(key.kind)
            }
        }

        /**
         * Returns the copy when it is fresh; otherwise reads it (sharing a read already in flight) and returns what the
         * store holds afterwards. [force] reads even a fresh copy (pull to refresh, Retry, after an own edit). [fetch]
         * gets the stored ETag (null without a copy) and calls the endpoint through `conditionalApiCall`.
         */
        suspend fun <T : Any> read(
            key: StoreKey<T>,
            force: Boolean = false,
            persist: Boolean = key.kind.tier == StoreTier.EVERYDAY,
            fetch: suspend (etag: String?) -> NetworkResult<Conditional<T>>,
        ): Stored<T> {
            val account = accountId() ?: return readSignedOut(fetch)
            val (slot, job) =
                synchronized(slots) {
                    val slot = slotLocked(key, account)
                    // Founder decision 3: a household entry stays on the phone only while its reader vouches for the
                    // viewer. A reader that no longer does (the viewer became a guest, or the access now expires)
                    // takes the saved copy away.
                    val vouched = persist && key.savable
                    val unsave = slot.persist && !vouched
                    slot.persist = vouched
                    if (unsave) {
                        // Retire queued writes and reads from the previous access decision before a later reader
                        // can enable persistence again.
                        slot.edits++
                        slot.inFlight?.cancel()
                        slot.inFlight = null
                        deleteSaved(key.id, account)
                    }
                    val current = slot.state.value
                    if (!force && !slot.stale && current.isFresh(key.kind)) return current.cast()
                    val running = slot.inFlight?.takeIf { it.isActive }
                    if (running != null) return@synchronized slot to running
                    val ticket = Ticket(generation, identity(account), slot.edits, slot.marks)
                    val etag = slot.etag.takeIf { current.data != null }
                    slot.state.value = current.copy(refreshing = true)
                    val job = scope.async { settle(slot, fetchSafely(fetch, etag), ticket) }
                    slot.inFlight = job
                    slot to job
                }
            try {
                job.await()
            } catch (cancelled: CancellationException) {
                // A wipe cancels reads in flight; only the caller's own cancellation goes on up.
                if (!currentCoroutineContext().isActive) throw cancelled
            }
            return slot.state.value.cast()
        }

        /**
         * Marks every entry carrying [topic] out of date (contract §8): the next read of it sends a request. A key
         * topic ending in `:*` (a list's "supporttrain:*") matches every topic with that prefix.
         */
        fun markStale(topic: String) {
            synchronized(slots) { slots.values.forEach { if (it.key.matches(topic)) it.markStaleLocked() } }
            _changes.update { it + 1 }
        }

        /** An own write without a full replacement: retire earlier reads and saved copies before revalidation. */
        fun markEdited(topic: String) {
            synchronized(slots) {
                slots.values.filter { it.key.matches(topic) }.forEach { slot ->
                    slot.edits++
                    slot.markStaleLocked()
                    slot.etag = null
                    slot.inFlight?.cancel()
                    slot.inFlight = null
                    slot.state.value = slot.state.value.copy(refreshing = false)
                    deleteSaved(slot.key.id)
                }
            }
            _changes.update { it + 1 }
        }

        /** Capture before an asynchronous save, so its reply cannot populate another account or a cleared cache. */
        fun <T : Any> writer(key: StoreKey<T>): (T) -> Unit {
            val account = accountId() ?: return {}
            val (slot, ticket) =
                synchronized(slots) {
                    val slot = slotLocked(key, account)
                    slot.edits++
                    slot.etag = null
                    slot.markStaleLocked()
                    slot.inFlight?.cancel()
                    slot.inFlight = null
                    slot.state.value = slot.state.value.copy(refreshing = false)
                    slot to Ticket(generation, identity(account), slot.edits, slot.marks)
                }
            return { data ->
                synchronized(slots) {
                    if (ticket.generation == generation && ticket.identity == identity() && ticket.edits == slot.edits) {
                        val markedMeanwhile = ticket.marks != slot.marks
                        put(key, data)
                        // Another device's change during this save still needs a read, just as during a GET.
                        if (markedMeanwhile) slot.stale = true
                    }
                }
            }
        }

        /** Capture before a direct sensitive read: its refusal cannot erase a newer account's safe summary. */
        fun remover(key: StoreKey<*>): () -> Unit {
            val account = accountId() ?: return {}
            val (slot, ticket) =
                synchronized(slots) {
                    val slot = slotLocked(key, account)
                    slot to Ticket(generation, identity(account), slot.edits, slot.marks)
                }
            return {
                synchronized(slots) {
                    if (ticket.generation == generation && ticket.identity == identity() && ticket.edits == slot.edits) {
                        remove(key)
                    }
                }
            }
        }

        /** A list item tapped now can seed a detail's first frame. It stays in the same bounded, wiped memory store. */
        fun <T : Any> seed(
            key: StoreKey<T>,
            data: T,
        ) {
            val account = accountId() ?: return
            synchronized(slots) {
                val slot = slotLocked(key, account)
                if (slot.state.value.data != null || slot.state.value.failure.refusesStoredCopy) return
                // A seed is never fresh or saved. A read already in flight may still replace it with the complete reply.
                slot.stale = true
                slot.state.value = Stored(data)
            }
        }

        /**
         * Own edit (contract §6): the server's reply to a save becomes the entry, counted as read now. The old ETag no
         * longer names it, so the next read after the window asks without one.
         */
        fun <T : Any> put(
            key: StoreKey<T>,
            data: T,
        ) {
            val account = accountId() ?: return
            synchronized(slots) {
                val slot = slotLocked(key, account)
                slot.edits++
                slot.etag = null
                slot.stale = false
                slot.state.value = Stored(data, fetchedAt = System.currentTimeMillis())
                if (slot.persist || (key.kind.tier == StoreTier.EVERYDAY && key.savable)) {
                    slot.persist = true
                    writeSaved(data, slot, slot.state.value.fetchedAt, etag = null)
                }
            }
        }

        /** Marks every entry of [kinds] out of date, e.g. the household ones after a socket reconnect. */
        fun markStale(kinds: Set<StoreKind>) {
            synchronized(slots) { slots.values.forEach { if (it.key.kind in kinds) it.markStaleLocked() } }
            _changes.update { it + 1 }
        }

        /** Drops one entry, e.g. after the item was deleted. */
        fun remove(key: StoreKey<*>) {
            val account = accountId() ?: return
            synchronized(slots) {
                slots.remove("$account|${key.id}")?.let { slot ->
                    slot.retire()
                    slot.state.value = Stored()
                }
            }
            deleteSaved(key.id, account)
        }

        /**
         * Sign-out (every path through `AuthRepository.finishLocalSignOut`), a revoked or ended session, an account
         * switch or deletion, and Clear cache: everything goes, and the generation moves so replies already in flight
         * can't write into the new state.
         */
        fun wipe() {
            synchronized(slots) {
                generation++
                slots.values.forEach { slot ->
                    slot.retire()
                    slot.state.value = Stored()
                }
                slots.clear()
            }
            // The saved pages too, before anyone else can sign in on this phone.
            synchronized(diskLock) { saved.deleteAll() }
        }

        /** Contract §6: when the phone warns about memory, keep only what screens are showing. */
        fun trimToVisible() {
            synchronized(slots) {
                slots.values.removeAll { slot ->
                    slot.removable.also { if (it) slot.retire() }
                }
            }
        }

        private fun slotLocked(
            key: StoreKey<*>,
            account: String,
        ): Slot {
            val now = SystemClock.elapsedRealtime()
            val slot = slots.getOrPut("$account|${key.id}") { Slot(key).also { loadSavedLocked(it, account) } }
            slot.lastUsed = now
            val iterator = slots.values.iterator()
            while (iterator.hasNext()) {
                val candidate = iterator.next()
                val overLimit = now - candidate.lastUsed > IDLE_MS || slots.size > MAX_ENTRIES
                if (candidate !== slot && overLimit && candidate.removable) {
                    candidate.retire()
                    iterator.remove()
                }
            }
            return slot
        }

        /** Remove the saved entry before returning, so an immediate relaunch cannot restore refused or edited data. */
        private fun deleteSaved(
            keyId: String,
            account: String? = accountId(),
        ) {
            if (account == null) return
            synchronized(diskLock) { saved.delete(account, keyId) }
        }

        /** A new entry starts from its saved copy on the phone, when there is a usable one (contract §6 "Read"). */
        private fun loadSavedLocked(
            slot: Slot,
            account: String,
        ) {
            val type = slot.key.type ?: return
            if (!slot.key.savable) return
            val copy = saved.load<Any>(account, slot.key.id, type) ?: return
            if (!slot.key.permitsSavedCopy(copy.data)) {
                deleteSaved(slot.key.id, account)
                return
            }
            slot.etag = copy.etag
            slot.persist = true
            slot.state.value = Stored(copy.data, fetchedAt = copy.fetchedAt)
        }

        /** Writes a confirmed reply to the phone off the caller's thread, when the entry may be saved. */
        private fun writeSaved(
            data: Any?,
            slot: Slot,
            fetchedAt: Long,
            etag: String? = slot.etag,
        ) {
            val account = accountId() ?: return
            if (data == null || !slot.persist) return
            if (!slot.key.permitsSavedCopy(data)) {
                slot.edits++
                slot.persist = false
                deleteSaved(slot.key.id, account)
                return
            }
            val type = slot.key.type ?: return
            val edits = slot.edits
            val gen = generation
            scope.launch {
                synchronized(diskLock) {
                    // A wipe, a newer own edit, ended access or a reader that stopped vouching for the viewer since
                    // this reply was settled: it is not written.
                    if (gen == generation && edits == slot.edits && slot.persist) {
                        saved.save(account, slot.key.id, type, data, fetchedAt, etag)
                    }
                }
            }
        }

        private suspend fun <T : Any> fetchSafely(
            fetch: suspend (etag: String?) -> NetworkResult<Conditional<T>>,
            etag: String?,
        ): NetworkResult<Conditional<T>> =
            try {
                fetch(etag)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // A guard that refused to send (session changed mid-read) or a bug: the copy stays.
                Timber.w(error, "store read failed")
                NetworkResult.Failure(NetworkError.Transport(error))
            }

        private fun <T : Any> settle(
            slot: Slot,
            result: NetworkResult<Conditional<T>>,
            ticket: Ticket,
        ) {
            synchronized(slots) {
                // Late reply (contract §5): the store was wiped, another account or session signed in, or an own
                // edit replaced the entry meanwhile. Nothing is written; an entry still in the store just stops
                // showing a read in progress.
                if (ticket.generation != generation || ticket.identity != identity() || ticket.edits != slot.edits) {
                    if (ticket.generation == generation) slot.state.value = slot.state.value.copy(refreshing = false)
                    return
                }
                // A topic marked the entry while the read was out: the reply is kept, and the next read asks again.
                val markedMeanwhile = ticket.marks != slot.marks
                val previous = slot.state.value
                val now = System.currentTimeMillis()
                slot.state.value =
                    when (result) {
                        is NetworkResult.Success ->
                            when (val reply = result.data) {
                                is Conditional.Fresh -> {
                                    slot.etag = reply.etag
                                    slot.stale = markedMeanwhile
                                    Stored(reply.data, fetchedAt = now).also { writeSaved(it.data, slot, now) }
                                }
                                Conditional.NotModified -> {
                                    slot.stale = markedMeanwhile
                                    previous.copy(fetchedAt = now, refreshing = false, failure = null).also {
                                        writeSaved(it.data, slot, now)
                                    }
                                }
                            }
                        is NetworkResult.Failure ->
                            if (
                                result.error.refusesStoredCopy
                            ) {
                                // Access ended: the entry goes at once, from the phone too, and the screen shows
                                // the server's answer.
                                slot.etag = null
                                slot.edits++
                                deleteSaved(slot.key.id)
                                Stored(failure = result.error)
                            } else {
                                previous.copy(refreshing = false, failure = result.error)
                            }
                    }
                if (BuildConfig.DEBUG) Timber.tag("ISStore").d("%s → %s", slot.key.id.replace(UUID, ":id"), slot.state.value.describe())
                // The visible reader may have consumed a topic signal by joining this older flight. Release it
                // before notifying again, so that reader rechecks the newer version instead of joining it twice.
                // No signal without a newer mark: failed reads do not create a retry loop.
                slot.inFlight = null
                if (markedMeanwhile && !slot.state.value.failure.refusesStoredCopy) _changes.update { it + 1 }
            }
        }

        private suspend fun <T : Any> readSignedOut(fetch: suspend (etag: String?) -> NetworkResult<Conditional<T>>): Stored<T> =
            when (val result = fetchSafely(fetch, null)) {
                is NetworkResult.Success ->
                    when (val reply = result.data) {
                        is Conditional.Fresh -> Stored(reply.data, fetchedAt = System.currentTimeMillis())
                        Conditional.NotModified -> Stored()
                    }
                is NetworkResult.Failure -> Stored(failure = result.error)
            }

        private fun accountId(): String? = (auth.get().state.value as? AuthRepository.State.SignedIn)?.user?.id

        /** Server, account and session marker: never a token, never logged. */
        private fun identity(account: String? = accountId()): String? =
            account?.let { "${BuildConfig.PANTOPUS_API_BASE_URL}|$it|${tokens.sessionMarker()}" }

        private companion object {
            const val LOAD_FACTOR = 0.75f
        }
    }

@Suppress("UNCHECKED_CAST")
private fun <T : Any> Stored<Any>.cast(): Stored<T> = this as Stored<T>

@Suppress("UNCHECKED_CAST")
private fun <T : Any> StateFlow<Stored<Any>>.cast(): StateFlow<Stored<T>> = this as StateFlow<Stored<T>>

private val UUID = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

/** Debug log text: what the entry holds, never its content. */
private fun Stored<*>.describe(): String =
    when {
        data != null && failure != null -> "copy kept, read failed (${failure.code ?: "network"})"
        data != null -> "fresh copy"
        failure != null -> "no copy (${failure.code ?: "network"})"
        else -> "empty"
    }
