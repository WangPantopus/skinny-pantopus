@file:Suppress("PackageNaming", "TooManyFunctions", "ReturnCount")

package app.pantopus.android.ui.screens.gigs.checkout

import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.gigs.GigBidAcceptResponse
import app.pantopus.android.data.api.models.gigs.GigBidDto
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

data class GigCheckoutIdentity(val userId: String, val sessionId: String?, val apiOrigin: String)

suspend fun TokenStorage.gigCheckoutIdentity(): GigCheckoutIdentity? =
    sessionIdentity()?.let { (userId, sessionId) -> GigCheckoutIdentity(userId, sessionId, BuildConfig.PANTOPUS_API_BASE_URL) }

enum class GigBidCheckoutPhase {
    Idle,
    Preparing,
    Presenting,
    Confirming,
    Canceling,
    RetryAccept,
    RetryFinalize,
    RetryCancel,
    Accepted,
    Canceled,
}

data class GigBidCheckoutPresentation(val token: String, val params: PaymentIntentSheetParamsDto)

data class GigBidCheckoutState(
    val gigId: String? = null,
    val bidId: String? = null,
    val phase: GigBidCheckoutPhase = GigBidCheckoutPhase.Idle,
    val amountCents: Int? = null,
    val message: String? = null,
    val presentation: GigBidCheckoutPresentation? = null,
) {
    val blocksNewBidActions: Boolean get() =
        phase !in
            listOf(
                GigBidCheckoutPhase.Idle, GigBidCheckoutPhase.Accepted, GigBidCheckoutPhase.Canceled,
            )
    val busy: Boolean get() = phase in listOf(GigBidCheckoutPhase.Preparing, GigBidCheckoutPhase.Confirming, GigBidCheckoutPhase.Canceling)
}

