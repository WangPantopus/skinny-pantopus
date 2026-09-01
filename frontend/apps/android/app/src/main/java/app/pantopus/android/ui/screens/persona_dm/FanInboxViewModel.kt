@file:Suppress("LongMethod", "MagicNumber", "PackageNaming", "ReturnCount", "TooManyFunctions")

package app.pantopus.android.ui.screens.persona_dm

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.membership.PersonaMembershipDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.membership.MembershipRepository
import app.pantopus.android.data.personadm.PersonaDmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key — mirrors the `ChildRoutes.FAN_INBOX` route template. */
const val FAN_INBOX_PERSONA_ID_KEY = "personaId"

/**
 * Backs the fan side of persona DMs (A15.5). Loads the fan's own thread list
 * (`GET /api/personas/:id/dms/threads`, `backend/routes/personaDms.js:185`)
 * plus their membership (`GET /api/personas/:id/membership`,
 * `backend/routes/personaMembership.js:108`) so the composer can show the
 * real remaining message-thread quota before a credit is spent.
 *
 * Opening a thread posts `POST /api/personas/:id/dms/threads`
 * (`backend/routes/personaDms.js:135`) and BURNS one credit. The 402 / 403
 * rejections map onto [FanInboxGate], each with its own copy, rather than a
 * generic "request failed".
 */
@HiltViewModel
class FanInboxViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val membershipRepository: MembershipRepository,
        private val dmRepository: PersonaDmRepository,
    ) : ViewModel() {
        private val personaId: String = savedStateHandle.get<String>(FAN_INBOX_PERSONA_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<FanInboxUiState>(FanInboxUiState.Loading)
        val state: StateFlow<FanInboxUiState> = _state.asStateFlow()

        private val _draft = MutableStateFlow("")
        val draft: StateFlow<String> = _draft.asStateFlow()

        private val _isOpening = MutableStateFlow(false)
        val isOpening: StateFlow<Boolean> = _isOpening.asStateFlow()

        /** Confirmation after a successful open ("Sent. 2 threads left…"). */
        private val _openConfirmation = MutableStateFlow<String?>(null)
        val openConfirmation: StateFlow<String?> = _openConfirmation.asStateFlow()

        private var header =
            FanInboxStartContent(
                personaTitle = "Messages",
                personaName = "Creator",
                initials = "",
                quota = FanInboxQuota(remaining = null, limit = null),
                gate = null,
            )

        fun onDraftChange(value: String) {
            _draft.value = value
        }

        fun canOpen(): Boolean {
            val current = _state.value
            return current is FanInboxUiState.Start &&
                current.content.gate == null &&
                _draft.value.isNotBlank() &&
                !_isOpening.value
        }

        fun load() {
            _state.value = FanInboxUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() = load()

        private suspend fun fetch() {
            // Membership first: it decides `no_membership` /
            // `tier_does_not_allow` and supplies the quota chip. A 404 here is
            // the no-membership state, not a load failure.
            var membership: PersonaMembershipDto? = null
            var membershipMissing = false
            when (val result = membershipRepository.membership(personaId)) {
                is NetworkResult.Success -> {
                    membership = result.data.membership
                    membershipMissing = membership == null
                }
                is NetworkResult.Failure -> {
                    val error = result.error
                    if (error is NetworkError.NotFound || error is NetworkError.Forbidden) {
                        membershipMissing = true
                    } else {
                        _state.value = FanInboxUiState.Error("Couldn't load your messages.")
                        return
                    }
                }
            }

            header = startContent(membership, membershipMissing)

            // With no membership the thread list is guaranteed empty (the
            // backend short-circuits), so skip the call entirely.
            if (membershipMissing) {
                _state.value = FanInboxUiState.Start(header)
                return
            }

            when (val result = dmRepository.threads(personaId)) {
                is NetworkResult.Success -> {
                    val thread = result.data.threads.firstOrNull()
                    _state.value =
                        if (thread != null) {
                            FanInboxUiState.Thread(thread.id)
                        } else {
                            FanInboxUiState.Start(header)
                        }
                }
                is NetworkResult.Failure ->
                    _state.value = FanInboxUiState.Error("Couldn't load your messages.")
            }
        }

        /**
         * Open a brand-new thread. Consumes one message-thread credit; the
         * backend replies with the remaining count so the confirmation can
         * state it exactly (mirrors RN's "Sent. N threads left this period.").
         */
        fun openThread() {
            val trimmed = _draft.value.trim()
            if (trimmed.isEmpty() || _isOpening.value) return
            _isOpening.value = true
            _openConfirmation.value = null
            viewModelScope.launch {
                when (val result = dmRepository.openThread(personaId, trimmed)) {
                    is NetworkResult.Success -> {
                        _draft.value = ""
                        _isOpening.value = false
                        _openConfirmation.value = openConfirmationCopy(result.data.quotaRemaining)
                        val threadId = result.data.threadId
                        if (threadId != null) {
                            _state.value = FanInboxUiState.Thread(threadId)
                        } else {
                            fetch()
                        }
                    }
                    is NetworkResult.Failure -> {
                        _isOpening.value = false
                        _state.value =
                            FanInboxUiState.Start(
                                header.copy(gate = gateFor(result.error) ?: header.gate),
                            )
                    }
                }
            }
        }

        companion object {
            internal fun openConfirmationCopy(quotaRemaining: Int?): String {
                if (quotaRemaining == null) return "Sent."
                val noun = if (quotaRemaining == 1) "thread" else "threads"
                return "Sent. $quotaRemaining $noun left this period."
            }

            /**
             * Map an open-thread rejection onto its first-class state.
             *
             * `safeApiCall` collapses every 403 into [NetworkError.Forbidden]
             * (the body is dropped), so `blocked` is the residual once
             * `no_membership` and `tier_does_not_allow` have already been
             * ruled out client-side from the membership read.
             */
            internal fun gateFor(error: NetworkError): FanInboxGate? =
                when {
                    error is NetworkError.ClientError && error.code == QUOTA_EXHAUSTED_STATUS ->
                        FanInboxGate.QuotaExhausted
                    error is NetworkError.Forbidden -> FanInboxGate.Blocked
                    error is NetworkError.NotFound -> FanInboxGate.NoMembership
                    else -> null
                }

            internal fun startContent(
                membership: PersonaMembershipDto?,
                membershipMissing: Boolean,
            ): FanInboxStartContent {
                val handle = membership?.persona?.handle
                val name = membership?.persona?.displayName ?: handle ?: "Creator"
                val perPeriod = membership?.tier?.msgThreadsPerPeriod
                val remaining = membership?.quotaRemaining?.msgThreads
                return FanInboxStartContent(
                    personaTitle = handle?.let { "@$it" } ?: "Messages",
                    personaName = name,
                    initials = PersonaDmThreadViewModel.initials(name),
                    quota = FanInboxQuota(remaining = remaining, limit = perPeriod),
                    gate = gate(membershipMissing, perPeriod, remaining),
                )
            }

            internal fun gate(
                membershipMissing: Boolean,
                perPeriod: Int?,
                remaining: Int?,
            ): FanInboxGate? {
                if (membershipMissing) return FanInboxGate.NoMembership
                if (perPeriod == null || perPeriod == 0) return FanInboxGate.TierDoesNotAllow
                // A negative `msgThreadsPerPeriod` means unlimited.
                if (perPeriod < 0) return null
                if (remaining != null && remaining <= 0) return FanInboxGate.QuotaExhausted
                return null
            }

            private const val QUOTA_EXHAUSTED_STATUS = 402
        }
    }
