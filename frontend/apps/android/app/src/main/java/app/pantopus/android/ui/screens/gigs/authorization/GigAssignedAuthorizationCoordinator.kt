@file:Suppress("PackageNaming", "TooManyFunctions", "ReturnCount")

package app.pantopus.android.ui.screens.gigs.authorization

import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationBody
import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationDto
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.checkout.GigBidCheckoutAdmission
import app.pantopus.android.ui.screens.gigs.checkout.GigCheckoutIdentity
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
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

/** A secret belongs only to this in-memory SDK launch; never save it to preferences or logs. */
data class GigAuthorizationPresentation(
    val token: String,
    val clientSecret: String,
    val attemptId: String,
    val intentId: String,
)

data class GigAssignedAuthorizationState(
    val visible: Boolean = false,
    val invalidated: Boolean = false,
    val busy: Boolean = false,
    val progress: GigAssignedAuthorizationDto? = null,
    val presentation: GigAuthorizationPresentation? = null,
    val message: String? = null,
) {
    val mayContinue: Boolean get() =
        !invalidated && !busy && presentation == null &&
            progress?.canRetry == true && progress.authorizationReady == false &&
            progress.cancellationPending == false && progress.authorizationAvailableAt == null
}

/** Read-only recovery and explicit continuation of one exact server-owned authorization. */
class GigAssignedAuthorizationCoordinator(
    private val repository: GigsRepository,
    private val scope: CoroutineScope,
    private val identity: suspend () -> GigCheckoutIdentity?,
    private val scopeMarker: () -> String?,
    identityChanges: Flow<Unit> = emptyFlow(),
    private val onReady: () -> Unit = {},
    private val admission: GigBidCheckoutAdmission = GigBidCheckoutAdmission.shared,
) {
    private val initialScopeMarker = scopeMarker()
    private val initialIdentity = scope.async(start = CoroutineStart.UNDISPATCHED) { readIdentity() }
    private val _state = MutableStateFlow(GigAssignedAuthorizationState())
    val state = _state.asStateFlow()
    private var target: AssignedAuthorizationTarget? = null
    private var serverScope: String? = null
    private var generation = 0
    private var claimedPresentation: String? = null
    private var claimingPresentation: String? = null

    init {
        scope.launch { identityChanges.collect { checkCurrentIdentity() } }
    }

    /** The existing screen cannot bind replacement account/session data after construction. */
    suspend fun isCurrentReadScope(): Boolean {
        if (_state.value.invalidated) return false
        if (initialScopeMarker != scopeMarker()) {
            invalidate()
            return false
        }
        val opening = initialIdentity.await()
        val current = readIdentity()
        val matchingIdentity = opening != null && opening == current
        if (_state.value.invalidated || !matchingIdentity || initialScopeMarker != scopeMarker()) {
            invalidate()
            return false
        }
        return true
    }

    fun checkIdentity() {
        scope.launch { checkCurrentIdentity() }
    }

    fun open(
        gig: GigDto,
        payment: GigPaymentDto,
    ) {
        if (_state.value.busy || _state.value.presentation != null || _state.value.invalidated) return
        val ticket = ++generation
        target = null
        serverScope = null
        _state.value = GigAssignedAuthorizationState(visible = true, busy = true)
        scope.launch {
            if (!owns(ticket)) return@launch
            if (!validTarget(gig, payment, initialIdentity.await()?.userId)) {
                _state.value = GigAssignedAuthorizationState(visible = true, message = "This assigned payment changed. Reopen the task.")
                return@launch
            }
            target = checkNotNull(GigAssignedAuthorizationProof.target(gig, payment, initialIdentity.await()?.userId))
            _state.value = _state.value.copy(busy = false)
            checkStatus()
        }
    }

    fun close() {
        generation++
        releasePresentation()
        target = null
        serverScope = null
        _state.value = GigAssignedAuthorizationState(invalidated = _state.value.invalidated)
    }

    fun checkStatus() = readStatus()

    private fun readStatus(expected: GigAuthorizationPresentation? = null) =
        operation { current, ticket ->
            val result = repository.assignedAuthorizationStatus(current.gigId)
            if (!owns(ticket)) return@operation
            check(result is NetworkResult.Success) { "Payment status is not confirmed. Check again before continuing." }
            if (expected != null) checkSameOperation(result.data, expected)
            applyReceipt(current, result.data, launchSdk = false)
        }

    /** A visible user action; the opening session proof and displayed money terms precede provider mutation. */
    fun continueAuthorization() {
        if (!_state.value.mayContinue) return
        val frozenScope = serverScope ?: return
        operation { current, ticket ->
            val actor = checkNotNull(initialIdentity.await())
            val body =
                GigAssignedAuthorizationBody(actor.userId, frozenScope, current.paymentId, current.payer, current.payee, current.amount)
            if (!owns(ticket)) return@operation
            val result = repository.continueAssignedAuthorization(current.gigId, body)
            if (!owns(ticket)) return@operation
            check(
                result is NetworkResult.Success,
            ) { "The authorization result is not confirmed. Check status to recover this same payment." }
            applyReceipt(current, result.data, launchSdk = true)
        }
    }

    suspend fun claimPresentation(token: String): Boolean {
        if (!checkCurrentIdentity() || claimedPresentation == token || claimingPresentation == token) return false
        val presentation = _state.value.presentation?.takeIf { it.token == token } ?: return false
        val current = target ?: return false
        val ticket = generation
        claimingPresentation = token
        try {
            val result = repository.assignedAuthorizationStatus(current.gigId)
            if (!owns(ticket) || _state.value.presentation?.token != token) return false
            check(result is NetworkResult.Success)
            val actor = checkNotNull(initialIdentity.await())
            GigAssignedAuthorizationProof.validate(current, result.data, actor.userId, serverScope)
            checkSameOperation(result.data, presentation)
            if (result.data.recoveryState != "action_required") {
                applyReceipt(current, result.data, launchSdk = false)
                return false
            }
            check(result.data.clientSecret == presentation.clientSecret)
            if (!owns(ticket)) return false
            if (!admission.claim(actor, current.gigId, token)) {
                _state.value =
                    _state.value.copy(
                        presentation = null,
                        message = "Payment is open in another task screen. Finish or close it there, then check status.",
                    )
                return false
            }
            claimedPresentation = token
            return true
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            if (owns(ticket)) {
                _state.value =
                    _state.value.copy(
                        progress = null, presentation = null, message = "Payment changed before checkout. Check status before continuing.",
                    )
            }
            return false
        } finally {
            if (claimingPresentation == token) claimingPresentation = null
        }
    }

    private fun checkSameOperation(
        receipt: GigAssignedAuthorizationDto,
        presentation: GigAuthorizationPresentation,
    ) {
        check(receipt.authorizationAttemptId == presentation.attemptId && receipt.paymentIntentId == presentation.intentId)
    }

    fun onSheetResult(
        token: String,
        outcome: CheckoutOutcome,
    ) {
        if (_state.value.presentation?.token != token || claimedPresentation != token) return
        val ticket = generation
        val presentation = checkNotNull(_state.value.presentation)
        scope.launch {
            if (!owns(ticket) || _state.value.presentation?.token != token) return@launch
            releasePresentation()
            _state.value = _state.value.copy(presentation = null, progress = null)
            when (outcome) {
                CheckoutOutcome.Paid -> readStatus(presentation)
                CheckoutOutcome.Canceled ->
                    _state.value =
                        _state.value.copy(
                            message = "Payment setup was closed. Check status before continuing.",
                        )
                is CheckoutOutcome.Declined ->
                    _state.value =
                        _state.value.copy(
                            message = "Payment could not be completed. Check status before trying again.",
                        )
            }
        }
    }

    fun presentationFailed(token: String) = onSheetResult(token, CheckoutOutcome.Declined(null))

    private fun operation(block: suspend (AssignedAuthorizationTarget, Int) -> Unit) {
        if (_state.value.busy || _state.value.presentation != null || _state.value.invalidated) return
        val current = target ?: return
        val ticket = generation
        _state.value = _state.value.copy(busy = true, message = null)
        scope.launch {
            try {
                if (owns(ticket)) block(current, ticket)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                if (owns(ticket)) {
                    _state.value =
                        _state.value.copy(
                            progress = null,
                            message = "Payment progress could not be verified. Check status to recover this same payment.",
                        )
                }
            } finally {
                if (ticket == generation) _state.value = _state.value.copy(busy = false)
            }
        }
    }

    private suspend fun applyReceipt(
        current: AssignedAuthorizationTarget,
        result: GigAssignedAuthorizationDto,
        launchSdk: Boolean,
    ) {
        val actor = initialIdentity.await()
        val fingerprint = GigAssignedAuthorizationProof.validate(current, result, actor?.userId, serverScope)
        val ready = result.authorizationReady == true
        val wasReady = _state.value.progress?.authorizationReady == true
        serverScope = fingerprint
        val presentation =
            if (launchSdk && !ready && result.recoveryState == "action_required") {
                val secret = checkNotNull(result.clientSecret)
                check(secret.startsWith("${result.paymentIntentId}_secret_"))
                GigAuthorizationPresentation(
                    UUID.randomUUID().toString(),
                    secret,
                    checkNotNull(result.authorizationAttemptId),
                    checkNotNull(result.paymentIntentId),
                )
            } else {
                null
            }
        _state.value = _state.value.copy(progress = result.copy(clientSecret = null), presentation = presentation)
        if (ready && !wasReady) onReady()
    }

    private suspend fun owns(ticket: Int): Boolean = ticket == generation && checkCurrentIdentity() && ticket == generation

    private suspend fun checkCurrentIdentity(): Boolean {
        if (!isCurrentReadScope()) return false
        if (initialIdentity.await()?.sessionId == null) {
            invalidate()
            return false
        }
        return true
    }

    private fun invalidate() {
        generation++
        releasePresentation()
        target = null
        serverScope = null
        _state.value =
            GigAssignedAuthorizationState(
                visible = _state.value.visible, invalidated = true, message = "Your account or session changed. Reopen the task.",
            )
    }

    private fun releasePresentation() {
        claimedPresentation?.let(admission::release)
        claimedPresentation = null
        claimingPresentation = null
    }

    private suspend fun readIdentity(): GigCheckoutIdentity? =
        try {
            identity()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            null
        }

    companion object {
        fun validTarget(
            gig: GigDto,
            payment: GigPaymentDto,
            actorId: String?,
        ): Boolean = GigAssignedAuthorizationProof.target(gig, payment, actorId) != null
    }
}
