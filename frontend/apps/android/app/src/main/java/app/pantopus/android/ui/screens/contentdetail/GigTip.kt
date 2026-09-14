@file:Suppress("PackageNaming", "TooManyFunctions", "ReturnCount", "LongParameterList")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.models.payments.TipCheckout
import app.pantopus.android.data.api.models.payments.TipOriginal
import app.pantopus.android.data.api.models.payments.TipPreview
import app.pantopus.android.data.api.models.payments.TipRequest
import app.pantopus.android.data.api.models.payments.TipResponse
import app.pantopus.android.data.api.models.payments.TipValidation
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingGigTipStore
import app.pantopus.android.ui.screens.gigs.checkout.GigBidCheckoutAdmission
import app.pantopus.android.ui.screens.gigs.checkout.GigCheckoutIdentity
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Existing gig-detail tip status. A matching committed receipt, rather than an
 * SDK callback alone, determines completion.
 */
sealed interface TipStatus {
    data object Idle : TipStatus

    data object Sending : TipStatus

    data object Succeeded : TipStatus

    data object Canceled : TipStatus

    data class Failed(val message: String) : TipStatus
}

/** One-shot effect: present Stripe PaymentSheet for the created tip payment. */
sealed interface GigTipEvent {
    data class PresentTipSheet(val token: String, val requestId: String, val checkout: TipCheckout) : GigTipEvent {
        val params: PaymentIntentSheetParamsDto get() = checkout.sheetParams()
    }
}

/** One-shot effect: navigate to the gig chat room after `GET /chat-room`. */
data class GigOpenChatEvent(
    val roomId: String,
    val displayName: String,
    val initials: String,
    val verified: Boolean,
)

/**
 * Phase 5 — one-shot effects for the lifecycle checkout flows (owner
 * accept-bid, helper instant-accept) plus transient toasts. The screen
 * presents PaymentSheet with [GigLifecycleEvent.PresentPaymentSheet.params]
 * and routes the Stripe result back via `onLifecycleCheckoutOutcome`.
 */
sealed interface GigLifecycleEvent {
    data class PresentPaymentSheet(val params: PaymentIntentSheetParamsDto) : GigLifecycleEvent

    data class Toast(val text: String, val isError: Boolean = false) : GigLifecycleEvent
}

/** Review affordance state on a completed gig (Phase 5, work item 5). */
sealed interface GigReviewState {
    /** Gig isn't completed or the viewer isn't a participant. */
    data object Hidden : GigReviewState

    /** Viewer may review; carries the reviewee from `my-pending`. */
    data class Available(val revieweeId: String, val revieweeName: String?) : GigReviewState

    /** Viewer already reviewed this gig — "Reviewed ✓". */
    data object Submitted : GigReviewState
}

data class GigTipState(
    val busy: Boolean = false,
    val invalidated: Boolean = false,
    val originalAmount: Int? = null,
    val canChoose: Boolean = false,
    val canContinue: Boolean = false,
    val canCancel: Boolean = false,
    val actionTitle: String = "Check tip status",
    val message: String = "100% goes to your helper. Charged to your card via Stripe.",
    val presentation: GigTipEvent.PresentTipSheet? = null,
)

