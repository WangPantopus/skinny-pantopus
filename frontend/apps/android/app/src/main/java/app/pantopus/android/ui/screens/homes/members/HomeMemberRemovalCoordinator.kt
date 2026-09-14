package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeMemberRemovalCodec
import app.pantopus.android.data.homes.HomeMemberRemovalContext
import app.pantopus.android.data.homes.HomeMemberRemovalCurrent
import app.pantopus.android.data.homes.HomeMemberRemovalFailure
import app.pantopus.android.data.homes.HomeMemberRemovalFailureKind
import app.pantopus.android.data.homes.HomeMemberRemovalIntent
import app.pantopus.android.data.homes.HomeMemberRemovalOutcome
import app.pantopus.android.data.homes.HomeMemberRemovalRecovery
import app.pantopus.android.data.homes.HomeMemberRemovalRequest
import app.pantopus.android.data.homes.HomeMemberRemovalTransport
import app.pantopus.android.data.homes.PendingHomeMemberRemoval
import app.pantopus.android.data.homes.PendingHomeMemberRemovalStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

/** One original per account/origin, retained before dispatch; network waits never lock protected storage. */
class HomeMemberRemovalCoordinator(
    val scope: HomeCreationScope,
    private val store: PendingHomeMemberRemovalStore,
    private val codec: HomeMemberRemovalCodec,
    private val transport: HomeMemberRemovalTransport,
    private val requireCurrent: suspend () -> Unit,
    private val requestId: () -> String = { UUID.randomUUID().toString() },
) {
    var pending: PendingHomeMemberRemoval? = null
        private set
    var context: HomeMemberRemovalContext? = null
        private set
    var opened = false
        private set
    var busy = false
        private set
    var currentRoster: HomeMemberRemovalCurrent = HomeMemberRemovalCurrent.Unchecked
        private set
    private var attempted = false

    @Volatile private var revision = 0L
    private var serverSession: String? = null
    private var observed: HomeMemberRemovalOutcome? = null
    private var acknowledging: PendingHomeMemberRemoval? = null
    val outcome: HomeMemberRemovalOutcome? get() = pending?.receiptJson?.let { codec.outcome(it, checkNotNull(pending)) }
    val canPrepare: Boolean get() = opened && !busy && !attempted && pending == null
    val canSubmit: Boolean get() = canPrepare && context != null
    val canAcknowledge: Boolean get() = !busy && outcome?.isTerminal == true

    suspend fun open() =
        operation { opening ->
            context = null
            val saved = readSaved()
            current(opening)
            if (acknowledging != null && saved == null) clearAcknowledged()
            verify(pending == null || saved?.sameIntent(checkNotNull(pending)) == true)
            pending = saved
            attempted = saved != null
            readSession(opening)
            opened = true
            if (saved != null) resolveOriginal(HomeMemberRemovalRecovery.Check, opening)
        }

    suspend fun prepare(intent: HomeMemberRemovalIntent) {
        verify(canPrepare && intent.isValid())
        operation { opening ->
            context = null
            verify(readSaved() == null)
            current(opening)
            readSession(opening)
            val selected = transport.context(scope, intent, checkNotNull(serverSession))
            current(opening)
            verify(selected.intent == intent)
            context = selected
        }
    }

    suspend fun submit(reviewedToken: String) {
        verify(canSubmit)
        operation { opening ->
            val selected = context ?: changed()
            verify(selected.decisionToken == reviewedToken)
            val request =
                HomeMemberRemovalRequest(
                    requestId(),
                    selected.intent,
                    selected.occupancyId,
                    reviewedToken,
                )
            val draft = PendingHomeMemberRemoval(scope, request, codec.encode(request), selected.summary)
            verify(codec.valid(draft, scope))
            attempted = true
            current(opening)
            replace(null, draft, opening)
            pending = draft
            context = null
            current(opening)
            resolveOriginal(HomeMemberRemovalRecovery.Retry, opening)
        }
    }

    suspend fun recover(
        action: HomeMemberRemovalRecovery,
        originalId: String,
    ) = operation { opening ->
        verify(pending?.request?.requestId == originalId)
        resolveOriginal(action, opening)
    }

    suspend fun checkCurrentRoster(originalId: String) {
        operation { opening ->
            val draft = pending ?: changed()
            verify(draft.request.requestId == originalId && readSaved() == draft)
            current(opening)
            readSession(opening)
            val result = transport.currentRoster(draft, checkNotNull(serverSession))
            current(opening)
            verify(readSaved() == draft)
            current(opening)
            currentRoster = result
        }
    }

    suspend fun acknowledge(originalId: String): PendingHomeMemberRemoval? {
        verify(canAcknowledge)
        var acknowledged: PendingHomeMemberRemoval? = null
        operation { opening ->
            val draft = pending ?: changed()
            verify(draft.request.requestId == originalId && readSaved() == draft)
            current(opening)
            acknowledging = draft
            try {
                replace(draft, null, opening)
            } catch (failure: HomeMemberRemovalFailure) {
                if (readSaved() != null) throw failure
            }
            clearAcknowledged()
            current(opening)
            acknowledged = draft
        }
        return acknowledged
    }

    fun edit() {
        verify(canPrepare)
        context = null
    }

    fun hide() {
        currentRoster = HomeMemberRemovalCurrent.Unchecked
        revision++
        context = null
        opened = false
    }

    private suspend fun resolveOriginal(
        action: HomeMemberRemovalRecovery,
        opening: Long,
    ) {
        val draft = pending ?: changed()
        verify(readSaved() == draft)
        current(opening)
        val known = observed ?: outcome
        if (known?.isTerminal == true) {
            persist(known, draft, opening)
            return
        }
        readSession(opening)
        val result = transport.resolve(draft, action, checkNotNull(serverSession))
        current(opening)
        persist(result, draft, opening)
    }

    private suspend fun persist(
        result: HomeMemberRemovalOutcome,
        draft: PendingHomeMemberRemoval,
        opening: Long,
    ) {
        verify(codec.outcome(result.receiptJson, draft) == result)
        if (result.isTerminal) observed = result
        val next = draft.copy(receiptJson = result.receiptJson)
        replace(draft, next, opening)
        current(opening)
        pending = next
    }

    private suspend fun readSession(opening: Long) {
        val result = transport.session(scope)
        current(opening)
        if (serverSession != null && result != serverSession) throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.SessionChanged)
        serverSession = result
    }

    private suspend fun operation(action: suspend (Long) -> Unit) {
        current(revision)
        verify(scope.isValid())
        if (busy) throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.Busy)
        busy = true
        currentRoster = HomeMemberRemovalCurrent.Unchecked
        val opening = revision
        try {
            action(opening)
        } finally {
            busy = false
        }
    }

    private suspend fun current(opening: Long) {
        currentCoroutineContext().ensureActive()
        try {
            check(opening == revision)
            requireCurrent()
            check(opening == revision)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.SessionChanged)
        }
    }

    private suspend fun readSaved(): PendingHomeMemberRemoval? = storage { store.read(scope) }

    private suspend fun replace(
        expected: PendingHomeMemberRemoval?,
        next: PendingHomeMemberRemoval?,
        opening: Long,
    ) = storage {
        store.replace(scope, expected, next) { current(opening) }
    }

    private suspend fun <T> storage(action: suspend () -> T): T =
        try {
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (known: HomeMemberRemovalFailure) {
            throw known
        } catch (_: Exception) {
            throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.Storage)
        }

    private fun clearAcknowledged() {
        pending = null
        observed = null
        acknowledging = null
        attempted = false
        context = null
    }

    private fun verify(value: Boolean) {
        if (!value) changed()
    }

    private fun changed(): Nothing = throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.Changed)
}
