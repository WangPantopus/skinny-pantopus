package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceReceipt
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.PendingHomeTaskRecurrence
import app.pantopus.android.data.homes.PendingHomeTaskRecurrenceStore
import app.pantopus.android.data.homes.validPendingTaskRecurrence
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import java.net.HttpURLConnection.HTTP_BAD_REQUEST
import java.net.HttpURLConnection.HTTP_CONFLICT
import java.net.HttpURLConnection.HTTP_FORBIDDEN
import java.net.HttpURLConnection.HTTP_NOT_FOUND
import java.net.HttpURLConnection.HTTP_UNAUTHORIZED
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val RECURRENCE_STORAGE =
    "The original schedule change could not be verified. Reload to recover it before making another change."

/** Called on the UI dispatcher. Scope locks also serialize separate open controllers. */
class HomeTaskRecurrenceController(
    private val access: HomeTaskRecurrenceAccess,
    private val store: PendingHomeTaskRecurrenceStore,
    private val scope: CoroutineScope,
    private val requestId: () -> String = { UUID.randomUUID().toString() },
) {
    private val mutable = MutableStateFlow(HomeTaskRecurrenceUiState())
    val state = mutable.asStateFlow()
    private val identity = access.identity
    private var generation = 0
    private var work: Job? = null
    private var reloadQueued = false
    private var observed: HomeTaskRecurrenceReceipt? = null

    init {
        scope.launch { access.invalidated.collect { if (it) retire() } }
    }

    fun show() {
        mutable.value = mutable.value.copy(visible = true)
        resume()
    }

    fun resume() {
        if (!state.value.visible) return
        if (!access.isCurrent) {
            retire()
            return
        }
        mutable.value = mutable.value.copy(active = true)
        reload()
    }

    fun pause() {
        generation++
        reloadQueued = false
        work?.cancel()
        mutable.value = HomeTaskRecurrenceUiState(visible = state.value.visible, busy = work != null)
    }

    fun close() {
        pause()
        mutable.value = mutable.value.copy(visible = false)
    }

    fun retire() {
        pause()
        mutable.value = mutable.value.copy(error = TASK_SESSION_CHANGED)
    }

    fun reload() {
        if (!state.value.active) return
        if (work != null) {
            reloadQueued = true
            return
        }
        runAction { revision ->
            mutable.value = HomeTaskRecurrenceUiState(visible = true, active = true, busy = true)
            val (task, schedule) = access.source()
            val pending = readSaved()
            current(revision)
            mutable.value = state.value.copy(task = task, schedule = schedule, pending = pending).fieldsFromCurrent()
        }
    }

    fun fields(
        frequency: String = state.value.frequency,
        interval: String = state.value.interval,
        timezone: String = state.value.timezone,
    ) {
        if (state.value.canChange) mutable.value = state.value.copy(frequency = frequency, interval = interval, timezone = timezone)
    }

    fun start() {
        if (!state.value.canStart) return
        perform(state.value.startRequest(requestId()))
    }

    fun pauseRepeats() {
        if (!state.value.canPause) return
        perform(HomeTaskRecurrenceRequest(requestId(), "pause", checkNotNull(state.value.schedule).revision))
    }

    fun retry() {
        val before = state.value
        if (before.pending == null || before.pending.confirmed != null || before.schedule?.canManage != true) return
        perform(null)
    }

    private fun perform(request: HomeTaskRecurrenceRequest?) {
        runAction { revision ->
            current(revision)
            val pending = state.value.pending
            check(readSaved() == pending) { RECURRENCE_STORAGE }
            current(revision)
            val original =
                if (request == null) {
                    checkNotNull(pending).also { check(it.confirmed == null) { RECURRENCE_STORAGE } }
                } else {
                    check(pending == null && request.valid()) { RECURRENCE_STORAGE }
                    PendingHomeTaskRecurrence(identity, request).also {
                        store.replace(identity, null, it)
                        current(revision)
                        mutable.value = state.value.copy(pending = it)
                    }
                }
            val response =
                access.change(original) {
                    current(revision)
                    check(readSaved() == original) { RECURRENCE_STORAGE }
                    checkCurrent(revision)
                }
            current(revision)
            val receipt = checkNotNull(response.receipt)
            check(observed?.takeIf { it.requestId == receipt.requestId }?.let { it == receipt } != false) { RECURRENCE_CHANGED }
            observed = receipt
            val confirmed = original.copy(confirmed = receipt)
            store.replace(identity, original, confirmed)
            current(revision)
            mutable.value = state.value.copy(pending = confirmed)
            val (task, schedule) = access.source()
            current(revision)
            mutable.value = state.value.copy(task = task, schedule = schedule).fieldsFromCurrent()
        }
    }

    fun acknowledge() {
        val original = state.value.pending ?: return
        if (original.confirmed == null && !state.value.canDismiss) return
        runAction { revision ->
            val (task, schedule) = access.source()
            current(revision)
            check(readSaved() == original) { RECURRENCE_STORAGE }
            current(revision)
            store.replace(identity, original, null)
            current(revision)
            observed = null
            mutable.value = state.value.copy(task = task, schedule = schedule, pending = null).fieldsFromCurrent()
        }
    }

    private suspend fun readSaved(): PendingHomeTaskRecurrence? =
        store.read(identity).also {
            check(it == null || validPendingTaskRecurrence(it, identity)) { RECURRENCE_STORAGE }
        }

    private suspend fun current(revision: Int) {
        access.requireCurrent()
        checkCurrent(revision)
    }

    private suspend fun checkCurrent(revision: Int) {
        currentCoroutineContext().ensureActive()
        check(access.isCurrent) { TASK_SESSION_CHANGED }
        if (!state.value.active || !state.value.visible || revision != generation) throw CancellationException()
    }

    private fun runAction(action: suspend (Int) -> Unit) {
        if (!state.value.active || !state.value.visible || work != null) return
        if (!access.isCurrent) {
            retire()
            return
        }
        val lock = locks.getOrPut(identity) { Mutex() }
        if (!lock.tryLock()) {
            mutable.value = state.value.copy(error = "A schedule change is already running. Reload when it finishes.")
            return
        }
        val revision = ++generation
        mutable.value = state.value.copy(busy = true, error = null, canDismiss = false)
        work =
            scope.launch(start = CoroutineStart.LAZY) {
                try {
                    action(revision)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: NetworkError) {
                    failed(error, revision)
                } catch (error: IllegalStateException) {
                    failed(error, revision)
                } catch (error: IllegalArgumentException) {
                    failed(error, revision)
                } finally {
                    lock.unlock()
                    work = null
                    mutable.value = state.value.copy(busy = false)
                    if (reloadQueued && state.value.active) {
                        reloadQueued = false
                        reload()
                    }
                }
            }
        work?.start()
    }

    private fun failed(
        error: Throwable,
        revision: Int,
    ) {
        if (!access.isCurrent) {
            retire()
            return
        }
        if (!state.value.active || revision != generation) return
        val network = (error as? RecurrenceMutationFailure)?.failure ?: error as? NetworkError
        val message =
            network?.displayMessage("Could not confirm this schedule change. Retry the saved change.")
                ?: error.message ?: RECURRENCE_STORAGE
        val hide =
            network?.code in setOf(HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_NOT_FOUND) ||
                message == TASK_ACCESS_CHANGED || message == RECURRENCE_CHANGED
        mutable.value =
            state.value.copy(
                error = message,
                task = state.value.task.takeUnless { hide },
                schedule = state.value.schedule.takeUnless { hide },
                canDismiss = error is RecurrenceMutationFailure && definitiveRecurrenceRejection(error.failure),
            )
    }

    companion object {
        private val locks = ConcurrentHashMap<app.pantopus.android.data.homes.HomeTaskRecurrenceScope, Mutex>()
    }
}

private fun definitiveRecurrenceRejection(error: NetworkError): Boolean {
    if (error !is NetworkError.ClientError) return false
    val type = Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
    val adapter = Moshi.Builder().build().adapter<Map<String, Any?>>(type)
    val code = runCatching { error.body?.let(adapter::fromJson)?.get("code") }.getOrNull()
    return (error.code == HTTP_BAD_REQUEST && code == "HOME_RECORD_INVALID") ||
        (error.code == HTTP_CONFLICT && code == "HOME_TASK_RECURRENCE_STALE")
}
