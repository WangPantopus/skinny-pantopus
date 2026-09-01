@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.vault

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderDto
import app.pantopus.android.data.api.models.mailbox.vault.VaultMailItemDto
import app.pantopus.android.data.api.models.mailbox.vault.VaultSearchResultDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxVaultRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject

/**
 * T6.5e (P19.5) — ViewModel for the Mailbox Vault list. The vault is
 * the user's "keep pile" of saved mail — a personal-pillar surface
 * (sky blue) under Mailbox, not scoped to a home. Per the
 * `vault-frames.jsx` design, rows render with a colored type tile,
 * item title, sender · saved-date subtitle, and a folder chip.
 *
 * Folders + items live behind separate endpoints
 * (`/vault/folders` and `/vault/folder/:id/items`); this VM
 * fetches the folders, then unions per-folder items into a single
 * flat list sorted by save date desc.
 */
@HiltViewModel
class VaultListViewModel
    @Inject
    constructor(
        private val repo: MailboxVaultRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)

        /** Observed UI state. */
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow("")

        /** Current search query. The shell renders the [searchBarConfig]. */
        val query: StateFlow<String> = _query.asStateFlow()

        private val _subtitle = MutableStateFlow("Saved from Mailbox")

        /** Top-bar subtitle. Updated on load to include the saved-item count. */
        val subtitle: StateFlow<String> = _subtitle.asStateFlow()

        private val _folders = MutableStateFlow<List<VaultFolderDto>>(emptyList())

        /** Last-fetched folder list — exposed so callers can render
         *  folder pickers (Save to vault). */
        val folders: StateFlow<List<VaultFolderDto>> = _folders.asStateFlow()

        private val _selectedDrawer = MutableStateFlow(DRAWER_TABS.first().id)

        /** Selected drawer tab — `personal` / `home` / `business`. */
        val selectedDrawer: StateFlow<String> = _selectedDrawer.asStateFlow()

        private var allRows: List<VaultListRow> = emptyList()
        private var onOpenItem: (String) -> Unit = {}
        private var onAddTapped: () -> Unit = {}
        private var onOpenMailbox: () -> Unit = {}
        private var searchJob: Job? = null

        /**
         * True while server search results (rather than the locally-narrowed
         * folder rows) are what the list is showing. Keeps every keystroke
         * after the first from flashing the folder view back on screen while
         * the debounced search is in flight.
         */
        private var showingSearchResults: Boolean = false

        private val drawer: String
            get() = _selectedDrawer.value

        /**
         * `true` once the trimmed query clears RN's two-character threshold —
         * the point at which the vault stops filtering the fetched folder rows
         * and starts asking the server to search the whole archive.
         */
        private val isSearching: Boolean
            get() = _query.value.trim().length >= MIN_SEARCH_LENGTH

        /** Wire nav callbacks before first load. */
        fun configureNavigation(
            onOpenItem: (String) -> Unit,
            onAddTapped: () -> Unit,
            onOpenMailbox: () -> Unit,
        ) {
            this.onOpenItem = onOpenItem
            this.onAddTapped = onAddTapped
            this.onOpenMailbox = onOpenMailbox
        }

        /** Initial load — no-op when already loaded. */
        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded) return
            refresh()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() {
            if (isSearching) {
                viewModelScope.launch { performSearch() }
                return
            }
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.folders(drawer = drawer)) {
                    is NetworkResult.Success -> applyFolders(result.data.folders)
                    is NetworkResult.Failure ->
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                }
            }
        }

        /**
         * Switch the drawer the folder pane is scoped to (RN's `DRAWER_TABS`,
         * `src/app/mailbox/vault.tsx:12`) and refetch its folders.
         */
        fun onSelectDrawer(id: String) {
            if (_selectedDrawer.value == id) return
            _selectedDrawer.value = id
            searchJob?.cancel()
            allRows = emptyList()
            refresh()
        }

        /**
         * Update the search query. Below RN's two-character threshold this
         * just narrows the already-fetched folder rows; above it, a debounced
         * `GET …/vault/search` searches the whole archive server-side.
         */
        fun onQueryChange(value: String) {
            _query.value = value
            searchJob?.cancel()
            if (!isSearching) {
                applyRows(allRows)
                return
            }
            // Narrow the fetched rows straight away so the field feels live,
            // then let the debounced server search replace them. Once server
            // results are already on screen we leave them be rather than
            // flashing back through the folder view on every keystroke.
            if (!showingSearchResults) applyRows(allRows)
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    performSearch()
                }
        }

        /**
         * `GET /api/mailbox/v2/p2/vault/search` — searches every drawer, not
         * just the rows the folder pane already fetched.
         */
        private suspend fun performSearch() {
            val trimmed = _query.value.trim()
            if (trimmed.length < MIN_SEARCH_LENGTH) return
            when (val result = repo.search(query = trimmed)) {
                is NetworkResult.Success -> {
                    // A slower in-flight search must not clobber a newer query.
                    if (_query.value.trim() != trimmed) return
                    applySearchResults(result.data.results, result.data.total ?: result.data.results.size)
                }
                is NetworkResult.Failure -> {
                    if (_query.value.trim() != trimmed) return
                    _state.value =
                        ListOfRowsUiState.Error(result.error.displayMessage("Couldn't search your vault."))
                }
            }
        }

        private fun applySearchResults(
            results: List<VaultSearchResultDto>,
            total: Int,
        ) {
            showingSearchResults = true
            if (results.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Search,
                        headline = "No matches found",
                        subcopy =
                            "Nothing in your archive matches that. Try a sender name, an amount " +
                                "like \$87, or a month like March 2025.",
                    )
                return
            }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections =
                        listOf(
                            RowSection(
                                id = "vaultSearch",
                                header = "$total result${if (total == 1) "" else "s"} · All drawers",
                                rows = results.map(::searchRowFor),
                            ),
                        ),
                    hasMore = false,
                )
        }

        /** FAB tap dispatcher — wired to the screen's FAB onClick. */
        fun onFabTapped() = onAddTapped()

        /** Visible for tests — apply a pre-built row list. */
        internal fun ingest(
            folders: List<VaultFolderDto>,
            itemsByFolder: Map<String, List<VaultMailItemDto>>,
        ) {
            _folders.value = folders
            allRows = flatten(folders = folders, itemsByFolder = itemsByFolder)
            applyRows(allRows)
        }

        private suspend fun applyFolders(folders: List<VaultFolderDto>) {
            _folders.value = folders
            if (folders.isEmpty()) {
                allRows = emptyList()
                _subtitle.value = "Saved from Mailbox"
                _state.value = emptyState()
                return
            }
            val items = fetchAllItems(folders)
            allRows = flatten(folders = folders, itemsByFolder = items)
            applyRows(allRows)
        }

        private suspend fun fetchAllItems(folders: List<VaultFolderDto>): Map<String, List<VaultMailItemDto>> {
            val deferred =
                folders.map { folder ->
                    viewModelScope.async {
                        folder.id to
                            when (val r = repo.folderItems(folder.id, limit = 20)) {
                                is NetworkResult.Success -> r.data.items
                                is NetworkResult.Failure -> emptyList()
                            }
                    }
                }
            return deferred.awaitAll().toMap()
        }

        private fun applyRows(rows: List<VaultListRow>) {
            showingSearchResults = false
            _subtitle.value =
                if (rows.isEmpty()) {
                    "Saved from Mailbox"
                } else {
                    "Saved from Mailbox · ${rows.size} item${if (rows.size == 1) "" else "s"}"
                }
            val filtered = filter(rows, _query.value)
            if (filtered.isEmpty()) {
                _state.value = emptyState()
                return
            }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "vault", rows = filtered.map(::rowFor))),
                    hasMore = false,
                )
        }

        private fun emptyState(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.Archive,
                headline = "Your vault is empty",
                subcopy =
                    "Save mail to keep it. Anything you bookmark from your Mailbox lands here — " +
                        "civic notices, permits, receipts, scanned letters.",
                ctaTitle = "Open Mailbox",
                onCta = { onOpenMailbox() },
            )

        private fun rowFor(row: VaultListRow): RowModel {
            val mailType = MailboxVaultMailType.fromRaw(row.item.mailType ?: row.item.type)
            val folder = row.folder
            val folderChip =
                folder?.let {
                    RowChip(
                        text = it.label,
                        icon = MailboxVaultFolderIcon.fromRaw(it.icon).icon,
                        tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                    )
                }
            return RowModel(
                id = row.id,
                title = row.title,
                subtitle = row.subtitle,
                template = RowTemplate.FileChevron,
                leading = RowLeading.Icon(icon = mailType.icon, tint = mailType.accent),
                trailing = RowTrailing.Kebab,
                onTap = { onOpenItem(row.id) },
                onSecondary = { onOpenItem(row.id) },
                chips = folderChip?.let { listOf(it) },
            )
        }

        /**
         * Row projection for a server-side search hit. Mirrors RN's result
         * card (`src/app/mailbox/vault.tsx:134`): sender + date on the top
         * line, preview underneath, and a drawer chip plus a "→ subject"
         * matched-field chip.
         */
        private fun searchRowFor(result: VaultSearchResultDto): RowModel {
            val mailType = MailboxVaultMailType.fromRaw(result.mailType ?: result.type)
            val chips =
                buildList {
                    result.drawer?.takeIf { it.isNotEmpty() }?.let {
                        add(
                            RowChip(
                                text = it.replaceFirstChar { c -> c.uppercase(Locale.ROOT) },
                                tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                            ),
                        )
                    }
                    result.matchField?.takeIf { it.isNotEmpty() }?.let {
                        add(
                            RowChip(
                                text = "→ $it",
                                tint = RowChip.Tint.Status(StatusChipVariant.Success),
                            ),
                        )
                    }
                }
            val preview =
                result.matchExcerpt?.takeIf { it.isNotEmpty() }
                    ?: result.previewText
                    ?: result.subject
            val subtitle =
                listOfNotNull(preview, savedAtLabel(result.createdAt))
                    .filter { it.isNotEmpty() }
                    .joinToString(" · ")
            return RowModel(
                id = result.id,
                title = result.senderDisplay ?: result.senderBusinessName ?: result.subject ?: "Saved mail",
                subtitle = subtitle.ifEmpty { null },
                template = RowTemplate.FileChevron,
                leading = RowLeading.Icon(icon = mailType.icon, tint = mailType.accent),
                trailing = RowTrailing.Chevron,
                onTap = { onOpenItem(result.id) },
                chips = chips.ifEmpty { null },
            )
        }

        companion object {
            /** RN's `DRAWER_TABS` (`src/app/mailbox/vault.tsx:12`). */
            val DRAWER_TABS: List<ListOfRowsTab> =
                listOf(
                    ListOfRowsTab(id = "personal", label = "Me"),
                    ListOfRowsTab(id = "home", label = "Home"),
                    ListOfRowsTab(id = "business", label = "Business"),
                )

            /** RN debounces the search field by 300 ms (`vault.tsx:56`). */
            private const val SEARCH_DEBOUNCE_MS = 300L

            /**
             * RN only searches once the trimmed query is longer than one
             * character (`vault.tsx:55`).
             */
            private const val MIN_SEARCH_LENGTH = 2

            /** Shared "Saved MMM d" stamp for both row projections. */
            internal fun savedAtLabel(iso: String?): String? {
                if (iso.isNullOrEmpty()) return null
                val parsers =
                    listOf(
                        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
                        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
                        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US),
                    )
                parsers.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }
                val date =
                    parsers.firstNotNullOfOrNull { runCatching { it.parse(iso) }.getOrNull() }
                        ?: return null
                return "Saved ${SimpleDateFormat("MMM d", Locale.US).format(date)}"
            }

            /** Visible for tests — flatten the per-folder items into a single
             *  cross-folder list sorted by created_at desc. */
            internal fun flatten(
                folders: List<VaultFolderDto>,
                itemsByFolder: Map<String, List<VaultMailItemDto>>,
            ): List<VaultListRow> {
                val folderById = folders.associateBy { it.id }
                val all =
                    itemsByFolder.flatMap { (folderId, items) ->
                        items.map { item ->
                            VaultListRow(
                                id = item.id,
                                item = item,
                                folder = folderById[folderId] ?: folderById[item.vaultFolderId.orEmpty()],
                            )
                        }
                    }
                return all.sortedByDescending { it.item.createdAt.orEmpty() }
            }

            /** Visible for tests — client-side text filter. */
            internal fun filter(
                rows: List<VaultListRow>,
                query: String,
            ): List<VaultListRow> {
                val needle = query.trim().lowercase(Locale.ROOT)
                if (needle.isEmpty()) return rows
                return rows.filter { row ->
                    val haystack =
                        listOfNotNull(row.title, row.subtitle, row.folder?.label)
                            .joinToString(separator = " ")
                            .lowercase(Locale.ROOT)
                    haystack.contains(needle)
                }
            }
        }
    }

