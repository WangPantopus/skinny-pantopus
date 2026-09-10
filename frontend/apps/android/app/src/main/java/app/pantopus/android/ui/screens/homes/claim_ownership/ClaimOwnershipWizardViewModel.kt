@file:Suppress(
    "PackageNaming",
    "TooManyFunctions",
    "LongMethod",
    "CyclomaticComplexMethod",
    "LoopWithTooManyJumpStatements",
    "MagicNumber",
)

package app.pantopus.android.ui.screens.homes.claim_ownership

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.ClaimRoutingClassification
import app.pantopus.android.data.api.models.homes.SubmitClaimRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HOME_EVIDENCE_MAX_BYTES
import app.pantopus.android.data.homes.HOME_EVIDENCE_MIMES
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceAccess
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceAccessFactory
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_SESSION_CHANGED
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewSnapshot
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.IOException
import java.util.UUID
import javax.inject.Inject

/** Nav-arg key for the home being claimed. */
const val CLAIM_OWNERSHIP_HOME_ID_KEY: String = "homeId"

/**
 * Nav-arg key selecting the evidence variant — `owner` (default) or
 * `residency`. Mirrors RN's `?verificationType=residency` query param
 * (`src/app/homes/[id]/claim-owner/evidence.tsx:86`).
 */
const val CLAIM_VERIFICATION_TYPE_KEY: String = "verificationType"

/**
 * Aggregate UI state for the Claim Ownership wizard. Combined so the
 * screen derives the [WizardChrome] from a single state read.
 */
data class ClaimOwnershipUiState(
    val currentStep: ClaimOwnershipStep = ClaimOwnershipStep.Start,
    /**
     * Which verification this run performs. Drives the slot set, the
     * wizard copy, and the `claim_type` sent on submit.
     */
    val verificationType: ClaimVerificationType = ClaimVerificationType.Owner,
    /**
     * Selected `evidence_type` for slots that accept several document
     * kinds (ownership proof / residency proof). `null` until the user
     * picks one on the residency path.
     */
    val selectedDocumentType: String? = null,
    val startContent: ClaimOwnershipStartContent = ClaimOwnershipSampleData.canonicalStart,
    val slots: Map<ClaimEvidenceSlot, ClaimSlotState> =
        ClaimEvidenceSlot.entries.associateWith { ClaimSlotState.Empty },
    /**
     * Per-slot address-match verdict from the on-upload OCR check. Computed
     * when a file is picked (sample-data heuristic until the evidence
     * pipeline returns a parsed address) and cleared when the slot is reset.
     */
    val addressMatches: Map<ClaimEvidenceSlot, ClaimAddressMatch> = emptyMap(),
    val isSubmitting: Boolean = false,
    val submitError: String? = null,
    // MARK: - Start-step method picker (A12.3)
    /**
     * `has_verified_owner` from `GET /api/homes/:id/public-profile`.
     */
    val hasVerifiedOwner: Boolean = false,
    /** `is_member` from the same call. */
    val isMember: Boolean = false,
    val selectedStartMethod: ClaimStartMethod = ClaimStartMethod.VerifyOwnership,
    /** True while `POST /:id/request-household-from-owner` is in flight. */
    val isSendingAskRequest: Boolean = false,
    /** Success copy for the confirm dialog; dismissing it closes the wizard. */
    val askRequestConfirmation: String? = null,
    /** Failure copy for the alert; dismissing keeps the wizard open. */
    val askRequestError: String? = null,
    /**
     * Non-null when the claim POST came back 409 (or with a null claim
     * id) because another person's verification already owns this home.
     * The screen shows an alert whose "Search homes" action opens the
     * Find-or-Add-Home discovery route.
     */
    val blockedByOtherClaimPrompt: String? = null,
    /**
     * Non-null when the backend's `routing_classification` needs the
     * claimant to acknowledge something before their evidence goes up.
     * The screen renders it as a single-action "Continue" dialog,
     * matching RN's blocking `Alert.alert(…, [{ text: 'Continue' }])`
     * (`claim-owner/evidence.tsx:223-241`).
     */
    val routingWarning: ClaimRoutingWarning? = null,
    /**
     * Extra line on the success step describing what the submission
     * actually did — a parallel claim, or a challenge that opened.
     */
    val submissionOutcomeNote: String? = null,
) {
    /**
     * Only render the "ask a verified owner" option when the home has a
     * verified owner AND the viewer is not already a member — the exact
     * condition RN uses at
     * `src/app/homes/[id]/claim-owner/index.tsx:52`.
     */
    val showsAskVerifiedOwner: Boolean
        get() = hasVerifiedOwner && !isMember

    /** Slots this run requires. */
    val activeSlots: List<ClaimEvidenceSlot>
        get() = verificationType.slots

    /** Document kinds the user must choose between before uploading. */
    val documentOptions: List<ClaimDocumentOption>
        get() = activeSlots.flatMap { it.documentOptions }

    /** True when a document-kind pick is required and still missing. */
    val needsDocumentTypeSelection: Boolean
        get() = documentOptions.isNotEmpty() && selectedDocumentType == null

    val bothSlotsHaveFiles: Boolean
        get() = activeSlots.all { slots[it]?.hasFile == true }

    val anySlotHasFile: Boolean
        get() = activeSlots.any { slots[it]?.hasFile == true }

    /** Submit gate — every required file plus an explicit doc-kind pick. */
    val canSubmit: Boolean
        get() = bothSlotsHaveFiles && !needsDocumentTypeSelection

    /** `evidence_type` sent for [slot]: fixed, or the user's pick. */
    fun evidenceTypeFor(slot: ClaimEvidenceSlot): String = slot.fixedBackendType ?: selectedDocumentType ?: slot.backendType
}

