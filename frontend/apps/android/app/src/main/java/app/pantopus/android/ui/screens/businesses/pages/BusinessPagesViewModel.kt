@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.pages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.business_pages.BusinessPageDto
import app.pantopus.android.data.api.models.business_pages.BusinessPageRevisionDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPagesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import javax.inject.Inject

/** Nav-arg key for the business UUID. */
const val BUSINESS_PAGES_BUSINESS_ID_KEY = "businessId"

/** One row in the pages list. */
data class BusinessPageRow(
    val id: String,
    val title: String,
    val slug: String,
    val isDefault: Boolean,
    val publishedRevision: Int,
) {
    val isPublished: Boolean get() = publishedRevision > 0

    /** `v3` once published, otherwise "Unpublished" — RN's badge copy. */
    val statusLabel: String get() = if (isPublished) "v$publishedRevision" else "Unpublished"

    companion object {
        fun from(dto: BusinessPageDto): BusinessPageRow =
            BusinessPageRow(
                id = dto.id,
                title = dto.title,
                slug = dto.slug,
                isDefault = dto.isDefault == true,
                publishedRevision = dto.publishedRevision ?: 0,
            )
    }
}

/** One revision-history entry. */
data class BusinessPageRevisionRow(
    val id: String,
    val revision: Int,
    val title: String,
    val subtitle: String,
) {
    companion object {
        fun from(dto: BusinessPageRevisionDto): BusinessPageRevisionRow {
            val notes = dto.notes?.trim().orEmpty()
            val publisher = dto.publisher?.name ?: dto.publisher?.username ?: "Unknown"
            val date = formatted(dto.publishedAt)
            return BusinessPageRevisionRow(
                id = dto.id,
                revision = dto.revision,
                title = if (notes.isEmpty()) "v${dto.revision}" else "v${dto.revision} — $notes",
                subtitle = if (date.isEmpty()) publisher else "$publisher · $date",
            )
        }

        private fun formatted(iso: String?): String {
            if (iso.isNullOrBlank()) return ""
            return runCatching {
                val instant = Instant.parse(iso)
                DateTimeFormatter
                    .ofLocalizedDate(FormatStyle.MEDIUM)
                    .withLocale(Locale.getDefault())
                    .withZone(ZoneId.systemDefault())
                    .format(instant)
            }.getOrDefault("")
        }
    }
}

/** Render state for the pages list. */
sealed interface BusinessPagesUiState {
    data object Loading : BusinessPagesUiState

    data object Empty : BusinessPagesUiState

    data class Loaded(
        val rows: List<BusinessPageRow>,
    ) : BusinessPagesUiState

    data class Error(
        val message: String,
    ) : BusinessPagesUiState
}

/**
 * C4 — the custom-pages CMS index for a business. Mirrors RN
 * `src/components/business/tabs/PagesTab.tsx:30-108` and iOS
 * `BusinessPagesViewModel`: create page, delete page, revision history,
 * restore revision. Each row opens the block builder.
 */
