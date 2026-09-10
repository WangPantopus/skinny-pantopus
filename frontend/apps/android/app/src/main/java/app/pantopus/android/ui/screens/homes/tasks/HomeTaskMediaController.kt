package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskMediaDto
import app.pantopus.android.data.api.models.homes.HomeTaskMediaList
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class HomeTaskMediaController(
    private val access: HomeTaskMediaAccess,
    private val scope: CoroutineScope,
) {
    private val mutable = MutableStateFlow(HomeTaskMediaState())
    val state = mutable.asStateFlow()
    private var generation = 0
    val revision get() = generation
    private var pickerRevision = 0
    private var retired = false
    private var inFlight = false
    private var pendingReload = false
    private var work: Job? = null
    private var pending: PendingTaskMediaUpload? = null

    init {
        scope.launch { access.invalidated.collect { if (it) retire() } }
    }

    fun show() {
        if (retired || !access.isCurrent) return
        mutable.value = mutable.value.copy(visible = true, active = true)
        reload()
    }

    fun resume() {
        if (state.value.visible) show()
    }

    fun pause() {
        generation++
        mutable.value = mutable.value.hidden().copy(active = false)
        work?.cancel()
    }

    fun close() {
        pickerRevision++
        pause()
        mutable.value = mutable.value.copy(visible = false)
    }

    fun retire() {
        retired = true
        pickerRevision++
        pause()
        pending?.erase()
        pending = null
        mutable.value = HomeTaskMediaState(visible = state.value.visible, error = TASK_SESSION_CHANGED)
    }

    fun reload() {
        if (!state.value.active) return
        if (inFlight) {
            pendingReload = true
            return
        }
        run { ticket -> accept(access.list(), ticket) }
    }

    fun beginPick(): Int? {
        if (!state.value.mayChoose || !access.isCurrent) return null
        pickerRevision++
        return pickerRevision
    }

    fun picked(
        name: String,
        mime: String,
        bytes: ByteArray,
        expectedRevision: Int,
    ) {
        if (!state.value.mayChoose || expectedRevision != pickerRevision || !access.isCurrent) return
        val copy = bytes.copyOf()
        run { ticket ->
            try {
                access.requireCurrent()
                if (owns(ticket)) {
                    val selected = PendingTaskMediaUpload(UUID.randomUUID().toString(), name, mime, copy)
                    pickerRevision++
                    pending = selected
                    mutable.value =
                        mutable.value.withProgress(
                            pending = TaskMediaSelection(selected.id, selected.localName, selected.size),
                            attempted = false, removedUploadId = null,
                        )
                }
            } finally {
                copy.fill(0)
            }
        }
    }

    fun discardUnsent(id: String) {
        if (!state.value.mayDiscard || pending?.id != id || !access.isCurrent) return
        pending?.erase()
        pending = null
        mutable.value = mutable.value.withProgress(pending = null)
    }

    fun upload(id: String) {
        val selected = pending ?: return
        if (!state.value.mayRetryUpload || selected.id != id) return
        mutable.value = mutable.value.withProgress(attempted = true)
        run { ticket ->
            try {
                val record = access.upload(selected)
                val result = access.list()
                check(record in result.media) { "The saved attachment changed. Reload its current details." }
                if (owns(ticket) && pending === selected) {
                    selected.erase()
                    pending = null
                    mutable.value = mutable.value.withProgress(pending = null, attempted = false, removedUploadId = null)
                    accept(result, ticket, "Private attachment saved.")
                }
            } catch (error: HomeTaskMediaUploadFailure) {
                if (owns(ticket) && pending === selected && error.retired) {
                    mutable.value = mutable.value.withProgress(removedUploadId = id)
                }
                throw error
            }
        }
    }

    fun acknowledgeRemovedUpload(id: String) {
        if (!state.value.mayAcknowledge || pending?.id != id) return
        run { ticket ->
            access.requireCurrent()
            if (owns(ticket) && pending?.id == id) {
                pending?.erase()
                pending = null
                mutable.value = mutable.value.withProgress(pending = null, attempted = false, removedUploadId = null)
                accept(access.list(), ticket)
            }
        }
    }

    fun open(record: HomeTaskMediaDto) {
        val before = state.value
        val shown = before.active && record in before.media && record.available
        if (!shown || before.busy || before.removing != null) return
        run { ticket ->
            val content = access.read(record)
            if (owns(ticket)) {
                mutable.value = mutable.value.copy(media = listOf(record), confirmed = true, preview = TaskMediaPreview(record, content))
            } else {
                content.bytes.fill(0)
            }
        }
    }

    fun remove(record: HomeTaskMediaDto) {
        if (!state.value.mayRemove(record) || !access.isCurrent) return
        mutable.value = mutable.value.withProgress(removing = record)
        retryRemoval(record.id)
    }

    fun retryRemoval(id: String) {
        val original = state.value.removing ?: return
        if (!state.value.mayRetryRemoval || original.id != id) return
        run { ticket ->
            access.remove(original)
            val result = access.list()
            if (owns(ticket) && state.value.removing == original) {
                mutable.value = mutable.value.withProgress(removing = null)
                accept(result, ticket, "Attachment removed. Its history remains.")
            }
        }
    }

    private fun run(action: suspend (Int) -> Unit) {
        if (inFlight || !state.value.active || retired) return
        if (!access.isCurrent) {
            retire()
            return
        }
        inFlight = true
        val ticket = generation
        mutable.value = mutable.value.hidden().copy(busy = true, error = null, notice = null)
        work =
            scope.launch(start = CoroutineStart.UNDISPATCHED) {
                try {
                    access.requireCurrent()
                    if (owns(ticket)) action(ticket)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: NetworkError) {
                    fail(ticket, error.displayMessage("Could not confirm attachment access. Retry the same action."))
                } catch (error: IllegalStateException) {
                    fail(ticket, error.message ?: TASK_ACCESS_CHANGED)
                } catch (error: IllegalArgumentException) {
                    fail(ticket, error.message ?: "Choose a supported private file of 25 MB or less.")
                } finally {
                    finish()
                }
            }
    }

    private fun accept(
        result: HomeTaskMediaList,
        ticket: Int,
        notice: String? = null,
    ) {
        if (owns(ticket)) {
            mutable.value = mutable.value.copy(media = result.media, canUpload = result.canUpload, confirmed = true, notice = notice)
        }
    }

    private fun fail(
        ticket: Int,
        message: String,
    ) {
        if (owns(ticket)) mutable.value = mutable.value.hidden().copy(error = message)
    }

    private fun finish() {
        inFlight = false
        mutable.value = mutable.value.copy(busy = false)
        if (pendingReload && state.value.active && !retired) {
            pendingReload = false
            val expected = generation
            scope.launch { if (owns(expected)) reload() }
        }
    }

    private fun owns(ticket: Int): Boolean {
        val currentLifetime = ticket == generation && state.value.active && !retired
        return currentLifetime && access.isCurrent
    }
}