/**
 * One blocking acknowledgement the claimant must clear before their
 * evidence is uploaded.
 *
 * Parity contract — mirrored in iOS `ClaimRoutingWarning`.
 */
data class ClaimRoutingWarning(
    val title: String,
    val message: String,
)

/** Saves a claim once, then uploads private documents with stable reservation IDs. */
@HiltViewModel
open class ClaimOwnershipWizardViewModel
    @Inject
    constructor(
        private val repository: HomesRepository,
        private val discoveryRepository: HomeDiscoveryRepository,
        private val evidenceFactory: HomePrivateEvidenceAccessFactory,
        private val networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel(),
        WizardModel {
        private val homeId: String =
            requireNotNull(savedStateHandle[CLAIM_OWNERSHIP_HOME_ID_KEY]) {
                "ClaimOwnershipWizardViewModel requires a '$CLAIM_OWNERSHIP_HOME_ID_KEY' nav arg."
            }

        /**
         * Evidence variant selected by the caller. `owner` unless the
         * route carried `verificationType=residency`.
         */
        private val verificationType: ClaimVerificationType =
            ClaimVerificationType.fromArg(savedStateHandle.get<String>(CLAIM_VERIFICATION_TYPE_KEY))

        private val blockedByOtherClaimCopy: String
            get() =
                if (verificationType == ClaimVerificationType.Residency) {
                    BLOCKED_BY_OTHER_CLAIM_RESIDENCY_COPY
                } else {
                    BLOCKED_BY_OTHER_CLAIM_COPY
                }

        private val _state =
            MutableStateFlow(
                ClaimOwnershipUiState(
                    currentStep = verificationType.steps.first(),
                    verificationType = verificationType,
                    // Residency forces an explicit pick (RN
                    // `evidence.tsx:162`). The owner variant starts on
                    // `deed` — the type this wizard sent before the
                    // five-option picker existed — and the claimant can
                    // switch to any other ownership document kind.
                    selectedDocumentType =
                        if (verificationType == ClaimVerificationType.Owner) "deed" else null,
                    startContent = ClaimOwnershipSampleData.startContent(homeId),
                ),
            )
        val state: StateFlow<ClaimOwnershipUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<ClaimOwnershipOutboundEvent?>(null)

        /**
         * Server-side claim id once `POST /ownership-claims` succeeds.
         * Held across retry attempts so a partial-success → retry doesn't
         * create a duplicate claim row server-side.
         */
        private var pendingClaimId: String? = null

        /**
         * `routing_classification` from the claim POST, held across the
         * warning round-trip and the challenge activation.
         */
        private var routingClassification: String? = null

        /**
         * True once the user tapped "Continue" on the routing warning,
         * so a resumed submit doesn't re-prompt.
         */
        private var acknowledgedRoutingWarning: Boolean = false

        private val session = evidenceFactory.session(viewModelScope)
        private var serverFingerprint: String? = null
        private var access: HomePrivateEvidenceAccess? = null
        private val uploadIds = mutableMapOf<ClaimEvidenceSlot, String>()
        private val pickerTickets = mutableMapOf<ClaimEvidenceSlot, String>()
        private var submitRunning = false
        private var closed = false
        private val isOpeningCurrent: Boolean get() = !closed && session.isCurrent

        private suspend fun requireOpening() {
            check(!closed) { CLAIM_SESSION_CHANGED }
            session.requireCurrent()
            check(!closed) { CLAIM_SESSION_CHANGED }
        }

        private fun dismiss() {
            closed = true
            pickerTickets.clear()
            _state.value.slots.values.forEach { it.pickedFile?.bytes?.fill(0) }
            pendingEvent.value = ClaimOwnershipOutboundEvent.Dismiss
        }

        override fun onCleared() {
            closed = true
            _state.value.slots.values.forEach { it.pickedFile?.bytes?.fill(0) }
            super.onCleared()
        }

        private fun startSubmit() {
            if (submitRunning) return
            submitRunning = true
            viewModelScope.launch {
                try {
                    submit()
                } finally {
                    submitRunning = false
                }
            }
        }

        private fun sessionExpired() {
            _state.value.slots.values.forEach { it.pickedFile?.bytes?.fill(0) }
            pickerTickets.clear()
            pendingEvent.value = null
            _state.update { it.copy(slots = emptyMap(), isSubmitting = false, submitError = CLAIM_SESSION_CHANGED) }
        }

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            when (_state.value.currentStep) {
                ClaimOwnershipStep.Start -> dismiss()
                // Residency starts on Upload — there is no preceding step
                // to pop back into, so the leading control closes.
                ClaimOwnershipStep.Upload ->
                    if (verificationType.steps.first() == ClaimOwnershipStep.Upload) {
                        dismiss()
                    } else {
                        transitionTo(ClaimOwnershipStep.Start)
                    }
                ClaimOwnershipStep.Success -> dismiss()
            }
        }

        override fun onDiscard() {
            dismiss()
        }

        override fun onPrimary() {
            if (!isOpeningCurrent) return
            when (_state.value.currentStep) {
                ClaimOwnershipStep.Start ->
                    if (_state.value.selectedStartMethod == ClaimStartMethod.AskVerifiedOwner) {
                        viewModelScope.launch { sendHouseholdRequest() }
                    } else {
                        transitionTo(ClaimOwnershipStep.Upload)
                    }
                ClaimOwnershipStep.Upload -> startSubmit()
                ClaimOwnershipStep.Success ->
                    pendingEvent.value = ClaimOwnershipOutboundEvent.OpenClaimsList
            }
        }

        // MARK: - Start step (A12.3 method picker)

        init {
            viewModelScope.launch { session.invalidated.collect { if (it) sessionExpired() } }
            viewModelScope.launch { loadPublicPreview() }
        }

        fun selectStartMethod(method: ClaimStartMethod) {
            if (method == ClaimStartMethod.AskVerifiedOwner && !_state.value.showsAskVerifiedOwner) return
            _state.update { it.copy(selectedStartMethod = method) }
        }

        /**
         * Resolve `has_verified_owner` / `is_member` so the start step
         * can decide whether to render the "ask a verified owner"
         * option, and replace the sample home label with the real one.
         */
        private suspend fun loadPublicPreview() {
            // The picker degrades to the ownership-verification path when
            // the preview can't be read — never invent the flag.
            val preview =
                runCatching { discoveryRepository.publicPreview(homeId) }
                    .getOrNull()
                    .let { it as? NetworkResult.Success }
                    ?.data ?: return
            val label = preview.home.displayAddress
            _state.update { current ->
                val next =
                    current.copy(
                        hasVerifiedOwner = preview.hasVerifiedOwner,
                        isMember = preview.isMember,
                        startContent =
                            if (label.isNotEmpty()) {
                                current.startContent.copy(homeLabel = label)
                            } else {
                                current.startContent
                            },
                    )
                if (!next.showsAskVerifiedOwner &&
                    next.selectedStartMethod == ClaimStartMethod.AskVerifiedOwner
                ) {
                    next.copy(selectedStartMethod = ClaimStartMethod.VerifyOwnership)
                } else {
                    next
                }
            }
        }

        /**
         * `POST /api/homes/:id/request-household-from-owner` — notifies
         * the home's verified owner(s) that a non-member wants in.
         */
        suspend fun sendHouseholdRequest() {
            if (_state.value.isSendingAskRequest) return
            if (!networkMonitor.isOnline.value) {
                _state.update {
                    it.copy(askRequestError = "You're offline. Try again when you're back online.")
                }
                return
            }
            _state.update { it.copy(isSendingAskRequest = true, askRequestError = null) }
            when (val result = discoveryRepository.requestHouseholdFromOwner(homeId, "owner")) {
                is NetworkResult.Success ->
                    _state.update {
                        it.copy(
                            isSendingAskRequest = false,
                            askRequestConfirmation =
                                "Verified owners were notified. They can add you from the " +
                                    "home Members screen.",
                        )
                    }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isSendingAskRequest = false,
                            askRequestError = result.error.message.ifBlank { "Try again later." },
                        )
                    }
            }
        }

        /** Dismiss the "Request sent" dialog → close the wizard. */
        fun acknowledgeAskConfirmation() {
            _state.update { it.copy(askRequestConfirmation = null) }
            pendingEvent.value = ClaimOwnershipOutboundEvent.Dismiss
        }

        fun acknowledgeAskError() {
            _state.update { it.copy(askRequestError = null) }
        }

        /** "OK" on the blocked-claim dialog — stay put. */
        fun dismissBlockedByOtherClaim() {
            _state.update { it.copy(blockedByOtherClaimPrompt = null) }
        }

        /** "Search homes" on the blocked-claim dialog. */
        fun openFindHomeFromBlockedClaim() {
            _state.update { it.copy(blockedByOtherClaimPrompt = null) }
            pendingEvent.value = ClaimOwnershipOutboundEvent.OpenFindHome
        }

        override fun onSecondary() {
            if (_state.value.currentStep == ClaimOwnershipStep.Success) {
                pendingEvent.value = ClaimOwnershipOutboundEvent.Dismiss
            }
        }

        // MARK: - Slot management

        private fun canSelect(slot: ClaimEvidenceSlot): Boolean {
            if (!isOpeningCurrent || _state.value.isSubmitting) return false
            return slot in _state.value.activeSlots && !uploadIds.containsKey(slot)
        }

        fun beginPick(slot: ClaimEvidenceSlot): String? {
            if (!canSelect(slot)) return null
            return UUID.randomUUID().toString().also { pickerTickets[slot] = it }
        }

        fun acceptPick(
            slot: ClaimEvidenceSlot,
            ticket: String,
            read: suspend () -> ClaimPickedFile?,
        ) {
            viewModelScope.launch {
                var file: ClaimPickedFile? = null
                var retained = false
                try {
                    requireOpening()
                    if (pickerTickets[slot] != ticket || _state.value.isSubmitting) return@launch
                    file = read()
                    requireOpening()
                    if (pickerTickets[slot] != ticket || _state.value.isSubmitting) return@launch
                    file?.let { picked(slot, it) }
                    retained = true
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: IOException) {
                    pickerFailed(error)
                } catch (error: SecurityException) {
                    pickerFailed(error)
                } catch (error: IllegalStateException) {
                    pickerFailed(error)
                } catch (error: IllegalArgumentException) {
                    pickerFailed(error)
                } finally {
                    if (!retained) file?.bytes?.fill(0)
                    if (pickerTickets[slot] == ticket) pickerTickets.remove(slot)
                }
            }
        }

        private fun pickerFailed(error: Exception) {
            if (!isOpeningCurrent) {
                sessionExpired()
            } else {
                _state.update { it.copy(submitError = error.message ?: "Could not read that document. Choose it again.") }
            }
        }

        fun picked(
            slot: ClaimEvidenceSlot,
            file: ClaimPickedFile,
        ) {
            if (!canSelect(slot)) {
                file.bytes.fill(0)
                return
            }
            if (file.mimeType !in HOME_EVIDENCE_MIMES || file.bytes.isEmpty() || file.bytes.size > HOME_EVIDENCE_MAX_BYTES) {
                file.bytes.fill(0)
                _state.update { it.copy(submitError = "Choose an image, PDF, or text document of 25 MB or less.") }
                return
            }
            _state.value.slots[slot]?.pickedFile?.bytes?.fill(0)
            _state.update { it.copy(slots = it.slots + (slot to ClaimSlotState.Picked(file)), submitError = null) }
        }

        fun remove(slot: ClaimEvidenceSlot) {
            if (!isOpeningCurrent || _state.value.isSubmitting) return
            _state.update { it.copy(isSubmitting = true, submitError = null) }
            viewModelScope.launch {
                evidenceAction {
                    requireOpening()
                    val uploadId = uploadIds[slot]
                    if (uploadId != null) {
                        val current = requireNotNull(access)
                        if (current.list().evidence.any { it.id == uploadId }) current.remove(uploadId)
                    }
                    requireOpening()
                    _state.value.slots[slot]?.pickedFile?.bytes?.fill(0)
                    uploadIds.remove(slot)
                    pickerTickets.remove(slot)
                    _state.update { it.copy(slots = it.slots + (slot to ClaimSlotState.Empty), isSubmitting = false) }
                }
            }
        }

        fun selectDocumentType(id: String) {
            if (!isOpeningCurrent || _state.value.isSubmitting) return
            if (uploadIds.isNotEmpty() || _state.value.documentOptions.none { it.id == id }) return
            _state.update { it.copy(selectedDocumentType = id, submitError = null) }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        // MARK: - Submit

        private suspend fun submit() =
            evidenceAction {
                requireOpening()
                submitCurrent()
            }

        private suspend fun evidenceAction(action: suspend () -> Unit) {
            try {
                action()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                handleFailure(error)
            } catch (error: IllegalStateException) {
                handleFailure(error)
            } catch (error: IllegalArgumentException) {
                handleFailure(error)
            }
        }

        private fun handleFailure(error: Throwable) {
            if (!isOpeningCurrent) {
                sessionExpired()
                return
            }
            _state.update { it.copy(isSubmitting = false, submitError = error.message ?: "Couldn't save the document. Retry.") }
        }

        private suspend fun submitCurrent() {
            val current = _state.value
            if (!current.canSubmit || current.isSubmitting) return
            if (!networkMonitor.isOnline.value) {
                _state.update {
                    it.copy(
                        submitError = "You're offline. Try again when you're back online.",
                    )
                }
                return
            }
            _state.update { it.copy(isSubmitting = true, submitError = null) }

            // Step 1: create the claim — but only once across retry
            // attempts. Holding the id in `pendingClaimId` keeps a
            // partial-success retry from creating a duplicate row.
            val claimId = resolveClaimId() ?: return

            // Step 1b: surface the backend's routing verdict before
            // anything is uploaded. RN blocks on the same two alerts
            // (`claim-owner/evidence.tsx:223-241`) and only continues
            // once the claimant taps "Continue". Residency claims skip
            // both.
            if (pauseForRouting()) return

            // Keep IDs for both known success and unknown responses; a retry cannot create another File.
            val evidenceAccess = access ?: evidenceFactory.create(session, homeId, claimId).also { access = it }
            val evidenceSession = evidenceAccess.list().claimSession
            check(evidenceSession.sessionScope == serverFingerprint && evidenceSession.actorId == session.actorId) {
                CLAIM_SESSION_CHANGED
            }
            for (slot in current.activeSlots) {
                if (current.slots[slot] is ClaimSlotState.Uploaded) continue
                val file = current.slots[slot]?.pickedFile ?: continue
                val uploadId = uploadIds.getOrPut(slot) { UUID.randomUUID().toString() }
                markSlot(slot, ClaimSlotState.Uploading(file, 0.5f))
                var uploaded = false
                try {
                    evidenceAccess.upload(uploadId, current.evidenceTypeFor(slot), file.filename, file.mimeType, file.bytes)
                    requireOpening()
                    markSlot(slot, ClaimSlotState.Uploaded(file, uploadId))
                    uploaded = true
                } finally {
                    if (!uploaded && isOpeningCurrent) {
                        markSlot(slot, ClaimSlotState.Failed(file, "Upload not confirmed. Retry the same document."))
                    }
                }
            }
            requireOpening()

            Analytics.track(AnalyticsEvent.CtaClaimOwnershipSubmit(AnalyticsResult.SUCCESS))
            _state.update {
                it.copy(
                    isSubmitting = false,
                    submissionOutcomeNote = "Documents saved pending review. Uploading does not verify identity or grant Home access.",
                )
            }
            transitionTo(ClaimOwnershipStep.Success)
        }

        /**
         * "Continue" on the routing warning — resume the same submit
         * with the already-created claim id.
         */
        fun acknowledgeRoutingWarning() {
            // Idempotent: the dialog fires both `onConfirm` and
            // `onDismissRequest`, and a second resume would re-run submit.
            if (_state.value.routingWarning == null) return
            _state.update { it.copy(routingWarning = null) }
            acknowledgedRoutingWarning = true
            startSubmit()
        }

        private fun pauseForRouting(): Boolean {
            if (routingClassification == ClaimRoutingClassification.CHALLENGE_CLAIM) {
                _state.update {
                    it.copy(
                        isSubmitting = false,
                        submitError = "This claim needs the dedicated dispute flow. No documents were uploaded. Contact Support.",
                    )
                }
                return true
            }
            if (verificationType != ClaimVerificationType.Residency && !acknowledgedRoutingWarning) {
                val warning = routingWarningFor(routingClassification)
                if (warning != null) {
                    _state.update { it.copy(isSubmitting = false, routingWarning = warning) }
                    return true
                }
            }

            return false
        }

        private suspend fun resolveClaimId(): String? {
            pendingClaimId?.let { return it }
            val expectedSession = currentClaimSession()
            val claimResult =
                repository.submitClaim(
                    homeId,
                    SubmitClaimRequest(
                        claimType = verificationType.claimType,
                        method = "doc_upload",
                    ),
                    expectedSession,
                )
            requireOpening()
            val envelope =
                when (claimResult) {
                    is NetworkResult.Success -> claimResult.data.claim
                    is NetworkResult.Failure -> {
                        Analytics.track(AnalyticsEvent.CtaClaimOwnershipSubmit(AnalyticsResult.ERROR))
                        // 409 = someone else's verification is
                        // already in flight for this home
                        // (EXISTING_IN_FLIGHT_CLAIM /
                        // DUPLICATE_CLAIM). RN offers "Search
                        // homes" here
                        // (`claim-owner/evidence.tsx:194-212`).
                        val blocked = claimResult.error.code == HTTP_CONFLICT
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                submitError = if (blocked) null else "Couldn't submit. Retry.",
                                blockedByOtherClaimPrompt =
                                    if (blocked) blockedByOtherClaimCopy else null,
                            )
                        }
                        return null
                    }
                }
            val resolvedId =
                envelope.id ?: run {
                    Analytics.track(AnalyticsEvent.CtaClaimOwnershipSubmit(AnalyticsResult.ERROR))
                    // Opaque-handshake path can return a null
                    // claim id when a duplicate exists — same
                    // user-visible outcome as the 409 above.
                    _state.update {
                        it.copy(
                            isSubmitting = false,
                            blockedByOtherClaimPrompt = blockedByOtherClaimCopy,
                        )
                    }
                    return null
                }
            pendingClaimId = resolvedId
            routingClassification = envelope.routingClassification
            return resolvedId
        }

        private suspend fun currentClaimSession(): String {
            requireOpening()
            val response = repository.myOwnershipClaims()
            requireOpening()
            val current =
                when (response) {
                    is NetworkResult.Success -> response.data.uploadSession
                    is NetworkResult.Failure -> throw response.error
                }
            check(current != null && current.actorId == session.actorId) { CLAIM_SESSION_CHANGED }
            check(HomeClaimReviewSnapshot.validToken(current.sessionScope)) { CLAIM_SESSION_CHANGED }
            check(serverFingerprint == null || serverFingerprint == current.sessionScope) { CLAIM_SESSION_CHANGED }
            serverFingerprint = current.sessionScope
            return current.sessionScope
        }

        private fun markSlot(
            slot: ClaimEvidenceSlot,
            value: ClaimSlotState,
        ) {
            _state.update { current ->
                current.copy(slots = current.slots.toMutableMap().apply { put(slot, value) })
            }
        }

        // MARK: - Step transitions

        private fun transitionTo(step: ClaimOwnershipStep) {
            _state.update { it.copy(currentStep = step) }
            Analytics.track(AnalyticsEvent.ScreenClaimOwnershipStepViewed(step.name))
        }

        // MARK: - Chrome derivation

        private fun computeChrome(state: ClaimOwnershipUiState): WizardChrome {
            val steps = state.verificationType.steps
            val total = steps.size
            val index = steps.indexOf(state.currentStep).coerceAtLeast(0) + 1
            val title = state.verificationType.wizardTitle
            return when (state.currentStep) {
                ClaimOwnershipStep.Start ->
                    WizardChrome(
                        title = title,
                        progressLabel = WizardProgressLabel.StepOf(index, total),
                        progressFraction = index.toFloat() / total.toFloat(),
                        leading = WizardLeadingControl.Close,
                        primaryCtaLabel =
                            if (state.selectedStartMethod == ClaimStartMethod.AskVerifiedOwner) {
                                "Send request"
                            } else {
                                "Start claim"
                            },
                        primaryCtaEnabled = !state.isSendingAskRequest,
                        secondaryCta = null,
                        isSubmitting = state.isSendingAskRequest,
                        // Once the user has touched Upload (picked a file or
                        // typed a note), Back→Start must still surface the
                        // discard-confirm so an X tap doesn't dump the
                        // in-memory bytes silently.
                        dirty = state.anySlotHasFile,
                        showsProgressBar = true,
                    )
                ClaimOwnershipStep.Upload ->
                    WizardChrome(
                        title = title,
                        progressLabel = WizardProgressLabel.StepOf(index, total),
                        progressFraction = index.toFloat() / total.toFloat(),
                        // Residency starts here, so there is nothing behind
                        // this step — the leading control closes instead.
                        leading =
                            if (steps.first() == ClaimOwnershipStep.Upload) {
                                WizardLeadingControl.Close
                            } else {
                                WizardLeadingControl.Back
                            },
                        primaryCtaLabel =
                            if (state.verificationType == ClaimVerificationType.Residency) {
                                "Submit"
                            } else {
                                "Submit claim"
                            },
                        primaryCtaEnabled = state.canSubmit && !state.isSubmitting,
                        secondaryCta = null,
                        isSubmitting = state.isSubmitting,
                        footerHint = if (state.isSubmitting) "Waiting for upload to finish" else null,
                        dirty = state.anySlotHasFile,
                        showsProgressBar = true,
                    )
                ClaimOwnershipStep.Success ->
                    WizardChrome(
                        title = title,
                        progressLabel = WizardProgressLabel.Hidden,
                        progressFraction = null,
                        leading = WizardLeadingControl.Close,
                        primaryCtaLabel = "View status",
                        primaryCtaEnabled = true,
                        secondaryCta = WizardSecondaryCta("Back to home", testTag = "claimOwnershipBackToHome"),
                        isSubmitting = false,
                        dirty = false,
                        showsProgressBar = false,
                    )
            }
        }

        companion object {
            private const val HTTP_CONFLICT = 409

            /**
             * Pre-upload warning copy per `routing_classification`.
             * Verbatim from RN (`claim-owner/evidence.tsx:223-241`).
             *
             * Parity contract — mirrored in iOS
             * `ClaimOwnershipWizardViewModel.routingWarning(for:)`.
             */
            fun routingWarningFor(classification: String?): ClaimRoutingWarning? =
                when (classification) {
                    ClaimRoutingClassification.PARALLEL_CLAIM ->
                        ClaimRoutingWarning(
                            title = "Another claim is pending",
                            message =
                                "Another person has a pending claim on this address. You can still " +
                                    "submit your own claim. If you are part of the same household, " +
                                    "the verified occupant may be able to invite you later.",
                        )
                    ClaimRoutingClassification.CHALLENGE_CLAIM ->
                        ClaimRoutingWarning(
                            title = "Verified household exists",
                            message =
                                "This address already has a verified household. Automatic document challenges are unavailable. " +
                                    "Contact Support for the dedicated dispute flow.",
                        )
                    else -> null
                }

            private const val BLOCKED_BY_OTHER_CLAIM_COPY =
                "Someone else's verification is already in progress for this home, so you can't " +
                    "upload documents here. Search for this home and request to join the " +
                    "household, or use Support if you believe this is wrong."

            /** RN uses different copy for the residency path (`evidence.tsx:206-212`). */
            private const val BLOCKED_BY_OTHER_CLAIM_RESIDENCY_COPY =
                "Someone else's verification is already in progress for this home, so you can't " +
                    "upload documents on this path. Search for the home and request to join, or " +
                    "ask your household for an invite."
        }
    }
