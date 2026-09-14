@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.tenant.TenantHomeStatusResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.tenant.TenantRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key for the home being verified. */
const val VERIFY_LANDLORD_HOME_ID_KEY: String = "homeId"

/**
 * Aggregate UI state for the verify-landlord wizard. Combined into a
 * single record so the screen derives [WizardChrome] from one state
 * read.
 */
data class VerifyLandlordUiState(
    val currentStep: VerifyLandlordStep = VerifyLandlordStep.Start,
    val startContent: VerifyLandlordStartContent = VerifyLandlordStartContent.selectedHome,
    val form: VerifyLandlordForm = VerifyLandlordForm(),
    /**
     * Validation errors materialised lazily — `null` means "user
     * hasn't tried to submit yet, don't render error chips". Becomes
     * an empty [VerifyLandlordValidationErrors] or populated after the
     * first submit attempt.
     */
    val errors: VerifyLandlordValidationErrors? = null,
    val submitState: VerifyLandlordSubmitState = VerifyLandlordSubmitState.Idle,
    /**
     * Populated once the tenant approval request resolved. Drives the
     * [VerifyLandlordStep.Sent] content — every field comes off the wire.
     */
    val approvalResult: VerifyLandlordApprovalResult? = null,
    val isLoadingStatus: Boolean = false,
    val statusNeedsRetry: Boolean = false,
) {
    val isSubmitting: Boolean get() = isLoadingStatus || submitState is VerifyLandlordSubmitState.Submitting

    val isDirty: Boolean
        get() =
            form.ownerName.isNotEmpty() ||
                form.contactName.isNotEmpty() ||
                form.email.isNotEmpty() ||
                form.lease != null ||
                form.pmEnabled
}

/**
 * Drives the A12.5 / A12.6 wizard state machine:
 *
 *     Start -> Details -> submit -+- 201 -> Sent (landlord now has it)
 *                                 +- known duplicate -> Sent (existing pending/active lease)
 *                                 +- verified no-landlord error -> OpenPostcardVerification(homeId)
 *
 * Submit posts a real tenant approval request to
 * `POST /api/v1/tenant/request-approval` (route
 * `backend/routes/landlordTenant.js:483`, mounted at `/api/v1` in
 * `backend/app.js:397`) carrying the move-in date + message the user
 * entered, with the landlord / PM details appended to the message
 * (`tenantRequestSchema` has no structured column for them). When the
 * home has no verified landlord authority the backend answers 400 —
 * that is RN's "no landlord on file" branch, and we fall back to the
 * mail-verification review. The user confirms their complete address there
 * before a postcard request is retained and submitted.
 */
