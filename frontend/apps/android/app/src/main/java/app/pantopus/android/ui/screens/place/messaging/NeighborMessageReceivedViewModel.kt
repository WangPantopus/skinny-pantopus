package app.pantopus.android.ui.screens.place.messaging

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.NeighborReplyTemplate
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val NEIGHBOR_MESSAGE_ID_KEY = "messageId"

/**
 * D2 — the receiving side of a verified-neighbor message. Fetches the
 * anonymized message (the API never returns the sender) and owns the
 * in-control actions: templated reply, "not helpful", block, and report.
 * None of these notify the sender. Mirrors the iOS
 * `NeighborMessageReceivedViewModel`.
 */
@HiltViewModel
class NeighborMessageReceivedViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val messageId: String =
            requireNotNull(savedStateHandle[NEIGHBOR_MESSAGE_ID_KEY]) {
                "NeighborMessageReceivedViewModel requires a '$NEIGHBOR_MESSAGE_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<NeighborReceivedUiState>(NeighborReceivedUiState.Loading)
        val state: StateFlow<NeighborReceivedUiState> = _state.asStateFlow()

        private val _replies = MutableStateFlow<List<NeighborReplyTemplate>>(emptyList())
        val replies: StateFlow<List<NeighborReplyTemplate>> = _replies.asStateFlow()

        private val _flags = MutableStateFlow(NeighborManageFlags())
        val flags: StateFlow<NeighborManageFlags> = _flags.asStateFlow()

        private val _editingReply = MutableStateFlow(false)
        val editingReply: StateFlow<Boolean> = _editingReply.asStateFlow()

        private val _replying = MutableStateFlow(false)
        val replying: StateFlow<Boolean> = _replying.asStateFlow()

        fun load() {
            _state.value = NeighborReceivedUiState.Loading
            viewModelScope.launch {
                val messageDeferred = async { repo.neighborMessage(messageId) }
                val catalogDeferred = async { repo.neighborMessageTemplates() }
                val messageResult = messageDeferred.await()
                val catalogResult = catalogDeferred.await()

                if (catalogResult is NetworkResult.Success) {
                    _replies.value = catalogResult.data.replies
                }
                _state.value =
                    when (messageResult) {
                        is NetworkResult.Success -> {
                            val message = messageResult.data
                            _flags.value =
                                NeighborManageFlags(
                                    notHelpful = message.notHelpful,
                                    blocked = false,
                                    reported = message.reported,
                                )
                            NeighborReceivedUiState.Loaded(message)
                        }
                        is NetworkResult.Failure ->
                            if (messageResult.error is NetworkError.NotFound) {
                                NeighborReceivedUiState.NotFound
                            } else {
                                NeighborReceivedUiState.Error(
                                    "We couldn't load this message. Check your connection and try again.",
                                )
                            }
                    }
            }
        }

        fun reply(replyTemplateId: String) {
            if (_replying.value) return
            _replying.value = true
            viewModelScope.launch {
                when (val r = repo.replyToNeighborMessage(messageId, replyTemplateId)) {
                    is NetworkResult.Success -> {
                        _editingReply.value = false
                        _state.value = NeighborReceivedUiState.Loaded(r.data)
                    }
                    is NetworkResult.Failure -> Unit // stay on the quick-reply bar
                }
                _replying.value = false
            }
        }

        fun startEditingReply() {
            _editingReply.value = true
        }

        fun markNotHelpful() {
            if (_flags.value.notHelpful) return
            viewModelScope.launch {
                repo.markNeighborMessageNotHelpful(messageId)
                _flags.value = _flags.value.copy(notHelpful = true)
            }
        }

        fun block() {
            if (_flags.value.blocked) return
            viewModelScope.launch {
                repo.blockNeighborMessageSender(messageId)
                _flags.value = _flags.value.copy(blocked = true)
            }
        }

        fun report() {
            if (_flags.value.reported) return
            viewModelScope.launch {
                repo.reportNeighborMessage(messageId, null)
                _flags.value = _flags.value.copy(reported = true)
            }
        }
    }

sealed interface NeighborReceivedUiState {
    data object Loading : NeighborReceivedUiState

    data class Loaded(val message: ReceivedNeighborMessage) : NeighborReceivedUiState

    data object NotFound : NeighborReceivedUiState

    data class Error(val message: String) : NeighborReceivedUiState
}
