@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.page_blocks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.business_pages.SaveBusinessPageBlocksRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPagesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg keys for the block builder. */
const val PAGE_BLOCKS_BUSINESS_ID_KEY = "businessId"
const val PAGE_BLOCKS_PAGE_ID_KEY = "pageId"
const val PAGE_BLOCKS_PAGE_TITLE_KEY = "pageTitle"

/** Render state for the block builder. */
sealed interface BusinessPageBlocksUiState {
    data object Loading : BusinessPageBlocksUiState

    data class Loaded(
        val blocks: List<BusinessPageBlock>,
    ) : BusinessPageBlocksUiState

    data class Error(
        val message: String,
    ) : BusinessPageBlocksUiState
}

/**
 * C4 — view-model for the business page **block builder** (distinct from
 * `EditBusinessPageViewModel`, which edits business profile fields). Mirrors
 * RN `src/app/businesses/[id]/page-editor.tsx:58-196` and iOS
 * `BusinessPageBlocksViewModel`.
 */
@HiltViewModel
class BusinessPageBlocksViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: BusinessPagesRepository,
    ) : ViewModel() {
        private val businessId: String = savedStateHandle.get<String>(PAGE_BLOCKS_BUSINESS_ID_KEY).orEmpty()
        private val pageId: String = savedStateHandle.get<String>(PAGE_BLOCKS_PAGE_ID_KEY).orEmpty()

        val pageTitle: String = savedStateHandle.get<String>(PAGE_BLOCKS_PAGE_TITLE_KEY).orEmpty()

        private val _state = MutableStateFlow<BusinessPageBlocksUiState>(BusinessPageBlocksUiState.Loading)
        val state: StateFlow<BusinessPageBlocksUiState> = _state.asStateFlow()

        private val _blocks = MutableStateFlow<List<BusinessPageBlock>>(emptyList())
        val blocks: StateFlow<List<BusinessPageBlock>> = _blocks.asStateFlow()

        private val _publishedRevision = MutableStateFlow(0)
        val publishedRevision: StateFlow<Int> = _publishedRevision.asStateFlow()

        private val _draftRevision = MutableStateFlow(0)
        val draftRevision: StateFlow<Int> = _draftRevision.asStateFlow()

        private val _hasChanges = MutableStateFlow(false)
        val hasChanges: StateFlow<Boolean> = _hasChanges.asStateFlow()

        private val _isSaving = MutableStateFlow(false)
        val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

        private val _isPublishing = MutableStateFlow(false)
        val isPublishing: StateFlow<Boolean> = _isPublishing.asStateFlow()

        /** Preview toggle — renders blocks the way visitors will see them. */
        private val _isPreviewing = MutableStateFlow(false)
        val isPreviewing: StateFlow<Boolean> = _isPreviewing.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var loaded = false

        // MARK: - Load

        fun load() {
            if (loaded) return
            fetch(showLoading = true)
        }

        fun refresh() = fetch(showLoading = false)

        private fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = BusinessPageBlocksUiState.Loading
            viewModelScope.launch {
                when (val result = repository.blocks(businessId, pageId)) {
                    is NetworkResult.Success -> {
                        val decoded =
                            result.data.blocks.mapIndexed { index, dto -> BusinessPageBlock.from(dto, index) }
                        _blocks.value = decoded
                        _draftRevision.value = result.data.draftRevision ?: result.data.revision ?: 0
                        _publishedRevision.value = result.data.publishedRevision ?: 0
                        _hasChanges.value = false
                        loaded = true
                        _state.value = BusinessPageBlocksUiState.Loaded(decoded)
                    }
                    is NetworkResult.Failure ->
                        _state.value = BusinessPageBlocksUiState.Error(result.error.message)
                }
            }
        }

        // MARK: - Local mutations (until Save draft / Publish)

        /**
         * Appends a block seeded from the registry defaults and returns the
         * index so the caller can open its editor — RN auto-opens on add.
         */
        fun addBlock(kind: BusinessPageBlockKind): Int {
            val next = _blocks.value + BusinessPageBlock.newBlock(kind, _blocks.value.size)
            publish(next)
            return next.lastIndex
        }

        fun updateBlock(
            index: Int,
            block: BusinessPageBlock,
        ) {
            val current = _blocks.value
            if (index !in current.indices) return
            publish(current.toMutableList().also { it[index] = block })
        }

        /** Confirmed delete — the screen asks "Remove this block?" first. */
        fun deleteBlock(index: Int) {
            val current = _blocks.value
            if (index !in current.indices) return
            publish(current.toMutableList().also { it.removeAt(index) })
        }

        fun moveUp(index: Int) = move(index, index - 1)

        fun moveDown(index: Int) = move(index, index + 1)

        private fun move(
            from: Int,
            to: Int,
        ) {
            val current = _blocks.value
            if (from !in current.indices || to !in current.indices) return
            val mutable = current.toMutableList()
            val moved = mutable.removeAt(from)
            mutable.add(to, moved)
            publish(mutable)
        }

        private fun publish(next: List<BusinessPageBlock>) {
            val renumbered = next.mapIndexed { index, block -> block.copy(sortOrder = index) }
            _blocks.value = renumbered
            _hasChanges.value = true
            _state.value = BusinessPageBlocksUiState.Loaded(renumbered)
        }

        fun togglePreview() {
            _isPreviewing.value = !_isPreviewing.value
        }

        fun setPreviewing(value: Boolean) {
            _isPreviewing.value = value
        }

        fun consumeToast() {
            _toast.value = null
        }

        // MARK: - Save / publish

        fun saveDraft() {
            if (_isSaving.value) return
            _isSaving.value = true
            viewModelScope.launch {
                val result = pushDraft()
                _isSaving.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _hasChanges.value = false
                        _toast.value = "Draft saved"
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
            }
        }

        /**
         * RN auto-saves pending edits before publishing so the snapshot is
         * never a revision behind what the editor shows.
         */
        fun publishPage() {
            if (_isPublishing.value) return
            if (_blocks.value.isEmpty()) {
                _toast.value = "Add a block before publishing."
                return
            }
            _isPublishing.value = true
            viewModelScope.launch {
                if (_hasChanges.value) {
                    val saved = pushDraft()
                    if (saved is NetworkResult.Failure) {
                        _isPublishing.value = false
                        _toast.value = saved.error.message
                        return@launch
                    }
                }
                when (val result = repository.publishPage(businessId, pageId)) {
                    is NetworkResult.Success -> {
                        result.data.publishedRevision?.let { _publishedRevision.value = it }
                        _hasChanges.value = false
                        _toast.value = "Page published as v${_publishedRevision.value}"
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
                _isPublishing.value = false
            }
        }

        private suspend fun pushDraft(): NetworkResult<*> {
            val body =
                SaveBusinessPageBlocksRequest(
                    blocks = _blocks.value.mapIndexed { index, block -> block.toSaveRequest(index) },
                )
            val result = repository.saveDraftBlocks(businessId, pageId, body)
            if (result is NetworkResult.Success) {
                result.data.draftRevision?.let { _draftRevision.value = it }
                // Adopt the server ids so a second save updates in place.
                val decoded = result.data.blocks.mapIndexed { index, dto -> BusinessPageBlock.from(dto, index) }
                _blocks.value = decoded
                _state.value = BusinessPageBlocksUiState.Loaded(decoded)
            }
            return result
        }
    }
