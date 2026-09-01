@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.persona_dm

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.personadm.PersonaDmMessageDto
import app.pantopus.android.data.api.models.personadm.PersonaDmReplyPolicyStatusDto
import app.pantopus.android.data.api.models.personadm.PersonaDmThreadDetailResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.personadm.PersonaDmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav-arg keys — mirror the `ChildRoutes.PERSONA_DM_THREAD` template. */
const val PERSONA_DM_PERSONA_ID_KEY = "personaId"
const val PERSONA_DM_THREAD_ID_KEY = "threadId"

/**
 * Backs the persona-DM thread (A15.4 / A15.5). Reads
 * `GET /api/personas/:id/dms/threads/:threadId`
 * (`backend/routes/personaDms.js:235`) — which doubles as the mark-read
 * call — and appends via
 * `POST /api/personas/:id/dms/threads/:threadId/messages`
 * (`backend/routes/personaDms.js:314`).
 *
 * Send failures that the backend treats as first-class states get their own
 * copy: a `403 blocked` is not "request failed", it is "this profile can't
 * accept new messages from your account".
 */
@HiltViewModel
class PersonaDmThreadViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: PersonaDmRepository,
    ) : ViewModel() {
        private val personaId: String = savedStateHandle.get<String>(PERSONA_DM_PERSONA_ID_KEY).orEmpty()
        private val threadId: String = savedStateHandle.get<String>(PERSONA_DM_THREAD_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<PersonaDmThreadUiState>(PersonaDmThreadUiState.Loading)
        val state: StateFlow<PersonaDmThreadUiState> = _state.asStateFlow()

        private val _draft = MutableStateFlow("")
        val draft: StateFlow<String> = _draft.asStateFlow()

        private val _isSending = MutableStateFlow(false)
        val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

        private val _sendError = MutableStateFlow<String?>(null)
        val sendError: StateFlow<String?> = _sendError.asStateFlow()

        fun onDraftChange(value: String) {
            _draft.value = value
            if (_sendError.value != null) _sendError.value = null
        }

        fun canSend(): Boolean = _draft.value.isNotBlank() && !_isSending.value

        fun load() {
            _state.value = PersonaDmThreadUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() = load()

        private suspend fun fetch() {
            when (val result = repository.thread(personaId, threadId)) {
                is NetworkResult.Success -> {
                    val loaded = project(result.data)
                    _state.value =
                        if (loaded.messages.isEmpty()) {
                            PersonaDmThreadUiState.Empty(loaded)
                        } else {
                            PersonaDmThreadUiState.Loaded(loaded)
                        }
                }
                is NetworkResult.Failure ->
                    _state.value = PersonaDmThreadUiState.Error(loadErrorMessage(result.error))
            }
        }

        /**
         * Append the composer draft to this thread. No quota is consumed —
         * only opening a NEW thread burns a message-thread credit.
         */
        fun send() {
            val trimmed = _draft.value.trim()
            if (trimmed.isEmpty() || _isSending.value) return
            _isSending.value = true
            _sendError.value = null
            viewModelScope.launch {
                when (val result = repository.sendMessage(personaId, threadId, trimmed)) {
                    is NetworkResult.Success -> {
                        _draft.value = ""
                        _isSending.value = false
                        fetch()
                    }
                    is NetworkResult.Failure -> {
                        _isSending.value = false
                        _sendError.value = sendErrorMessage(result.error)
                    }
                }
            }
        }

        companion object {
            internal fun loadErrorMessage(error: NetworkError): String =
                when (error) {
                    is NetworkError.NotFound -> "This thread is no longer available."
                    is NetworkError.Forbidden -> "You don't have access to this thread."
                    else -> "Couldn't load this thread."
                }

            /**
             * `403 blocked` is the only rejection the append route raises
             * beyond 404 — the fan can still see the thread but may not post.
             */
            internal fun sendErrorMessage(error: NetworkError): String =
                when (error) {
                    is NetworkError.Forbidden -> "This profile can't accept new messages from your account."
                    is NetworkError.NotFound -> "This thread is no longer available."
                    else -> "Couldn't send. Try again."
                }

            internal fun project(dto: PersonaDmThreadDetailResponse): PersonaDmThreadLoaded {
                val role = PersonaDmViewerRole.fromWire(dto.viewerRole)
                val counterpartyHandle =
                    if (role == PersonaDmViewerRole.Fan) dto.persona?.handle else dto.fan?.handle
                val counterpartyName =
                    if (role == PersonaDmViewerRole.Fan) {
                        dto.persona?.displayName ?: dto.persona?.handle
                    } else {
                        dto.fan?.displayName ?: dto.fan?.handle
                    }
                val name =
                    counterpartyName ?: if (role == PersonaDmViewerRole.Fan) "Creator" else "Follower"
                return PersonaDmThreadLoaded(
                    title = counterpartyHandle?.let { "@$it" } ?: name,
                    subtitle = name,
                    initials = initials(name),
                    viewerRole = role,
                    policyBanner =
                        if (role == PersonaDmViewerRole.Fan) policyBanner(dto.replyPolicyStatus) else null,
                    messages = dto.messages.map { message(it, role) },
                )
            }

            internal fun message(
                dto: PersonaDmMessageDto,
                viewerRole: PersonaDmViewerRole,
            ): PersonaDmMessageContent {
                val fromViewer = PersonaDmViewerRole.fromWire(dto.senderRole) == viewerRole
                return PersonaDmMessageContent(
                    id = dto.id,
                    fromViewer = fromViewer,
                    body = dto.body.orEmpty(),
                    timeLabel = timeLabel(dto.createdAt),
                    readByCounterparty = fromViewer && dto.readAt != null,
                )
            }

            /**
             * Mirrors RN `renderReplyPolicyBanner` — the `sla_missed` copy
             * names the window that was missed and points at the refund.
             */
            internal fun policyBanner(dto: PersonaDmReplyPolicyStatusDto?): PersonaDmPolicyBanner? {
                val status = dto?.status ?: return null
                val days = dto.slaDays ?: 0
                if (status == "sla_missed") {
                    return PersonaDmPolicyBanner(
                        kind = PersonaDmPolicyBannerKind.Missed,
                        text =
                            "The creator missed the $days-day reply window. " +
                                "You may request a refund from your membership.",
                    )
                }
                return PersonaDmPolicyBanner(
                    kind = PersonaDmPolicyBannerKind.OnTrack,
                    text = policyLabel(dto.policy, days),
                )
            }

            internal fun policyLabel(
                policy: String?,
                slaDays: Int,
            ): String =
                when (policy) {
                    "discretion" -> "Replies at the creator's discretion."
                    "always" -> "Reply guaranteed."
                    else -> "Reply within $slaDays days."
                }

            internal fun initials(name: String): String {
                val parts = name.split(" ").filter { it.isNotEmpty() }.take(2)
                val letters = parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
                return letters.ifEmpty { name.take(2).uppercase() }
            }

            private val timeFormatter: DateTimeFormatter =
                DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            private val dateFormatter: DateTimeFormatter =
                DateTimeFormatter.ofPattern("MMM d", Locale.US)

            internal fun timeLabel(iso: String?): String {
                val instant =
                    iso?.takeUnless(String::isBlank)?.let { runCatching { Instant.parse(it) }.getOrNull() }
                        ?: return ""
                val seconds = Duration.between(instant, Instant.now()).seconds.coerceAtLeast(0)
                val zoned = instant.atZone(ZoneId.systemDefault())
                return when {
                    seconds < SECONDS_PER_MINUTE -> "Just now"
                    seconds < SECONDS_PER_DAY -> zoned.format(timeFormatter)
                    else -> zoned.format(dateFormatter)
                }
            }

            private const val SECONDS_PER_MINUTE = 60L
            private const val SECONDS_PER_DAY = 24L * 60L * 60L
        }
    }
