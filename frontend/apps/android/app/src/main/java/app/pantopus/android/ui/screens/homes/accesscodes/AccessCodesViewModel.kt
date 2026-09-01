@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.homes.accesscodes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ChipStripConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowIconAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Stable chip ids. */
object AccessCodesChip {
    const val ALL = "all"

    fun id(category: AccessCategory): String = category.wire
}

/** Stable a11y / test identifiers — match iOS strings exactly. */
object AccessCodesA11y {
    const val SCREEN = "accessCodes_screen"
    const val ROW = "accessCodes_row"
    const val COPY_ACTION = "accessCodes_copyAction"
    const val KEBAB_ACTION = "accessCodes_kebabAction"
    const val TOAST = "accessCodes_toast"
    const val FAB = "accessCodes_fab"
}

/** Outbound routing target. */
sealed interface AccessCodesTarget {
    data class AddCode(val homeId: String, val category: AccessCategory?) : AccessCodesTarget

    data class EditCode(val homeId: String, val secretId: String) : AccessCodesTarget

    data class Search(val homeId: String) : AccessCodesTarget
}

@HiltViewModel
class AccessCodesViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String =
            savedStateHandle.get<String>(HOME_ID_KEY)
                ?: error("AccessCodesViewModel requires a homeId in SavedStateHandle")

        /** Pre-resolved home subtitle ("412 Birch Ln"). Optional. */
        val homeName: String? = savedStateHandle.get<String>(HOME_NAME_KEY)

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedChip = MutableStateFlow(AccessCodesChip.ALL)
        val selectedChip: StateFlow<String> = _selectedChip.asStateFlow()

        private val _revealed = MutableStateFlow<Set<String>>(emptySet())
        val revealed: StateFlow<Set<String>> = _revealed.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _chipStrip = MutableStateFlow<ChipStripConfig?>(null)
        val chipStrip: StateFlow<ChipStripConfig?> = _chipStrip.asStateFlow()

        private var secrets: List<HomeAccessSecretDto> = emptyList()
        private var loadedOnce: Boolean = false
        private var toastJob: Job? = null
        private var copyHandler: ((String) -> Unit) = { _ -> }

        /** Routing callback wired by the screen before [load]. */
        var onSelect: (AccessCodesTarget) -> Unit = {}
            set(value) {
                field = value
                applyState()
                rebuildChipStrip()
            }

        /**
         * Clipboard handler. The screen wires this to the platform
         * ClipboardManager — the VM stays platform-independent for
         * unit tests.
         */
        fun bindClipboard(handler: (String) -> Unit) {
            copyHandler = handler
        }

        /** Initial load. Idempotent — re-running won't refetch. */
        fun load() {
            if (loadedOnce) return
            reload()
        }

        /** Pull-to-refresh. */
        fun refresh() = reload()

        /** Update the live chip selection. Rebuilds sections in place. */
        fun selectChip(id: String) {
            if (_selectedChip.value == id) return
            _selectedChip.value = id
            rebuildChipStrip()
            applyState()
        }

        /** Toggle redaction for a specific secret. */
        fun toggleReveal(secretId: String) {
            _revealed.value =
                if (_revealed.value.contains(secretId)) {
                    _revealed.value - secretId
                } else {
                    _revealed.value + secretId
                }
            applyState()
        }

        /** Copy the secret's literal value via the bound clipboard helper. */
        fun copyValue(secretId: String) {
            val secret = secrets.firstOrNull { it.id == secretId } ?: return
            copyHandler(secret.secretValue)
            showToast("Code copied")
        }

        /** Open the kebab menu for a secret (currently routes to Edit). */
        fun openKebab(secretId: String) {
            onSelect(AccessCodesTarget.EditCode(homeId = homeId, secretId = secretId))
        }

        /** Trigger from the FAB or an empty-state CTA. */
        fun startAddCode(category: AccessCategory? = null) {
            onSelect(AccessCodesTarget.AddCode(homeId = homeId, category = category))
        }

        /** Top-bar search action. */
        fun startSearch() {
            onSelect(AccessCodesTarget.Search(homeId = homeId))
        }

        // ─── Fetching ──────────────────────────────────────────────

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val result = repo.getHomeAccessSecrets(homeId)
                when (result) {
                    is NetworkResult.Success -> {
                        secrets = result.data.secrets
                        loadedOnce = true
                        rebuildChipStrip()
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            ListOfRowsUiState.Error("Couldn't load access codes. Try again.")
                    }
                }
            }
        }

        // ─── Toast ─────────────────────────────────────────────────

        private fun showToast(message: String) {
            _toast.value = message
            toastJob?.cancel()
            toastJob =
                viewModelScope.launch {
                    delay(TOAST_DURATION_MS)
                    _toast.value = null
                }
        }

        // ─── Chip strip ────────────────────────────────────────────

        private fun rebuildChipStrip() {
            val counts = countsByCategory()
            val chips =
                buildList {
                    add(
                        ChipStripConfig.Chip(
                            id = AccessCodesChip.ALL,
                            label = "All (${secrets.size})",
                        ),
                    )
                    for (category in AccessCategory.displayOrder) {
                        add(
                            ChipStripConfig.Chip(
                                id = AccessCodesChip.id(category),
                                label = "${category.label} (${counts[category] ?: 0})",
                                icon = category.icon,
                            ),
                        )
                    }
                }
            _chipStrip.value =
                ChipStripConfig(
                    chips = chips,
                    selectedId = _selectedChip.value,
                    onSelect = { selectChip(it) },
                )
        }

        private fun countsByCategory(): Map<AccessCategory, Int> {
            val counts = mutableMapOf<AccessCategory, Int>()
            for (secret in secrets) {
                val category = AccessCategory.from(secret.accessType)
                counts[category] = (counts[category] ?: 0) + 1
            }
            return counts
        }

        // ─── State projection ──────────────────────────────────────

        internal fun applyState() {
            val visibleCategories: List<AccessCategory> =
                when (_selectedChip.value) {
                    AccessCodesChip.ALL -> AccessCategory.displayOrder
                    else ->
                        AccessCategory.entries.firstOrNull { it.wire == _selectedChip.value }
                            ?.let { listOf(it) }
                            ?: AccessCategory.displayOrder
                }

            val sections = mutableListOf<RowSection>()
            for (category in visibleCategories) {
                val rows = secrets.filter { AccessCategory.from(it.accessType) == category }
                if (rows.isEmpty()) continue
                sections.add(
                    RowSection(
                        id = "category-${category.wire}",
                        header = category.label,
                        rows = rows.map { rowFor(it) },
                        count = rows.size,
                        onSeeAll = { startAddCode(category) },
                        style = SectionStyle.Card,
                    ),
                )
            }

            if (sections.isEmpty()) {
                _state.value = emptyContent()
                return
            }
            _state.value = ListOfRowsUiState.Loaded(sections = sections, hasMore = false)
        }

        private fun emptyContent(): ListOfRowsUiState.Empty {
            val selectedId = _selectedChip.value
            val isFiltered = selectedId != AccessCodesChip.ALL
            val filteredCategory =
                AccessCategory.entries.firstOrNull { it.wire == selectedId }
            if (isFiltered && filteredCategory != null) {
                val labelLower = filteredCategory.label.lowercase()
                return ListOfRowsUiState.Empty(
                    icon = PantopusIcon.KeyRound,
                    headline = "No $labelLower codes yet",
                    subcopy =
                        "Add a $labelLower code so household members can find it " +
                            "when they need it.",
                    ctaTitle = "Add ${filteredCategory.label} code",
                    onCta = { startAddCode(filteredCategory) },
                )
            }
            return ListOfRowsUiState.Empty(
                icon = PantopusIcon.KeyRound,
                headline = "No access codes yet",
                subcopy =
                    "One vault for every code at this address. Codes are encrypted, " +
                        "masked by default, and only shared with members you choose.",
                ctaTitle = "Add your first code",
                onCta = { startAddCode(null) },
            )
        }

        // ─── Row mapping ───────────────────────────────────────────

        /** Pure projection — public for unit tests. */
        internal fun rowFor(secret: HomeAccessSecretDto): RowModel {
            val category = AccessCategory.from(secret.accessType)
            val isRevealed = _revealed.value.contains(secret.id)
            val display = if (isRevealed) secret.secretValue else mask(secret.secretValue)
            return RowModel(
                id = secret.id,
                title = secret.label,
                subtitle = display,
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.TypeIcon(
                        icon = category.icon,
                        background = category.background,
                        foreground = category.foreground,
                    ),
                trailing =
                    RowTrailing.IconActions(
                        primary =
                            RowIconAction(
                                icon = PantopusIcon.Copy,
                                accessibilityLabel = "Copy ${secret.label}",
                                onClick = { copyValue(secret.id) },
                            ),
                        secondary =
                            RowIconAction(
                                icon = PantopusIcon.MoreHorizontal,
                                accessibilityLabel = "More actions for ${secret.label}",
                                onClick = { openKebab(secret.id) },
                            ),
                    ),
                onTap = { toggleReveal(secret.id) },
                body = secret.notes,
            )
        }

        companion object {
            const val HOME_ID_KEY = "homeId"
            const val HOME_NAME_KEY = "homeName"
            private const val TOAST_DURATION_MS = 2_000L

            /**
             * Mask a code value as a row of round bullet dots, capped at
             * 12 to keep row geometry stable. Empty strings render as
             * 4 dots so the placeholder is always visible.
             */
            fun mask(value: String): String {
                val length = maxOf(1, minOf(12, value.length))
                return "•".repeat(maxOf(length, 4))
            }
        }
    }