/** Original recovery for the existing tip picker; payment and SDK receipts stay distinct. */
class GigTipRecovery(
    private val gigId: String,
    private val repository: PaymentsRepository,
    private val store: PendingGigTipStore,
    private val scope: CoroutineScope,
    private val identity: suspend () -> GigCheckoutIdentity?,
    private val scopeMarker: () -> String?,
    identityChanges: Flow<Unit> = emptyFlow(),
    private val admission: GigBidCheckoutAdmission = GigBidCheckoutAdmission.shared,
    private val newId: () -> String = { UUID.randomUUID().toString() },
) {
    private val openingMarker = scopeMarker()
    private val workToken = UUID.randomUUID().toString()
    private val conflictAdapter by lazy { com.squareup.moshi.Moshi.Builder().build().adapter(Map::class.java) }
    private var openingIdentity: GigCheckoutIdentity? = null
    private var storageKey: String? = null
    private var original: TipOriginal? = null
    private var preview: TipPreview? = null
    private var progress: TipResponse? = null
    private var conflict: TipResponse? = null
    private var serverSession: String? = null
    private var mayResume = false
    private var retired = false
    private var busy = false
    private var presentation: GigTipEvent.PresentTipSheet? = null
    private var claimedPresentation: String? = null
    private var message = GigTipState().message
    private val _state = MutableStateFlow(GigTipState())
    val state = _state.asStateFlow()
    private val _status = MutableStateFlow<TipStatus>(TipStatus.Idle)
    val status = _status.asStateFlow()

    init {
        scope.launch { identityChanges.collect { if (scopeMarker() != openingMarker) retire() } }
    }

    fun prepare(retainedOnly: Boolean = false) {
        scope.launch {
            work {
                preview = null
                progress = null
                conflict = null
                mayResume = false
                original = readStored()
                val saved = original
                if (saved != null) {
                    try {
                        val value = repository.tipOriginal(saved.requestId).value()
                        accept(value, saved)
                    } catch (_: NetworkError.NotFound) {
                        val next = readPreview()
                        mayResume = next.eligible && next.terms == saved.terms
                        if (next.activeRequestId != null && next.activeRequestId != saved.requestId) {
                            conflict = readOther(next.activeRequestId)
                        }
                        message = "The original tip is not confirmed. Keep its amount and request when continuing."
                    }
                } else if (!retainedOnly) {
                    val next = readPreview()
                    when {
                        next.activeRequestId != null -> {
                            val active = readOther(next.activeRequestId)
                            retain(active.request, null)
                            original = active.request
                            accept(active, active.request)
                        }
                        next.legacyPaymentId != null ->
                            message = "An earlier tip needs checking in payment history before another tip can be sent."
                        !next.eligible -> message = "This task is not currently available for a tip. Reopen its details before continuing."
                    }
                }
            }
        }
    }

    fun send(
        amount: Int,
        gig: GigDto?,
    ) {
        if (busy || presentation != null || retired) return
        scope.launch {
            work {
                if (conflict != null) {
                    adoptConflict()
                    return@work
                }
                check(progress?.terminal != true) { "This tip already has a receipt." }
                val previous = original
                check(previous == null || previous.amountCents == amount) { "Continue the original tip amount before choosing another." }
                check(amount in TipValidation.MIN_CENTS..TipValidation.MAX_CENTS)
                if (previous == null) {
                    val terms = checkNotNull(preview).terms
                    val task = checkNotNull(gig)
                    check(preview?.eligible == true && task.id == gigId && task.acceptedBy == terms.payeeId)
                    check(TipValidation.instant(task.ownerConfirmedAt) == TipValidation.instant(terms.ownerConfirmedAt))
                    val actor = checkNotNull(openingIdentity).userId
                    val id = newId()
                    val request = TipOriginal(id, id, gigId, actor, checkNotNull(terms.payeeId), amount, "usd", terms)
                    retain(request, null)
                    original = request
                }
                _status.value = TipStatus.Sending
                val saved = checkNotNull(original)
                val mode = if (previous == null || mayResume) "resume" else "check"
                val result = command(mode, saved)
                if (!result.terminal && result.checkout != null) {
                    presentation = GigTipEvent.PresentTipSheet(UUID.randomUUID().toString(), saved.requestId, result.checkout)
                }
            }
        }
    }

    fun cancel() {
        if (original == null) return
        scope.launch { work { command("cancel", checkNotNull(original)) } }
    }

    /** Called by the existing keyed PaymentSheet immediately before SDK presentation. */
    suspend fun claimSheet(token: String): PaymentIntentSheetParamsDto? {
        if (busy || claimedPresentation != null || presentation?.token != token) return null
        var params: PaymentIntentSheetParamsDto? = null
        work(allowPresentation = true) {
            val selected = checkNotNull(presentation)
            check(selected.token == token)
            val saved = checkNotNull(original)
            check(selected.requestId == saved.requestId)
            val result = command("check", saved)
            if (!result.terminal) {
                val checkout = checkNotNull(result.checkout)
                check(checkout.sameIntent(selected.checkout)) { "Checkout changed. Reopen the original tip." }
                requireCurrent()
                check(presentation?.token == token)
                claimedPresentation = token
                params = checkout.sheetParams()
            }
        }
        if (params == null && presentation?.token == token) {
            presentation = null
            release()
            publish()
        }
        return params
    }

    fun onOutcome(
        token: String,
        outcome: CheckoutOutcome,
    ) {
        if (presentation?.token != token || claimedPresentation != token || busy) return
        presentation = null
        claimedPresentation = null
        scope.launch {
            work {
                val result = command("check", checkNotNull(original))
                if (!result.terminal) {
                    message =
                        if (outcome == CheckoutOutcome.Canceled) {
                            "This tip has not been confirmed. Continue or cancel the same original tip."
                        } else {
                            "The tip result is unconfirmed. Check the same original before trying again."
                        }
                    _status.value = TipStatus.Failed(message)
                }
            }
        }
    }

    fun clearStatus() {
        _status.value = TipStatus.Idle
    }

    fun retire() {
        retired = true
        presentation = null
        claimedPresentation = null
        original = null
        preview = null
        progress = null
        conflict = null
        serverSession = null
        release()
        _status.value = TipStatus.Idle
        publish()
    }

    // NetworkError extends Throwable; storage/decoding failures must also keep the original.
    @Suppress("TooGenericExceptionCaught")
    private suspend fun work(
        allowPresentation: Boolean = false,
        action: suspend () -> Unit,
    ) {
        val sheetBlocksWork = presentation != null && !allowPresentation
        if (busy || retired || sheetBlocksWork) return
        busy = true
        publish()
        try {
            val current = requireCurrent()
            check(admission.claim(current, "tip:$gigId", workToken)) { "Another tip action is already running." }
            action()
        } catch (canceled: CancellationException) {
            throw canceled
        } catch (error: Throwable) {
            if (isCurrentMarker()) {
                recoverConflict(error)
                if (original != null && progress?.paymentIntentId == null) mayResume = true
                message = "The tip result is unconfirmed. Reopen and check the same original request."
                _status.value = TipStatus.Failed(message)
            } else {
                retire()
            }
        } finally {
            busy = false
            if (presentation == null) release()
            publish()
        }
    }

    private suspend fun recoverConflict(error: Throwable) {
        if (error !is NetworkError.ClientError || error.code != java.net.HttpURLConnection.HTTP_CONFLICT || original == null) return
        val body = runCatching { error.body?.let(conflictAdapter::fromJson) }.getOrNull()
        val active = body?.get("activeRequestId") as? String
        if (body?.get("code") != "TIP_ACTIVE" || !TipValidation.identifier(active)) return
        try {
            val next = readPreview()
            val activeId = next.activeRequestId
            if (activeId == active && activeId != null && activeId != original?.requestId) {
                conflict = readOther(activeId)
            }
        } catch (
            canceled: CancellationException,
        ) {
            throw canceled
        } catch (_: Throwable) {
            // Keep the original unless the pending request can be verified.
        }
    }

    private suspend fun adoptConflict() {
        val previous = checkNotNull(original)
        val other = checkNotNull(conflict)
        val next = readOther(other.request.requestId)
        check(next.request == other.request)
        retain(next.request, previous)
        original = next.request
        conflict = null
        accept(next, next.request)
    }

    private suspend fun command(
        mode: String,
        saved: TipOriginal,
    ): TipResponse {
        requireCurrent()
        check(readStored() == saved)
        val command =
            TipRequest(
                saved.requestId,
                gigId,
                saved.amountCents,
                saved.paymentMethodId,
                saved.payerId,
                checkNotNull(serverSession),
                saved.terms,
                mode,
            )
        val result = repository.tip(command).value()
        accept(result, saved)
        return result
    }

    private suspend fun readPreview(): TipPreview {
        val actor = requireCurrent().userId
        val result = repository.tipPreview(gigId).value()
        requireCurrent()
        check(TipValidation.preview(result, gigId, actor, serverSession))
        preview = result
        serverSession = result.sessionScope
        return result
    }

    private suspend fun readOther(requestId: String): TipResponse {
        val actor = requireCurrent().userId
        val result = repository.tipOriginal(requestId).value()
        requireCurrent()
        check(TipValidation.progress(result, gigId, actor, requestId, serverSession))
        return result
    }

    private suspend fun accept(
        result: TipResponse,
        saved: TipOriginal,
    ) {
        val actor = requireCurrent().userId
        check(TipValidation.progress(result, gigId, actor, saved.requestId, serverSession, saved))
        check(readStored() == saved)
        if (result.terminal) {
            store.replace(checkNotNull(storageKey), saved, null, ::isCurrentMarker)
            requireCurrent()
            presentation = null
            claimedPresentation = null
        }
        progress = result
        serverSession = result.sessionScope
        mayResume = result.canRetry && result.paymentIntentId == null
        _status.value =
            when {
                result.status == "succeeded" && !result.changedAfterCapture -> TipStatus.Succeeded
                result.status == "canceled" -> TipStatus.Canceled
                result.changedAfterCapture ->
                    TipStatus.Failed("This tip has a payment record. Check history for its refund or dispute status.")
                else -> TipStatus.Idle
            }
        message =
            when {
                result.changedAfterCapture -> "This tip has a payment record. Check history for its refund or dispute status."
                result.status == "needs_review" -> "This original tip needs review. Check payment history before continuing."
                result.status == "canceled" -> "The original tip is canceled with no charge."
                result.status == "succeeded" -> "The original tip is confirmed."
                else -> "This tip is not confirmed as paid. Continue or check the same original before sending another."
            }
    }

    private suspend fun readStored(): TipOriginal? {
        val actor = requireCurrent().userId
        val value = store.read(checkNotNull(storageKey))
        requireCurrent()
        check(value == null || TipValidation.original(value, gigId, actor))
        return value
    }

    private suspend fun retain(
        next: TipOriginal,
        expected: TipOriginal?,
    ) {
        val actor = requireCurrent().userId
        check(TipValidation.original(next, gigId, actor))
        store.replace(checkNotNull(storageKey), expected, next, ::isCurrentMarker)
        requireCurrent()
    }

    private suspend fun requireCurrent(): GigCheckoutIdentity {
        currentCoroutineContext().ensureActive()
        if (!isCurrentMarker()) {
            retire()
            error("The tip session changed.")
        }
        val current =
            identity() ?: run {
                retire()
                error("The tip session changed.")
            }
        if (!isCurrentMarker() || openingIdentity != null && current != openingIdentity) {
            retire()
            error("The tip session changed.")
        }
        if (openingIdentity == null) {
            check(TipValidation.identifier(current.userId) && current.apiOrigin.isNotBlank())
            openingIdentity = current
            storageKey = "gig-tip-original-v1|${current.apiOrigin}|${current.userId}|$gigId"
        }
        return current
    }

    private fun isCurrentMarker(): Boolean = !retired && scopeMarker() == openingMarker

    private fun release() {
        admission.release(workToken)
    }

    private fun publish() {
        if (retired) {
            _state.value = GigTipState(invalidated = true, message = "Your session changed. Reopen this task before continuing.")
            return
        }
        val pending = original != null && progress?.terminal != true
        val controlsAvailable = !busy && presentation == null
        _state.value =
            GigTipState(
                busy = busy || presentation != null, originalAmount = original?.amountCents,
                canChoose = controlsAvailable && original == null && preview?.eligible == true && serverSession != null,
                canContinue = controlsAvailable && pending && serverSession != null,
                canCancel = controlsAvailable && pending && serverSession != null && progress?.canCancel != false,
                actionTitle =
                    if (conflict != null) {
                        "View pending tip"
                    } else if (mayResume || progress?.checkout != null) {
                        "Continue original tip"
                    } else {
                        "Check tip status"
                    },
                message = message, presentation = presentation,
            )
    }

    private fun <T> NetworkResult<T>.value(): T =
        when (this) {
            is NetworkResult.Success -> data
            is NetworkResult.Failure -> throw error
        }
}

/** Reuses the existing dock for a retained tip whose task eligibility has since changed. */
fun tipRecoveryDetailState(
    state: ContentDetailUiState,
    tip: GigTipState,
): ContentDetailUiState {
    if (state !is ContentDetailUiState.Loaded || tip.originalAmount == null || tip.invalidated) return state
    val content = state.content
    return state.copy(
        content =
            content.copy(
                dock =
                    content.dock.copy(
                        primary =
                            ContentDetailDockButton(
                                label = "Check tip status",
                                icon = app.pantopus.android.ui.theme.PantopusIcon.HandCoins,
                            ),
                    ),
            ),
    )
}

/** Validate money input before conversion; NaN, infinity and overflow are never admitted. */
fun tipAmountCents(value: String): Int? =
    value.trim().replace("$", "").replace(",", "").toDoubleOrNull()
        ?.takeIf { it.isFinite() && it >= TipValidation.MIN_CENTS / 100.0 && it <= TipValidation.MAX_CENTS / 100.0 }
        ?.let { kotlin.math.round(it * 100).toInt() }
