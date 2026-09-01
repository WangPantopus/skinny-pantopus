@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.ceremonial_mail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mail_compose.MailHomeContextResponse
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mail_compose.SendMailBody
import app.pantopus.android.data.api.models.mail_compose.SendMailObject
import app.pantopus.android.data.api.models.mail_compose.SendMailPayload
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mail_compose.MailComposeRepository
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

@HiltViewModel
class CeremonialMailViewModel
    @Inject
    constructor(
        private val repository: MailComposeRepository,
    ) : ViewModel(), WizardModel {
        private val _form = MutableStateFlow(CeremonialMailFormState())
        val form: StateFlow<CeremonialMailFormState> = _form.asStateFlow()

        private val _recipientResults = MutableStateFlow<List<MailRecipientDto>>(emptyList())
        val recipientResults: StateFlow<List<MailRecipientDto>> = _recipientResults.asStateFlow()

        private val _selectedRecipient = MutableStateFlow<MailRecipientDto?>(null)
        val selectedRecipient: StateFlow<MailRecipientDto?> = _selectedRecipient.asStateFlow()

        private val _homeContext = MutableStateFlow<MailHomeContextResponse?>(null)
        val homeContext: StateFlow<MailHomeContextResponse?> = _homeContext.asStateFlow()

        private val _isSearching = MutableStateFlow(false)
        val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

        private val _isSubmitting = MutableStateFlow(false)
        val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

        private val _submitError = MutableStateFlow<String?>(null)
        val submitError: StateFlow<String?> = _submitError.asStateFlow()

        private val _voiceStatus = MutableStateFlow<VoicePostscriptStatus>(VoicePostscriptStatus.Empty)
        val voiceStatus: StateFlow<VoicePostscriptStatus> = _voiceStatus.asStateFlow()

        private val _pendingEvent = MutableStateFlow<CeremonialMailEvent?>(null)
        val pendingEvent: StateFlow<CeremonialMailEvent?> = _pendingEvent.asStateFlow()

        private var searchJob: Job? = null

        // MARK: - Step 1: decide

        fun updateRecipientQuery(value: String) {
            _form.value = _form.value.copy(recipientQuery = value)
            val current = _selectedRecipient.value
            if (current != null && value != displayName(current)) {
                _selectedRecipient.value = null
                _homeContext.value = null
            }
            val trimmed = value.trim()
            searchJob?.cancel()
            if (trimmed.length < 2) {
                _recipientResults.value = emptyList()
                _isSearching.value = false
                return
            }
            searchJob =
                viewModelScope.launch {
                    delay(250)
                    searchRecipients(trimmed)
                }
        }

        fun selectRecipient(recipient: MailRecipientDto) {
            _selectedRecipient.value = recipient
            _form.value = _form.value.copy(recipientQuery = displayName(recipient), addressConfirmed = false)
            _homeContext.value = null
        }

        fun selectIntent(intent: CeremonialMailIntent) {
            _form.value = _form.value.copy(intent = intent)
        }

        // MARK: - Step 2: verify

        fun loadHomeContext() {
            val homeId = _selectedRecipient.value?.homeId ?: return
            viewModelScope.launch {
                when (val result = repository.homeContext(homeId)) {
                    is NetworkResult.Success -> _homeContext.value = result.data
                    is NetworkResult.Failure -> _homeContext.value = null
                }
            }
        }

        fun toggleAddressConfirmed(value: Boolean) {
            _form.value = _form.value.copy(addressConfirmed = value)
        }

        fun toggleReturnAddressShared(value: Boolean) {
            _form.value = _form.value.copy(returnAddressShared = value)
        }

        // MARK: - Step 3: compose

        fun selectStationery(value: CeremonialMailStationery) {
            _form.value = _form.value.copy(stationery = value)
        }

        fun selectInk(value: CeremonialMailInk) {
            _form.value = _form.value.copy(ink = value)
        }

        fun selectSeal(value: CeremonialMailSeal) {
            _form.value = _form.value.copy(seal = value)
        }

        fun updateBody(value: String) {
            _form.value = _form.value.copy(bodyText = value)
        }

        fun voicePostscriptDidStartRecording() {
            _voiceStatus.value = VoicePostscriptStatus.Recording
        }

        /** View calls this after capturing audio. We accept the
         *  local URI; the upload helper that wraps `/api/files/upload`
         *  is host-provided so tests can inject a mock. */
        fun voicePostscriptDidCapture(localUri: String) {
            _voiceStatus.value = VoicePostscriptStatus.Captured(localUri)
        }

        /** Apply an upload result from the platform helper. */
        fun voicePostscriptDidUpload(remoteUrl: String) {
            _voiceStatus.value = VoicePostscriptStatus.Uploaded(remoteUrl)
        }

        fun voicePostscriptDidFail(message: String) {
            _voiceStatus.value = VoicePostscriptStatus.Error(message)
        }

        fun clearVoicePostscript() {
            _voiceStatus.value = VoicePostscriptStatus.Empty
        }

        // MARK: - Step 4: commit

        fun selectSendTiming(value: CeremonialMailSendTiming) {
            _form.value = _form.value.copy(sendTiming = value)
        }

        fun submit() {
            if (_isSubmitting.value) return
            val recipient = _selectedRecipient.value ?: return
            val form = _form.value
            _isSubmitting.value = true
            _submitError.value = null
            val voiceUri =
                (_voiceStatus.value as? VoicePostscriptStatus.Uploaded)?.remoteUrl
            val body =
                SendMailBody(
                    recipientUserId = recipient.userId,
                    recipientHomeId = recipient.homeId,
                    type = "letter",
                    subject = subjectFromIntent(form.intent),
                    content = form.bodyText.trim(),
                    `object` =
                        SendMailObject(
                            title = subjectFromIntent(form.intent),
                            content = form.bodyText.trim(),
                            payload =
                                SendMailPayload(
                                    stationeryTheme = form.stationery.wire,
                                    inkSelection = form.ink.wire,
                                    sealChoice = form.seal.wire,
                                    intent = form.intent.wire,
                                    returnAddressShared = form.returnAddressShared,
                                    voicePostscriptUri = voiceUri,
                                ),
                        ),
                    expiresAt = null,
                )
            viewModelScope.launch {
                when (val result = repository.send(body)) {
                    is NetworkResult.Success -> {
                        _isSubmitting.value = false
                        _form.value = form.copy(step = CeremonialMailStep.Success)
                        result.data.mail?.id?.let { _pendingEvent.value = CeremonialMailEvent.OpenMail(it) }
                    }
                    is NetworkResult.Failure -> {
                        _isSubmitting.value = false
                        _submitError.value = "Couldn't send your letter. Try again."
                    }
                }
            }
        }

        fun acknowledgePendingEvent() {
            _pendingEvent.value = null
        }

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() {
                val current = _form.value
                val total = CeremonialMailStep.PROGRESS_TOTAL
                val number = current.step.stepNumber
                return WizardChrome(
                    title = titleFor(current.step),
                    progressLabel =
                        number?.let { WizardProgressLabel.StepOf(it, total) }
                            ?: WizardProgressLabel.Hidden,
                    progressFraction = number?.toFloat()?.div(total.toFloat()),
                    leading = if (current.step == CeremonialMailStep.Decide) WizardLeadingControl.Close else WizardLeadingControl.Back,
                    primaryCtaLabel = primaryCtaLabelFor(current.step),
                    primaryCtaEnabled = primaryEnabledFor(current),
                    secondaryCta =
                        if (current.step == CeremonialMailStep.Success) {
                            WizardSecondaryCta(label = "Back to Hub", testTag = "ceremonialBackToHub")
                        } else {
                            null
                        },
                    isSubmitting = _isSubmitting.value,
                    dirty = dirtyFor(current),
                    showsProgressBar = current.step != CeremonialMailStep.Success,
                )
            }

        override fun onLeading() {
            val step = _form.value.step
            if (step == CeremonialMailStep.Decide) {
                _pendingEvent.value = CeremonialMailEvent.Dismiss
                return
            }
            _form.value =
                _form.value.copy(
                    step =
                        when (step) {
                            CeremonialMailStep.Verify -> CeremonialMailStep.Decide
                            CeremonialMailStep.Compose -> CeremonialMailStep.Verify
                            CeremonialMailStep.Commit -> CeremonialMailStep.Compose
                            CeremonialMailStep.Success -> CeremonialMailStep.Commit
                            CeremonialMailStep.Decide -> CeremonialMailStep.Decide
                        },
                )
            if (step == CeremonialMailStep.Success) _pendingEvent.value = CeremonialMailEvent.Dismiss
        }

        override fun onDiscard() {
            _pendingEvent.value = CeremonialMailEvent.Dismiss
        }

        override fun onPrimary() {
            val step = _form.value.step
            when (step) {
                CeremonialMailStep.Decide -> {
                    if (_selectedRecipient.value == null) return
                    _form.value = _form.value.copy(step = CeremonialMailStep.Verify)
                    loadHomeContext()
                }
                CeremonialMailStep.Verify -> {
                    if (!_form.value.addressConfirmed) return
                    _form.value = _form.value.copy(step = CeremonialMailStep.Compose)
                }
                CeremonialMailStep.Compose -> {
                    if (_form.value.bodyText.trim().isEmpty()) return
                    _form.value = _form.value.copy(step = CeremonialMailStep.Commit)
                }
                CeremonialMailStep.Commit -> submit()
                CeremonialMailStep.Success -> _pendingEvent.value = CeremonialMailEvent.Dismiss
            }
        }

        override fun onSecondary() {
            if (_form.value.step == CeremonialMailStep.Success) {
                _pendingEvent.value = CeremonialMailEvent.Dismiss
            }
        }

        // MARK: - Helpers

        private fun titleFor(step: CeremonialMailStep): String =
            // T6.5e — Step titles match the ceremonial-compose design
            // (Porch Call · Address It · Write It · Seal & Send) while
            // the internal enum stays decide / verify / compose / commit
            // so existing tests and analytics events keep their stable
            // names.
            when (step) {
                CeremonialMailStep.Decide -> "Porch Call"
                CeremonialMailStep.Verify -> "Address It"
                CeremonialMailStep.Compose -> "Write It"
                CeremonialMailStep.Commit -> "Seal & Send"
                CeremonialMailStep.Success -> "Letter on its way"
            }

        private fun primaryCtaLabelFor(step: CeremonialMailStep): String =
            when (step) {
                CeremonialMailStep.Decide -> "Continue"
                CeremonialMailStep.Verify -> "Continue to letter"
                CeremonialMailStep.Compose -> "Continue"
                CeremonialMailStep.Commit -> "Seal and send"
                CeremonialMailStep.Success -> "Done"
            }

        private fun primaryEnabledFor(form: CeremonialMailFormState): Boolean =
            when (form.step) {
                CeremonialMailStep.Decide -> _selectedRecipient.value != null
                CeremonialMailStep.Verify -> form.addressConfirmed
                CeremonialMailStep.Compose -> form.bodyText.trim().isNotEmpty()
                CeremonialMailStep.Commit -> !_isSubmitting.value
                CeremonialMailStep.Success -> true
            }

        private fun dirtyFor(form: CeremonialMailFormState): Boolean =
            when (form.step) {
                CeremonialMailStep.Decide -> _selectedRecipient.value != null || form.recipientQuery.isNotEmpty()
                CeremonialMailStep.Verify, CeremonialMailStep.Compose, CeremonialMailStep.Commit -> true
                CeremonialMailStep.Success -> false
            }

        private fun subjectFromIntent(intent: CeremonialMailIntent): String =
            when (intent) {
                CeremonialMailIntent.SayHello -> "A note from a friend"
                CeremonialMailIntent.Congratulations -> "Congratulations!"
                CeremonialMailIntent.Condolences -> "Thinking of you"
                CeremonialMailIntent.BusinessNote -> "A business note"
                CeremonialMailIntent.JustBecause -> "Just because"
            }

        private fun displayName(recipient: MailRecipientDto?): String = recipient?.name ?: recipient?.username ?: ""

        private suspend fun searchRecipients(query: String) {
            _isSearching.value = true
            try {
                when (val result = repository.recipients(query)) {
                    is NetworkResult.Success -> _recipientResults.value = result.data.recipients
                    is NetworkResult.Failure -> _recipientResults.value = emptyList()
                }
            } finally {
                _isSearching.value = false
            }
        }
    }