/**
 * Projected flat row — survives the cross-folder union with enough
 * context for the row mapping helper.
 */
data class VaultListRow(
    val id: String,
    val item: VaultMailItemDto,
    val folder: VaultFolderDto?,
) {
    val title: String
        get() = item.displayTitle ?: item.subject ?: item.previewText ?: "Saved mail"

    val subtitle: String
        get() {
            val sender = item.senderBusinessName ?: item.senderAddress ?: "Unknown sender"
            val saved = VaultListViewModel.savedAtLabel(item.createdAt)
            return if (saved != null) "$sender · $saved" else sender
        }
}

/**
 * Classification for the leading type-icon. Mirrors the iOS enum so
 * the parity sweep can lift the test fixtures across.
 */
enum class MailboxVaultMailType {
    Letter,
    Notice,
    Permit,
    Receipt,
    Parcel,
    Scan,
    Doc,
    ;

    val icon: PantopusIcon
        get() =
            when (this) {
                Letter -> PantopusIcon.Mail
                Notice -> PantopusIcon.Megaphone
                Permit -> PantopusIcon.Stamp
                Receipt -> PantopusIcon.ReceiptText
                Parcel -> PantopusIcon.Package
                Scan -> PantopusIcon.ScanLine
                Doc -> PantopusIcon.FileText
            }

