package app.pantopus.android.ui.screens.homes.residencyreview

import app.pantopus.android.data.homes.HomeResidencyCurrentReview
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyReviewCodec
import app.pantopus.android.data.homes.HomeResidencyReviewFailure
import app.pantopus.android.data.homes.HomeResidencyReviewFailureKind
import app.pantopus.android.data.homes.HomeResidencyReviewRole
import app.pantopus.android.data.homes.HomeResidencyReviewScope
import app.pantopus.android.data.homes.HomeResidencyReviewTransport
import app.pantopus.android.data.homes.PendingHomeResidencyReview
import app.pantopus.android.data.homes.PendingHomeResidencyReviewStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** Current authority, historical proof and protected originals have separate lifetimes. */
class HomeResidencyReviewCoordinator(
    val scope: HomeResidencyReviewScope,
    private val store: PendingHomeResidencyReviewStore,
    private val codec: HomeResidencyReviewCodec,
    private val transport: HomeResidencyReviewTransport,
    private val requireCurrent: suspend () -> Unit,
    private val requestId: () -> String = { UUID.randomUUID().toString() },
) {
    var pending: PendingHomeResidencyReview? = null
        private set
    var review: HomeResidencyCurrentReview? = null
        private set
    var isBusy = false
        private set
    var storageFailed = false
        private set
    var canDiscard = false
        private set
    private var revision = 0L
    private var sessionScope: String? = null
    private var expectedRequestId: String? = null
    private var knownReceipt: String? = null
    private var acknowledging: PendingHomeResidencyReview? = null
    val receipt: String? get() = knownReceipt ?: pending?.receiptJson

    suspend fun open(requestedClaim: String?) =
        operation { opening ->
            review = null
            canDiscard = false
            restore(opening)
            (pending?.claimId ?: requestedClaim)?.let { readCurrent(it, opening) }
        }

    suspend fun prepare(
        action: HomeResidencyDecision,
        role: HomeResidencyReviewRole,
        reason: String,
    ) = operation { opening ->
        verify(pending == null && knownReceipt == null && readSaved() == null)
        current(opening)
        val selected = review ?: changed()
        verify(selected.canDecide(scope.actorId))
        val id = requestId()
        val draft =
            PendingHomeResidencyReview(scope, selected.claimId, id, action, codec.request(id, selected.reviewToken, action, role, reason))
        verify(codec.valid(draft, scope))
        replace(null, draft)
        current(opening)
        pending = draft
        expectedRequestId = draft.requestId
        canDiscard = false
    }

    suspend fun resolve() =
        operation { opening ->
            canDiscard = false
            restore(opening)
            val draft = pending ?: changed()
            readCurrent(draft.claimId, opening)
            val session = sessionScope ?: changed()
            requireSaved(draft, opening)
            val known = receipt
            if (known != null) {
                persist(known, draft, opening)
            } else {
                try {
                    val result = transport.decide(draft, session)
                    current(opening)
                    persist(result, draft, opening)
                } catch (failure: HomeResidencyReviewFailure) {
                    current(opening)
                    if (failure.kind == HomeResidencyReviewFailureKind.Refused) canDiscard = true
                    throw failure
                }
            }
            readCurrent(draft.claimId, opening)
        }

    suspend fun acknowledge(requestedClaim: String?) =
        operation { opening ->
            restore(opening)
            val draft = pending ?: changed()
            verify(draft.receiptJson != null || canDiscard)
            readCurrent(draft.claimId, opening)
            requireSaved(draft, opening)
            verify(knownReceipt == null || draft.receiptJson == knownReceipt)
            // A cancelled IO return can follow a committed clear. Only this explicit
            // acknowledgement marker permits restore to reconcile the missing slot.
            acknowledging = draft
            replace(draft, null)
            clearAcknowledged()
            current(opening)
            review = null
            requestedClaim?.let { readCurrent(it, opening) }
        }

    fun hide() {
        revision++
        review = null
        pending = null
        canDiscard = false
    }

    private suspend fun operation(action: suspend (Long) -> Unit) {
        requireCurrent()
        verify(scope.isValid())
        if (isBusy || !activeScopes.add(scope)) throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.Busy)
        isBusy = true
        val opening = revision
        try {
            action(opening)
        } catch (failure: HomeResidencyReviewFailure) {
            if (failure.kind in setOf(HomeResidencyReviewFailureKind.Unavailable, HomeResidencyReviewFailureKind.SessionChanged)) {
                review = null
            }
            throw failure
        } finally {
            isBusy = false
            activeScopes.remove(scope)
        }
    }

    private suspend fun current(opening: Long) {
        currentCoroutineContext().ensureActive()
        requireCurrent()
        if (opening != revision) throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.SessionChanged)
    }

    private suspend fun readCurrent(
        claim: String,
        opening: Long,
    ) {
        review = null
        val value = transport.read(scope, claim, sessionScope)
        current(opening)
        verify(value.homeId == scope.homeId && value.actorId == scope.actorId && value.claimId == claim)
        verify(sessionScope == null || value.sessionScope == sessionScope)
        sessionScope = value.sessionScope
        review = value
    }

    private suspend fun restore(opening: Long) {
        val saved = readSaved()
        current(opening)
        val acknowledgement = acknowledging
        if (acknowledgement != null && (saved == null || !acknowledgement.sameIntent(saved))) clearAcknowledged()
        verify(expectedRequestId == null || saved?.requestId == expectedRequestId)
        verify(pending == null || saved == null || checkNotNull(pending).sameIntent(saved))
        knownReceipt?.let {
            verify(saved != null && codec.receipt(it, saved) == it && (saved.receiptJson == null || saved.receiptJson == it))
        }
        pending = saved
        expectedRequestId = saved?.requestId
        if (knownReceipt == null) knownReceipt = saved?.receiptJson
    }

    private suspend fun requireSaved(
        draft: PendingHomeResidencyReview,
        opening: Long,
    ) {
        val saved = readSaved()
        current(opening)
        verify(saved == draft)
    }

    private suspend fun persist(
        result: String,
        draft: PendingHomeResidencyReview,
        opening: Long,
    ) {
        val saved = readSaved() ?: changed()
        current(opening)
        verify(saved.sameIntent(draft))
        val confirmedReceipt = codec.receipt(result, draft)
        verify(knownReceipt == null || knownReceipt == confirmedReceipt)
        verify(saved.receiptJson == null || saved.receiptJson == confirmedReceipt)
        knownReceipt = confirmedReceipt
        val confirmed = saved.copy(receiptJson = confirmedReceipt)
        replace(saved, confirmed)
        current(opening)
        pending = confirmed
    }

    private fun clearAcknowledged() {
        pending = null
        knownReceipt = null
        expectedRequestId = null
        acknowledging = null
        canDiscard = false
    }

    private suspend fun readSaved(): PendingHomeResidencyReview? =
        storage {
            store.read(scope).also { verify(it == null || codec.valid(it, scope)) }
        }

    private suspend fun replace(
        expected: PendingHomeResidencyReview?,
        next: PendingHomeResidencyReview?,
    ) = storage {
        store.replace(scope, expected, next)
    }

    private suspend fun <T> storage(action: suspend () -> T): T {
        try {
            return action().also { storageFailed = false }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            storageFailed = true
            throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.Storage)
        }
    }

    private fun verify(value: Boolean) {
        if (!value) changed()
    }

    private fun changed(): Nothing = throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.Changed)

    private companion object {
        val activeScopes = ConcurrentHashMap.newKeySet<HomeResidencyReviewScope>()
    }
}
