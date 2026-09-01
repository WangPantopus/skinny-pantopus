@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.MailItem
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.screens.mailbox.MailboxListViewModel
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * P4.2 — Backs `MailboxSearchScreen`. Fetches the user's mailbox once
 * (`GET /api/mailbox`, route `backend/routes/mailbox.js:1306`) and filters
 * the corpus client-side across sender, subject, body, and category. Rows
 * project through [MailboxListViewModel.makeRow] so each result is
 * identical to a Mailbox list row.
 *
 * Drives the shared `SearchListShell` (P4.1): the shell owns the search
 * bar + debounce + four phases; this VM supplies `query`, `results`, and
 * `isLoading`.
 */
@HiltViewModel
class MailboxSearchViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
    ) : ViewModel() {
        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _results = MutableStateFlow<List<MailItem>>(emptyList())
        val results: StateFlow<List<MailItem>> = _results.asStateFlow()

        private val _isLoading = MutableStateFlow(true)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

        private var corpus: List<MailItem> = emptyList()
        private var loaded = false
        private var onOpenMail: (String) -> Unit = {}

        fun configureNavigation(onOpenMail: (String) -> Unit = {}) {
            this.onOpenMail = onOpenMail
        }

        /** Fetch the corpus once; repeat calls are no-ops so typing
         *  doesn't trigger refetches. */
        fun load() {
            if (loaded) return
            _isLoading.value = true
            viewModelScope.launch {
                corpus =
                    when (
                        val result =
                            repo.list(
                                viewed = null,
                                archived = false,
                                starred = null,
                                limit = CORPUS_LIMIT,
                                offset = 0,
                            )
                    ) {
                        is NetworkResult.Success -> result.data.mail
                        // The shell has no error phase; an unreachable
                        // mailbox simply yields no matches.
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

        /** Result row identical to the Mailbox list row, routing taps to
         *  this surface's `onOpenMail`. */
        fun rowModel(mail: MailItem): RowModel = MailboxListViewModel.makeRow(mail, onOpenMail = onOpenMail)

        private fun recompute() {
            _results.value = filter(corpus, _query.value)
        }

        companion object {
            private const val CORPUS_LIMIT = 100

            /** Filter the corpus by a free-text query. Blank query → []. */
            fun filter(
                mail: List<MailItem>,
                query: String,
            ): List<MailItem> {
                val trimmed = query.trim()
                if (trimmed.isEmpty()) return emptyList()
                return mail.filter { matches(it, trimmed) }
            }

            /** Case-insensitive substring match across sender, subject/title,
             *  body, and category label. */
            fun matches(
                mail: MailItem,
                query: String,
            ): Boolean {
                val needle = query.lowercase()
                val category = MailItemCategory.fromRaw(mail.mailType ?: mail.type)
                val fields =
                    listOf(
                        mail.senderBusinessName,
                        mail.senderAddress,
                        mail.subject,
                        mail.displayTitle,
                        mail.previewText,
                        mail.content,
                        category.label,
                    )
                return fields.any { it?.lowercase()?.contains(needle) == true }
            }
        }
    }