@HiltViewModel
class BusinessPagesViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: BusinessPagesRepository,
    ) : ViewModel() {
        private val businessId: String = savedStateHandle.get<String>(BUSINESS_PAGES_BUSINESS_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<BusinessPagesUiState>(BusinessPagesUiState.Loading)
        val state: StateFlow<BusinessPagesUiState> = _state.asStateFlow()

        private val _showsAddForm = MutableStateFlow(false)
        val showsAddForm: StateFlow<Boolean> = _showsAddForm.asStateFlow()

        private val _draftTitle = MutableStateFlow("")
        val draftTitle: StateFlow<String> = _draftTitle.asStateFlow()

        private val _draftSlug = MutableStateFlow("")
        val draftSlug: StateFlow<String> = _draftSlug.asStateFlow()

        private val _isCreating = MutableStateFlow(false)
        val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

        private val _expandedRevisionsPageId = MutableStateFlow<String?>(null)
        val expandedRevisionsPageId: StateFlow<String?> = _expandedRevisionsPageId.asStateFlow()

        private val _revisions = MutableStateFlow<List<BusinessPageRevisionRow>>(emptyList())
        val revisions: StateFlow<List<BusinessPageRevisionRow>> = _revisions.asStateFlow()

        private val _isLoadingRevisions = MutableStateFlow(false)
        val isLoadingRevisions: StateFlow<Boolean> = _isLoadingRevisions.asStateFlow()

        private val _restoringRevision = MutableStateFlow<Int?>(null)
        val restoringRevision: StateFlow<Int?> = _restoringRevision.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var loaded = false

        fun load() {
            if (loaded) return
            fetch(showLoading = true)
        }

        fun refresh() = fetch(showLoading = false)

        private fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = BusinessPagesUiState.Loading
            viewModelScope.launch {
                when (val result = repository.pages(businessId)) {
                    is NetworkResult.Success -> {
                        val rows = result.data.pages.map(BusinessPageRow::from)
                        loaded = true
                        _state.value =
                            if (rows.isEmpty()) BusinessPagesUiState.Empty else BusinessPagesUiState.Loaded(rows)
                    }
                    is NetworkResult.Failure -> _state.value = BusinessPagesUiState.Error(result.error.message)
                }
            }
        }

        fun toggleAddForm() {
            _showsAddForm.value = !_showsAddForm.value
        }

        fun setTitle(value: String) {
            _draftTitle.value = value
        }

        /** Slugs are lowercase `[a-z0-9-]` — RN sanitises as you type. */
        fun setSlug(raw: String) {
            _draftSlug.value = raw.lowercase().filter { it.isDigit() || it in 'a'..'z' || it == '-' }
        }

        fun consumeToast() {
            _toast.value = null
        }

        fun createPage() {
            val title = _draftTitle.value.trim()
            val slug = _draftSlug.value.trim()
            if (title.isEmpty() || slug.isEmpty()) {
                _toast.value = "Title and slug are required"
                return
            }
            if (_isCreating.value) return
            _isCreating.value = true
            viewModelScope.launch {
                when (val result = repository.createPage(businessId, slug = slug, title = title)) {
                    is NetworkResult.Success -> {
                        _draftTitle.value = ""
                        _draftSlug.value = ""
                        _showsAddForm.value = false
                        fetch(showLoading = false)
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
                _isCreating.value = false
            }
        }

        fun deletePage(row: BusinessPageRow) {
            viewModelScope.launch {
                when (val result = repository.deletePage(businessId, row.id)) {
                    is NetworkResult.Success -> {
                        if (_expandedRevisionsPageId.value == row.id) collapseRevisions()
                        fetch(showLoading = false)
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
            }
        }

        /** Second tap on the same page collapses the panel — RN's toggle. */
        fun toggleRevisions(row: BusinessPageRow) {
            if (_expandedRevisionsPageId.value == row.id) {
                collapseRevisions()
                return
            }
            _expandedRevisionsPageId.value = row.id
            _revisions.value = emptyList()
            _isLoadingRevisions.value = true
            viewModelScope.launch {
                when (val result = repository.revisions(businessId, row.id)) {
                    is NetworkResult.Success ->
                        _revisions.value = result.data.revisions.map(BusinessPageRevisionRow::from)
                    is NetworkResult.Failure -> {
                        _revisions.value = emptyList()
                        _toast.value = result.error.message
                    }
                }
                _isLoadingRevisions.value = false
            }
        }

        fun collapseRevisions() {
            _expandedRevisionsPageId.value = null
            _revisions.value = emptyList()
        }

        fun restore(
            pageId: String,
            revision: Int,
        ) {
            if (_restoringRevision.value != null) return
            _restoringRevision.value = revision
            viewModelScope.launch {
                when (val result = repository.restoreRevision(businessId, pageId, revision)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Revision v$revision restored to draft"
                        collapseRevisions()
                        fetch(showLoading = false)
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
                _restoringRevision.value = null
            }
        }
    }
