package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationSenderCodec
import app.pantopus.android.data.homes.HomeInvitationSenderContext
import app.pantopus.android.data.homes.HomeInvitationSenderFailure
import app.pantopus.android.data.homes.HomeInvitationSenderFailureKind
import app.pantopus.android.data.homes.HomeInvitationSenderIntent
import app.pantopus.android.data.homes.HomeInvitationSenderOutcome
import app.pantopus.android.data.homes.HomeInvitationSenderRecovery
import app.pantopus.android.data.homes.HomeInvitationSenderRequest
import app.pantopus.android.data.homes.HomeInvitationSenderTransport
import app.pantopus.android.data.homes.PendingHomeInvitationSender
import app.pantopus.android.data.homes.PendingHomeInvitationSenderStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.security.SecureRandom
import java.time.Instant
import java.util.UUID

/** One original per account/origin, retained before dispatch; network waits never lock protected storage. */
class HomeInvitationSenderCoordinator(
    val scope: HomeCreationScope,
    private val store: PendingHomeInvitationSenderStore,
    private val codec: HomeInvitationSenderCodec,
    private val transport: HomeInvitationSenderTransport,
    private val requireCurrent: suspend () -> Unit,
    private val requestId: () -> String = { UUID.randomUUID().toString() },
    private val nowMillis: () -> Long = System::currentTimeMillis,
    private val capability: () -> String = {
        ByteArray(
            TOKEN_BYTES,
        ).also(SecureRandom()::nextBytes).joinToString("") { "%02x".format(it) }
    },
) {
    var pending: PendingHomeInvitationSender? = null
        private set
    var context: HomeInvitationSenderContext? = null
        private set
    var opened = false
        private set
    var busy = false
        private set
    var sharingUntilMillis: Long? = null
        private set
    private var attempted = false
    private var revision = 0L
    private var serverSession: String? = null
    private var observed: HomeInvitationSenderOutcome? = null
    private var acknowledging: PendingHomeInvitationSender? = null
    val outcome: HomeInvitationSenderOutcome? get() = pending?.receiptJson?.let { codec.outcome(it, checkNotNull(pending)) }
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
            if (saved != null) resolveOriginal(HomeInvitationSenderRecovery.Check, opening)
        }

    suspend fun prepare(intent: HomeInvitationSenderIntent) {
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
                HomeInvitationSenderRequest(
                    requestId(),
                    if (selected.intent.action == "withdraw") null else capability(),
                    selected.intent,
                    reviewedToken,
                )
            val draft = PendingHomeInvitationSender(scope, request, codec.encode(request), selected.summary)
            verify(codec.valid(draft, scope))
            attempted = true
            current(opening)
            replace(null, draft)
            pending = draft
            context = null
            current(opening)
            resolveOriginal(HomeInvitationSenderRecovery.Retry, opening)
        }
    }

    suspend fun recover(
        action: HomeInvitationSenderRecovery,
        originalId: String,
    ) = operation { opening ->
        verify(pending?.request?.requestId == originalId)
        resolveOriginal(action, opening)
    }

    /** Read current resend eligibility without issuing a command, alias or notification. */
    suspend fun checkSharing(originalId: String): PendingHomeInvitationSender? {
        var checked: PendingHomeInvitationSender? = null
        operation { opening ->
            val draft = pending ?: changed()
            val receipt = outcome ?: changed()
            verify(draft.request.requestId == originalId && receipt.state == "completed" && draft.request.intent.action != "withdraw")
            verify(readSaved() == draft)
            current(opening)
            readSession(opening)
            val intent = HomeInvitationSenderIntent(draft.request.intent.homeId, "resend", invitationId = receipt.invitationId)
            val selected = transport.context(scope, intent, checkNotNull(serverSession))
            current(opening)
            verify(selected.intent == intent && readSaved() == draft)
            current(opening)
            val expires = selected.expiresAt?.let { Instant.parse(it).toEpochMilli() } ?: Long.MAX_VALUE
            val until = minOf(nowMillis() + MAX_SHARING_AGE_MILLIS, expires)
            verify(until > nowMillis())
            sharingUntilMillis = until
            checked = draft
        }
        return checked
    }

    suspend fun acknowledge(originalId: String): PendingHomeInvitationSender? {
        verify(canAcknowledge)
        var acknowledged: PendingHomeInvitationSender? = null
        operation { opening ->
            val draft = pending ?: changed()
            verify(draft.request.requestId == originalId && readSaved() == draft)
            current(opening)
            acknowledging = draft
            try {
                replace(draft, null)
            } catch (failure: HomeInvitationSenderFailure) {
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
        sharingUntilMillis = null
        revision++
        context = null
        opened = false
    }

    private suspend fun resolveOriginal(
        action: HomeInvitationSenderRecovery,
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
        result: HomeInvitationSenderOutcome,
        draft: PendingHomeInvitationSender,
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

    private suspend fun operation(action: suspend (Long) -> Unit) {
        requireCurrent()
        verify(scope.isValid())
        if (busy) throw HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.Busy)
        busy = true
        sharingUntilMillis = null
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
        if (opening != revision) throw HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.SessionChanged)
    }

    private suspend fun readSaved(): PendingHomeInvitationSender? = storage { store.read(scope) }

    private suspend fun replace(
        expected: PendingHomeInvitationSender?,
        next: PendingHomeInvitationSender?,
    ) = storage {
        store.replace(scope, expected, next)
    }

    private suspend fun <T> storage(action: suspend () -> T): T =
        try {
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            throw HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.Storage)
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

    private fun changed(): Nothing = throw HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.Changed)

    private companion object {
        const val TOKEN_BYTES = 32
        const val MAX_SHARING_AGE_MILLIS = 60_000L
    }
}
