package app.pantopus.android.ui.screens.homes.postal

import app.pantopus.android.data.api.models.homes.HomeResidencyAddressSnapshot
import app.pantopus.android.data.homes.HomePostalCodeRequest
import app.pantopus.android.data.homes.HomePostalCodec
import app.pantopus.android.data.homes.HomePostalKind
import app.pantopus.android.data.homes.HomePostalMailRequest
import app.pantopus.android.data.homes.HomePostalOutcome
import app.pantopus.android.data.homes.HomePostalScope
import app.pantopus.android.data.homes.PendingHomePostalCommand
import app.pantopus.android.data.homes.PendingHomePostalStore
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

enum class HomePostalAction { Submit, Check, Cancel }

fun interface HomePostalTransport {
    suspend fun resolve(
        draft: PendingHomePostalCommand,
        action: HomePostalAction,
    ): HomePostalOutcome
}

/** Retain one exact mailing or code attempt through restart and uncertain writes. */
class HomePostalCoordinator(
    val scope: HomePostalScope,
    private val store: PendingHomePostalStore,
    private val codec: HomePostalCodec,
    private val transport: HomePostalTransport,
    private val requireCurrent: suspend () -> Unit,
    private val newRequestId: () -> String = { UUID.randomUUID().toString() },
) {
    var pending: PendingHomePostalCommand? = null
        private set
    var isBusy = false
        private set
    var storageFailed = false
        private set
    private var revision = 0L
    private var expectedRequestId: String? = null
    private var knownOutcome: HomePostalOutcome? = null
    private var acknowledging: PendingHomePostalCommand? = null
    val outcome: HomePostalOutcome? get() = knownOutcome ?: pending?.outcome

    suspend fun restore() {
        val opening = revision
        requireCurrent()
        check(scope.isValid()) { CHANGED }
        val saved = readSaved()
        requireCurrent()
        check(opening == revision) { CHANGED }
        // IO cancellation can arrive after a confirmed acknowledgement removed
        // the slot. Reconcile that explicit local action before the old hint.
        val acknowledgement = acknowledging
        if (acknowledgement != null && (saved == null || !acknowledgement.sameIntent(saved))) clearAcknowledgedOriginal()
        check(expectedRequestId == null || saved?.requestId == expectedRequestId) { CHANGED }
        check(pending == null || saved == null || checkNotNull(pending).sameIntent(saved)) { CHANGED }
        val known = knownOutcome
        if (known != null) {
            check(saved != null && known.matches(saved)) { CHANGED }
            check(!known.isTerminal || saved.outcome?.isTerminal != true || known.sameDecision(saved.outcome)) { CHANGED }
        }
        pending = saved
        expectedRequestId = saved?.requestId
        if (known?.isTerminal != true) knownOutcome = saved?.outcome
    }

    suspend fun prepareMail(
        address: HomeResidencyAddressSnapshot,
        originalRequestId: String? = null,
    ) {
        val id = originalRequestId ?: newRequestId()
        prepare(PendingHomePostalCommand(scope, id, HomePostalKind.Mail, null, codec.encode(HomePostalMailRequest(id, address))))
    }

    suspend fun prepareCode(
        code: String,
        postcardId: String,
    ) {
        val id = newRequestId()
        prepare(PendingHomePostalCommand(scope, id, HomePostalKind.Code, postcardId, codec.encode(HomePostalCodeRequest(id, code))))
    }

    private suspend fun prepare(original: PendingHomePostalCommand) {
        val opening = revision
        requireCurrent()
        check(!isBusy && pending == null && knownOutcome == null && readSaved() == null) { CHANGED }
        check(opening == revision && codec.valid(original, scope)) { CHANGED }
        requireCurrent()
        replace(null, original)
        requireCurrent()
        check(opening == revision) { CHANGED }
        pending = original
        expectedRequestId = original.requestId
    }

    suspend fun resolve(action: HomePostalAction): HomePostalOutcome {
        requireCurrent()
        check(!isBusy && activeScopes.add(scope)) { "Your original postal request is still being checked. Try again shortly." }
        isBusy = true
        val opening = revision
        try {
            restore()
            check(opening == revision) { CHANGED }
            val draft = checkNotNull(pending) { CHANGED }
            val known = knownOutcome
            if (known?.isTerminal == true) {
                persist(known, draft)
                return known
            }
            val result = transport.resolve(draft, action)
            requireCurrent()
            check(opening == revision && result.matches(draft)) { CHANGED }
            persist(result, draft)
            return checkNotNull(outcome)
        } finally {
            isBusy = false
            activeScopes.remove(scope)
        }
    }

    suspend fun acknowledge(): PendingHomePostalCommand {
        val opening = revision
        requireCurrent()
        val original = checkNotNull(pending) { CHANGED }
        val proof = checkNotNull(outcome) { CHANGED }
        val saved = checkNotNull(readSaved()) { CHANGED }
        check(opening == revision && !isBusy && proof.isTerminal && original.sameIntent(saved)) { CHANGED }
        check(saved.outcome?.sameDecision(proof) == true) { CHANGED }
        requireCurrent()
        acknowledging = original
        replace(saved, null)
        clearAcknowledgedOriginal()
        requireCurrent()
        check(opening == revision) { CHANGED }
        return original
    }

    private fun clearAcknowledgedOriginal() {
        pending = null
        knownOutcome = null
        expectedRequestId = null
        acknowledging = null
    }

    fun hide() {
        revision++
        pending = null
        if (knownOutcome?.isTerminal != true) knownOutcome = null
    }

    private suspend fun persist(
        result: HomePostalOutcome,
        draft: PendingHomePostalCommand,
    ) {
        val opening = revision
        val saved = checkNotNull(readSaved()) { CHANGED }
        requireCurrent()
        check(opening == revision && saved.sameIntent(draft)) { CHANGED }
        val previous = knownOutcome?.takeIf { it.isTerminal } ?: saved.outcome
        val retained =
            if (previous?.isTerminal == true) {
                check(!result.isTerminal || previous.sameDecision(result)) { CHANGED }
                previous
            } else {
                result.projected()
            }
        knownOutcome = retained
        val confirmed = saved.copy(outcome = retained)
        pending = confirmed
        replace(saved, confirmed)
        requireCurrent()
        check(opening == revision) { CHANGED }
    }

    private suspend fun readSaved(): PendingHomePostalCommand? {
        try {
            return store.read(scope).also {
                check(it == null || codec.valid(it, scope)) { STORAGE }
                storageFailed = false
            }
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            storageFailed = true
            error(STORAGE)
        }
    }

    private suspend fun replace(
        expected: PendingHomePostalCommand?,
        next: PendingHomePostalCommand?,
    ) {
        try {
            store.replace(scope, expected, next)
            storageFailed = false
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            storageFailed = true
            error(STORAGE)
        }
    }

    companion object {
        private val activeScopes = ConcurrentHashMap.newKeySet<HomePostalScope>()
        const val CHANGED = "The saved postal request or your session changed. Reopen mail verification to recover the original."
        const val STORAGE = "The original postal request could not be read or saved. Keep it and retry recovery before starting another."
    }
}
