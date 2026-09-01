@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * P4.5 — Backs `DocumentSearchScreen`. Fetches the home's documents once
 * (`GET /api/homes/:id/documents`, route `backend/routes/home.js:4944`)
 * and filters the corpus client-side across title, tags, and category.
 * Rows project through [DocumentsViewModel.makeRow] so each result is
 * identical to a Documents list row, plus matched-tag chips appended.
 *
 * Drives the shared `SearchListShell` (P4.1): the shell owns the search
 * bar + debounce + four phases; this VM supplies `query`, `results`, and
 * `isLoading`.
 */
@HiltViewModel
class DocumentSearchViewModel
    internal constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomesRepository,
            savedStateHandle: SavedStateHandle,
        ) : this(repo, savedStateHandle, Instant::now)

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(DOCUMENTS_HOME_ID_KEY)) {
                "DocumentSearchViewModel requires a $DOCUMENTS_HOME_ID_KEY nav argument"
            }

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _results = MutableStateFlow<List<HomeDocumentDto>>(emptyList())
        val results: StateFlow<List<HomeDocumentDto>> = _results.asStateFlow()

        private val _isLoading = MutableStateFlow(true)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

        private var corpus: List<HomeDocumentDto> = emptyList()
        private var loaded = false
        private var onOpenDocument: (HomeDocumentDto) -> Unit = {}

        fun configureNavigation(onOpenDocument: (HomeDocumentDto) -> Unit = {}) {
            this.onOpenDocument = onOpenDocument
        }

        /** Fetch the corpus once; repeat calls are no-ops so typing
         *  doesn't trigger refetches. */
        fun load() {
            if (loaded) return
            _isLoading.value = true
            viewModelScope.launch {
                corpus =
                    when (val result = repo.getHomeDocuments(homeId)) {
                        is NetworkResult.Success -> result.data.documents
                        // The shell has no error phase; an unreachable
                        // vault simply yields no matches.
                        is NetworkResult.Failure -> emptyList()
                    }
                loaded = true
                _isLoading.value = false
                recompute()
            }
        }

        fun onQueryChange(value: String) {
            _query.value = value
            recompute()
        }

        /** Result row identical to the Documents list row, with the
         *  document's tags appended as inline chips. */
        fun rowModel(dto: HomeDocumentDto): RowModel =
            DocumentsViewModel.makeRow(
                dto = dto,
                now = clock(),
                extraChips = tagChips(dto),
                onTap = { onOpenDocument(dto) },
                onSecondary = { onOpenDocument(dto) },
            )

        private fun recompute() {
            _results.value = filter(corpus, _query.value)
        }

        companion object {
            /** Filter the corpus by a free-text query. Blank query → []. */
            fun filter(
                documents: List<HomeDocumentDto>,
                query: String,
            ): List<HomeDocumentDto> {
                val trimmed = query.trim()
                if (trimmed.isEmpty()) return emptyList()
                return documents.filter { matches(it, trimmed) }
            }

            /** Case-insensitive substring match across title, category
             *  label, and the document's free-form tags. */
            fun matches(
                dto: HomeDocumentDto,
                query: String,
            ): Boolean {
                val needle = query.lowercase()
                if (dto.title.lowercase().contains(needle)) return true
                if (DocumentCategory.fromDocType(dto.docType).label.lowercase().contains(needle)) {
                    return true
                }
                return parseTags(dto.details ?: emptyMap()).any { it.lowercase().contains(needle) }
            }

            /** One neutral pill per tag, rendered after the reused row's
             *  category / expiry chips. */
            fun tagChips(dto: HomeDocumentDto): List<RowChip> =
                parseTags(dto.details ?: emptyMap()).map { tag ->
                    RowChip(
                        text = tag,
                        icon = PantopusIcon.Tag,
                        tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                    )
                }
        }
    }
