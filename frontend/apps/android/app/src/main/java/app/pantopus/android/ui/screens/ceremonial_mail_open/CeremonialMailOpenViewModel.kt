@file:Suppress("LongMethod", "MagicNumber", "PackageNaming", "ReturnCount")

package app.pantopus.android.ui.screens.ceremonial_mail_open

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CeremonialMailOpenViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val mailId: String = savedStateHandle.get<String>(MAIL_ID_KEY) ?: ""

        private val _state = MutableStateFlow<CeremonialMailOpenUiState>(CeremonialMailOpenUiState.Loading)
        val state: StateFlow<CeremonialMailOpenUiState> = _state.asStateFlow()

        private val _isVoicePlaying = MutableStateFlow(false)
        val isVoicePlaying: StateFlow<Boolean> = _isVoicePlaying.asStateFlow()

        fun load() {
            if (mailId.isBlank()) {
                _state.value = CeremonialMailOpenUiState.Error("Missing mail id.")
                return
            }
            _state.value = CeremonialMailOpenUiState.Loading
            viewModelScope.launch {
                when (val result = repository.item(mailId)) {
                    is NetworkResult.Success -> {
                        val letter = project(result.data, mailId)
                        _state.value = CeremonialMailOpenUiState.Loaded(letter, CeremonialMailPhase.Sealed)
                    }
                    is NetworkResult.Failure ->
                        _state.value = CeremonialMailOpenUiState.Error("Couldn't load this letter.")
                }
            }
        }

        /**
         * Step the seal-break ceremony forward. The view triggers
         * this when the user taps the envelope. Pass
         * [skipAnimation] = true to jump straight to `Open` without
         * the intermediate `Breaking` frame — used automatically when
         * the system has reduce-motion enabled, or when the user taps
         * the "Skip animation" affordance. Total time from `Sealed`
         * to `Open` is capped at 750 ms (T6.5d).
         */
        fun startBreakingSeal(skipAnimation: Boolean = false) {
            val current = _state.value as? CeremonialMailOpenUiState.Loaded ?: return
            if (current.phase != CeremonialMailPhase.Sealed) return
            if (skipAnimation) {
                _state.value = current.copy(phase = CeremonialMailPhase.Open)
                return
            }
            _state.value = current.copy(phase = CeremonialMailPhase.Breaking)
            viewModelScope.launch {
                delay(750)
                val now = _state.value as? CeremonialMailOpenUiState.Loaded ?: return@launch
                if (now.phase == CeremonialMailPhase.Breaking) {
                    _state.value = now.copy(phase = CeremonialMailPhase.Open)
                }
            }
        }

        fun openImmediately() {
            val current = _state.value as? CeremonialMailOpenUiState.Loaded ?: return
            _state.value = current.copy(phase = CeremonialMailPhase.Open)
        }

        fun enterReplying() {
            val current = _state.value as? CeremonialMailOpenUiState.Loaded ?: return
            _state.value = current.copy(phase = CeremonialMailPhase.Replying)
        }

        fun resetToOpen() {
            val current = _state.value as? CeremonialMailOpenUiState.Loaded ?: return
            _state.value = current.copy(phase = CeremonialMailPhase.Open)
        }

        fun toggleVoicePlayback() {
            _isVoicePlaying.value = !_isVoicePlaying.value
        }

        fun stopVoicePlayback() {
            _isVoicePlaying.value = false
        }

        companion object {
            const val MAIL_ID_KEY = "mailId"

            internal fun project(
                response: app.pantopus.android.data.api.models.mailbox.v2.MailboxV2ItemResponse,
                mailId: String,
            ): CeremonialMailLetter {
                val item = response.mail
                // The backend's `object_payload` arrives as an opaque
                // map — pull the ceremonial slots by key. The wider
                // payload is intentionally untyped at the repo layer
                // because each mail_type has a different shape.
                val payload = composePayload(item.objectPayload)

                fun payloadString(key: String): String? = payload[key] as? String
                val stationery =
                    CeremonialMailStationeryTone.fromWire(payloadString("stationeryTheme")?.takeIf { it.isNotEmpty() })
                val ink = CeremonialMailInkTone.fromWire(payloadString("inkSelection")?.takeIf { it.isNotEmpty() })
                val seal = CeremonialMailSealTone.fromWire(payloadString("sealChoice")?.takeIf { it.isNotEmpty() })
                val voiceUri = payloadString("voicePostscriptUri")?.takeIf { it.isNotEmpty() }
                val body = item.content.orEmpty()
                val paragraphs =
                    body.split("\n\n")
                        .map { it.trim() }
                        .filter { it.isNotEmpty() }
                val sender =
                    CeremonialSenderCard(
                        displayName = item.senderDisplay ?: item.sender?.name ?: "Someone",
                        handle = item.sender?.username,
                        trustLabel = trustLabel(item.senderTrust),
                        avatarUrl = null,
                    )
                return CeremonialMailLetter(
                    mailId = mailId,
                    sender = sender,
                    category = "letter",
                    subject = item.subject ?: "A letter",
                    bodyParagraphs = if (paragraphs.isEmpty()) listOf(body) else paragraphs,
                    stationery = stationery,
                    ink = ink,
                    seal = seal,
                    voicePostscriptUri = voiceUri,
                    receivedAt = item.createdAt,
                    outcomeCtas = CeremonialMailLetter.defaultOutcomeCtas(),
                )
            }

            /**
             * Locate the compose metadata inside `object_payload`.
             *
             * `POST /api/mailbox/send` writes the object as
             * `{ version, objectFormat, envelope, recipient, policy, body: {
             * content, payload } }` (`backend/routes/mailbox.js:605-638`), so
             * the ceremonial keys (`stationeryTheme`, `inkSelection`,
             * `voicePostscriptUri`) live under `body.payload` — not at the top
             * level. Older / hand-written objects put them under `payload` or
             * at the root, so probe all three in the order RN does
             * (`src/app/mailbox/detail.tsx:44`).
             */
            @Suppress("UNCHECKED_CAST")
            internal fun composePayload(objectPayload: Map<String, Any?>?): Map<String, Any?> {
                val root = objectPayload ?: return emptyMap()
                val nested = root["payload"] as? Map<String, Any?>
                if (nested != null && nested["stationeryTheme"] != null) return nested
                val body = root["body"] as? Map<String, Any?>
                val bodyPayload = body?.get("payload") as? Map<String, Any?>
                if (bodyPayload != null) return bodyPayload
                if (nested != null) return nested
                return root
            }

            internal fun trustLabel(raw: String?): String? =
                when (raw) {
                    "verified_gov", "verified_utility", "verified_business" -> "Verified"
                    "pantopus_user" -> "Pantopus friend"
                    "partial" -> "Partial trust"
                    else -> null
                }
        }
    }
