@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.models.payments.PaymentRefundAttempt
import app.pantopus.android.data.api.models.payments.PaymentRefundConflictDto
import app.pantopus.android.data.api.models.payments.PaymentRefundRequestDto
import app.pantopus.android.data.api.models.payments.RefundPaymentSummary
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingRefundStore
import app.pantopus.android.data.payments.RefundValidation
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.launch
import java.util.UUID

data class GigRefundState(
    val visible: Boolean = false,
    val invalidated: Boolean = false,
    val busy: Boolean = false,
    val ready: Boolean = false,
    val summary: RefundPaymentSummary? = null,
    val requests: List<PaymentRefundRequestDto> = emptyList(),
    val attempt: PaymentRefundAttempt? = null,
    val error: String? = null,
) {
    val mayRequest: Boolean get() = !invalidated && ready && !busy && attempt == null && summary?.mayRequest == true
    val activeReceipt: PaymentRefundRequestDto? get() = requests.firstOrNull { it.requestId == attempt?.requestId }
    val unconfirmed: Boolean get() = attempt != null && activeReceipt == null
    val mayRetry: Boolean get() =
        !invalidated && ready && !busy && attempt != null &&
            (activeReceipt == null || (activeReceipt?.pending == true && activeReceipt?.canRetry == true))
}

