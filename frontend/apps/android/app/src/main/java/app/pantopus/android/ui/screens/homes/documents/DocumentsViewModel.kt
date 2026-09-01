@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCta
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.ChipStripConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav arg key for the Documents route. */
const val DOCUMENTS_HOME_ID_KEY = "homeId"

/** Chip-strip filter ids for the Documents screen. */
enum class DocumentsFilter(val id: String) {
    All("all"),
    Recent("recent"),
    Expiring("expiring"),
    Shared("shared"),
    ;

    companion object {
        fun fromId(id: String): DocumentsFilter = entries.firstOrNull { it.id == id } ?: All
    }
}

/** Pure projection: DTO → display fields. Tested directly. */
data class DocumentRowProjection(
    val id: String,
    val category: DocumentCategory,
    val fileType: DocumentFileType,
    val filename: String,
    val sizeLabel: String?,
    val uploadedLabel: String?,
    val version: String?,
    val expiresLabel: String?,
    val expiresUrgent: Boolean,
    val sharedWithCount: Int,
    val pinned: Boolean,
)

/** Banner summary. Pure projection from the loaded rows. */
data class DocumentsBannerSummary(
    val totalCount: Int,
    val storageUsedLabel: String?,
    val expiringCount: Int,
) {
    val hasContent: Boolean get() = totalCount > 0
}

/** Action invoked from the kebab menu on a document row. */
enum class DocumentAction { View, Share, Download, Delete }

/**
 * ViewModel for the Documents list (T6.4b / P17). Wraps
 * `GET /api/homes/:id/documents` and projects each row into a
 * category-grouped section.
 */
