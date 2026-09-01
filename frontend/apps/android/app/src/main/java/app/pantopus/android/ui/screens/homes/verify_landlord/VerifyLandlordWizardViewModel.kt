@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeVerificationRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.tenant.TenantRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
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
    val startContent: VerifyLandlordStartContent = VerifyLandlordSampleData.canonical,
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
) {
    val isSubmitting: Boolean get() = submitState is VerifyLandlordSubmitState.Submitting

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
 *                                 +- 409 -> Sent (existing pending/active lease)
 *                                 +- 400 -> OpenPostcardVerification(homeId)
 *
 * Submit posts a real tenant approval request to
 * `POST /api/v1/tenant/request-approval` (route
 * `backend/routes/landlordTenant.js:483`, mounted at `/api/v1` in
 * `backend/app.js:397`) carrying the move-in date + message the user
 * entered, with the landlord / PM details appended to the message
 * (`tenantRequestSchema` has no structured column for them). When the
 * home has no verified landlord authority the backend answers 400 —
 * that is RN's "no landlord on file" branch, and we fall back to the
 * mailed-code path: `POST /api/homes/:id/request-postcard` (route
 * `backend/routes/homeOwnership.js:2452`) followed by the outbound
 * `OpenPostcardVerification` event.
 */
@HiltViewModel
open class VerifyLandlordWizardViewModel
    @Inject
    constructor(
        private val networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
        private val verificationRepository: HomeVerificationRepository,
        private val tenantRepository: TenantRepository,
    ) : ViewModel(),
        WizardModel {
        private val homeId: String =
            requireNotNull(savedStateHandle[VERIFY_LANDLORD_HOME_ID_KEY]) {
                "VerifyLandlordWizardViewModel requires a '$VERIFY_LANDLORD_HOME_ID_KEY' nav arg."
            }

        /** Configurable so JVM unit tests can drop the delay to zero. */
        protected open val submitDelayMillis: Long = SUBMIT_DELAY_DEFAULT_MILLIS

        private val _state =
            MutableStateFlow(
                VerifyLandlordUiState(
                    startContent = VerifyLandlordSampleData.startContent(homeId),
                    form = VerifyLandlordSampleData.formSeed(homeId),
                ),
            )
        val state: StateFlow<VerifyLandlordUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<VerifyLandlordOutboundEvent?>(null)

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            when (_state.value.currentStep) {
                VerifyLandlordStep.Start, VerifyLandlordStep.Sent ->
                    pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
                VerifyLandlordStep.Details -> {
                    _state.update { it.copy(currentStep = VerifyLandlordStep.Start, errors = null) }
                }
            }
        }

        override fun onDiscard() {
            pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
        }

        override fun onPrimary() {
            when (_state.value.currentStep) {
                VerifyLandlordStep.Start -> {
                    _state.update { it.copy(currentStep = VerifyLandlordStep.Details) }
                }
                VerifyLandlordStep.Details -> viewModelScope.launch { submit() }
                VerifyLandlordStep.Sent -> pendingEvent.value = VerifyLandlordOutboundEvent.Dismiss
            }
        }

        override fun onSecondary() {
            // Only the Sent step carries a secondary — the mailed-code
            // fallback (RN's "Verify with a mailed code" alternative path).
            if (_state.value.currentStep != VerifyLandlordStep.Sent) return
            viewModelScope.launch { startPostcardFallback() }
        }

        // MARK: - Field mutations

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
         * Used by previews / sample-data toggles + the dashboard
         * fast-track decision tree. Mirrors iOS' `setVariant(_:)`.
         */
        fun setVariant(variant: VerifyLandlordVariant) {
            val next =
                when (variant) {
                    VerifyLandlordVariant.Canonical -> VerifyLandlordSampleData.canonical
                    VerifyLandlordVariant.FastTrack -> VerifyLandlordSampleData.fastTrack
                }
            _state.update { it.copy(startContent = next) }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        // MARK: - Submit

        @Suppress("ReturnCount")
        private suspend fun submit() {
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
            when (val result = tenantRepository.requestApproval(request)) {
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

        /**
         * Branches the `request-approval` non-2xx answers into the states
         * we can observe without a tenant status endpoint.
         */
        private suspend fun handleApprovalFailure(result: NetworkResult.Failure) {
            val message = result.error.message
            when (result.error.code) {
                HTTP_CONFLICT -> {
                    // Duplicate request — the server just told us the real
                    // state, so render it instead of failing the wizard.
                    val kind =
                        if (message.contains("active lease", ignoreCase = true)) {
                            VerifyLandlordApprovalResult.Kind.AlreadyActive
                        } else {
                            VerifyLandlordApprovalResult.Kind.AlreadyPending
                        }
                    _state.update {
                        it.copy(
                            submitState = VerifyLandlordSubmitState.Submitted,
                            currentStep = VerifyLandlordStep.Sent,
                            approvalResult =
                                VerifyLandlordApprovalResult(kind = kind, serverMessage = message),
                        )
                    }
                }
                HTTP_BAD_REQUEST, HTTP_NOT_FOUND ->
                    // "This property has no verified landlord…" — RN's
                    // no-landlord branch. Fall back to the mailed-code path
                    // so the tenant still has a way through.
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

        /**
         * Mails the verification postcard and hands the user off to the
         * A12.7 tracker. Used both as the no-landlord fallback and as the
         * Sent step's secondary CTA.
         */
        suspend fun startPostcardFallback() {
            _state.update { it.copy(submitState = VerifyLandlordSubmitState.Submitting) }
            when (val result = verificationRepository.requestPostcard(homeId)) {
                is NetworkResult.Success -> {
                    _state.update { it.copy(submitState = VerifyLandlordSubmitState.Submitted) }
                    pendingEvent.value = VerifyLandlordOutboundEvent.OpenPostcardVerification(homeId)
                }
                is NetworkResult.Failure -> {
                    // A pending/duplicate code (400) or address cap (429)
                    // means a postcard is already on its way — proceed to
                    // enter it. Other failures surface inline so the user
                    // can retry.
                    if (result.error.code == HTTP_BAD_REQUEST || result.error.code == HTTP_TOO_MANY_REQUESTS) {
                        _state.update { it.copy(submitState = VerifyLandlordSubmitState.Submitted) }
                        pendingEvent.value = VerifyLandlordOutboundEvent.OpenPostcardVerification(homeId)
                    } else {
                        _state.update {
                            it.copy(
                                submitState =
                                    VerifyLandlordSubmitState.Error(
                                        result.error.message.ifEmpty {
                                            "Couldn't request the verification postcard. Try again."
                                        },
                                    ),
                            )
                        }
                    }
                }
            }
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
                        primaryCtaLabel = "Start verification",
                        primaryCtaEnabled = true,
                        secondaryCta = null,
                        isSubmitting = false,
                        dirty = state.isDirty,
                        showsProgressBar = true,
                    )
                VerifyLandlordStep.Details -> {
                    val live = state.form.validate()
                    val blocked = (state.errors != null && !live.isEmpty) || state.isSubmitting
                    WizardChrome(
                        title = "Verify landlord",
                        progressLabel = WizardProgressLabel.StepOf(2, TOTAL_STEPS),
                        progressFraction = 2f / TOTAL_STEPS,
                        leading = WizardLeadingControl.Back,
                        primaryCtaLabel = "Submit",
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
                        primaryCtaLabel = "Done",
                        primaryCtaEnabled = !state.isSubmitting,
                        secondaryCta =
                            WizardSecondaryCta(
                                label = "Mail me a code",
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
            private const val HTTP_NOT_FOUND = 404
            private const val HTTP_CONFLICT = 409
            private const val HTTP_TOO_MANY_REQUESTS = 429
        }
    }
