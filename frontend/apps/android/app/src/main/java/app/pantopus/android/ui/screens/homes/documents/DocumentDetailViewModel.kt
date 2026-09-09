@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okio.ByteString
import javax.inject.Inject

/** Nav arg keys for the Document Detail route. */
const val DOCUMENT_DETAIL_HOME_ID_KEY = "homeId"
const val DOCUMENT_DETAIL_DOC_ID_KEY = "documentId"

/** UI state surfaces for the Document Detail screen. */
sealed interface DocumentDetailUiState {
    data object Loading : DocumentDetailUiState

    data class Loaded(
        val document: HomeDocumentDto,
        val isMutating: Boolean = false,
        val content: ByteString? = null,
    ) : DocumentDetailUiState

    data class Error(val message: String) : DocumentDetailUiState
}

/** Transient toast surfaced by the screen. */
data class DocumentDetailToast(val text: String, val isError: Boolean)

@HiltViewModel
class DocumentDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(DOCUMENT_DETAIL_HOME_ID_KEY)) {
                "DocumentDetailViewModel requires a $DOCUMENT_DETAIL_HOME_ID_KEY nav argument"
            }
        private val documentId: String =
            checkNotNull(savedStateHandle.get<String>(DOCUMENT_DETAIL_DOC_ID_KEY)) {
                "DocumentDetailViewModel requires a $DOCUMENT_DETAIL_DOC_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<DocumentDetailUiState>(DocumentDetailUiState.Loading)
        val state: StateFlow<DocumentDetailUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<DocumentDetailToast?>(null)
        val toast: StateFlow<DocumentDetailToast?> = _toast.asStateFlow()

        private var loadId = 0

        fun clearContent() {
            loadId += 1
            _state.value = DocumentDetailUiState.Loading
        }

        fun load() {
            viewModelScope.launch { loadDocument() }
        }

        fun export(onReady: (HomeDocumentDto, ByteString) -> Unit) {
            viewModelScope.launch {
                loadDocument()
                val loaded = _state.value as? DocumentDetailUiState.Loaded ?: return@launch
                loaded.content?.let { onReady(loaded.document, it) }
            }
        }

        private suspend fun loadDocument() {
            clearContent()
            val requestId = loadId
            when (val result = repo.getHomeDocuments(homeId)) {
                is NetworkResult.Success -> {
                    if (requestId != loadId) return
                    val match = result.data.documents.firstOrNull { it.id.equals(documentId, ignoreCase = true) }
                    if (match == null) {
                        _state.value = DocumentDetailUiState.Error("This document is no longer available.")
                    } else if (match.contentUrl == null) {
                        _state.value = DocumentDetailUiState.Loaded(match)
                    } else {
                        val bytes = repo.homeDocumentContent(homeId, documentId)
                        if (requestId != loadId) return
                        _state.value =
                            when (bytes) {
                                is NetworkResult.Success -> DocumentDetailUiState.Loaded(match, content = bytes.data)
                                is NetworkResult.Failure ->
                                    DocumentDetailUiState.Error(bytes.error.displayMessage("Couldn't load this file."))
                            }
                    }
                }
                is NetworkResult.Failure -> {
                    if (requestId == loadId) {
                        _state.value = DocumentDetailUiState.Error(result.error.displayMessage("Couldn't load this document."))
                    }
                }
            }
        }

        /**
         * Soft-delete stub — the backend has no DELETE handler for
         * documents today. Surface a toast and leave the state intact;
         * a follow-up patch wires the real DELETE call.
         */
        fun delete() {
            val current = _state.value as? DocumentDetailUiState.Loaded ?: return
            _state.update { current.copy(isMutating = true) }
            viewModelScope.launch {
                _toast.value =
                    DocumentDetailToast(
                        "Delete will be available once the server ships its handler.",
                        isError = false,
                    )
                _state.update { current.copy(isMutating = false) }
            }
        }

        fun dismissToast() {
            _toast.value = null
        }
    }
