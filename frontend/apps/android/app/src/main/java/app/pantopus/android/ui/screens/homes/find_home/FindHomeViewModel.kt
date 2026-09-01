@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.find_home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homediscovery.DiscoveredHomeDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.token_accept.TokenAcceptRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Render states for the discovery result area. */
sealed interface FindHomeUiState {
    /** Query is shorter than the backend's 2-character minimum. */
    data class Idle(
        val hint: String? = null,
    ) : FindHomeUiState

    data object Loading : FindHomeUiState

    data class Loaded(
        val homes: List<DiscoveredHomeDto>,
    ) : FindHomeUiState

    data object Empty : FindHomeUiState

    data class Error(
        val message: String,
    ) : FindHomeUiState
}

/** Outbound navigation the host NavHost performs. */
sealed interface FindHomeOutboundEvent {
    /** Tapping a discovered home starts the ownership-claim wizard. */
    data class OpenClaimOwnership(
        val homeId: String,
    ) : FindHomeOutboundEvent

    /** Empty-state / "add missing address" CTA → the Add Home wizard. */
    data object OpenAddHome : FindHomeOutboundEvent

    /**
     * Invite code resolved — hand the raw token to the shared
     * TokenAccept surface rather than re-implementing accept/decline.
     */
    data class OpenInviteToken(
        val token: String,
    ) : FindHomeOutboundEvent
}

/**
 * A12.1 "Find or Add Home" discovery. Mirrors RN
 * `src/app/homes/find.tsx`:
 *
 *  - search public-preview homes → `GET /api/homes/discover`
 *  - tap a result                → start an ownership claim
 *  - empty state                 → "Add missing address"
 *  - manual invite-code box      → `GET /api/homes/invitations/token/:token`
 *                                  then hand off to TokenAccept
 */
@HiltViewModel
class FindHomeViewModel
    @Inject
    constructor(
        private val repository: HomeDiscoveryRepository,
        private val tokenAcceptRepository: TokenAcceptRepository,
        networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        /** Drives the shared offline strip. */
        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        private val _state = MutableStateFlow<FindHomeUiState>(FindHomeUiState.Idle())
        val state: StateFlow<FindHomeUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _inviteSectionExpanded = MutableStateFlow(false)
        val inviteSectionExpanded: StateFlow<Boolean> = _inviteSectionExpanded.asStateFlow()

        private val _inviteCode = MutableStateFlow("")
        val inviteCode: StateFlow<String> = _inviteCode.asStateFlow()

        private val _isResolvingInvite = MutableStateFlow(false)
        val isResolvingInvite: StateFlow<Boolean> = _isResolvingInvite.asStateFlow()

        private val _inviteError = MutableStateFlow<String?>(null)
        val inviteError: StateFlow<String?> = _inviteError.asStateFlow()

        val pendingEvent = MutableStateFlow<FindHomeOutboundEvent?>(null)

        private var searchJob: Job? = null

        private val trimmedQuery: String get() = _query.value.trim()

        /** "Type 1 more character to search homes" — RN `formatThresholdHint`. */
        private fun thresholdHint(): String? {
            val remaining = MIN_QUERY_LENGTH - trimmedQuery.length
            if (remaining <= 0 || trimmedQuery.isEmpty()) return null
            val noun = if (remaining == 1) "character" else "characters"
            return "Type $remaining more $noun to search homes"
        }

        fun updateQuery(value: String) {
            _query.value = value
            searchJob?.cancel()
            if (trimmedQuery.length < MIN_QUERY_LENGTH) {
                _state.value = FindHomeUiState.Idle(thresholdHint())
                return
            }
            _state.value = FindHomeUiState.Loading
            searchJob =
                viewModelScope.launch {
                    // 250 ms debounce so every keystroke doesn't hit the API.
                    delay(SEARCH_DEBOUNCE_MS)
                    search()
                }
        }

        /** Explicit submit (keyboard "Search") — bypasses the debounce. */
        fun submitSearch() {
            searchJob?.cancel()
            if (trimmedQuery.length < MIN_QUERY_LENGTH) {
                _state.value = FindHomeUiState.Idle(thresholdHint())
                return
            }
            _state.value = FindHomeUiState.Loading
            searchJob = viewModelScope.launch { search() }
        }

        fun refresh() {
            if (trimmedQuery.length < MIN_QUERY_LENGTH) {
                _state.value = FindHomeUiState.Idle(thresholdHint())
                return
            }
            searchJob?.cancel()
            _state.value = FindHomeUiState.Loading
            searchJob = viewModelScope.launch { search() }
        }

        fun clearQuery() {
            searchJob?.cancel()
            _query.value = ""
            _state.value = FindHomeUiState.Idle()
        }

        private suspend fun search() {
            val term = trimmedQuery
            when (val result = repository.discover(term)) {
                is NetworkResult.Success -> {
                    if (term != trimmedQuery) return
                    _state.value =
                        if (result.data.homes.isEmpty()) {
                            FindHomeUiState.Empty
                        } else {
                            FindHomeUiState.Loaded(result.data.homes)
                        }
                }
                is NetworkResult.Failure ->
                    _state.value =
                        FindHomeUiState.Error(
                            result.error.message.ifBlank { "Couldn't search homes. Try again." },
                        )
            }
        }

        // MARK: - Intents

        fun selectHome(home: DiscoveredHomeDto) {
            pendingEvent.value = FindHomeOutboundEvent.OpenClaimOwnership(home.id)
        }

        fun addMissingHome() {
            pendingEvent.value = FindHomeOutboundEvent.OpenAddHome
        }

        fun toggleInviteSection() {
            _inviteSectionExpanded.update { !it }
            if (!_inviteSectionExpanded.value) _inviteError.value = null
        }

        fun updateInviteCode(value: String) {
            _inviteCode.value = value
            if (_inviteError.value != null) _inviteError.value = null
        }

        /**
         * Resolve the pasted invite code, then hand the token to the
         * shared TokenAccept surface. Never duplicates TokenAccept's own
         * accept / decline calls.
         */
        fun submitInviteCode() {
            val token = _inviteCode.value.trim()
            if (token.isEmpty() || _isResolvingInvite.value) return
            viewModelScope.launch {
                _isResolvingInvite.value = true
                _inviteError.value = null
                when (val result = tokenAcceptRepository.homeInvite(token)) {
                    is NetworkResult.Success -> {
                        val invite = result.data
                        when {
                            invite.expired == true ->
                                _inviteError.value = "That invite has expired. Ask for a new one."
                            invite.alreadyUsed == true ->
                                _inviteError.value = "That invite was already used."
                            invite.invitation == null ->
                                _inviteError.value = "We couldn't find that invite code."
                            else ->
                                pendingEvent.value = FindHomeOutboundEvent.OpenInviteToken(token)
                        }
                    }
                    is NetworkResult.Failure ->
                        _inviteError.value =
                            result.error.message.ifBlank { "We couldn't find that invite code." }
                }
                _isResolvingInvite.value = false
            }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        companion object {
            /** Backend minimum (`backend/routes/home.js:2308`). */
            const val MIN_QUERY_LENGTH = 2
            private const val SEARCH_DEBOUNCE_MS = 250L
        }
    }