    val accent: Color
        get() =
            when (this) {
                Letter -> PantopusColors.primary600
                Notice -> PantopusColors.business
                Permit -> PantopusColors.warning
                Receipt -> PantopusColors.success
                Parcel -> PantopusColors.warning
                Scan -> PantopusColors.error
                Doc -> PantopusColors.appTextSecondary
            }

    companion object {
        fun fromRaw(raw: String?): MailboxVaultMailType {
            val key = raw?.lowercase(Locale.ROOT) ?: return Letter
            return when (key) {
                "notice", "civic", "community", "announcement" -> Notice
                "permit", "license", "certified" -> Permit
                "receipt", "invoice", "bill" -> Receipt
                "package", "parcel", "delivery" -> Parcel
                "scan", "scanned", "scanned_letter" -> Scan
                "doc", "document", "booklet", "coupon" -> Doc
                else -> Letter
            }
        }
    }
}

/**
 * Folder-chip icon classification. Backend stores `icon` as emoji on
 * the system folders; map the common ones to a Pantopus icon so the
 * chip renders with the design's glyph.
 */
enum class MailboxVaultFolderIcon {
    Civic,
    Receipts,
    Health,
    Finance,
    Travel,
    Keepsakes,
    Generic,
    ;

    val icon: PantopusIcon
        get() =
            when (this) {
                Civic -> PantopusIcon.Landmark
                Receipts -> PantopusIcon.Receipt
                Health -> PantopusIcon.HeartPulse
                Finance -> PantopusIcon.PiggyBank
                Travel -> PantopusIcon.Plane
                Keepsakes -> PantopusIcon.MailOpen
                Generic -> PantopusIcon.FolderLock
            }

    companion object {
        private val matchers: List<Pair<MailboxVaultFolderIcon, List<String>>> =
            listOf(
                Civic to listOf("📋", "📜", "🏛", "civic", "permit"),
                Receipts to listOf("🧾", "receipt", "invoice"),
                Health to listOf("🏥", "health", "medical"),
                Finance to listOf("🏦", "💳", "bank", "finance", "tax"),
                Travel to listOf("✈", "plane", "travel"),
                Keepsakes to listOf("📩", "keepsake", "letter"),
            )

        fun fromRaw(raw: String?): MailboxVaultFolderIcon {
            val key = raw?.lowercase(Locale.ROOT) ?: return Generic
            return matchers.firstOrNull { (_, keywords) ->
                keywords.any { key.contains(it) }
            }?.first ?: Generic
        }
    }
}