/** Keeps one exact operation across disconnects; the server owns refund truth. */
class GigRefundCoordinator(
    private val repository: PaymentsRepository,
    private val store: PendingRefundStore,
    private val scope: CoroutineScope,
    private val identity: suspend () -> GigRefundIdentity?,
    moshi: Moshi,
    identityChanges: Flow<Unit> = emptyFlow(),
    private val onChanged: () -> Unit = {},
) {
    private data class Target(val paymentId: String, val total: Int, val key: String)

    private val initialIdentity = scope.async(start = CoroutineStart.UNDISPATCHED) { readIdentity() }
    private val _state = MutableStateFlow(GigRefundState())
    val state = _state.asStateFlow()
    private val conflictAdapter = moshi.adapter(PaymentRefundConflictDto::class.java)
    private var target: Target? = null
    private var generation = 0

    init {
        scope.launch { identityChanges.collect { isCurrentIdentity() } }
    }

    suspend fun isCurrentIdentity(): Boolean {
        if (_state.value.invalidated) return false
        val first = initialIdentity.await()
        if (first == null || readIdentity() != first) {
            generation++
            target = null
            _state.value = GigRefundState(visible = _state.value.visible, invalidated = true)
            return false
        }
        return true
    }

    fun open(
        gigId: String,
        payment: GigPaymentDto,
    ) {
        if (_state.value.busy || _state.value.invalidated) return
        val ticket = ++generation
        target = null
        _state.value = GigRefundState(visible = true, busy = true)
        scope.launch {
            if (!isCurrentIdentity() || ticket != generation) return@launch
            val actor = checkNotNull(initialIdentity.await())
            if (!validTarget(gigId, payment, actor.actorId)) {
                _state.value = GigRefundState(visible = true, error = "This payment could not be verified. Reopen the task.")
                return@launch
            }
            target =
                Target(
                    checkNotNull(payment.id), checkNotNull(payment.amountTotal), "${actor.apiOrigin}|${actor.actorId}|${payment.id}",
                )
            _state.value = GigRefundState(visible = true)
            checkStatus()
        }
    }

    fun close() {
        generation++
        target = null
        _state.value = GigRefundState(invalidated = _state.value.invalidated)
    }

    fun checkStatus() =
        operation { current, ticket ->
            _state.value = _state.value.copy(ready = false, error = null)
            val saved = _state.value.attempt ?: store.read(current.key)
            if (!owns(ticket)) return@operation
            _state.value = _state.value.copy(attempt = saved)
            val result = repository.refunds(current.paymentId)
            if (!owns(ticket)) return@operation
            check(result is NetworkResult.Success) { "Could not confirm refund status. Check again before starting another request." }
            val data = result.data
            validate(current, data.payment, data.requests)
            val pending = data.requests.filter { it.pending }
            check(pending.size <= 1) { "Refund recovery needs support." }
            val exact = saved?.let { attempt -> data.requests.firstOrNull { it.requestId == attempt.requestId } }
            check(saved == null || exact == null || saved == exact.attempt) { "Saved refund terms do not match the server request." }
            val next =
                if (exact != null && !exact.pending) {
                    store.clear(current.key)
                    pending.firstOrNull()?.attempt
                } else {
                    // A negative read never erases a locally sent unknown operation.
                    exact?.attempt ?: saved ?: pending.firstOrNull()?.attempt
                }
            if (!owns(ticket)) return@operation
            _state.value = _state.value.copy(summary = data.payment, requests = data.requests, attempt = next, ready = true)
        }

    /** Only invoked after explicit confirmation. A retry never recalculates amount. */
    fun submit(
        amountText: String,
        reason: String,
    ) {
        val current = _state.value
        if (!current.mayRequest || reason !in RefundValidation.reasons) return
        val summary = checkNotNull(current.summary)
        val amount = if (summary.releasing || amountText.isBlank()) null else RefundValidation.cents(amountText)
        val hasTypedRefundAmount = !summary.releasing && amountText.isNotBlank()
        if (hasTypedRefundAmount && (amount == null || amount !in MINIMUM_REFUND..summary.remaining)) {
            _state.value = current.copy(error = "Enter an amount from $0.50 to ${RefundValidation.money(summary.remaining)}.")
            return
        }
        send(PaymentRefundAttempt(UUID.randomUUID().toString(), amount, reason))
    }

    fun retry() {
        if (!_state.value.mayRetry) return
        send(checkNotNull(_state.value.attempt))
    }

    private fun send(attempt: PaymentRefundAttempt) =
        operation { current, ticket ->
            // Durability precedes the POST. Storage failure cannot create a new operation.
            store.save(current.key, attempt)
            if (!owns(ticket)) return@operation
            _state.value = _state.value.copy(attempt = attempt, error = null)
            val result = repository.refund(current.paymentId, attempt)
            if (!owns(ticket)) return@operation
            if (result is NetworkResult.Failure) {
                recoverConflict(current, result.error, attempt, ticket)
                error("The result is not confirmed. Check status to recover this request.")
            }
            check(result is NetworkResult.Success)
            val receipt = result.data.refundRequest
            validate(current, result.data.payment, listOf(receipt))
            check(receipt.attempt == attempt) { "The result is not confirmed. Check status to recover this request." }
            if (!receipt.pending) store.clear(current.key)
            if (!owns(ticket)) return@operation
            _state.value =
                _state.value.copy(
                    summary = result.data.payment,
                    requests = listOf(receipt) + _state.value.requests.filterNot { it.requestId == receipt.requestId },
                    attempt = receipt.attempt.takeIf { receipt.pending }, ready = true,
                )
            onChanged()
        }

    private suspend fun recoverConflict(
        current: Target,
        error: NetworkError,
        sent: PaymentRefundAttempt,
        ticket: Int,
    ) {
        val client = error as? NetworkError.ClientError ?: return
        val conflict = runCatching { client.body?.let(conflictAdapter::fromJson) }.getOrNull() ?: return
        val receipt = conflict.refundRequest
        if (!RefundValidation.validReceipt(receipt, current.paymentId, current.total)) return
        if (receipt.attempt == sent) {
            _state.value = _state.value.copy(attempt = receipt.attempt)
        } else if (client.code == HTTP_CONFLICT && conflict.code == "REFUND_ACTIVE" && receipt.requestId != sent.requestId) {
            store.clear(current.key)
            if (owns(ticket)) _state.value = _state.value.copy(attempt = receipt.attempt)
        }
    }

    private fun validate(
        current: Target,
        payment: RefundPaymentSummary,
        requests: List<PaymentRefundRequestDto>,
    ) {
        check(
            RefundValidation.validSummary(payment, current.paymentId, current.total) &&
                requests.map { it.requestId }.distinct().size == requests.size &&
                requests.all { RefundValidation.validReceipt(it, current.paymentId, current.total) },
        ) { "Refund status could not be verified. Check again before continuing." }
    }

    private suspend fun owns(ticket: Int): Boolean = isCurrentIdentity() && ticket == generation

    @Suppress("TooGenericExceptionCaught")
    private suspend fun readIdentity(): GigRefundIdentity? =
        try {
            identity()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            null
        }

    @Suppress("TooGenericExceptionCaught") // One boundary retains unknown outcomes from storage, decoding and transport.
    private fun operation(block: suspend (Target, Int) -> Unit) {
        val current = target ?: return
        if (_state.value.busy || _state.value.invalidated || !_state.value.visible) return
        val ticket = generation
        _state.value = _state.value.copy(busy = true)
        scope.launch {
            var acquired = false
            try {
                if (!owns(ticket)) return@launch
                acquired = synchronized(active) { active.add(current.key) }
                check(acquired) { "This payment is being checked in another screen. Check status shortly." }
                block(current, ticket)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (owns(
                        ticket,
                    )
                ) {
                    _state.value = _state.value.copy(ready = false, error = error.message ?: "Could not confirm this request.")
                }
            } finally {
                if (acquired) synchronized(active) { active.remove(current.key) }
                if (ticket == generation) _state.value = _state.value.copy(busy = false)
            }
        }
    }

    companion object {
        private const val MINIMUM_REFUND = 50
        private const val HTTP_CONFLICT = 409
        private val active = mutableSetOf<String>()

        fun validTarget(
            gigId: String,
            payment: GigPaymentDto,
            actorId: String?,
        ): Boolean =
            !actorId.isNullOrBlank() && payment.payerId == actorId && payment.gigId == gigId &&
                payment.id?.let(RefundValidation::validId) == true && payment.currency.equals("usd", true) &&
                (payment.amountTotal ?: 0) >= MINIMUM_REFUND
    }
}