@HiltViewModel
open class VerifyLandlordWizardViewModel
    @Inject
    constructor(
        private val networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
        private val tenantRepository: TenantRepository,
        sessions: HomeClaimSessionScopeFactory,
    ) : ViewModel(),
        WizardModel {
        private val homeId: String =
            requireNotNull(savedStateHandle[VERIFY_LANDLORD_HOME_ID_KEY]) {
                "VerifyLandlordWizardViewModel requires a '$VERIFY_LANDLORD_HOME_ID_KEY' nav arg."
            }

        /** Configurable so JVM unit tests can drop the delay to zero. */
        protected open val submitDelayMillis: Long = SUBMIT_DELAY_DEFAULT_MILLIS

        private val _state = MutableStateFlow(VerifyLandlordUiState())
        val state: StateFlow<VerifyLandlordUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<VerifyLandlordOutboundEvent?>(null)
        private var pendingWork: Job? = null
        private val session = sessions.create(viewModelScope)

        init {
            viewModelScope.launch {
                session.invalidated.collect { if (it) sessionChanged() }
            }
        }

        private fun sessionChanged() {
            retirePendingWork()
            _state.update {
                it.copy(
                    currentStep = VerifyLandlordStep.Start,
                    form = VerifyLandlordForm(),
                    errors = null,
                    approvalResult = null,
                    statusNeedsRetry = false,
                )
            }
            pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
        }

        private fun isCurrentSession(): Boolean = session.isCurrent.also { if (!it) sessionChanged() }

        private suspend fun requireCurrentSession() {
            currentCoroutineContext().ensureActive()
            if (!session.confirmCurrent()) {
                sessionChanged()
                throw CancellationException("The opening session changed")
            }
            currentCoroutineContext().ensureActive()
        }

        fun onDeparture() = retirePendingWork()

        /** Reuse the existing status read; opening this screen never creates a request. */
        fun restoreSavedRequest() {
            if (!isCurrentSession()) return
            val snapshot = _state.value
            if (snapshot.isSubmitting || pendingEvent.value != null) return
            pendingWork =
                viewModelScope.launch {
                    _state.update { it.copy(isLoadingStatus = true) }
                    requireCurrentSession()
                    val result = tenantRepository.homeStatus(homeId)
                    currentCoroutineContext().ensureActive()
                    requireCurrentSession()
                    val status = (result as? NetworkResult.Success)?.data
                    if (status != null && restoreStatus(status)) {
                        _state.update { it.copy(isLoadingStatus = false, statusNeedsRetry = false) }
                    } else {
                        _state.update {
                            it.copy(
                                isLoadingStatus = false,
                                statusNeedsRetry = true,
                                submitState =
                                    VerifyLandlordSubmitState.Error(
                                        "Couldn't check your saved request. Retry before continuing.",
                                    ),
                            )
                        }
                    }
                }
        }

        @Suppress("ReturnCount")
        private fun restoreStatus(status: TenantHomeStatusResponse): Boolean {
            val saved = status.lease ?: return false
            val matchesActor = status.requestContext.actorId == session.actorId
            if (!status.matches(homeId) || !matchesActor) return false
            val existing = saved.state == "pending" || saved.state == "active"
            if (existing) {
                val lease = saved.lease ?: return false
                val matchesLease = lease.id == status.requestContext.leaseId && lease.homeId == homeId
                val matchesState = lease.state == saved.state && lease.state == status.requestContext.leaseState
                if (!matchesLease || !matchesState) return false
                _state.update {
                    it.copy(
                        currentStep = VerifyLandlordStep.Sent,
                        submitState = VerifyLandlordSubmitState.Submitted,
                        approvalResult =
                            VerifyLandlordApprovalResult(
                                kind =
                                    if (saved.state == "active") {
                                        VerifyLandlordApprovalResult.Kind.AlreadyActive
                                    } else {
                                        VerifyLandlordApprovalResult.Kind.AlreadyPending
                                    },
                                submittedAt = lease.createdAt,
                                requestedStartAt = lease.startAt,
                                message = lease.metadata?.message,
                            ),
                    )
                }
            } else if (saved.state in setOf("none", "denied", "ended")) {
                _state.update {
                    it.copy(
                        currentStep =
                            if (it.currentStep == VerifyLandlordStep.Details) {
                                VerifyLandlordStep.Details
                            } else {
                                VerifyLandlordStep.Start
                            },
                        submitState = VerifyLandlordSubmitState.Idle,
                        approvalResult = null,
                    )
                }
            } else {
                return false
            }
            return true
        }

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            retirePendingWork()
            when (_state.value.currentStep) {
                VerifyLandlordStep.Start, VerifyLandlordStep.Sent ->
                    pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
                VerifyLandlordStep.Details -> {
                    _state.update { it.copy(currentStep = VerifyLandlordStep.Start, errors = null) }
                }
            }
        }

        override fun onDiscard() {
            retirePendingWork()
            pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
        }

        private fun retirePendingWork() {
            pendingWork?.cancel()
            pendingWork = null
            _state.update { it.copy(submitState = VerifyLandlordSubmitState.Idle, isLoadingStatus = false) }
        }

        override fun onPrimary() {
            if (!isCurrentSession() || _state.value.isLoadingStatus) return
            if (_state.value.statusNeedsRetry) {
                restoreSavedRequest()
                return
            }
            when (_state.value.currentStep) {
                VerifyLandlordStep.Start -> {
                    _state.update { it.copy(currentStep = VerifyLandlordStep.Details) }
                }
                VerifyLandlordStep.Details ->
                    if (!_state.value.isSubmitting) {
                        pendingWork = viewModelScope.launch { submit() }
                    }
                VerifyLandlordStep.Sent -> pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
            }
        }

        override fun onSecondary() {
            if (!isCurrentSession()) return
            // Only the Sent step carries a secondary — the mailed-code
            // fallback (RN's "Verify with a mailed code" alternative path).
            if (_state.value.currentStep != VerifyLandlordStep.Sent) return
            if (!_state.value.isSubmitting) {
                pendingWork = viewModelScope.launch { startPostcardFallback() }
            }
        }

        // MARK: - Field mutations

        fun attachLeaseTapped() {
            if (!isCurrentSession() || _state.value.isSubmitting) return
            _state.update {
                it.copy(
                    errors = null,
                    submitState =
                        VerifyLandlordSubmitState.Error(
                            "Lease attachments aren't available in this request yet. You can submit without a document.",
                        ),
                )
            }
        }

        fun setOwnerName(value: String) = updateForm { it.copy(ownerName = value) }

        fun setContactName(value: String) = updateForm { it.copy(contactName = value) }

        fun setEmail(value: String) = updateForm { it.copy(email = value) }

        fun setPhone(value: String) = updateForm(revalidate = false) { it.copy(phone = value) }

        fun setLease(lease: VerifyLandlordLeaseFile?) = updateForm { it.copy(lease = lease) }

        fun setPMEnabled(enabled: Boolean) =
            updateForm { current ->
                if (enabled) {
                    current.copy(pmEnabled = true)
                } else {
                    current.copy(pmEnabled = false, pmName = "", pmEmail = "", pmPhone = "")
                }
            }

        fun setPMName(value: String) = updateForm { it.copy(pmName = value) }

        fun setPMEmail(value: String) = updateForm { it.copy(pmEmail = value) }

        fun setPMPhone(value: String) = updateForm(revalidate = false) { it.copy(pmPhone = value) }

        fun setMoveInDate(value: String) = updateForm { it.copy(moveInDate = value) }

        fun setMessageToLandlord(value: String) =
            updateForm(revalidate = false) {
                it.copy(messageToLandlord = value.take(VerifyLandlordForm.MESSAGE_MAX_LENGTH))
            }

        /**
         * Explicit preview/sample injection. Live forms start empty.
         */
        fun setVariant(
            variant: VerifyLandlordVariant,
            form: VerifyLandlordForm? = null,
        ) {
            val next =
                when (variant) {
                    VerifyLandlordVariant.Canonical -> VerifyLandlordSampleData.canonical
                    VerifyLandlordVariant.FastTrack -> VerifyLandlordSampleData.fastTrack
                }
            _state.update { it.copy(startContent = next, form = form ?: it.form) }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        // MARK: - Submit

        @Suppress("ReturnCount")
        private suspend fun submit() {
            requireCurrentSession()
            val snapshot = _state.value
            if (snapshot.isSubmitting) return
            val live = snapshot.form.validate()
            _state.update { it.copy(errors = live) }
            if (!live.isEmpty) {
                val noun = if (live.count == 1) "thing" else "things"
                _state.update {
                    it.copy(
                        submitState = VerifyLandlordSubmitState.Error("Fix ${live.count} $noun to submit"),
                    )
                }
                return
            }
            _state.update { it.copy(submitState = VerifyLandlordSubmitState.Submitting) }
            if (!networkMonitor.isOnline.value) {
                _state.update {
                    it.copy(
                        submitState =
                            VerifyLandlordSubmitState.Error(
                                "You're offline. Try again when you're back online.",
                            ),
                    )
                }
                return
            }
            // Real submit: ask the home's verified landlord to approve the
            // tenancy. Everything the user typed travels with it — the
            // move-in date as `start_at`, and the note + landlord / PM
            // details folded into `message`.
            if (submitDelayMillis > 0) delay(submitDelayMillis)
            val form = _state.value.form
            val request =
                TenantRequestApprovalRequest(
                    homeId = homeId,
                    startAt = form.startAtISO,
                    message = form.composedMessage,
                )
            val result = tenantRepository.requestApproval(request, ::requireCurrentSession)
            currentCoroutineContext().ensureActive()
            requireCurrentSession()
            when (result) {
                is NetworkResult.Success -> {
                    val lease = result.data.lease
                    _state.update {
                        it.copy(
                            submitState = VerifyLandlordSubmitState.Submitted,
                            currentStep = VerifyLandlordStep.Sent,
                            approvalResult =
                                VerifyLandlordApprovalResult(
                                    kind = VerifyLandlordApprovalResult.Kind.Submitted,
                                    submittedAt = lease.createdAt,
                                    requestedStartAt = lease.startAt,
                                    message = lease.metadata?.message,
                                ),
                        )
                    }
                }
                is NetworkResult.Failure -> handleApprovalFailure(result)
            }
        }

        /** Only explicit lease/no-landlord responses establish these alternate states. */
        private suspend fun handleApprovalFailure(result: NetworkResult.Failure) {
            val message = result.error.message
            val existingKind =
                when (message) {
                    "You already have a pending request for this home" -> VerifyLandlordApprovalResult.Kind.AlreadyPending
                    "You already have an active lease at this home" -> VerifyLandlordApprovalResult.Kind.AlreadyActive
                    else -> null
                }
            when {
                result.error.code == HTTP_CONFLICT && existingKind != null -> {
                    _state.update {
                        it.copy(
                            submitState = VerifyLandlordSubmitState.Submitted,
                            currentStep = VerifyLandlordStep.Sent,
                            approvalResult =
                                VerifyLandlordApprovalResult(kind = existingKind, serverMessage = message),
                        )
                    }
                }
                result.error.code == HTTP_BAD_REQUEST &&
                    message == "This property has no verified landlord. Cannot submit a lease request." ->
                    startPostcardFallback()
                else ->
                    _state.update {
                        it.copy(
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    message.ifEmpty { "Couldn't send the request. Try again." },
                                ),
                        )
                    }
            }
        }

        /** Opens address review; this navigation never requests a mailing. */
        fun startPostcardFallback() {
            if (!isCurrentSession()) return
            _state.update { it.copy(submitState = VerifyLandlordSubmitState.Idle, isLoadingStatus = false) }
            pendingEvent.value = VerifyLandlordOutboundEvent.OpenPostcardVerification(homeId)
        }

        // MARK: - Chrome derivation

        private fun computeChrome(state: VerifyLandlordUiState): WizardChrome =
            when (state.currentStep) {
                VerifyLandlordStep.Start ->
                    WizardChrome(
                        title = "Verify landlord",
                        progressLabel = WizardProgressLabel.StepOf(1, TOTAL_STEPS),
                        progressFraction = 1f / TOTAL_STEPS,
                        leading = WizardLeadingControl.Close,
                        primaryCtaLabel = if (state.statusNeedsRetry) "Retry status" else "Start verification",
                        primaryCtaEnabled = !state.isLoadingStatus,
                        secondaryCta = null,
                        isSubmitting = state.isLoadingStatus,
                        dirty = state.isDirty,
                        showsProgressBar = true,
                    )
                VerifyLandlordStep.Details -> {
                    val live = state.form.validate()
                    val blocked = (state.errors != null && !live.isEmpty && !state.statusNeedsRetry) || state.isSubmitting
                    WizardChrome(
                        title = "Verify landlord",
                        progressLabel = WizardProgressLabel.StepOf(2, TOTAL_STEPS),
                        progressFraction = 2f / TOTAL_STEPS,
                        leading = WizardLeadingControl.Back,
                        primaryCtaLabel = if (state.statusNeedsRetry) "Retry status" else "Submit",
                        primaryCtaEnabled = !blocked,
                        secondaryCta = null,
                        isSubmitting = state.isSubmitting,
                        dirty = state.isDirty,
                        showsProgressBar = true,
                    )
                }
                VerifyLandlordStep.Sent ->
                    WizardChrome(
                        title = "Verify landlord",
                        progressLabel = WizardProgressLabel.StepOf(TOTAL_STEPS, TOTAL_STEPS),
                        progressFraction = 1f,
                        leading = WizardLeadingControl.Close,
                        primaryCtaLabel = if (state.statusNeedsRetry) "Retry status" else "Done",
                        primaryCtaEnabled = !state.isSubmitting,
                        secondaryCta =
                            WizardSecondaryCta(
                                label = "Review mail verification",
                                testTag = "verifyLandlordMailCodeCTA",
                            ),
                        isSubmitting = state.isSubmitting,
                        dirty = false,
                        showsProgressBar = true,
                    )
            }

        // MARK: - Helpers

        private inline fun updateForm(
            revalidate: Boolean = true,
            crossinline transform: (VerifyLandlordForm) -> VerifyLandlordForm,
        ) {
            if (!isCurrentSession()) return
            _state.update { current ->
                val nextForm = transform(current.form)
                val nextErrors =
                    if (revalidate && current.errors != null) {
                        nextForm.validate()
                    } else {
                        current.errors
                    }
                current.copy(form = nextForm, errors = nextErrors)
            }
        }

        companion object {
            /** Total steps surfaced to the user — the third is A12.7
             *  (the sibling postcard verification screen). */
            const val TOTAL_STEPS: Int = 3
            const val SUBMIT_DELAY_DEFAULT_MILLIS: Long = 800L

            private const val HTTP_BAD_REQUEST = 400
            private const val HTTP_CONFLICT = 409
        }
    }
