package app.pantopus.android.ui.screens.place.messaging

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.geo.NormalizedAddress
import app.pantopus.android.data.api.models.place.NeighborAddressCheckRequest
import app.pantopus.android.data.api.models.place.NeighborMessageTemplate
import app.pantopus.android.data.api.models.place.NeighborRecipientAddress
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
 * selection, and sends a template-only note to an address on your block.
 * The note reaches a verified household if one lives there; nothing here says
 * whether one does. The verified-only (T4) gate is enforced upstream (the
 * dashboard only surfaces the composer for verified residents; the backend
 * re-checks).
 * Mirrors the iOS `NeighborMessageComposeViewModel`.
 */
@HiltViewModel
class NeighborMessageComposeViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
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

        /** The chosen address's apartment or unit, if it has one. */
        private val _recipientUnit = MutableStateFlow("")
        val recipientUnit: StateFlow<String> = _recipientUnit.asStateFlow()

        private val _addressCheck = MutableStateFlow<AddressCheckState>(AddressCheckState.Idle)
        val addressCheck: StateFlow<AddressCheckState> = _addressCheck.asStateFlow()
        private var checkGeneration = 0

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
            checkGeneration++
            _addressCheck.value = AddressCheckState.Idle
        }

        fun updateRecipientUnit(text: String) {
            _recipientUnit.value = text
        }

        /** A house number and a street: at least four characters with a digit and a letter. */
        fun canUseTyped(text: String = _recipientQuery.value): Boolean {
            val query = text.trim()
            return query.length >= MIN_RECIPIENT_QUERY && query.any(Char::isDigit) && query.any(Char::isLetter) &&
                _addressCheck.value !is AddressCheckState.Checking
        }

        /** Checks what was typed; the server looks it up in your town. */
        fun useTypedAddress() {
            if (!canUseTyped()) return
            checkAddress(NeighborAddressCheckRequest(senderHomeId = homeId, address = _recipientQuery.value.trim()))
        }

        /** A picked address suggestion is the exact address: check it at once. */
        fun choosePicked(picked: NormalizedAddress) {
            val street = picked.address?.takeIf { it.isNotBlank() } ?: return
            _recipientQuery.value = street
            checkAddress(
                NeighborAddressCheckRequest(
                    senderHomeId = homeId,
                    address = street,
                    city = picked.city,
                    state = picked.state,
                    zipcode = picked.zipcode,
                ),
            )
        }

        /** Asks the server whether the address is on your block, and chooses it if so. */
        private fun checkAddress(request: NeighborAddressCheckRequest) {
            if (_sending.value) return
            val generation = ++checkGeneration
            _addressCheck.value = AddressCheckState.Checking
            viewModelScope.launch {
                val result = repo.checkNeighborAddress(request)
                if (generation != checkGeneration) return@launch
                _addressCheck.value =
                    when (result) {
                        is NetworkResult.Success -> {
                            val street = result.data.address
                            if (result.data.status == "on_block" && !street.isNullOrBlank()) {
                                _recipient.value =
                                    ComposeRecipient(street, result.data.city, result.data.state, result.data.zipcode)
                                _recipientUnit.value = ""
                                _sendError.value = null
                                AddressCheckState.Idle
                            } else {
                                AddressCheckState.Refused(
                                    result.data.message ?: "Couldn't use that address. Check the number and street.",
                                )
                            }
                        }
                        is NetworkResult.Failure ->
                            AddressCheckState.Refused("Couldn't check that address. Check your connection and try again.")
                    }
            }
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
            val recipient = _recipient.value ?: return
            val template = selectedTemplate() ?: return
            if (_sending.value) return
            _sending.value = true
            _sendError.value = null
            viewModelScope.launch {
                val result =
                    repo.sendNeighborMessage(
                        SendNeighborMessageRequest(
                            senderHomeId = homeId,
                            recipientAddress =
                                NeighborRecipientAddress(
                                    address = recipient.address,
                                    unit = _recipientUnit.value.trim().ifEmpty { null },
                                    city = recipient.city,
                                    state = recipient.state,
                                    zipcode = recipient.zipcode,
                                ),
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

/** The Choose a home address check. */
sealed interface AddressCheckState {
    data object Idle : AddressCheckState

    data object Checking : AddressCheckState

    data class Refused(val message: String) : AddressCheckState
}

sealed interface NeighborComposeUiState {
    data object Loading : NeighborComposeUiState

    data class Loaded(val templates: List<NeighborMessageTemplate>) : NeighborComposeUiState

    data class Error(val message: String) : NeighborComposeUiState
}
