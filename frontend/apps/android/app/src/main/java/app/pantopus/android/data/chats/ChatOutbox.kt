package app.pantopus.android.data.chats

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import app.pantopus.android.data.api.models.chats.ChatMessageDto
import app.pantopus.android.data.api.models.chats.FindOrCreateTopicBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import timber.log.Timber
import java.net.HttpURLConnection.HTTP_BAD_REQUEST
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** One account's ordered, durable outgoing queue. Network work does not occupy the composer's Send button. */
@Singleton
@Suppress("TooManyFunctions") // Draft promotion and delivery share one account-scoped writer and logout boundary.
class ChatOutbox
    @Inject
    constructor(
        private val store: ChatOutboxStore,
        private val tokens: TokenStorage,
        private val repo: ChatRepository,
        private val uploads: UploadRepository,
        private val socket: SocketManager,
        @ApplicationContext private val context: Context,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val lock = Mutex()
        private val wake = Channel<Unit>(Channel.CONFLATED)
        private val _entries = MutableStateFlow<List<ChatOutboxEntry>>(emptyList())
        val entries = _entries.asStateFlow()
        private val _accepted = MutableSharedFlow<Pair<ChatSendTarget, ChatMessageDto>>(extraBufferCapacity = MAX_MESSAGES)
        val accepted = _accepted.asSharedFlow()

        @Volatile private var foreground = false

        @Volatile private var backgroundRuns = 0

        @Volatile private var accountRestored = false

        @Volatile private var account: String? = null

        @Volatile private var blockedSession: String? = null

        @Volatile private var generation = 0L
        private var request: Job? = null
        private val draftRevisions = mutableMapOf<Pair<ChatSendTarget, String?>, Long>()

        @Synchronized
        private fun reviseDraft(draft: ChatComposerDraft): Long {
            val key = draft.target to draft.topicId
            val revision = (draftRevisions[key] ?: 0L) + 1L
            draftRevisions[key] = revision
            return revision
        }

        @Synchronized
        private fun isCurrentDraft(
            draft: ChatComposerDraft,
            revision: Long,
        ) = draftRevisions[draft.target to draft.topicId] == revision

        init {
            scope.launch {
                // Hydrate the existing token store before observing its hot flow on a cold start.
                tokens.userId()
                tokens.accessTokenFlow.collect { synchronizeAccount() }
            }
            scope.launch {
                socket.connectionState.collect { state ->
                    if (state == SocketManager.ConnectionState.Connected) {
                        lock.withLock {
                            _entries.value = _entries.value.map { if (it.terminal) it else it.copy(retryAt = 0) }
                        }
                        wake.trySend(Unit)
                    }
                }
            }
            scope.launch { drain() }
            scope.launch { _entries.collect { scheduleDelivery() } }
        }

        fun foregrounded() {
            foreground = true
            scope.launch { synchronizeAccount() }
            wake.trySend(Unit)
        }

        fun backgrounded() {
            foreground = false
            scope.launch { scheduleDelivery() }
        }

        /** The platform grants a finite opportunity; foreground and background share the same ordered writer. */
        suspend fun runScheduledDelivery(): Boolean {
            lock.withLock { backgroundRuns++ }
            try {
                synchronizeAccount()
                wake.trySend(Unit)
                withTimeoutOrNull(BACKGROUND_BUDGET_MS) { entries.first { pending -> pending.none { !it.terminal } } }
            } finally {
                withContext(NonCancellable) {
                    lock.withLock {
                        backgroundRuns--
                        // A stopped job must release its upload/send. Lost acceptance is retried with the durable id.
                        if (!foreground && backgroundRuns == 0) request?.cancel()
                    }
                    wake.trySend(Unit)
                }
            }
            return _entries.value.any { !it.terminal }
        }

        fun hasPendingDelivery(): Boolean = !accountRestored || _entries.value.any { !it.terminal }

        /** One persisted job carries no account, credentials, body or attachment path in its system metadata. */
        @Synchronized
        private fun scheduleDelivery() {
            runCatching { scheduleDeliveryIfNeeded() }
                .onFailure { Timber.w("Background chat delivery was not scheduled") }
        }

        private fun scheduleDeliveryIfNeeded() {
            if (!accountRestored || backgroundRuns > 0) return
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            val next = _entries.value.filterNot { it.terminal }.minOfOrNull { it.retryAt }
            if (next == null) {
                scheduler.cancel(DELIVERY_JOB_ID)
                return
            }
            if (scheduler.getPendingJob(DELIVERY_JOB_ID) != null) return
            val job =
                JobInfo.Builder(DELIVERY_JOB_ID, ComponentName(context, ChatOutboxJobService::class.java))
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setMinimumLatency((next - System.currentTimeMillis()).coerceAtLeast(BACKGROUND_DELAY_MS))
                    .setBackoffCriteria(BACKGROUND_BUDGET_MS, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                    .setPersisted(true)
                    .build()
            if (scheduler.schedule(job) != JobScheduler.RESULT_SUCCESS) Timber.w("Background chat delivery was not scheduled")
        }

        /** Keep draft writes independent of the screen's lifetime, but serialized with logout and sends. */
        fun saveDraft(
            draft: ChatComposerDraft,
            files: List<UploadFile>,
            onFailure: (String) -> Unit,
        ) {
            val revision = reviseDraft(draft)
            scope.launch {
                synchronizeAccount()
                lock.withLock {
                    if (account != draft.target.accountId || !isCurrentDraft(draft, revision)) return@withLock
                    runCatching { store.saveDraft(draft, files) }.onFailure {
                        onFailure("Couldn't save this draft on the device. Free some storage and try again.")
                    }
                }
            }
        }

        suspend fun loadDraft(
            target: ChatSendTarget,
            topicId: String?,
        ): Pair<ChatComposerDraft, List<UploadFile>>? =
            withContext(Dispatchers.IO) {
                synchronizeAccount()
                lock.withLock {
                    if (account != target.accountId) return@withLock null
                    runCatching { store.loadDraft(target, topicId) }.getOrNull()
                }
            }

        private suspend fun synchronizeAccount() {
            val user = tokens.userId()
            val session = tokens.sessionMarker()
            lock.withLock {
                if (session != null && session == blockedSession) return@withLock
                if (user != account) {
                    generation++
                    request?.cancel()
                    account = user
                    _entries.value = if (user == null) emptyList() else store.load(user)
                }
                accountRestored = true
            }
            scheduleDelivery()
            wake.trySend(Unit)
        }

        /** A null result means persisted; failure leaves the caller's original composer text and files intact. */
        @Suppress("TooGenericExceptionCaught") // Storage and Keystore providers expose several platform exception types.
        suspend fun enqueue(
            entry: ChatOutboxEntry,
            files: List<UploadFile>,
            draft: ChatComposerDraft? = null,
        ): String? =
            withContext(Dispatchers.IO) {
                synchronizeAccount()
                lock.withLock {
                    if (account != entry.target.accountId) return@withLock "Your account changed. Open the conversation and try again."
                    try {
                        val submittedDraft = draft?.copy(queuedClientId = entry.clientId)
                        if (submittedDraft != null) {
                            reviseDraft(submittedDraft)
                            store.saveDraft(submittedDraft, files)
                        }
                        val saved = store.insert(entry, files, submittedDraft)
                        _entries.value = _entries.value + saved
                        wake.trySend(Unit)
                        null
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: IllegalStateException) {
                        error.message ?: "Couldn't save the message on this device. Try again."
                    } catch (_: Exception) {
                        Timber.w("An outgoing chat could not be saved")
                        "Couldn't save the message on this device. Try again."
                    }
                }
            }

        fun retry(clientId: String) {
            scope.launch {
                lock.withLock {
                    val entry = _entries.value.firstOrNull { it.clientId == clientId } ?: return@withLock
                    if (entry.refused) return@withLock
                    replace(entry.copy(attempts = 0, retryAt = 0, error = null, terminal = false))
                }
                wake.trySend(Unit)
            }
        }

        fun discard(clientId: String) {
            scope.launch {
                lock.withLock {
                    val entry = _entries.value.firstOrNull { it.clientId == clientId } ?: return@withLock
                    // Only a failed/refused row offers this action; an active send completes normally.
                    if (entry.error == null) return@withLock
                    store.remove(entry)
                    _entries.value = _entries.value.filterNot { it.clientId == clientId }
                }
                wake.trySend(Unit)
            }
        }

        /** A socket echo or a history page can confirm an HTTP response that was lost. */
        fun acknowledge(messages: List<ChatMessageDto>) {
            scope.launch {
                lock.withLock {
                    messages.forEach { message ->
                        val entry =
                            _entries.value.firstOrNull {
                                it.clientId == message.clientMessageId && it.body.roomId == message.roomId &&
                                    it.pending.userId == message.userId
                            } ?: return@forEach
                        store.remove(entry)
                        _entries.value = _entries.value.filterNot { it.clientId == entry.clientId }
                    }
                }
                wake.trySend(Unit)
            }
        }

        /** Called before the token store changes; cancelled requests cannot continue under the next account. */
        suspend fun clear() =
            withContext(Dispatchers.IO) {
                lock.withLock {
                    blockedSession = tokens.sessionMarker()
                    generation++
                    request?.cancel()
                    request = null
                    account = null
                    _entries.value = emptyList()
                    synchronized(this@ChatOutbox) { draftRevisions.clear() }
                    store.clear()
                    synchronized(this@ChatOutbox) { context.getSystemService(JobScheduler::class.java)?.cancel(DELIVERY_JOB_ID) }
                }
            }

        private suspend fun drain() {
            while (scope.isActive) {
                val next = lock.withLock { if ((!foreground && backgroundRuns == 0) || account == null) null else nextEntry() }
                when {
                    next == null -> wake.receive()
                    next.retryAt > System.currentTimeMillis() ->
                        withTimeoutOrNull(next.retryAt - System.currentTimeMillis()) { wake.receive() }
                    else -> attempt(next)
                }
            }
        }

        @Suppress("TooGenericExceptionCaught") // A provider failure must not stop delivery of every subsequent queued message.
        private suspend fun attempt(next: ChatOutboxEntry) {
            val revision = generation
            val sending =
                lock.withLock {
                    if (!foreground && backgroundRuns == 0) return
                    scope.async { deliver(next, revision) }.also { request = it }
                }
            try {
                sending.await()
            } catch (_: CancellationException) {
                // Sign-out ends the request; the queue loop remains available for the next account.
            } catch (error: Exception) {
                Timber.w("An outgoing chat attempt could not finish")
                fail(next, NetworkError.Transport(error), revision)
            } finally {
                if (request === sending) request = null
            }
        }

        /** Preserve order within a thread; one refused/rate-limited thread must not block every other thread. */
        private fun nextEntry(): ChatOutboxEntry? =
            _entries.value.filterNot { it.terminal }.groupBy { it.target }.values.map { it.first() }
                .minWithOrNull(compareBy<ChatOutboxEntry> { it.retryAt }.thenBy { Instant.parse(it.pending.createdAt) })

        private suspend fun current(
            entry: ChatOutboxEntry,
            revision: Long,
        ): Boolean {
            if (revision != generation || account != entry.target.accountId) return false
            return _entries.value.any { it.clientId == entry.clientId } && tokens.userId() == entry.target.accountId
        }

        @Suppress("ReturnCount") // Every preparation step can be cancelled by logout or a confirming socket echo.
        private suspend fun deliver(
            original: ChatOutboxEntry,
            revision: Long,
        ) {
            var entry = original.copy(error = null)
            // A first attempt is already saved exactly as queued; only a retry rewrites its cleared error first.
            if (!current(entry, revision) || (original.error != null && !saveProgress(entry, revision))) return
            entry = resolveTopic(entry, revision) ?: return
            entry = resolveRoom(entry, revision) ?: return
            if (entry.body.replyToId != null) {
                when (val result = repo.validateReplyRoom(entry.target, entry.body.roomId)) {
                    is NetworkResult.Failure -> {
                        fail(entry, result.error, revision)
                        return
                    }
                    is NetworkResult.Success -> if (!current(entry, revision)) return
                }
            }
            entry = uploadAttachments(entry, revision) ?: return
            if (!current(entry, revision)) return
            when (val result = repo.sendMessage(entry.body)) {
                is NetworkResult.Failure -> fail(entry, result.error, revision)
                is NetworkResult.Success ->
                    lock.withLock {
                        if (revision != generation) return@withLock
                        _accepted.tryEmit(entry.target to result.data.message)
                        store.remove(entry)
                        _entries.value = _entries.value.filterNot { it.clientId == entry.clientId }
                    }
            }
        }

        private suspend fun resolveTopic(
            entry: ChatOutboxEntry,
            revision: Long,
        ): ChatOutboxEntry? {
            val topic = entry.topic ?: return entry
            if (entry.target.kind != "person") return entry
            return when (
                val result =
                    repo.findOrCreateTopic(
                        entry.target.id,
                        FindOrCreateTopicBody(topic.type, topic.referenceId, topic.title),
                    )
            ) {
                is NetworkResult.Failure -> {
                    fail(entry, result.error, revision)
                    null
                }
                is NetworkResult.Success ->
                    entry.copy(
                        body = entry.body.copy(topicId = result.data.topic.id),
                        pending = entry.pending.copy(topicId = result.data.topic.id),
                        topic = null,
                    ).let { if (saveProgress(it, revision)) it else null }
            }
        }

        private suspend fun resolveRoom(
            entry: ChatOutboxEntry,
            revision: Long,
        ): ChatOutboxEntry? {
            if (!current(entry, revision)) return null
            if (entry.body.roomId.isNotEmpty()) return entry
            if (entry.body.replyToId != null) {
                fail(
                    entry,
                    NetworkError.ClientError(HTTP_BAD_REQUEST, "Open the original conversation to reply to this message."),
                    revision,
                )
                return null
            }
            return when (val result = repo.createDirectChat(entry.target.id)) {
                is NetworkResult.Failure -> {
                    fail(entry, result.error, revision)
                    null
                }
                is NetworkResult.Success ->
                    entry.copy(
                        body = entry.body.copy(roomId = result.data.roomId),
                        pending = entry.pending.copy(roomId = result.data.roomId),
                    ).let { if (saveProgress(it, revision)) it else null }
            }
        }

        private suspend fun uploadAttachments(
            entry: ChatOutboxEntry,
            revision: Long,
        ): ChatOutboxEntry? {
            if (!current(entry, revision)) return null
            if (entry.attachments.isEmpty() || !entry.body.fileIds.isNullOrEmpty()) return entry
            val files = lock.withLock { store.attachments(entry) }
            return when (val result = uploads.uploadChatMedia(entry.body.roomId, files, clientRequestId = entry.clientId)) {
                is NetworkResult.Failure -> {
                    fail(entry, result.error, revision)
                    null
                }
                is NetworkResult.Success ->
                    entry.copy(body = entry.body.copy(fileIds = result.data.media.map { it.id }))
                        .let { if (saveProgress(it, revision)) it else null }
            }
        }

        private suspend fun saveProgress(
            entry: ChatOutboxEntry,
            revision: Long,
        ): Boolean =
            lock.withLock {
                if (revision != generation || _entries.value.none { it.clientId == entry.clientId }) return@withLock false
                replace(entry)
            }

        private suspend fun fail(
            entry: ChatOutboxEntry,
            error: NetworkError,
            revision: Long,
        ) {
            lock.withLock {
                val held = _entries.value.firstOrNull { it.clientId == entry.clientId } ?: return@withLock
                if (revision != generation) return@withLock
                val attempts = held.attempts + 1
                val limited = error is NetworkError.ClientError && error.body?.contains("PRE_BID_LIMIT") == true
                val terminal = limited || error.code?.let { it in 400..499 && it != HTTP_TOO_MANY_REQUESTS } == true
                val backoff = (INITIAL_BACKOFF_MS * (1L shl attempts.coerceAtMost(MAX_EXPONENT))).coerceAtMost(MAX_BACKOFF_MS)
                replace(
                    held.copy(
                        attempts = attempts,
                        retryAt = System.currentTimeMillis() + backoff,
                        error = error.message,
                        terminal = terminal,
                        refused = error.code == 403,
                    ),
                )
            }
        }

        private fun replace(entry: ChatOutboxEntry): Boolean {
            val saved = runCatching { store.update(entry) }.isSuccess
            _entries.value =
                _entries.value.map {
                    if (it.clientId != entry.clientId) {
                        it
                    } else if (saved) {
                        entry
                    } else {
                        it.copy(error = "Couldn't update the saved message. Free some device storage and retry.", terminal = true)
                    }
                }
            return saved
        }

        private companion object {
            const val HTTP_TOO_MANY_REQUESTS = 429
            const val MAX_MESSAGES = 200
            const val INITIAL_BACKOFF_MS = 1000L
            const val MAX_BACKOFF_MS = 60_000L
            const val MAX_EXPONENT = 6
            const val DELIVERY_JOB_ID = 63_109
            const val BACKGROUND_DELAY_MS = 5_000L
            const val BACKGROUND_BUDGET_MS = 30_000L
        }
    }
