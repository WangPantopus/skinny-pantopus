@file:Suppress(
    "PackageNaming",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.support_trains.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.SupportTrainListItemDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.support_trains.SupportTrainType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * P4.6 — Support Trains search. Mirrors iOS `SupportTrainsSearchViewModel`.
 * Reuses the shared `SearchListShell`; the only per-surface customization
 * is the client-side filter (this VM) and the row template (the Support
 * Trains list row — category-gradient tile + status chip).
 *
 * The corpus is the same `/me/support-trains` feed the list screen loads,
 * so [isLoading] only covers the one-shot fetch — filtering is synchronous.
 */
@HiltViewModel
class SupportTrainsSearchViewModel
    @Inject
    constructor(
        private val repo: SupportTrainsRepository,
    ) : ViewModel() {
        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _isLoading = MutableStateFlow(false)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

        private val _results = MutableStateFlow<List<SupportTrainListItemDto>>(emptyList())
        val results: StateFlow<List<SupportTrainListItemDto>> = _results.asStateFlow()

        private var corpus: List<SupportTrainListItemDto> = emptyList()
        private var loadedOnce = false

        /** Routing callback wired by the screen before [load]. */
        var onOpenTrain: (String) -> Unit = {}

        fun load() {
            if (loadedOnce) return
            reload()
        }

        fun setQuery(value: String) {
            _query.value = value
            recompute()
        }

        private fun reload() {
            _isLoading.value = true
            viewModelScope.launch {
                when (val result = repo.mine()) {
                    is NetworkResult.Success -> {
                        corpus = result.data.supportTrains
                        loadedOnce = true
                    }
                    // A failed corpus load degrades to "no matches" — the list
                    // screen owns the first-class error/retry surface; search
                    // stays inside the shell's four-phase contract.
                    is NetworkResult.Failure -> corpus = emptyList()
                }
                _isLoading.value = false
                recompute()
            }
        }

        private fun recompute() {
            val needle = _query.value.trim().lowercase()
            _results.value =
                if (needle.isEmpty()) {
                    emptyList()
                } else {
                    corpus.filter { searchableText(it).contains(needle) }
                }
        }

        // ─── Filtering ─────────────────────────────────────────────

        private fun searchableText(train: SupportTrainListItemDto): String =
            listOfNotNull(
                train.recipientName,
                train.title,
                train.supportTrainType?.let { SupportTrainType.from(it).label },
            ).joinToString(" ").lowercase()

        // ─── Row mapping ───────────────────────────────────────────

        /**
         * Mirrors `SupportTrainsViewModel.rowFor` — category-gradient tile +
         * recipient/title headline + "type · role" subtitle + status chip.
         * Tapping a result opens the train.
         */
        fun rowFor(train: SupportTrainListItemDto): RowModel {
            val type = SupportTrainType.from(train.supportTrainType)
            val chip = statusChip(train.status)
            return RowModel(
                id = train.id,
                title = train.recipientName ?: train.title ?: "Support train",
                subtitle = subtitleLine(train, type),
                template = RowTemplate.StatusChip,
                leading = RowLeading.CategoryGradientIcon(icon = type.icon, gradient = type.gradient),
                trailing = RowTrailing.Status(text = chip.first, variant = chip.second),
                metaTail = metaTail(train),
                onTap = { onOpenTrain(train.id) },
            )
        }

        private fun subtitleLine(
            train: SupportTrainListItemDto,
            type: SupportTrainType,
        ): String? {
            val parts =
                listOfNotNull(
                    if (train.supportTrainType != null) type.label else null,
                    roleLabel(train.myRole),
                ).filter { it.isNotBlank() }
            return parts.joinToString(" · ").ifBlank { null }
        }

        private fun roleLabel(role: String?): String? =
            when (role) {
                "organizer" -> "You organize"
                "co_organizer" -> "You co-organize"
                "helper" -> "Helper"
                else -> null
            }

        private fun metaTail(train: SupportTrainListItemDto): String? {
            val total = train.slotsTotal
            if (total != null) {
                val filled = train.slotsFilled ?: 0
                val left = (total - filled).coerceAtLeast(0)
                return if (left == 0) "$filled / $total slots" else "$filled / $total slots · $left open"
            }
            if (!train.startsOn.isNullOrBlank() && !train.endsOn.isNullOrBlank()) {
                return "${train.startsOn} — ${train.endsOn}"
            }
            return null
        }

        private fun statusChip(status: String?): Pair<String, StatusChipVariant> =
            when (status) {
                "active" -> "Active" to StatusChipVariant.Success
                "filling" -> "Filling up" to StatusChipVariant.Info
                "full" -> "Slots full" to StatusChipVariant.Neutral
                "wrapping" -> "Wrapping up" to StatusChipVariant.Warning
                "complete" -> "Complete" to StatusChipVariant.Neutral
                "invited" -> "Invited" to StatusChipVariant.Business
                "proposed" -> "Proposed" to StatusChipVariant.Neutral
                else -> "Active" to StatusChipVariant.Info
            }
    }
