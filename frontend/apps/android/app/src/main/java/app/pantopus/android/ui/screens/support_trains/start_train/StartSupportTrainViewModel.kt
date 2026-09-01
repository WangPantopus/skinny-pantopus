@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.start_train

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.support_trains.AddSupportTrainSlotBody
import app.pantopus.android.data.api.models.support_trains.CreateSupportTrainBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mail_compose.MailComposeRepository
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * P2.6 — Start-a-Support-Train wizard view model. Owns the three-step
 * state machine + recipient autocomplete + the launch sequence (create
 * draft → POST each generated slot → publish). On success, emits
 * `OpenTrain` so the host stack can pop the wizard and push the new
 * train's review-signups screen.
 */
@HiltViewModel
class StartSupportTrainViewModel
    @Inject
    constructor(
        private val supportTrains: SupportTrainsRepository,
        private val mailCompose: MailComposeRepository,
    ) : ViewModel(), WizardModel {
        private val _form = MutableStateFlow(StartSupportTrainFormState())
        val form: StateFlow<StartSupportTrainFormState> = _form.asStateFlow()

        private val _beneficiaryResults = MutableStateFlow<List<MailRecipientDto>>(emptyList())
        val beneficiaryResults: StateFlow<List<MailRecipientDto>> = _beneficiaryResults.asStateFlow()

        private val _selectedBeneficiary = MutableStateFlow<MailRecipientDto?>(null)
        val selectedBeneficiary: StateFlow<MailRecipientDto?> = _selectedBeneficiary.asStateFlow()

        private val _isSearching = MutableStateFlow(false)
        val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

        private val _isSubmitting = MutableStateFlow(false)
        val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

        private val _launchError = MutableStateFlow<String?>(null)
        val launchError: StateFlow<String?> = _launchError.asStateFlow()

        private val _pendingEvent = MutableStateFlow<StartSupportTrainEvent?>(null)
        val pendingEvent: StateFlow<StartSupportTrainEvent?> = _pendingEvent.asStateFlow()

        private val _publishedTrainId = MutableStateFlow<String?>(null)
        val publishedTrainId: StateFlow<String?> = _publishedTrainId.asStateFlow()

        private var searchJob: Job? = null

        // ─── Step 1 actions ─────────────────────────────────────────────

        fun updateBeneficiaryQuery(value: String) {
            _form.value = _form.value.copy(beneficiaryQuery = value)
            val current = _selectedBeneficiary.value
            if (current != null && value != displayName(current)) {
                _selectedBeneficiary.value = null
            }
            val trimmed = value.trim()
            searchJob?.cancel()
            if (trimmed.length < 2) {
                _beneficiaryResults.value = emptyList()
                _isSearching.value = false
                return
            }
            searchJob =
                viewModelScope.launch {
                    delay(250)
                    searchBeneficiary(trimmed)
                }
        }

        fun selectBeneficiary(recipient: MailRecipientDto) {
            _selectedBeneficiary.value = recipient
            _form.value = _form.value.copy(beneficiaryQuery = displayName(recipient))
            _beneficiaryResults.value = emptyList()
        }

        fun clearBeneficiary() {
            _selectedBeneficiary.value = null
        }

        fun searchAgain() {
            searchJob?.cancel()
            _selectedBeneficiary.value = null
            _beneficiaryResults.value = emptyList()
            _isSearching.value = false
            _form.value = _form.value.copy(beneficiaryQuery = "")
        }

        fun selectReason(value: StartSupportTrainReason) {
            _form.value = _form.value.copy(selectedReason = value)
        }

        fun updateReason(value: String) {
            val clamped =
                if (value.length > StartSupportTrainFormState.REASON_CHAR_LIMIT) {
                    value.substring(0, StartSupportTrainFormState.REASON_CHAR_LIMIT)
                } else {
                    value
                }
            _form.value = _form.value.copy(reason = clamped)
        }

        fun toggleInviteOnly(value: Boolean) {
            _form.value = _form.value.copy(inviteOnly = value)
        }

        fun toggleBlockVisible(value: Boolean) {
            _form.value = _form.value.copy(blockVisible = value)
        }

        fun selectInviteMethod(value: StartSupportTrainInviteMethod) {
            _form.value = _form.value.copy(inviteMethod = value)
        }

        // ─── Step 2 actions ─────────────────────────────────────────────

        fun selectKind(value: SupportTrainKind) {
            _form.value = _form.value.copy(kind = value)
        }

        fun setStartDate(millis: Long) {
            val current = _form.value
            val newStart = stripToStartOfDay(millis)
            val adjustedEnd = if (current.endDateMillis < newStart) newStart else current.endDateMillis
            _form.value = current.copy(startDateMillis = newStart, endDateMillis = adjustedEnd)
        }

        fun setEndDate(millis: Long) {
            val current = _form.value
            val newEnd = stripToStartOfDay(millis)
            val clampedEnd = if (newEnd < current.startDateMillis) current.startDateMillis else newEnd
            _form.value = current.copy(endDateMillis = clampedEnd)
        }

        fun selectSlotDuration(value: StartSupportTrainSlotDuration) {
            _form.value = _form.value.copy(slotDuration = value)
        }

        // ─── Step 3 actions ─────────────────────────────────────────────

        fun toggleAllowComments(value: Boolean) {
            _form.value = _form.value.copy(allowComments = value)
        }

        fun selectVisibility(value: StartSupportTrainVisibility) {
            _form.value = _form.value.copy(visibility = value)
        }

        // ─── Derived projections ────────────────────────────────────────

        fun generatedSlots(): List<StartSupportTrainSlot> {
            val current = _form.value
            return StartSupportTrainSlotGenerator.generate(
                startMillis = current.startDateMillis,
                endMillis = current.endDateMillis,
                durationMinutes = current.slotDuration.minutes,
                startHour = current.kind.defaultStartHour,
            )
        }

        fun reasonRemainingChars(): Int = (StartSupportTrainFormState.REASON_CHAR_LIMIT - _form.value.reason.length).coerceAtLeast(0)

        fun derivedTitle(): String {
            val current = _form.value
            val selected = _selectedBeneficiary.value
            val raw =
                selected?.name
                    ?: selected?.username
                    ?: current.beneficiaryQuery.trim()
            val name = raw.ifBlank { "a neighbor" }
            return "${current.kind.title} for $name"
        }

        fun canAdvanceFromWhoAndWhy(): Boolean {
            val current = _form.value
            val hasBeneficiary =
                _selectedBeneficiary.value != null || current.beneficiaryQuery.trim().length >= 2
            return hasBeneficiary
        }

        fun isInviteRecipientBranch(): Boolean {
            val current = _form.value
            return _selectedBeneficiary.value == null &&
                current.beneficiaryQuery.trim().length >= 2 &&
                _beneficiaryResults.value.isEmpty() &&
                !_isSearching.value
        }

        fun canAdvanceFromWhatAndWhen(): Boolean {
            val current = _form.value
            return current.endDateMillis >= current.startDateMillis && generatedSlots().isNotEmpty()
        }

        /** Mutual connections shared with the selected verified neighbor —
         *  drives the recipient card's micro-avatar strip. Stubbed from
         *  sample data; a real implementation would fetch the mutuals when
         *  a beneficiary is selected. */
        fun recipientMutuals(): List<StartSupportTrainMutual> =
            if (_selectedBeneficiary.value == null) emptyList() else StartSupportTrainSampleData.mutuals

        /** The Frame-2 invite candidate when the typed name matched no
         *  verified neighbor. Contact handles are stubbed (real
         *  contact-picker is out of scope); only the typed name is live. */
        fun inviteCandidate(): StartSupportTrainInviteCandidate? {
            if (!isInviteRecipientBranch()) return null
            return StartSupportTrainInviteCandidate(
                typedName = _form.value.beneficiaryQuery.trim(),
                phone = StartSupportTrainSampleData.inviteCandidate.phone,
                email = StartSupportTrainSampleData.inviteCandidate.email,
            )
        }

        // ─── WizardModel ────────────────────────────────────────────────

        override val chrome: WizardChrome
            get() {
                val current = _form.value
                val number = current.step.stepNumber
                val total = StartSupportTrainStep.PROGRESS_TOTAL
                return WizardChrome(
                    title = titleFor(current.step),
                    progressLabel =
                        number?.let { WizardProgressLabel.StepOf(it, total) }
                            ?: WizardProgressLabel.Hidden,
                    progressFraction = number?.toFloat()?.div(total.toFloat()),
                    leading =
                        if (current.step == StartSupportTrainStep.WhoAndWhy) {
                            WizardLeadingControl.Close
                        } else {
                            WizardLeadingControl.Back
                        },
                    primaryCtaLabel = primaryCtaLabelFor(current.step),
                    primaryCtaEnabled = primaryEnabledFor(current.step),
                    secondaryCta = secondaryCtaFor(current.step),
                    isSubmitting = _isSubmitting.value,
                    dirty = dirtyFor(current.step),
                    showsProgressBar = current.step != StartSupportTrainStep.Success,
                )
            }

        override fun onLeading() {
            val step = _form.value.step
            when (step) {
                StartSupportTrainStep.WhoAndWhy -> _pendingEvent.value = StartSupportTrainEvent.Dismiss
                StartSupportTrainStep.WhatAndWhen ->
                    _form.value = _form.value.copy(step = StartSupportTrainStep.WhoAndWhy)
                StartSupportTrainStep.ReviewAndLaunch ->
                    _form.value = _form.value.copy(step = StartSupportTrainStep.WhatAndWhen)
                StartSupportTrainStep.Success -> handleSuccessExit()
            }
        }

        override fun onDiscard() {
            _pendingEvent.value = StartSupportTrainEvent.Dismiss
        }

        override fun onPrimary() {
            when (_form.value.step) {
                StartSupportTrainStep.WhoAndWhy -> {
                    if (!canAdvanceFromWhoAndWhy()) return
                    _form.value = _form.value.copy(step = StartSupportTrainStep.WhatAndWhen)
                }
                StartSupportTrainStep.WhatAndWhen -> {
                    if (!canAdvanceFromWhatAndWhen()) return
                    _form.value = _form.value.copy(step = StartSupportTrainStep.ReviewAndLaunch)
                }
                StartSupportTrainStep.ReviewAndLaunch -> {
                    if (_isSubmitting.value) return
                    launch()
                }
                StartSupportTrainStep.Success -> handleSuccessExit()
            }
        }

        override fun onSecondary() {
            if (isInviteRecipientBranch()) {
                searchAgain()
            } else if (_form.value.step == StartSupportTrainStep.Success) {
                handleSuccessExit()
            }
        }

        fun acknowledgePendingEvent() {
            _pendingEvent.value = null
        }

        // ─── Helpers ────────────────────────────────────────────────────

        private fun titleFor(step: StartSupportTrainStep): String =
            when (step) {
                StartSupportTrainStep.WhoAndWhy -> "Start a support train"
                StartSupportTrainStep.WhatAndWhen -> "What & when"
                StartSupportTrainStep.ReviewAndLaunch -> "Review & launch"
                StartSupportTrainStep.Success -> "Train launched"
            }

        private fun primaryCtaLabelFor(step: StartSupportTrainStep): String =
            when (step) {
                StartSupportTrainStep.WhoAndWhy ->
                    if (isInviteRecipientBranch()) "Send invite & continue" else "Continue"
                StartSupportTrainStep.WhatAndWhen -> "Continue"
                StartSupportTrainStep.ReviewAndLaunch -> "Launch train"
                StartSupportTrainStep.Success -> "Open train"
            }

        private fun secondaryCtaFor(step: StartSupportTrainStep): WizardSecondaryCta? =
            when {
                step == StartSupportTrainStep.Success ->
                    WizardSecondaryCta(
                        label = "Back to trains",
                        testTag = "startSupportTrainBackToList",
                    )
                isInviteRecipientBranch() ->
                    WizardSecondaryCta(
                        label = "Search again",
                        testTag = "startSupportTrainSearchAgain",
                    )
                else -> null
            }

        private fun primaryEnabledFor(step: StartSupportTrainStep): Boolean =
            when (step) {
                StartSupportTrainStep.WhoAndWhy -> canAdvanceFromWhoAndWhy()
                StartSupportTrainStep.WhatAndWhen -> canAdvanceFromWhatAndWhen()
                StartSupportTrainStep.ReviewAndLaunch -> !_isSubmitting.value && generatedSlots().isNotEmpty()
                StartSupportTrainStep.Success -> true
            }

        private fun dirtyFor(step: StartSupportTrainStep): Boolean =
            when (step) {
                StartSupportTrainStep.WhoAndWhy ->
                    canAdvanceFromWhoAndWhy() ||
                        _form.value.beneficiaryQuery.isNotEmpty() ||
                        _form.value.reason.isNotEmpty() ||
                        _form.value.selectedReason != StartSupportTrainReason.Surgery ||
                        !_form.value.inviteOnly ||
                        _form.value.blockVisible
                StartSupportTrainStep.WhatAndWhen, StartSupportTrainStep.ReviewAndLaunch -> true
                StartSupportTrainStep.Success -> false
            }

        private fun displayName(recipient: MailRecipientDto?): String = recipient?.name ?: recipient?.username ?: ""

        private suspend fun searchBeneficiary(query: String) {
            _isSearching.value = true
            try {
                when (val result = mailCompose.recipients(query)) {
                    is NetworkResult.Success -> _beneficiaryResults.value = result.data.recipients
                    is NetworkResult.Failure -> _beneficiaryResults.value = emptyList()
                }
            } finally {
                _isSearching.value = false
            }
        }

        private fun launch() {
            _isSubmitting.value = true
            _launchError.value = null
            val current = _form.value
            val trimmedReason = current.reason.trim()
            val body =
                CreateSupportTrainBody(
                    draftPayload = CreateSupportTrainBody.DraftPayload(story = trimmedReason),
                    title = derivedTitle(),
                    recipientUserId = _selectedBeneficiary.value?.userId,
                    sharingMode = effectiveSharingMode(current),
                )
            viewModelScope.launch {
                try {
                    val created =
                        when (val result = supportTrains.create(body)) {
                            is NetworkResult.Success -> result.data
                            is NetworkResult.Failure -> {
                                _launchError.value = "Couldn't launch the train. Try again."
                                return@launch
                            }
                        }
                    _publishedTrainId.value = created.id
                    for (slot in generatedSlots()) {
                        val slotBody =
                            AddSupportTrainSlotBody(
                                slotDate = slot.dateKey,
                                slotLabel = current.kind.defaultSlotLabel,
                                supportMode = current.kind.supportMode,
                                startTime = slot.startTime,
                                endTime = slot.endTime,
                            )
                        when (supportTrains.addSlot(created.id, slotBody)) {
                            is NetworkResult.Success -> Unit
                            is NetworkResult.Failure -> {
                                _launchError.value = "Couldn't add a slot. Try again."
                                return@launch
                            }
                        }
                    }
                    when (supportTrains.publish(created.id)) {
                        is NetworkResult.Success -> {
                            _form.value = _form.value.copy(step = StartSupportTrainStep.Success)
                        }
                        is NetworkResult.Failure -> {
                            _launchError.value = "Couldn't publish the train. Try again."
                        }
                    }
                } finally {
                    _isSubmitting.value = false
                }
            }
        }

        private fun handleSuccessExit() {
            val id = _publishedTrainId.value
            _pendingEvent.value =
                if (id != null) StartSupportTrainEvent.OpenTrain(id) else StartSupportTrainEvent.Dismiss
        }

        private fun effectiveSharingMode(form: StartSupportTrainFormState): String =
            when {
                form.inviteOnly -> StartSupportTrainVisibility.Connections.sharingModeWire
                form.blockVisible -> StartSupportTrainVisibility.Neighbors.sharingModeWire
                else -> form.visibility.sharingModeWire
            }

        private fun stripToStartOfDay(millis: Long): Long {
            val cal = java.util.Calendar.getInstance()
            cal.timeInMillis = millis
            cal.stripTime()
            return cal.timeInMillis
        }
    }
