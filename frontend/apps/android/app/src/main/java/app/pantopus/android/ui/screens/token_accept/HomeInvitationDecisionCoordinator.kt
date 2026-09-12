@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.token_accept

import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationDecisionCodec
import app.pantopus.android.data.homes.HomeInvitationDecisionContext
import app.pantopus.android.data.homes.HomeInvitationDecisionOutcome
import app.pantopus.android.data.homes.HomeInvitationDecisionRequest
import app.pantopus.android.data.homes.HomeInvitationDecisionTransport
import app.pantopus.android.data.homes.HomeInvitationFailure
import app.pantopus.android.data.homes.HomeInvitationFailureKind
import app.pantopus.android.data.homes.HomeInvitationRecoveryAction
import app.pantopus.android.data.homes.HomeInvitationRefusal
import app.pantopus.android.data.homes.PendingHomeInvitationDecision
import app.pantopus.android.data.homes.PendingHomeInvitationDecisionStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

/** Network waits do not lock another scene out of recovering the protected original. */
class HomeInvitationDecisionCoordinator(
    val scope: HomeCreationScope,
    val token: String,
    private val store: PendingHomeInvitationDecisionStore,
    private val codec: HomeInvitationDecisionCodec,
    private val transport: HomeInvitationDecisionTransport,
    private val requireCurrent: suspend () -> Unit,
    private val requestId: () -> String = { UUID.randomUUID().toString() },
) {
    var pending: PendingHomeInvitationDecision? = null
        private set
    var context: HomeInvitationDecisionContext? = null
        private set
    var access: PersonalHomeResidencyProgress? = null
        private set
    var opened = false
        private set
    var busy = false
        private set
    var attempted = false
        private set
    private var revision = 0L
    private var serverSession: String? = null
    private var observed: HomeInvitationDecisionOutcome? = null
    private var acknowledging: PendingHomeInvitationDecision? = null
    val outcome: HomeInvitationDecisionOutcome? get() = pending?.receiptJson?.let { codec.outcome(it, checkNotNull(pending)) }
    val canDecide: Boolean get() = opened && !busy && !attempted && pending == null && context?.isFresh() == true
    val canAcknowledge: Boolean get() = !busy && outcome?.isTerminal == true

    suspend fun open() =
        operation { opening ->
            context = null
            access = null
            val saved = readSaved()
            current(opening)
            if (acknowledging != null && saved == null) clearAcknowledged()
            verify(pending == null || saved?.sameIntent(checkNotNull(pending)) == true)
            pending = saved
            attempted = saved != null
            readSession(opening)
            opened = true
            if (saved != null) {
                resolveOriginal(HomeInvitationRecoveryAction.Check, opening)
            } else {
                context = transport.context(scope, token, checkNotNull(serverSession)).also { current(opening) }
            }
        }

    suspend fun decide(
        action: String,
        reviewedToken: String,
    ) {
        verify(canDecide)
        operation { opening ->
            val selected = context ?: changed()
            verify(selected.isFresh() && selected.decisionToken == reviewedToken && action in setOf("accept", "decline"))
            val draft =
                PendingHomeInvitationDecision(
                    scope,
                    selected.homeLabel,
                    HomeInvitationDecisionRequest(requestId(), token, selected.homeId, selected.invitationId, action, reviewedToken),
                )
            attempted = true
            current(opening)
            replace(null, draft)
            pending = draft
            context = null
            access = null
            current(opening)
            resolveOriginal(HomeInvitationRecoveryAction.Retry, opening)
        }
    }

    suspend fun recover(
        action: HomeInvitationRecoveryAction,
        originalId: String,
    ) = operation { opening ->
        verify(pending?.request?.requestId == originalId)
        resolveOriginal(action, opening)
    }

    suspend fun checkAccess() = operation { opening -> readAccess(opening) }

    suspend fun acknowledge(
        originalId: String,
        openHome: Boolean,
    ): PendingHomeInvitationDecision? {
        verify(canAcknowledge)
        var acknowledged: PendingHomeInvitationDecision? = null
        operation { opening ->
            val draft = pending ?: changed()
            verify(draft.request.requestId == originalId)
            if (openHome) {
                readAccess(opening)
                if (access?.currentAccess != "shared") throw HomeInvitationRefusal("CURRENT_ACCESS_UNAVAILABLE")
            }
            verify(readSaved() == draft)
            current(opening)
            clearOriginal(draft)
            clearAcknowledged()
            current(opening)
            acknowledged = draft
        }
        return acknowledged
    }

    private suspend fun clearOriginal(draft: PendingHomeInvitationDecision) {
        acknowledging = draft
        try {
            replace(draft, null)
        } catch (failure: HomeInvitationFailure) {
            if (readSaved() != null) throw failure
        }
    }

    fun hide() {
        revision++
        context = null
        access = null
    }

    private suspend fun resolveOriginal(
        action: HomeInvitationRecoveryAction,
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
        val result = transport.resolve(draft, action, checkNotNull(serverSession))
        current(opening)
        persist(result, draft, opening)
    }

    private suspend fun persist(
        result: HomeInvitationDecisionOutcome,
        draft: PendingHomeInvitationDecision,
        opening: Long,
    ) {
        verify(codec.outcome(result.receiptJson, draft) == result)
        if (result.isTerminal) observed = result
        val next = draft.copy(receiptJson = result.receiptJson)
        replace(draft, next)
        current(opening)
        pending = next
    }

    private suspend fun readSession(opening: Long) {
        val result = transport.session(scope)
        current(opening)
        verify(serverSession == null || result == serverSession)
        serverSession = result
    }

    private suspend fun readAccess(opening: Long) {
        access = null
        val original = pending ?: changed()
        verify(outcome?.state == "completed" && original.request.action == "accept")
        readSession(opening)
        val result = transport.access(original.request.homeId)
        current(opening)
        readSession(opening)
        verify(result.matches(original.request.homeId))
        access = result
    }

    private suspend fun operation(action: suspend (Long) -> Unit) {
        requireCurrent()
        verify(scope.isValid())
        if (busy) throw HomeInvitationFailure(HomeInvitationFailureKind.Busy)
        busy = true
        val opening = revision
        try {
            action(opening)
        } finally {
            busy = false
        }
    }

    private suspend fun current(opening: Long) {
        currentCoroutineContext().ensureActive()
        requireCurrent()
        if (opening != revision) throw HomeInvitationFailure(HomeInvitationFailureKind.SessionChanged)
    }

    private suspend fun readSaved(): PendingHomeInvitationDecision? = storage { store.read(scope) }

    private suspend fun replace(
        expected: PendingHomeInvitationDecision?,
        next: PendingHomeInvitationDecision?,
    ) = storage { store.replace(scope, expected, next) }

    private suspend fun <T> storage(action: suspend () -> T): T =
        try {
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            throw HomeInvitationFailure(HomeInvitationFailureKind.Storage)
        }

    private fun clearAcknowledged() {
        pending = null
        observed = null
        acknowledging = null
        attempted = false
        context = null
        access = null
    }

    private fun verify(value: Boolean) {
        if (!value) changed()
    }

    private fun changed(): Nothing = throw HomeInvitationFailure(HomeInvitationFailureKind.Changed)
}