@HiltViewModel
class DocumentsViewModel
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
                "DocumentsViewModel requires a $DOCUMENTS_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedFilter = MutableStateFlow(DocumentsFilter.All.id)
        val selectedFilter: StateFlow<String> = _selectedFilter.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private val _chipStrip = MutableStateFlow(initialChipStrip())
        val chipStrip: StateFlow<ChipStripConfig> = _chipStrip.asStateFlow()

        private var documents: List<HomeDocumentDto>? = null
        private var onOpenDocument: (HomeDocumentDto) -> Unit = {}
        private var onUpload: () -> Unit = {}
        private var onSearch: () -> Unit = {}
        private var onExport: () -> Unit = {}
        private var onDocumentAction: (HomeDocumentDto, DocumentAction) -> Unit = { _, _ -> }

        fun configureNavigation(
            onOpenDocument: (HomeDocumentDto) -> Unit = {},
            onUpload: () -> Unit = {},
            onSearch: () -> Unit = {},
            onExport: () -> Unit = {},
            onDocumentAction: (HomeDocumentDto, DocumentAction) -> Unit = { _, _ -> },
        ) {
            this.onOpenDocument = onOpenDocument
            this.onUpload = onUpload
            this.onSearch = onSearch
            this.onExport = onExport
            this.onDocumentAction = onDocumentAction
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeDocuments(homeId)) {
                    is NetworkResult.Success -> applySuccess(result.data.documents)
                    is NetworkResult.Failure -> {
                        documents = null
                        _banner.value = null
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        fun selectFilter(id: String) {
            _selectedFilter.value = id
            _chipStrip.value = chipStripFromState()
            documents?.let(::renderForCurrentFilter)
        }

        val topBarAction: TopBarAction =
            TopBarAction(
                icon = PantopusIcon.Search,
                contentDescription = "Search documents",
                onClick = { onSearch() },
            )

        fun fab(): FabAction =
            FabAction(
                icon = PantopusIcon.Upload,
                contentDescription = "Upload document",
                variant = FabVariant.SecondaryCreate,
                tint = FabTint.Home,
                onClick = { onUpload() },
            )

        private fun applySuccess(loaded: List<HomeDocumentDto>) {
            documents = loaded
            _chipStrip.value = chipStripFromState()
            renderForCurrentFilter(loaded)
        }

        private fun renderForCurrentFilter(loaded: List<HomeDocumentDto>) {
            if (loaded.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.FolderLock,
                        headline = "No documents yet",
                        subcopy =
                            "Upload your lease, insurance, or warranties. Stored end-to-end " +
                                "encrypted, shareable with household members.",
                        ctaTitle = "Upload document",
                        onCta = { onUpload() },
                    )
                return
            }
            val now = clock()
            val filter = DocumentsFilter.fromId(_selectedFilter.value)
            val filtered = loaded.filter { passes(it, filter, now) }

            if (filtered.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.FolderLock,
                        headline = emptyHeadline(filter),
                        subcopy = "Switch chips above or upload a document to populate this scope.",
                    )
                return
            }

            val bucketed = filtered.groupBy { DocumentCategory.fromDocType(it.docType) }
            val sections =
                bucketed
                    .toSortedMap(compareBy(DocumentCategory::sortOrder))
                    .mapNotNull { (category, dtos) ->
                        if (dtos.isEmpty()) {
                            null
                        } else {
                            RowSection(
                                id = "documents.${category.id}",
                                header = category.label,
                                rows = dtos.map { rowFor(it, now) },
                                count = dtos.size,
                            )
                        }
                    }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = sections,
                    hasMore = false,
                )
            _banner.value = bannerFor(loaded, now)
        }

        private fun bannerFor(
            loaded: List<HomeDocumentDto>,
            now: Instant,
        ): BannerConfig? {
            val summary = summarize(loaded, now)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.FolderLock,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                cta =
                    BannerCta(
                        label = "Export",
                        icon = PantopusIcon.Download,
                        accessibilityLabel = "Export documents",
                        tint = BannerCtaTint.Home,
                        onClick = { onExport() },
                    ),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: DocumentsBannerSummary): String {
            val unit = if (summary.totalCount == 1) "document" else "documents"
            return summary.storageUsedLabel?.let { "${summary.totalCount} $unit · $it" }
                ?: "${summary.totalCount} $unit"
        }

        private fun bannerSubtitle(summary: DocumentsBannerSummary): String {
            if (summary.expiringCount > 0) {
                val unit = if (summary.expiringCount == 1) "document" else "documents"
                return "${summary.expiringCount} $unit expiring in the next 90 days"
            }
            return "All current · vault end-to-end encrypted"
        }

        private fun rowFor(
            dto: HomeDocumentDto,
            now: Instant,
        ): RowModel =
            makeRow(
                dto = dto,
                now = now,
                onTap = { onOpenDocument(dto) },
                onSecondary = { onDocumentAction(dto, DocumentAction.View) },
            )

        private fun passes(
            dto: HomeDocumentDto,
            filter: DocumentsFilter,
            now: Instant,
        ): Boolean =
            when (filter) {
                DocumentsFilter.All -> true
                DocumentsFilter.Recent -> {
                    val created = dto.createdAt?.let(::parseInstant)
                    created != null && created >= now.minusSeconds(30L * 24 * 60 * 60)
                }
                DocumentsFilter.Expiring -> expiresWithin(dto, 90, now)
                DocumentsFilter.Shared ->
                    dto.visibility != "private" && sharedCount(dto) > 0
            }

        private fun expiresWithin(
            dto: HomeDocumentDto,
            days: Int,
            now: Instant,
        ): Boolean {
            val raw = dto.details?.get("expires_at") ?: dto.details?.get("expires") ?: return false
            val expires = parseInstant(raw) ?: return false
            val cutoff = now.plusSeconds(days.toLong() * 24 * 60 * 60)
            return expires >= now && expires <= cutoff
        }

        private fun emptyHeadline(filter: DocumentsFilter): String =
            when (filter) {
                DocumentsFilter.All -> "No documents in this home"
                DocumentsFilter.Recent -> "Nothing uploaded recently"
                DocumentsFilter.Expiring -> "No documents expiring soon"
                DocumentsFilter.Shared -> "No shared documents"
            }

        private fun chipStripFromState(): ChipStripConfig {
            val counts = chipCounts()
            return ChipStripConfig(
                chips =
                    listOf(
                        ChipStripConfig.Chip(DocumentsFilter.All.id, "All ${counts[DocumentsFilter.All] ?: 0}"),
                        ChipStripConfig.Chip(DocumentsFilter.Recent.id, "Recent ${counts[DocumentsFilter.Recent] ?: 0}"),
                        ChipStripConfig.Chip(
                            DocumentsFilter.Expiring.id,
                            "Expiring ${counts[DocumentsFilter.Expiring] ?: 0}",
                        ),
                        ChipStripConfig.Chip(DocumentsFilter.Shared.id, "Shared ${counts[DocumentsFilter.Shared] ?: 0}"),
                    ),
                selectedId = _selectedFilter.value,
                onSelect = ::selectFilter,
            )
        }

        private fun chipCounts(): Map<DocumentsFilter, Int> {
            val loaded = documents ?: return emptyMap()
            val now = clock()
            return mapOf(
                DocumentsFilter.All to loaded.size,
                DocumentsFilter.Recent to loaded.count { passes(it, DocumentsFilter.Recent, now) },
                DocumentsFilter.Expiring to loaded.count { passes(it, DocumentsFilter.Expiring, now) },
                DocumentsFilter.Shared to loaded.count { passes(it, DocumentsFilter.Shared, now) },
            )
        }

        private fun initialChipStrip(): ChipStripConfig =
            ChipStripConfig(
                chips =
                    listOf(
                        ChipStripConfig.Chip(DocumentsFilter.All.id, "All"),
                        ChipStripConfig.Chip(DocumentsFilter.Recent.id, "Recent"),
                        ChipStripConfig.Chip(DocumentsFilter.Expiring.id, "Expiring"),
                        ChipStripConfig.Chip(DocumentsFilter.Shared.id, "Shared"),
                    ),
                selectedId = _selectedFilter.value,
                onSelect = ::selectFilter,
            )

        companion object {
            /**
             * Shared row builder so the Documents list and the Document
             * Search surface (`DocumentSearchScreen`) render identical
             * rows. Search passes `extraChips` to append matched-tag pills
             * after the category / expiry chips.
             */
            fun makeRow(
                dto: HomeDocumentDto,
                now: Instant,
                extraChips: List<RowChip> = emptyList(),
                onTap: () -> Unit,
                onSecondary: () -> Unit,
            ): RowModel {
                val projection = project(dto, now)
                val fileType = projection.fileType
                return RowModel(
                    id = projection.id,
                    title = projection.filename,
                    template = RowTemplate.StatusChip,
                    leading =
                        RowLeading.TypeIcon(
                            icon = fileType.icon,
                            background = fileType.background,
                            foreground = fileType.foreground,
                        ),
                    trailing = RowTrailing.Kebab,
                    onTap = onTap,
                    onSecondary = onSecondary,
                    body = bodyLine(projection)?.ifEmpty { null },
                    bodyIcon = PantopusIcon.UploadCloud,
                    chips = chipsFor(projection) + extraChips,
                    metaTail =
                        if (projection.sharedWithCount > 0) {
                            "Shared ${projection.sharedWithCount}"
                        } else {
                            projection.sizeLabel
                        },
                )
            }

            private fun bodyLine(projection: DocumentRowProjection): String? {
                val fragments = mutableListOf<String>()
                projection.uploadedLabel?.let { fragments.add(it) }
                projection.version?.let { fragments.add(it) }
                return if (fragments.isEmpty()) null else fragments.joinToString(" · ")
            }

            private fun chipsFor(projection: DocumentRowProjection): List<RowChip> {
                val chips =
                    mutableListOf(
                        RowChip(
                            text = projection.category.label,
                            icon = projection.category.icon,
                            tint =
                                RowChip.Tint.Custom(
                                    background = projection.category.background,
                                    foreground = projection.category.foreground,
                                ),
                        ),
                    )
                projection.expiresLabel?.let { label ->
                    chips.add(
                        RowChip(
                            text = label,
                            icon = PantopusIcon.CalendarClock,
                            tint =
                                RowChip.Tint.Status(
                                    if (projection.expiresUrgent) {
                                        StatusChipVariant.Warning
                                    } else {
                                        StatusChipVariant.Neutral
                                    },
                                ),
                        ),
                    )
                }
                return chips
            }

            /** Pure mapping from a DTO to display strings. */
            @JvmStatic
            fun project(
                dto: HomeDocumentDto,
                now: Instant,
            ): DocumentRowProjection {
                val category = DocumentCategory.fromDocType(dto.docType)
                val fileType = DocumentFileType.fromMime(mimeType = dto.mimeType, filename = dto.title)
                val sizeLabel = formatSize(dto.sizeBytes)
                val uploadedLabel = formatUploadedLabel(dto)
                val version = dto.details?.get("version")
                val expires = expiresInfo(dto, now)
                val sharedCount = sharedCount(dto)
                val pinned = dto.details?.get("pinned") == "1"
                return DocumentRowProjection(
                    id = dto.id,
                    category = category,
                    fileType = fileType,
                    filename = dto.title,
                    sizeLabel = sizeLabel,
                    uploadedLabel = uploadedLabel,
                    version = version,
                    expiresLabel = expires.label,
                    expiresUrgent = expires.urgent,
                    sharedWithCount = sharedCount,
                    pinned = pinned,
                )
            }

            @JvmStatic
            fun summarize(
                documents: List<HomeDocumentDto>,
                now: Instant,
            ): DocumentsBannerSummary {
                var totalBytes: Long = 0
                var expiring = 0
                val cutoff = now.plusSeconds(90L * 24 * 60 * 60)
                for (doc in documents) {
                    doc.sizeBytes?.let { totalBytes += it }
                    val raw = doc.details?.get("expires_at") ?: doc.details?.get("expires")
                    val date = raw?.let(::parseInstant) ?: continue
                    if (date >= now && date <= cutoff) {
                        expiring += 1
                    }
                }
                val used = if (totalBytes > 0) formatBytes(totalBytes) else null
                return DocumentsBannerSummary(
                    totalCount = documents.size,
                    storageUsedLabel = used,
                    expiringCount = expiring,
                )
            }

            internal fun sharedCount(dto: HomeDocumentDto): Int {
                val raw = dto.details?.get("shared_count")?.toIntOrNull()
                if (raw != null) return raw
                if (dto.visibility == "members" || dto.visibility == "managers") return 0
                return 0
            }

            private fun formatSize(bytes: Long?): String? {
                if (bytes == null || bytes <= 0) return null
                return formatBytes(bytes)
            }

            private fun formatBytes(bytes: Long): String {
                val kb = bytes / 1024.0
                val mb = kb / 1024.0
                val gb = mb / 1024.0
                return when {
                    gb >= 1.0 -> String.format(Locale.US, "%.1f GB", gb)
                    mb >= 1.0 -> String.format(Locale.US, "%.1f MB", mb)
                    kb >= 1.0 -> String.format(Locale.US, "%.0f KB", kb)
                    else -> "$bytes B"
                }
            }

            private fun formatUploadedLabel(dto: HomeDocumentDto): String? {
                val created = dto.createdAt?.let(::parseInstant)
                if (created == null) {
                    return dto.details?.get("uploaded_by")?.let { "by $it" }
                }
                val formatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
                val day = formatter.format(created.atZone(ZoneId.of("UTC")))
                val uploader = dto.details?.get("uploaded_by")
                return if (!uploader.isNullOrEmpty()) "$day · by $uploader" else day
            }

            private data class ExpiresInfo(val label: String?, val urgent: Boolean)

            private fun expiresInfo(
                dto: HomeDocumentDto,
                now: Instant,
            ): ExpiresInfo {
                val raw = dto.details?.get("expires_at") ?: dto.details?.get("expires")
                if (raw.isNullOrEmpty()) return ExpiresInfo(null, false)
                val date = parseInstant(raw) ?: return ExpiresInfo(null, false)
                val urgent = date <= now.plusSeconds(60L * 24 * 60 * 60)
                val formatter = DateTimeFormatter.ofPattern("MMM yyyy", Locale.US)
                val label = "Expires ${formatter.format(date.atZone(ZoneId.of("UTC")))}"
                return ExpiresInfo(label, urgent)
            }

            internal fun parseInstant(raw: String): Instant? =
                runCatching { Instant.parse(raw) }
                    .recoverCatching {
                        Instant.parse("${raw}T00:00:00Z")
                    }
                    .recoverCatching {
                        // bare yyyy-MM-dd
                        LocalDate.parse(raw).atStartOfDay(ZoneId.of("UTC")).toInstant()
                    }
                    .getOrNull()
        }
    }
