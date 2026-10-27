package app.pantopus.android.data.store

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.os.SystemClock
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
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
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

/** Contract §6 "Memory": at most this many entries… */
private const val MAX_ENTRIES = 200

/** …and an entry nobody has used for 30 minutes goes. */
private const val IDLE_MS = 30 * 60 * 1000L

/**
 * A chat copy changed in memory (a send's acceptance, its echo, receipts, a read) is written once the burst settles,
 * not once per change and not in the way of the next send's encrypted save.
 */
private const val CHAT_COPY_SETTLE_MS = 500L

/** A copy read ahead at launch is for the first screens: one no screen opened within a minute is read from its file. */
private const val READ_AHEAD_MS = 60 * 1000L

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
 * - **Launch:** the first screens' saved copies are read ahead off the main thread ([readAhead]), so their first
 *   frames don't read and decode files.
 *
 * Sensitive replies (contract §5) never enter the store: their screens keep calling the repository directly.
 */
@Singleton
@Suppress("TooManyFunctions", "LargeClass") // Read, write, invalidation and eviction share the same account/generation lock.
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

            @Volatile
            var stale = false

            /** Own edits (`put`, `remove`) and ended access: a read that started before one never overwrites it. */
            @Volatile
            var edits = 0L

            /** Topic marks: a reply to a read that started before one is kept but stays out of date. */
            var marks = 0L

            /** Inbox message/preference changes are distinct from a read's own generic chat sync signal. */
            var chatListRevision = 0L

            /** Live memory updates must not hide an access refusal from a read already in flight. */
            @Volatile
            var memoryEdits = 0L
            var badgeEdits = 0L
            var refusals = 0L

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
            val memoryEdits: Long = 0L,
            val badgeEdits: Long = 0L,
        )

        /** A mark whose saved-copy work is still queued: a load before it lands applies the mark itself. */
        private class DiskMark(
            val account: String,
            val mark: SavedCopies.Mark,
        ) {
            fun covers(
                key: StoreKey<*>,
                copy: SavedCopies.Copy<*>,
            ): Boolean =
                copy.fetchedAt <= mark.upTo &&
                    (copy.legacy || key.kind in mark.kinds || mark.topic?.let(key::matches) == true)
        }

        // Guarded by slots.
        private val pendingDiskMarks = mutableListOf<DiskMark>()

        /** A saved copy [readAhead] read before its entry opened, and the marks queued for its account since. */
        private class ReadAhead(
            val account: String,
            val key: StoreKey<*>,
            val copy: SavedCopies.Copy<Any>,
            val until: Long,
        ) {
            val marks = mutableListOf<DiskMark>()
        }

        // Guarded by slots: the copies read ahead ("account|key id"), and a count of the removals, retirements, marks
        // and wipes, so a copy read while one happened is not kept.
        private val readAheads = HashMap<String, ReadAhead>()
        private var savedChanges = 0L

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

        /**
         * Launch (contract §6 "Read"): reads [key]'s saved copy for [account] on the caller's thread, never the main one,
         * before a screen asks for it, and returns its reply. The entry that opens for it within a minute starts from this
         * copy instead of reading and decoding the file on the screen's thread; marks queued meanwhile still apply, and a
         * removal, a retirement or a wipe drops it. Null without a usable copy, or when the entry is already open.
         */
        fun <T : Any> readAhead(
            key: StoreKey<T>,
            account: String,
        ): T? {
            val type = key.type?.takeIf { key.savable } ?: return null
            val id = "$account|${key.id}"
            val changes =
                synchronized(slots) {
                    savedChanges.takeUnless { id in slots || id in readAheads || pendingDiskMarks.isNotEmpty() }
                } ?: return null
            val copy = saved.load<Any>(account, key.id, type, kind = key.kind) ?: return null
            val kept =
                synchronized(slots) {
                    // Not when the saved copies changed while this one was read, or its screen opened it meanwhile.
                    (changes == savedChanges && id !in slots).also { current ->
                        if (current) readAheads[id] = ReadAhead(account, key, copy, SystemClock.elapsedRealtime() + READ_AHEAD_MS)
                    }
                }
            @Suppress("UNCHECKED_CAST")
            return (copy.data as T).takeIf { kept }
        }

        class ChatMediaAccess internal constructor(
            val read: () -> SavedCopies.MediaCopy?,
            val write: (SavedCopies.MediaCopy) -> Unit,
            val isCurrent: () -> Boolean,
            val refuse: () -> Unit,
            /** The file is gone on the server: its saved copies (the file and its thumbnail) go too. */
            val forget: () -> Unit = {},
        )

        /** Bind a binary fetch to the same durable access epoch as the history that made it visible. */
        fun chatMediaAccess(key: String): ChatMediaAccess? =
            synchronized(slots) {
                val account = accountId() ?: return@synchronized null
                val gen = generation
                val session = identity(account)
                val namespace = synchronized(diskLock) { saved.mediaNamespace(account) }

                fun current(): Boolean = gen == generation && session == identity() && saved.mediaNamespace(account) == namespace
                ChatMediaAccess(
                    read = {
                        synchronized(slots) { synchronized(diskLock) { if (current()) saved.loadMedia(account, key) else null } }
                    },
                    write = {
                            copy ->
                        synchronized(slots) { synchronized(diskLock) { if (current()) saved.saveMedia(account, key, copy) } }
                    },
                    isCurrent = { synchronized(slots) { synchronized(diskLock) { current() } } },
                    refuse = { synchronized(slots) { if (synchronized(diskLock) { current() }) retireChatLocked(account) } },
                    forget = { synchronized(slots) { synchronized(diskLock) { saved.forgetMedia(account, key) } } },
                )
            }

        /** True while the entry's copy is fresh and no topic marked it out of date: a read would send nothing. */
        fun isCurrent(key: StoreKey<*>): Boolean {
            val account = accountId() ?: return false
            return synchronized(slots) {
                val slot = slots["$account|${key.id}"] ?: return@synchronized false
                !slot.stale && slot.state.value.isFresh(key.kind)
            }
        }

        /**
         * Shares a read already in flight, otherwise returns a fresh copy or reads it and returns what the store
         * holds afterwards. [force] reads even a fresh copy (pull to refresh, Retry, after an own edit). [fetch]
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
                    val running = slot.inFlight?.takeIf { it.isActive }
                    if (running != null) return@synchronized slot to running
                    if (!force && !slot.stale && current.isFresh(key.kind)) return current.cast()
                    val ticket = Ticket(generation, identity(account), slot.edits, slot.marks, slot.memoryEdits, slot.badgeEdits)
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
            synchronized(slots) {
                slots.values.forEach {
                    if (it.key.matches(topic)) {
                        if (topic == StoreTopics.CHAT_LIST) it.chatListRevision++
                        it.markStaleLocked()
                    }
                }
                queueDiskMarkLocked(SavedCopies.Mark(topic = topic))
            }
            _changes.update { it + 1 }
        }

        /** An own write retires earlier reads. Ordinary chat writes can retain the encrypted inbox for offline navigation. */
        fun markEdited(
            topic: String,
            retainChatList: Boolean = false,
        ) {
            require(!retainChatList || topic == StoreTopics.CHAT_LIST)
            synchronized(slots) {
                slots.values.filter { it.key.matches(topic) }.forEach { slot ->
                    slot.edits++
                    slot.markStaleLocked()
                    slot.etag = null
                    slot.inFlight?.cancel()
                    slot.inFlight = null
                    slot.state.value = slot.state.value.copy(refreshing = false)
                    if (!retainChatList || slot.key.kind != StoreKind.MESSAGES_LIST) deleteSaved(slot.key.id)
                }
                queueDiskMarkLocked(SavedCopies.Mark(topic = topic, edited = true, retainChatList = retainChatList))
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
                        put(key, data, markedMeanwhile)
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

        /**
         * Keep a live copy in step with confirmed changes, including the encrypted conversation window. Capture before
         * reading or revalidating
         * the screen context. This cannot recreate an evicted, cleared or refused copy, or follow a session switch.
         * Unlike [writer], it leaves an in-flight access check running; a refusal still removes the entire copy.
         */
        fun <T : Any> memoryUpdater(key: StoreKey<T>): (T) -> Unit {
            require(!key.savable || key.kind == StoreKind.CONVERSATION)
            val account = accountId() ?: return {}
            return synchronized(slots) {
                val slot = slotLocked(key, account)
                val gen = generation
                val session = identity(account)
                val refusals = slot.refusals
                val update: (T) -> Unit = { data ->
                    synchronized(slots) live@{
                        val active = gen == generation && session == identity() && slots["$account|${key.id}"] === slot
                        if (!active || refusals != slot.refusals) return@live
                        val current = slot.state.value
                        if (current.data != null && current.data != data) {
                            slot.memoryEdits++
                            slot.etag = null
                            slot.stale = true
                            val now = System.currentTimeMillis()
                            slot.state.value = current.copy(data = data, fetchedAt = now)
                            writeSaved(data, slot, now, etag = null, coalesce = true)
                        }
                    }
                }
                update
            }
        }

        /** Apply a confirmed scoped read to the existing encrypted inbox without overwriting a newer reply. */
        fun <T : Any> chatReadUpdater(key: StoreKey<T>): ((T) -> T) -> Unit {
            require(key.kind == StoreKind.MESSAGES_LIST)
            val account = accountId() ?: return {}
            return synchronized(slots) {
                val slot = slotLocked(key, account)
                val ticket = Ticket(generation, identity(account), slot.edits, slot.marks, slot.memoryEdits)
                val refusals = slot.refusals
                val inboxRevision = slot.chatListRevision
                val before = slot.state.value.data
                val update: ((T) -> T) -> Unit = { project ->
                    synchronized(slots) live@{
                        val active = ticket.generation == generation && ticket.identity == identity()
                        if (!active || slots["$account|${key.id}"] !== slot || refusals != slot.refusals) return@live
                        val unchanged =
                            ticket.edits == slot.edits && ticket.memoryEdits == slot.memoryEdits &&
                                inboxRevision == slot.chatListRevision && before === slot.state.value.data
                        markEdited(StoreTopics.CHAT_LIST, retainChatList = true)
                        if (unchanged && before != null) {
                            @Suppress("UNCHECKED_CAST")
                            val data = project(before as T)
                            slot.memoryEdits++
                            val now = System.currentTimeMillis()
                            slot.state.value = slot.state.value.copy(data = data, fetchedAt = now)
                            writeSaved(data, slot, now, etag = null, coalesce = true)
                        }
                        markStale(StoreTopics.CHATS)
                    }
                }
                update
            }
        }

        /** Capture the session per socket and account/access per event, before a callback can queue across either change. */
        fun chatBadgeUpdater(): () -> (suspend (Int, Int?) -> Boolean) {
            val gen = generation
            // Auth publishes the new socket just before its signed-in UI state, including account return.
            val session = tokens.sessionMarker()
            return {
                synchronized(slots) {
                    val account = accountId()
                    val currentSession = session != null && session == tokens.sessionMarker()
                    if (account == null || gen != generation || !currentSession) {
                        { _, _ -> false }
                    } else {
                        captureBadgeEvent(account)
                    }
                }
            }
        }

        /** Persist only authoritative global totals, preserving rows. An old event cannot repopulate a retired slot. */
        private fun captureBadgeEvent(account: String): suspend (Int, Int?) -> Boolean {
            return synchronized(slots) {
                val slot = slotLocked(StoreKeys.conversations, account)
                val gen = generation
                val session = identity(account)
                val refusals = slot.refusals
                val update: suspend (Int, Int?) -> Boolean = { total, unmuted ->
                    val persisted =
                        withContext(Dispatchers.IO) {
                            synchronized(slots) live@{
                                val active = gen == generation && session == identity() && slots["$account|${slot.key.id}"] === slot
                                if (!active || refusals != slot.refusals) return@live false
                                val previous = slot.state.value.data as? UnifiedConversationsResponse
                                val data =
                                    (previous ?: UnifiedConversationsResponse(emptyList())).copy(
                                        totalUnread = total,
                                        totalUnmutedUnread = unmuted,
                                    )
                                slot.memoryEdits++
                                slot.badgeEdits++
                                slot.etag = null
                                slot.stale = true
                                slot.persist = true
                                val now = System.currentTimeMillis()
                                slot.state.value = slot.state.value.copy(data = data, fetchedAt = now)
                                synchronized(diskLock) { saved.save(account, StoreKeys.conversations, data, now, null, stale = true) }
                                true
                            }
                        }
                    // Resume in the collector's context and recheck after disk work, before it updates visible totals.
                    persisted &&
                        synchronized(slots) {
                            gen == generation && session == identity() &&
                                slots["$account|${slot.key.id}"] === slot && refusals == slot.refusals
                        }
                }
                update
            }
        }

        /** Retain unaffected inbox rows after an edit/delete, guarded by the account and access captured before it. */
        fun <T : Any> chatContentUpdater(
            key: StoreKey<T>,
            expectedAccountId: String?,
        ): suspend ((T) -> T?) -> Unit {
            require(key.kind == StoreKind.MESSAGES_LIST)
            val account = accountId() ?: return {}
            if (expectedAccountId != null && expectedAccountId != account) return {}
            return synchronized(slots) {
                val slot = slotLocked(key, account)
                val gen = generation
                val session = identity(account)
                val refusals = slot.refusals
                val update: suspend ((T) -> T?) -> Unit = { project ->
                    withContext(Dispatchers.IO) {
                        synchronized(slots) live@{
                            val active = gen == generation && session == identity() && slots["$account|${key.id}"] === slot
                            if (!active || refusals != slot.refusals) return@live
                            // Clear the affected preview in the latest copy, including a reply that arrived during the write.
                            // A scoped mutation cannot establish the replacement newest message or any unread totals.
                            @Suppress("UNCHECKED_CAST")
                            val data = slot.state.value.data?.let { project(it as T) }
                            markEdited(StoreTopics.CHAT_LIST, retainChatList = data != null)
                            slot.memoryEdits++
                            val now = System.currentTimeMillis()
                            slot.state.value = slot.state.value.copy(data = data, fetchedAt = now)
                            // Finish retirement/replacement before confirming the edit. A failed write or immediate
                            // process death may lose the offline copy, but can never restore the old deleted preview.
                            synchronized(diskLock) {
                                saved.delete(account, key.id)
                                if (data != null && slot.persist && key.permitsSavedCopy(data)) {
                                    saved.save(account, key, data, now, etag = null, stale = true)
                                }
                            }
                            markStale(StoreTopics.CHATS)
                        }
                    }
                }
                update
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
        ) = put(key, data, markedWhileSaving = false)

        private fun <T : Any> put(
            key: StoreKey<T>,
            data: T,
            markedWhileSaving: Boolean,
        ) {
            val account = accountId() ?: return
            synchronized(slots) {
                val slot = slotLocked(key, account)
                slot.edits++
                slot.etag = null
                // Another device's change during a save still needs a read, including after eviction or relaunch.
                slot.stale = markedWhileSaving
                slot.state.value = Stored(data, fetchedAt = System.currentTimeMillis())
                if (slot.persist || (key.kind.tier == StoreTier.EVERYDAY && key.savable)) {
                    slot.persist = true
                    writeSaved(data, slot, slot.state.value.fetchedAt, etag = null)
                }
            }
        }

        /** Marks every entry of [kinds] out of date, e.g. the household ones after a socket reconnect. */
        fun markStale(kinds: Set<StoreKind>) {
            synchronized(slots) {
                slots.values.forEach {
                    if (it.key.kind in kinds) {
                        if (it.key.kind == StoreKind.MESSAGES_LIST) it.chatListRevision++
                        it.markStaleLocked()
                    }
                }
                queueDiskMarkLocked(SavedCopies.Mark(kinds = kinds))
            }
            _changes.update { it + 1 }
        }

        /** Screens on show read again without marking anything: an entry still fresh and unmarked sends nothing. */
        fun recheckShown() {
            _changes.update { it + 1 }
        }

        /** Drops one entry, e.g. after the item was deleted. */
        fun remove(key: StoreKey<*>) {
            val account = accountId() ?: return
            synchronized(slots) {
                if (key.kind == StoreKind.CONVERSATION || key.kind == StoreKind.MESSAGES_LIST) {
                    retireChatLocked(account)
                    return
                }
                // A copy read ahead, or one still being read, can't bring the entry back.
                readAheads.remove("$account|${key.id}")
                savedChanges++
                slots.remove("$account|${key.id}")?.let { slot ->
                    slot.retire()
                    slot.state.value = Stored()
                }
            }
            deleteSaved(key.id, account)
        }

        /** Capture before recovery. Confirmed room removal must survive a later-page failure or immediate process death. */
        fun chatAccessRetirer(): suspend (Set<String>) -> Unit {
            val account = accountId() ?: return {}
            val gen = generation
            val session = identity(account)
            return { roomIds ->
                if (roomIds.isNotEmpty()) {
                    withContext(Dispatchers.IO + NonCancellable) {
                        synchronized(slots) retire@{
                            if (gen != generation || session != identity()) return@retire
                            retireChatLocked(account)
                        }
                    }
                    _changes.update { it + 1 }
                }
            }
        }

        /**
         * Capture before a Read correction. Only the saved windows of [paths] (every query: a person's All window and each
         * topic, a room for each identity) retire, durably before this returns; the inbox (it holds no Read stamps), other
         * conversations and received files stay readable offline. If that can't be recorded, the account's chat copies
         * retire as for ended access.
         */
        fun chatThreadRetirer(): suspend (Set<String>) -> Unit {
            val account = accountId() ?: return {}
            val gen = generation
            val session = identity(account)
            return { paths ->
                if (paths.isNotEmpty()) {
                    withContext(Dispatchers.IO + NonCancellable) {
                        synchronized(slots) retire@{
                            if (gen != generation || session != identity()) return@retire
                            retireThreadsLocked(account, paths)
                        }
                    }
                    _changes.update { it + 1 }
                }
            }
        }

        private fun retireThreadsLocked(
            account: String,
            paths: Set<String>,
        ) {
            val retiring = slots.entries.filter { (id, slot) -> id.startsWith("$account|") && slot.key.path in paths }
            // Fence first: a queued write or a read in flight from before the correction can't land in the new epoch.
            retiring.forEach { it.value.retire() }
            readAheads.values.removeAll { it.account == account && it.key.path in paths }
            savedChanges++
            try {
                synchronized(diskLock) { saved.retireChatThreads(account, paths, retiring.map { it.value.key.id }) }
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                Timber.w(error, "chat thread retirement failed; retiring the account's chat copies")
                retireChatLocked(account)
                return
            }
            retiring.forEach { (id, slot) ->
                slot.state.value = Stored()
                slots.remove(id)
            }
        }

        /** All encrypted topic variants retire atomically; drafts and queued uploads use a separate store. */
        private fun retireChatLocked(account: String) {
            val iterator = slots.values.iterator()
            while (iterator.hasNext()) {
                val slot = iterator.next()
                if (slot.key.kind == StoreKind.CONVERSATION || slot.key.kind == StoreKind.MESSAGES_LIST) {
                    slot.retire()
                    slot.state.value = Stored()
                    iterator.remove()
                }
            }
            readAheads.values.removeAll {
                it.account == account && (it.key.kind == StoreKind.CONVERSATION || it.key.kind == StoreKind.MESSAGES_LIST)
            }
            savedChanges++
            synchronized(diskLock) { saved.retireChat(account) }
        }

        /**
         * Sign-out (every path through `AuthRepository.finishLocalSignOut`), a revoked or ended session, an account
         * switch or deletion, and Clear cache: everything goes, and the generation moves so replies already in flight
         * can't write into the new state.
         */
        fun wipe() {
            synchronized(slots) {
                generation++
                pendingDiskMarks.clear()
                readAheads.clear()
                savedChanges++
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
                readAheads.clear()
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

        /**
         * Saved copies without a memory slot learn [mark] on the IO scope, never on the caller's thread (the main thread
         * on resume, or a tap's own edit). Only copies fetched at or before the mark are touched.
         */
        private fun queueDiskMarkLocked(mark: SavedCopies.Mark) {
            val account = accountId() ?: return
            val pending = DiskMark(account, mark.copy(upTo = System.currentTimeMillis()))
            pendingDiskMarks += pending
            // A copy read ahead learns the mark as its file will; one still being read is not kept.
            readAheads.values.forEach { if (it.account == account) it.marks += pending }
            savedChanges++
            val gen = generation
            scope.launch {
                try {
                    saved.invalidate(account, pending.mark) { work ->
                        // One file at a time, so a delete on the main thread waits for one file at most.
                        synchronized(diskLock) { if (gen == generation) work() }
                    }
                } finally {
                    synchronized(slots) { pendingDiskMarks.remove(pending) }
                }
            }
        }

        /** Remove the saved entry before returning, so an immediate relaunch cannot restore refused or edited data. */
        private fun deleteSaved(
            keyId: String,
            account: String? = accountId(),
        ) {
            if (account == null) return
            synchronized(diskLock) { saved.delete(account, keyId) }
        }

        /**
         * A new entry starts from its saved copy on the phone, when there is a usable one (contract §6 "Read"): the copy
         * read ahead at launch, with the marks queued since, else the file.
         */
        private fun loadSavedLocked(
            slot: Slot,
            account: String,
        ) {
            val type = slot.key.type ?: return
            if (!slot.key.savable) return
            val ahead = readAheads.remove("$account|${slot.key.id}")?.takeIf { SystemClock.elapsedRealtime() < it.until }
            val copy = ahead?.copy ?: saved.load<Any>(account, slot.key.id, type, kind = slot.key.kind) ?: return
            if (!slot.key.permitsSavedCopy(copy.data)) {
                deleteSaved(slot.key.id, account)
                return
            }
            val marks = (pendingDiskMarks + ahead?.marks.orEmpty()).filter { it.account == account && it.covers(slot.key, copy) }
            val edited = marks.any { it.mark.edited }
            val retired = marks.any { it.mark.edited && !(it.mark.retainChatList && slot.key.kind == StoreKind.MESSAGES_LIST) }
            // A queued own edit retires a current-format copy (its disk work is deleting the file): it is not shown.
            if (!retired || copy.legacy) {
                slot.etag = copy.etag.takeUnless { edited }
                // A process can end before its queued disk mark finishes. Always revalidate a restored inbox
                // online while keeping its encrypted rows available when the connection is down.
                slot.stale = copy.stale || marks.isNotEmpty() || slot.key.kind == StoreKind.MESSAGES_LIST
                slot.persist = true
                slot.state.value = Stored(copy.data, fetchedAt = copy.fetchedAt)
            }
        }

        /**
         * Writes a confirmed reply to the phone off the caller's thread, when the entry may be saved. With [coalesce], the
         * write waits for a burst of in-memory chat changes to end and is skipped when a newer change, another read or
         * any retirement has replaced [data] meanwhile.
         */
        private fun writeSaved(
            data: Any?,
            slot: Slot,
            fetchedAt: Long,
            etag: String? = slot.etag,
            coalesce: Boolean = false,
        ) {
            val account = accountId() ?: return
            if (data == null || !slot.persist) return
            if (!slot.key.permitsSavedCopy(data)) {
                slot.edits++
                slot.persist = false
                deleteSaved(slot.key.id, account)
                return
            }
            if (slot.key.type == null) return
            val edits = slot.edits
            val liveEdits = slot.memoryEdits
            val gen = generation
            scope.launch {
                if (coalesce) delay(CHAT_COPY_SETTLE_MS)
                synchronized(diskLock) {
                    // A wipe, a newer own edit, ended access or a reader that stopped vouching for the viewer since
                    // this reply was settled: it is not written.
                    val current = gen == generation && edits == slot.edits && liveEdits == slot.memoryEdits && slot.persist
                    if (current && (!coalesce || slot.state.value.data === data)) {
                        saved.save(account, slot.key, data, fetchedAt, etag, slot.stale)
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
                val updatedMeanwhile = ticket.memoryEdits != slot.memoryEdits
                val previous = slot.state.value
                val now = System.currentTimeMillis()
                slot.state.value =
                    when (result) {
                        is NetworkResult.Success ->
                            when (val reply = result.data) {
                                is Conditional.Fresh -> settleFresh(slot, reply, ticket, now)
                                Conditional.NotModified -> {
                                    slot.stale = markedMeanwhile || updatedMeanwhile
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
                                slot.refusals++
                                if (slot.key.kind == StoreKind.CONVERSATION || slot.key.kind == StoreKind.MESSAGES_LIST) {
                                    accountId()?.let(::retireChatLocked)
                                } else {
                                    deleteSaved(slot.key.id)
                                }
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

        private fun <T : Any> settleFresh(
            slot: Slot,
            reply: Conditional.Fresh<T>,
            ticket: Ticket,
            now: Long,
        ): Stored<Any> {
            val updatedMeanwhile = ticket.memoryEdits != slot.memoryEdits
            slot.etag = reply.etag.takeUnless { updatedMeanwhile }
            slot.stale = ticket.marks != slot.marks || updatedMeanwhile
            val onlyBadgeChanged = updatedMeanwhile && ticket.memoryEdits + slot.badgeEdits - ticket.badgeEdits == slot.memoryEdits
            val totals = slot.state.value.data as? UnifiedConversationsResponse
            if (onlyBadgeChanged && reply.data is UnifiedConversationsResponse && totals != null) {
                val combined = reply.data.copy(totalUnread = totals.totalUnread, totalUnmutedUnread = totals.totalUnmutedUnread)
                return Stored(combined, fetchedAt = now).also { writeSaved(combined, slot, now, etag = null) }
            }
            // A successful older read cannot overwrite live changes that landed while it was in flight.
            return if (updatedMeanwhile) {
                slot.state.value.copy(refreshing = false, failure = null)
            } else {
                Stored(reply.data, fetchedAt = now).also { writeSaved(it.data, slot, now) }
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
