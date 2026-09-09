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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okio.ByteString
import java.io.InputStream
import java.util.UUID
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

        private val _shouldDismiss = MutableStateFlow(false)
        val shouldDismiss: StateFlow<Boolean> = _shouldDismiss.asStateFlow()

        private var loadId = 0
        private var mutating = false
        private var deleted = false
        private var replacementDocument: HomeDocumentDto? = null
        private var replacementSelection = UUID.randomUUID()
        private var replacementAttempt: Triple<PickedFile, String, String>? = null
        private val _replacementFile = MutableStateFlow<PickedFile?>(null)
        val replacementFile: StateFlow<PickedFile?> = _replacementFile.asStateFlow()

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
            if (mutating || deleted) return
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

        fun beginReplacement(): Boolean {
            val current = _state.value as? DocumentDetailUiState.Loaded ?: return false
            if (mutating || deleted) return false
            if (current.document.fileVersion == null || current.document.contentUrl == null) return false
            replacementSelection = UUID.randomUUID()
            replacementDocument = current.document
            _replacementFile.value = null
            return true
        }

        suspend fun readReplacement(
            filename: String,
            mimeType: String?,
            openStream: () -> InputStream?,
        ) {
            if (replacementDocument == null) return
            val selection = replacementSelection
            try {
                val bytes = withContext(Dispatchers.IO) { readDocumentBytes(openStream) }
                if (selection == replacementSelection) {
                    _replacementFile.value = PickedFile(filename, bytes.size.toLong(), mimeType, bytes)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (selection == replacementSelection) {
                    _toast.value = DocumentDetailToast("Choose a readable, nonempty file of 25 MB or less.", true)
                }
            }
        }

        fun cancelReplacement() {
            replacementSelection = UUID.randomUUID()
            replacementDocument = null
            _replacementFile.value = null
            replacementAttempt = null
        }

        @Suppress("ReturnCount") // An incomplete or cancelled picker cannot start a mutation.
        fun replace() {
            val original = replacementDocument ?: return
            val version = original.fileVersion ?: return
            val file = _replacementFile.value ?: return
            val bytes = file.bytes ?: return
            if (mutating || deleted) return
            val previous = replacementAttempt
            val uploadId = if (previous?.first == file && previous.second == version) previous.third else UUID.randomUUID().toString()
            replacementAttempt = Triple(file, version, uploadId)
            mutating = true
            loadId += 1
            _state.value = DocumentDetailUiState.Loaded(original, isMutating = true)
            viewModelScope.launch {
                val result = repo.replaceHomeDocument(homeId, documentId, uploadId, version, file.filename, file.mimeType, bytes)
                when (result) {
                    is NetworkResult.Success -> {
                        val document = result.data.document
                        val matchesDocument = document.id == documentId && document.fileId == documentId
                        val matchesVersion = document.fileVersion == uploadId && document.contentUrl != null
                        if (matchesDocument && matchesVersion) {
                            cancelReplacement()
                            mutating = false
                            loadDocument()
                            val loaded = _state.value as? DocumentDetailUiState.Loaded
                            if (loaded?.document?.fileVersion == uploadId && loaded.content != null) {
                                _toast.value = DocumentDetailToast("File replaced.", false)
                            }
                        } else {
                            _state.value = DocumentDetailUiState.Error("Couldn't confirm replacement. Reload this document.")
                        }
                    }
                    is NetworkResult.Failure -> {
                        _state.value = DocumentDetailUiState.Error(result.error.displayMessage("Couldn't replace this file."))
                    }
                }
                mutating = false
            }
        }

        fun delete() {
            val current = _state.value as? DocumentDetailUiState.Loaded ?: return
            if (mutating || deleted) return
            mutating = true
            cancelReplacement()
            loadId += 1
            _state.value = current.copy(isMutating = true, content = null)
            viewModelScope.launch {
                when (val result = repo.deleteHomeDocument(homeId, documentId)) {
                    is NetworkResult.Success -> {
                        if (result.data.deleted) {
                            deleted = true
                            clearContent()
                            _shouldDismiss.value = true
                        } else {
                            _state.value = DocumentDetailUiState.Error("Couldn't delete this document. Try again.")
                        }
                    }
                    is NetworkResult.Failure -> {
                        _state.value = DocumentDetailUiState.Error(result.error.displayMessage("Couldn't delete this document."))
                    }
                }
                mutating = false
            }
        }

        fun acknowledgeDismiss() {
            _shouldDismiss.value = false
        }

        fun dismissToast() {
            _toast.value = null
        }
    }
