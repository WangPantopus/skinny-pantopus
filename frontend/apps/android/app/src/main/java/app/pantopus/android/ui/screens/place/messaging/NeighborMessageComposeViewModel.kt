package app.pantopus.android.ui.screens.place.messaging

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homediscovery.DiscoveredHomeDto
import app.pantopus.android.data.api.models.place.NeighborMessageTemplate
import app.pantopus.android.data.api.models.place.SendNeighborMessageRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val NEIGHBOR_COMPOSE_HOME_ID_KEY = "homeId"
const val NEIGHBOR_COMPOSE_ADDRESS_KEY = "address"

/**
 * D1 — composing a verified-neighbor heads-up. Loads the server template
 * catalog (the only thing you can send — no free text), tracks the
 * selection, and sends a template-only note to a recipient home on your
 * block. The verified-only (T4) gate is enforced upstream (the dashboard
 * only surfaces the composer for verified residents; the backend re-checks).
 * Mirrors the iOS `NeighborMessageComposeViewModel`.
 */
@HiltViewModel
class NeighborMessageComposeViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        private val discovery: HomeDiscoveryRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /** The sender's Home; address suggestions favor addresses near it. */
        val homeId: String =
            requireNotNull(savedStateHandle[NEIGHBOR_COMPOSE_HOME_ID_KEY]) {
                "NeighborMessageComposeViewModel requires a '$NEIGHBOR_COMPOSE_HOME_ID_KEY' nav arg."
            }
        val address: String = savedStateHandle[NEIGHBOR_COMPOSE_ADDRESS_KEY] ?: ""

        // Chosen on this screen (Choose a home): an address, never a name.
        private val _recipient = MutableStateFlow<ComposeRecipient?>(null)
        val recipient: StateFlow<ComposeRecipient?> = _recipient.asStateFlow()

        private val _recipientQuery = MutableStateFlow("")
        val recipientQuery: StateFlow<String> = _recipientQuery.asStateFlow()

        private val _recipientSearch = MutableStateFlow<RecipientSearchState>(RecipientSearchState.Idle)
        val recipientSearch: StateFlow<RecipientSearchState> = _recipientSearch.asStateFlow()
        private var searchGeneration = 0

        private val _state = MutableStateFlow<NeighborComposeUiState>(NeighborComposeUiState.Loading)
        val state: StateFlow<NeighborComposeUiState> = _state.asStateFlow()

        private val _selectedTemplateId = MutableStateFlow<String?>(null)
        val selectedTemplateId: StateFlow<String?> = _selectedTemplateId.asStateFlow()

        private val _sending = MutableStateFlow(false)
        val sending: StateFlow<Boolean> = _sending.asStateFlow()

        private val _sendError = MutableStateFlow<String?>(null)
        val sendError: StateFlow<String?> = _sendError.asStateFlow()

        private val _sent = MutableStateFlow(false)
        val sent: StateFlow<Boolean> = _sent.asStateFlow()

        fun load() {
            if (_state.value is NeighborComposeUiState.Loaded) return
            _state.value = NeighborComposeUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val r = repo.neighborMessageTemplates()) {
                        is NetworkResult.Success -> NeighborComposeUiState.Loaded(r.data.templates)
                        is NetworkResult.Failure ->
                            NeighborComposeUiState.Error(
                                "We couldn't open the composer. Check your connection and try again.",
                            )
                    }
            }
        }

        fun updateRecipientQuery(text: String) {
            _recipientQuery.value = text
            searchGeneration++
            _recipientSearch.value = RecipientSearchState.Idle
        }

        /** A house number and a street: at least four characters with a digit and a letter. */
        fun canSearch(text: String = _recipientQuery.value): Boolean {
            val query = text.trim()
            return query.length >= MIN_RECIPIENT_QUERY && query.any(Char::isDigit) && query.any(Char::isLetter) &&
                _recipientSearch.value !is RecipientSearchState.Loading
        }

        /** Looks the typed (or picked) address up among discoverable homes. */
        fun searchRecipients(text: String = _recipientQuery.value) {
            if (!canSearch(text)) return
            if (text != _recipientQuery.value) _recipientQuery.value = text
            val generation = ++searchGeneration
            val query = text.trim()
            _recipientSearch.value = RecipientSearchState.Loading
            viewModelScope.launch {
                val result = discovery.discover(query)
                if (generation != searchGeneration) return@launch
                _recipientSearch.value =
                    when (result) {
                        // Discovery's privacy contract: never a redacted or ambiguous address, never your own
                        // household, never a resident's name.
                        is NetworkResult.Success ->
                            RecipientSearchState.Loaded(
                                result.data.homes.filter {
                                    it.id != homeId && !it.isMember && it.addressRedacted == false &&
                                        it.visibility == "public_preview" && !it.address.isNullOrBlank()
                                },
                            )
                        is NetworkResult.Failure ->
                            RecipientSearchState.Error("Couldn't search homes. Check your connection and try again.")
                    }
            }
        }

        fun selectRecipient(home: DiscoveredHomeDto) {
            if (_sending.value) return
            val homes = (_recipientSearch.value as? RecipientSearchState.Loaded)?.homes ?: return
            val street = home.address
            if (homes.none { it.id == home.id } || street.isNullOrBlank()) return
            _recipient.value =
                ComposeRecipient(
                    homeId = home.id,
                    address = street,
                    relativeLabel = listOfNotNull(home.city, home.state).joinToString(", "),
                )
            _sendError.value = null
        }

        fun changeRecipient() {
            if (_sending.value) return
            _recipient.value = null
            _sendError.value = null
        }

        fun select(templateId: String) {
            _selectedTemplateId.value = templateId
        }

        fun selectedTemplate(): NeighborMessageTemplate? {
            val id = _selectedTemplateId.value ?: return null
            return (_state.value as? NeighborComposeUiState.Loaded)?.templates?.firstOrNull { it.id == id }
        }

        fun send() {
            val recipientHome = _recipient.value ?: return
            val template = selectedTemplate() ?: return
            if (_sending.value) return
            _sending.value = true
            _sendError.value = null
            viewModelScope.launch {
                val result =
                    repo.sendNeighborMessage(
                        SendNeighborMessageRequest(
                            senderHomeId = homeId,
                            recipientHomeId = recipientHome.homeId,
                            templateId = template.id,
                        ),
                    )
                when (result) {
                    is NetworkResult.Success -> _sent.value = true
                    is NetworkResult.Failure ->
                        _sendError.value = "We couldn't send that message. Please try again."
                }
                _sending.value = false
            }
        }
    }

private const val MIN_RECIPIENT_QUERY = 4

/** The Choose a home search. */
sealed interface RecipientSearchState {
    data object Idle : RecipientSearchState

    data object Loading : RecipientSearchState

    data class Loaded(val homes: List<DiscoveredHomeDto>) : RecipientSearchState

    data class Error(val message: String) : RecipientSearchState
}

sealed interface NeighborComposeUiState {
    data object Loading : NeighborComposeUiState

    data class Loaded(val templates: List<NeighborMessageTemplate>) : NeighborComposeUiState

    data class Error(val message: String) : NeighborComposeUiState
}
