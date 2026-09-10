@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.payments

import app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto
import app.pantopus.android.data.api.models.payments.ConfirmAddCardResponse
import app.pantopus.android.data.api.models.payments.PaymentMethodDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingCardSetupStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Same-setup recovery lives independently of the payments list/history projection. */
internal class PaymentsCardSetup(
    private val repository: PaymentsRepository,
    private val pendingSetups: PendingCardSetupStore,
    private val scope: CoroutineScope,
    private val events: Channel<PaymentsEvent>,
    private val canStart: () -> Boolean,
    private val onFreshMethods: (String, List<PaymentMethodDto>) -> Unit,
    private val onSavedReceipt: (String, PaymentMethodDto) -> Unit,
) {
    private val _phase = MutableStateFlow(AddCardPhase.Idle)
    val phase = _phase.asStateFlow()
    private var presentingSetupIntentId: String? = null
    private var pendingSetupIntentId: String? = null
    private var setupAccountId: String? = null
    private var retryConfirmation = false

    suspend fun restorePendingSetup() {
        if (_phase.value != AddCardPhase.Idle) return
        val accountId = pendingSetups.currentAccountId() ?: return
        val savedId = pendingSetups.read(accountId)
        if (_phase.value != AddCardPhase.Idle || pendingSetups.currentAccountId() != accountId) return
        setupAccountId = accountId
        pendingSetupIntentId = savedId
        if (savedId != null) _phase.value = AddCardPhase.Retry
    }

    fun tapAddMethod() {
        if (!canStart() || _phase.value.isBusy) return
        _phase.value = AddCardPhase.Preparing
        scope.launch {
            val accountId = pendingSetups.currentAccountId()
            if (accountId == null) {
                _phase.value = AddCardPhase.Idle
                events.send(PaymentsEvent.ShowMessage("Sign in again to add a payment method."))
                return@launch
            }
            if (setupAccountId != accountId) {
                pendingSetupIntentId = null
                retryConfirmation = false
            }
            setupAccountId = accountId
            pendingSetupIntentId = pendingSetupIntentId ?: pendingSetups.read(accountId)
            if (!ownsSetup(accountId)) return@launch
            if (retryConfirmation && pendingSetupIntentId != null) {
                reconcileAddedCard(accountId)
            } else {
                prepareAddedCard(accountId)
            }
        }
    }

    private suspend fun prepareAddedCard(accountId: String) {
        val requestedId = pendingSetupIntentId
        val result = repository.addCardSheetParams(requestedId)
        if (!ownsSetup(accountId)) return
        when (result) {
            is NetworkResult.Success -> {
                val params = result.data
                if (!params.setupIntentId.matches(Regex("seti_[A-Za-z0-9]+")) ||
                    (requestedId != null && params.setupIntentId != requestedId)
                ) {
                    retrySetup("Couldn't recover that card setup. Please try again.")
                    return
                }
                pendingSetupIntentId = params.setupIntentId
                val persisted = pendingSetups.save(accountId, params.setupIntentId)
                if (!ownsSetup(accountId)) return
                if (!persisted) {
                    retrySetup("Couldn't save card setup recovery. Please try again.")
                    return
                }
                handlePreparedSetup(accountId, params)
            }
            is NetworkResult.Failure -> handleSetupFailure(accountId, result.error)
        }
    }

    private suspend fun handlePreparedSetup(
        accountId: String,
        params: AddCardSheetParamsDto,
    ) {
        when (params.setupStatus) {
            "succeeded" -> reconcileAddedCard(accountId)
            "requires_payment_method", "requires_confirmation", "requires_action" -> {
                if (params.setupIntent.isBlank() || params.ephemeralKey.isBlank() || params.customer.isBlank()) {
                    retrySetup("Couldn't prepare that card setup. Please try again.")
                    return
                }
                presentingSetupIntentId = params.setupIntentId
                _phase.value = AddCardPhase.Presenting
                events.send(PaymentsEvent.PresentAddCardSheet(params))
            }
            "canceled" -> clearTerminalSetup(accountId)
            "processing" -> retrySetup("Your card setup is still processing. Tap Retry saving card to check again.")
            else -> retrySetup("Couldn't verify that card setup. Please try again.")
        }
    }

    /** A queued presentation is never delivered to a different signed-in account. */
    suspend fun canPresentAddCardSheet(params: AddCardSheetParamsDto): Boolean {
        val accountId = setupAccountId ?: return false
        return ownsSetup(accountId) && _phase.value == AddCardPhase.Presenting &&
            presentingSetupIntentId == params.setupIntentId
    }

    fun onAddCardOutcome(outcome: AddCardOutcome) {
        if (_phase.value != AddCardPhase.Presenting) return
        if (presentingSetupIntentId != pendingSetupIntentId) return
        val accountId = setupAccountId ?: return
        presentingSetupIntentId = null
        _phase.value = AddCardPhase.Confirming
        scope.launch {
            if (!ownsSetup(accountId)) return@launch
            when (outcome) {
                AddCardOutcome.Completed -> reconcileAddedCard(accountId)
                AddCardOutcome.Canceled -> _phase.value = AddCardPhase.Retry
                is AddCardOutcome.Failed -> retrySetup(outcome.message ?: "Couldn't add that card.")
            }
        }
    }

    private suspend fun reconcileAddedCard(accountId: String) {
        val setupIntentId = pendingSetupIntentId ?: return
        _phase.value = AddCardPhase.Confirming
        val result = repository.confirmAddCard(setupIntentId)
        if (!ownsSetup(accountId)) return
        when (result) {
            is NetworkResult.Success -> applyConfirmation(accountId, setupIntentId, result.data)
            is NetworkResult.Failure -> {
                retryConfirmation = result.error.code != 409
                handleSetupFailure(accountId, result.error)
            }
        }
    }

    private suspend fun applyConfirmation(
        accountId: String,
        setupIntentId: String,
        result: ConfirmAddCardResponse,
    ) {
        if (!result.confirmed || result.paymentMethod.id.isBlank()) {
            retryConfirmation = true
            retrySetup("Your card hasn't been saved yet. Tap Retry saving card.")
            return
        }
        val cleared = pendingSetups.clear(accountId, setupIntentId)
        if (!ownsSetup(accountId)) return
        if (cleared) pendingSetupIntentId = null
        retryConfirmation = !cleared
        val methods = repository.paymentMethods()
        if (!ownsSetup(accountId)) return
        when (methods) {
            is NetworkResult.Success -> onFreshMethods(accountId, methods.data.paymentMethods)
            is NetworkResult.Failure -> {
                onSavedReceipt(accountId, result.paymentMethod)
                if (cleared) {
                    events.send(
                        PaymentsEvent.ShowMessage(
                            "Your card was saved. Couldn't refresh the other payment methods; pull down to retry.",
                        ),
                    )
                }
            }
        }
        if (cleared) {
            _phase.value = AddCardPhase.Idle
        } else {
            retrySetup("Your card was saved. Couldn't finish recovery cleanup. Tap Retry saving card.")
        }
    }

    private suspend fun ownsSetup(accountId: String): Boolean {
        if (pendingSetups.currentAccountId() == accountId && setupAccountId == accountId) return true
        presentingSetupIntentId = null
        pendingSetupIntentId = null
        retryConfirmation = false
        setupAccountId = null
        _phase.value = AddCardPhase.Idle
        return false
    }

    private suspend fun handleSetupFailure(
        accountId: String,
        error: NetworkError,
    ) {
        if (error.code == 404) {
            clearTerminalSetup(accountId)
        } else {
            retrySetup("Saving your card hasn't been confirmed. Tap Retry saving card.")
        }
    }

    private suspend fun clearTerminalSetup(accountId: String) {
        val setupIntentId = pendingSetupIntentId
        val cleared = setupIntentId == null || pendingSetups.clear(accountId, setupIntentId)
        if (!ownsSetup(accountId)) return
        if (!cleared) {
            retrySetup("Couldn't clear that card setup. Tap Retry saving card.")
            return
        }
        pendingSetupIntentId = null
        retryConfirmation = false
        _phase.value = AddCardPhase.Idle
        events.send(PaymentsEvent.ShowMessage("That card setup is no longer available. Add a payment method to start again."))
    }

    private suspend fun retrySetup(message: String) {
        _phase.value = if (pendingSetupIntentId == null) AddCardPhase.Idle else AddCardPhase.Retry
        events.send(PaymentsEvent.ShowMessage(message))
    }
}