/** Server-held bid identity survives restart. This coordinator stores no secrets or pending IDs on disk. */
class GigBidCheckoutCoordinator(
    private val repository: GigsRepository,
    private val scope: CoroutineScope,
    private val identity: suspend () -> GigCheckoutIdentity?,
    private val onAccepted: (String, String) -> Unit,
    private val onCanceled: () -> Unit = {},
    private val admission: GigBidCheckoutAdmission = GigBidCheckoutAdmission.shared,
) {
    private val _state = MutableStateFlow(GigBidCheckoutState())
    val state = _state.asStateFlow()

    // Start resolving on construction; every screen awaits this before loading
    // its data. Dismissal never adopts a later account or login session.
    private val initialIdentity = scope.async(start = CoroutineStart.UNDISPATCHED) { readIdentity() }
    private var generation = 0
    private var claimedPresentation: String? = null

    fun start(
        gigId: String,
        bidId: String,
    ) {
        if (_state.value.busy || _state.value.presentation != null) return
        if (gigId.isBlank() || bidId.isBlank()) return
        if (_state.value.phase !in listOf(GigBidCheckoutPhase.Idle, GigBidCheckoutPhase.Accepted, GigBidCheckoutPhase.Canceled) &&
            (_state.value.gigId != gigId || _state.value.bidId != bidId)
        ) {
            return
        }
        val ticket = ++generation
        _state.value = GigBidCheckoutState(gigId, bidId, GigBidCheckoutPhase.Preparing)
        scope.launch {
            if (!owns(ticket)) return@launch
            accept(ticket)
        }
    }

    /** Restore one exact pending bid from the owner-authorized server list, without creating payment. */
    fun restore(
        gigId: String,
        bids: List<GigBidDto>,
    ) {
        if (_state.value.phase != GigBidCheckoutPhase.Idle) return
        val pending = bids.filter { it.gigId == gigId && it.status == "pending_payment" }
        if (pending.size != 1) return
        val ticket = ++generation
        scope.launch {
            if (!owns(ticket) || _state.value.phase != GigBidCheckoutPhase.Idle) return@launch
            _state.value =
                GigBidCheckoutState(
                    gigId, pending.single().id, GigBidCheckoutPhase.RetryAccept,
                    message = "Payment setup is pending. Resume or cancel this same bid.",
                )
        }
    }

    fun retry() {
        val value = _state.value
        if (value.busy || value.presentation != null || value.bidId == null) return
        val ticket = generation
        when (value.phase) {
            GigBidCheckoutPhase.RetryFinalize -> {
                _state.value = value.copy(phase = GigBidCheckoutPhase.Confirming, message = null)
                scope.launch { finalize(ticket) }
            }
            GigBidCheckoutPhase.RetryCancel -> cancel()
            GigBidCheckoutPhase.RetryAccept -> start(value.gigId.orEmpty(), value.bidId)
            else -> Unit
        }
    }

    fun cancel() {
        val value = _state.value
        if (value.busy || value.bidId == null || value.phase in listOf(GigBidCheckoutPhase.Accepted, GigBidCheckoutPhase.Canceled)) return
        val ticket = generation
        _state.value = value.copy(phase = GigBidCheckoutPhase.Canceling, presentation = null, message = null)
        scope.launch {
            if (!owns(ticket)) return@launch
            val result = repository.abortAcceptBid(value.gigId.orEmpty(), value.bidId)
            if (!owns(ticket)) return@launch
            if (result is NetworkResult.Success && exactBid(result.data, "pending")) {
                _state.value = _state.value.copy(phase = GigBidCheckoutPhase.Canceled, message = "Payment setup canceled.")
                onCanceled()
            } else {
                if (recoverFinalized(ticket, value) || !owns(ticket)) return@launch
                retryPhase(GigBidCheckoutPhase.RetryCancel, "Cancellation is unconfirmed. Retry canceling the same payment.")
            }
        }
    }

    /** The presentation token is captured by the individual SDK launcher, never read from a newer sheet. */
    fun onSheetResult(
        token: String,
        outcome: CheckoutOutcome,
    ) {
        admission.release(token)
        if (_state.value.presentation?.token != token || _state.value.phase != GigBidCheckoutPhase.Presenting) return
        val ticket = generation
        _state.value = _state.value.copy(presentation = null, phase = GigBidCheckoutPhase.Confirming)
        scope.launch {
            if (!owns(ticket)) return@launch
            when (outcome) {
                CheckoutOutcome.Paid -> finalize(ticket)
                CheckoutOutcome.Canceled -> {
                    _state.value = _state.value.copy(phase = GigBidCheckoutPhase.RetryCancel)
                    cancel()
                }
                is CheckoutOutcome.Declined ->
                    retryPhase(
                        GigBidCheckoutPhase.RetryAccept,
                        "Authorization is unconfirmed. Resume or cancel this payment.",
                    )
            }
        }
    }

    fun checkIdentity() {
        val ticket = generation
        scope.launch { owns(ticket) }
    }

    suspend fun claimPresentation(token: String): Boolean {
        if (!owns(generation) || _state.value.presentation?.token != token || claimedPresentation == token) return false
        val owner = initialIdentity.await() ?: return false
        if (!admission.claim(owner, _state.value.gigId.orEmpty(), token)) {
            retryPhase(GigBidCheckoutPhase.RetryAccept, "Another payment screen is open for this task. Return to it, then retry here.")
            return false
        }
        claimedPresentation = token
        return true
    }

    fun presentationFailed(token: String) {
        admission.release(token)
        if (_state.value.presentation?.token == token) {
            retryPhase(GigBidCheckoutPhase.RetryAccept, "Could not open payment. Resume or cancel this same setup.")
        }
    }

    fun dismiss() {
        generation += 1
        claimedPresentation = null
        _state.value = GigBidCheckoutState()
    }

    private suspend fun readIdentity(): GigCheckoutIdentity? =
        try {
            identity()
        } catch (canceled: CancellationException) {
            throw canceled
        } catch (_: Exception) {
            null
        }

    /** Anonymous and legacy sessions may read; they cannot authorize a payment. */
    suspend fun isCurrentReadScope(): Boolean = initialIdentity.await() == readIdentity()

    /** Payment admission requires the same complete initial authenticated session. */
    suspend fun isCurrentIdentity(): Boolean {
        val owner = initialIdentity.await()
        return !owner?.sessionId.isNullOrBlank() && readIdentity() == owner
    }

    private suspend fun owns(ticket: Int): Boolean {
        if (ticket != generation) return false
        val current = isCurrentIdentity()
        if (ticket != generation) return false
        if (!current) {
            dismiss()
            return false
        }
        return true
    }

    private suspend fun accept(ticket: Int) {
        if (!owns(ticket)) return
        val value = _state.value
        val result = repository.acceptBid(value.gigId.orEmpty(), value.bidId.orEmpty())
        if (!owns(ticket)) return
        if (result !is NetworkResult.Success) {
            if (recoverFinalized(ticket, value)) return
            if (!owns(ticket)) return
            retryPhase(GigBidCheckoutPhase.RetryAccept, "Payment progress is unconfirmed. Resume or cancel the same bid.")
            return
        }
        val receipt = result.data
        if (exactBid(receipt, "accepted")) {
            accepted()
            return
        }
        val cents = receipt.amountCents
        val validAmount = cents != null && cents >= MINIMUM_AMOUNT_CENTS && receipt.currency?.lowercase() == "usd"
        if (!exactBid(receipt, "pending_payment") || !validAmount || receipt.isSetupIntent == true) {
            retryPhase(GigBidCheckoutPhase.RetryAccept, "Could not confirm the exact agreed payment. Retry this bid.")
            return
        }
        _state.value = _state.value.copy(amountCents = cents)
        if (receipt.authorizationReady == true && receipt.paymentStatus == "authorized") {
            _state.value = _state.value.copy(phase = GigBidCheckoutPhase.Confirming)
            finalize(ticket)
        } else {
            val params = receipt.sheetParams()
            if (receipt.authorizationReady == true || params.clientSecret.isNullOrBlank() || params.paymentIntentId.isNullOrBlank()) {
                retryPhase(GigBidCheckoutPhase.RetryAccept, "Payment progress is unconfirmed. Retry the same bid.")
                return
            }
            _state.value =
                _state.value.copy(
                    phase = GigBidCheckoutPhase.Presenting,
                    presentation = GigBidCheckoutPresentation(UUID.randomUUID().toString(), params), message = null,
                )
        }
    }

    /** A lost finalize may already have assigned the gig; a list row alone is never success. */
    private suspend fun recoverFinalized(
        ticket: Int,
        value: GigBidCheckoutState,
    ): Boolean {
        val bids = repository.bids(value.gigId.orEmpty())
        if (!owns(ticket)) return false
        val exactAccepted =
            bids is NetworkResult.Success &&
                bids.data.bids.any {
                    it.id == value.bidId && it.gigId == value.gigId && it.status == "accepted"
                }
        if (!exactAccepted) return false
        _state.value = _state.value.copy(phase = GigBidCheckoutPhase.Confirming)
        finalize(ticket)
        return true
    }

    private suspend fun finalize(ticket: Int) {
        if (!owns(ticket)) return
        val value = _state.value
        val result = repository.finalizeAcceptBid(value.gigId.orEmpty(), value.bidId.orEmpty())
        if (!owns(ticket)) return
        if (result is NetworkResult.Success && exactBid(result.data, "accepted")) {
            accepted()
        } else {
            retryPhase(GigBidCheckoutPhase.RetryFinalize, "Authorization may be complete. Retry confirmation of the same bid.")
        }
    }

    private fun exactBid(
        receipt: GigBidAcceptResponse,
        status: String,
    ): Boolean = receipt.bid?.id == _state.value.bidId && receipt.bid?.gigId == _state.value.gigId && receipt.bid?.status == status

    private fun accepted() {
        val value = _state.value
        _state.value = value.copy(phase = GigBidCheckoutPhase.Accepted, presentation = null, message = "Bid acceptance confirmed.")
        onAccepted(value.gigId.orEmpty(), value.bidId.orEmpty())
    }

    private fun retryPhase(
        phase: GigBidCheckoutPhase,
        message: String,
    ) {
        _state.value = _state.value.copy(phase = phase, presentation = null, message = message)
    }

    private companion object {
        const val MINIMUM_AMOUNT_CENTS = 50
    }
}
