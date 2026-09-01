package app.pantopus.android.ui.screens.place.messaging

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.NeighborMessageTemplate
import app.pantopus.android.data.api.models.place.SendNeighborMessageRequest
import app.pantopus.android.data.api.net.NetworkResult
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
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[NEIGHBOR_COMPOSE_HOME_ID_KEY]) {
                "NeighborMessageComposeViewModel requires a '$NEIGHBOR_COMPOSE_HOME_ID_KEY' nav arg."
            }
        val address: String = savedStateHandle[NEIGHBOR_COMPOSE_ADDRESS_KEY] ?: ""

        // Native has no block-home picker yet (k-anon density hides
        // membership), so the composer opens recipient-less; a future block
        // deep-link would populate this.
        val recipient: ComposeRecipient? = null

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

        fun select(templateId: String) {
            _selectedTemplateId.value = templateId
        }

        fun selectedTemplate(): NeighborMessageTemplate? {
            val id = _selectedTemplateId.value ?: return null
            return (_state.value as? NeighborComposeUiState.Loaded)?.templates?.firstOrNull { it.id == id }
        }

        fun send() {
            val recipientHome = recipient ?: return
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

sealed interface NeighborComposeUiState {
    data object Loading : NeighborComposeUiState

    data class Loaded(val templates: List<NeighborMessageTemplate>) : NeighborComposeUiState

    data class Error(val message: String) : NeighborComposeUiState
}
