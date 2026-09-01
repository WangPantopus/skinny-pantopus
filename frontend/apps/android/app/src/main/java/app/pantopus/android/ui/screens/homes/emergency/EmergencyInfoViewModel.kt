@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
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
import javax.inject.Inject

/** Nav arg key for the Emergency info route. */
const val EMERGENCY_HOME_ID_KEY = "homeId"

/** Chip-strip filter ids for the Emergency info screen. */
enum class EmergencyFilter(
    val id: String,
    val category: EmergencyCategory?,
) {
    All("all", null),
    Shutoff("shutoff", EmergencyCategory.Shutoff),
    Contact("contact", EmergencyCategory.Contact),
    Evac("evac", EmergencyCategory.Evac),
    Medical("medical", EmergencyCategory.Medical),
    ;

    companion object {
        fun fromId(id: String): EmergencyFilter = entries.firstOrNull { it.id == id } ?: All
    }
}

/** Pure projection: DTO → display fields. Tested directly. */
data class EmergencyRowProjection(
    val id: String,
    val category: EmergencyCategory,
    val glyph: PantopusIcon,
    val title: String,
    val body: String,
    val bodyIcon: PantopusIcon?,
    val lastReviewed: String?,
    val needsReview: Boolean,
    val pinned: Boolean,
    val actionTarget: String?,
)

/** Banner summary. Pure projection from the loaded rows. */
data class EmergencyBannerSummary(
    val totalItems: Int,
    val lastReviewedLabel: String?,
    val needsReviewCount: Int,
) {
    val hasContent: Boolean get() = totalItems > 0
}

/**
 * ViewModel for the Emergency info list (T6.4b / P17). Wraps
 * `GET /api/homes/:id/emergencies` and projects each row into a
 * category-grouped section.
 */
@HiltViewModel
class EmergencyInfoViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(EMERGENCY_HOME_ID_KEY)) {
                "EmergencyInfoViewModel requires a $EMERGENCY_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedFilter = MutableStateFlow(EmergencyFilter.All.id)
        val selectedFilter: StateFlow<String> = _selectedFilter.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private val _chipStrip = MutableStateFlow(initialChipStrip())
        val chipStrip: StateFlow<ChipStripConfig> = _chipStrip.asStateFlow()

        /**
         * Phone number the user just asked to dial — either the standing
         * "Emergency? Call 911" bar or a stored contact's tap-to-dial
         * row. [EmergencyInfoScreen] observes it, fires `ACTION_DIAL`,
         * and calls [consumeDialRequest]. Mirrors RN's `callPhone`
         * (`emergency.tsx:80`), which dials both the banner (`:107`) and
         * every contact's phone row (`:158`).
         */
        private val _dialRequest = MutableStateFlow<String?>(null)
        val dialRequest: StateFlow<String?> = _dialRequest.asStateFlow()

        /** Ask the screen to dial [number]; blank input is a no-op. */
        fun dial(number: String?) {
            if (number.isNullOrBlank()) return
            _dialRequest.value = number
        }

        /** Dial emergency services from the standing red bar. */
        fun dialEmergencyNumber() {
            dial(EMERGENCY_NUMBER)
        }

        fun consumeDialRequest() {
            _dialRequest.value = null
        }

        private var emergencies: List<HomeEmergencyDto>? = null
        private var onAction: (HomeEmergencyDto) -> Unit = {}
        private var onAdd: () -> Unit = {}
        private var onShare: () -> Unit = {}
        private var onPrintCard: () -> Unit = {}

        fun configureNavigation(
            onAction: (HomeEmergencyDto) -> Unit = {},
            onAdd: () -> Unit = {},
            onShare: () -> Unit = {},
            onPrintCard: () -> Unit = {},
        ) {
            this.onAction = onAction
            this.onAdd = onAdd
            this.onShare = onShare
            this.onPrintCard = onPrintCard
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeEmergencies(homeId)) {
                    is NetworkResult.Success -> applySuccess(result.data.emergencies)
                    is NetworkResult.Failure -> {
                        emergencies = null
                        _banner.value = null
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        fun selectFilter(id: String) {
            _selectedFilter.value = id
            _chipStrip.value = chipStripFromState()
            emergencies?.let(::renderForCurrentFilter)
        }

        // P6.6 — share / print payloads built from the loaded rows.

        /** Plain-text summary handed to the share sheet ("Share emergency
         * info"). Null until the first load returns. */
        fun shareSummaryText(): String? {
            val rows = emergencies?.takeIf { it.isNotEmpty() } ?: return null
            val card = EmergencyCardPdf.content(rows, homeLabel = "Emergency info")
            return buildString {
                append("${card.homeLabel} — emergency info")
                for (section in card.sections) {
                    if (section.items.isEmpty()) continue
                    append("\n\n").append(section.heading)
                    for (item in section.items) {
                        append("\n")
                        append(
                            if (item.detail.isEmpty()) {
                                "• ${item.title}"
                            } else {
                                "• ${item.title}: ${item.detail}"
                            },
                        )
                    }
                }
            }
        }

        /** Printable A4 card content for "Print emergency card". Null until
         * the first load returns. */
        fun printableCard(): EmergencyCardContent? {
            val rows = emergencies?.takeIf { it.isNotEmpty() } ?: return null
            return EmergencyCardPdf.content(rows, homeLabel = "Emergency info")
        }

        val topBarAction: TopBarAction =
            TopBarAction(
                icon = PantopusIcon.Share,
                contentDescription = "Share emergency info",
                onClick = { onShare() },
            )

        fun fab(): FabAction =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Add emergency info",
                variant = FabVariant.SecondaryCreate,
                tint = FabTint.Home,
                onClick = { onAdd() },
            )

        private fun applySuccess(loaded: List<HomeEmergencyDto>) {
            emergencies = loaded
            _chipStrip.value = chipStripFromState()
            renderForCurrentFilter(loaded)
        }

        private fun renderForCurrentFilter(loaded: List<HomeEmergencyDto>) {
            if (loaded.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ShieldCheck,
                        headline = "No emergency info set up",
                        subcopy =
                            "Set up shutoffs, key contacts, evac spots, and medical info for " +
                                "this home. Easier to do now than during a 2 AM water leak.",
                        ctaTitle = "Add info",
                        onCta = { onAdd() },
                    )
                return
            }
            val filter = EmergencyFilter.fromId(_selectedFilter.value)
            val bucketed = bucketByCategory(loaded)

            val sections = mutableListOf<RowSection>()
            // Pinned pseudo-group — only when All is active.
            if (filter == EmergencyFilter.All) {
                val pinned = loaded.filter { it.details?.get("pinned") == "1" }
                if (pinned.isNotEmpty()) {
                    val rows = pinned.map { rowFor(it, pinned = true) }
                    sections.add(
                        RowSection(
                            id = "emergency.pinned",
                            header = "Pinned · Quick access",
                            rows = rows,
                            count = rows.size,
                        ),
                    )
                }
            }
            val categoriesToShow: List<EmergencyCategory> =
                if (filter.category != null) listOf(filter.category) else allCategoriesInOrder
            categoriesToShow
                .mapNotNull { category ->
                    val dtos = bucketed[category].orEmpty()
                    val rows = dtos.map { rowFor(it, pinned = false) }
                    if (rows.isEmpty()) {
                        null
                    } else {
                        RowSection(
                            id = "emergency.${category.id}",
                            header = category.label,
                            rows = rows,
                            count = rows.size,
                        )
                    }
                }.forEach(sections::add)

            if (sections.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ShieldCheck,
                        headline = "No ${filter.category?.chipLabel?.lowercase() ?: "items"} in this scope",
                        subcopy = "Switch chips above or add an item to populate this category.",
                    )
                return
            }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = sections,
                    hasMore = false,
                )
            _banner.value = bannerFor(loaded)
        }

        private fun bannerFor(loaded: List<HomeEmergencyDto>): BannerConfig? {
            val summary = summarize(loaded)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.ShieldCheck,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                cta =
                    BannerCta(
                        label = "Print card",
                        icon = PantopusIcon.Printer,
                        accessibilityLabel = "Print emergency card",
                        tint = BannerCtaTint.Home,
                        onClick = { onPrintCard() },
                    ),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: EmergencyBannerSummary): String {
            val unit = if (summary.totalItems == 1) "item" else "items"
            val suffix = summary.lastReviewedLabel?.let { " · $it" } ?: ""
            return "${summary.totalItems} $unit$suffix"
        }

        private fun bannerSubtitle(summary: EmergencyBannerSummary): String {
            if (summary.needsReviewCount > 0) {
                val unit = if (summary.needsReviewCount == 1) "item needs" else "items need"
                return "${summary.needsReviewCount} $unit review · keep the plan current"
            }
            return "Plan current · shared with household members"
        }

        private fun rowFor(
            dto: HomeEmergencyDto,
            pinned: Boolean,
        ): RowModel {
            val projection = project(dto, pinned)
            val category = projection.category
            val chips = chipsFor(projection)
            return RowModel(
                id = projection.id,
                title = projection.title,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = projection.glyph,
                        background = category.background,
                        foreground = category.foreground,
                    ),
                trailing =
                    RowTrailing.CircularAction(
                        icon = category.actionIcon,
                        accessibilityLabel = category.actionAccessibilityLabel,
                        background = category.background,
                        foreground = category.foreground,
                        // A stored phone number is a tap-to-dial
                        // affordance (RN `emergency.tsx:157-162`);
                        // everything else opens the item detail.
                        onClick = {
                            val phone = emergencyPhoneNumber(projection)
                            if (phone != null) dial(phone) else onAction(dto)
                        },
                    ),
                onTap = { onAction(dto) },
                body = projection.body.ifEmpty { null },
                bodyIcon = projection.bodyIcon,
                chips = chips,
                metaTail = if (projection.needsReview) null else projection.lastReviewed,
            )
        }

        private fun chipsFor(projection: EmergencyRowProjection): List<RowChip> {
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
            if (projection.needsReview) {
                chips.add(
                    RowChip(
                        text = "Review needed",
                        icon = PantopusIcon.AlertCircle,
                        tint = RowChip.Tint.Status(StatusChipVariant.Warning),
                    ),
                )
            }
            return chips
        }

        private fun bucketByCategory(loaded: List<HomeEmergencyDto>): Map<EmergencyCategory, List<HomeEmergencyDto>> {
            val buckets = LinkedHashMap<EmergencyCategory, MutableList<HomeEmergencyDto>>()
            for (dto in loaded) {
                val cat = EmergencyCategory.fromType(dto.type)
                buckets.getOrPut(cat) { mutableListOf() }.add(dto)
            }
            return buckets
        }

        private fun chipStripFromState(): ChipStripConfig {
            val counts = emergencies?.let(::countsByCategory).orEmpty()
            val total = counts.values.sum()
            return ChipStripConfig(
                chips =
                    listOf(
                        ChipStripConfig.Chip(EmergencyFilter.All.id, "All $total"),
                        chip(EmergencyFilter.Shutoff, counts),
                        chip(EmergencyFilter.Contact, counts),
                        chip(EmergencyFilter.Evac, counts),
                        chip(EmergencyFilter.Medical, counts),
                    ),
                selectedId = _selectedFilter.value,
                onSelect = ::selectFilter,
            )
        }

        private fun chip(
            filter: EmergencyFilter,
            counts: Map<EmergencyCategory, Int>,
        ): ChipStripConfig.Chip {
            val category = filter.category ?: return ChipStripConfig.Chip(filter.id, filter.id)
            val count = counts[category] ?: 0
            return ChipStripConfig.Chip(
                id = filter.id,
                label = "${category.chipLabel} $count",
                icon = category.icon,
            )
        }

        private fun countsByCategory(loaded: List<HomeEmergencyDto>): Map<EmergencyCategory, Int> =
            loaded.groupingBy { EmergencyCategory.fromType(it.type) }.eachCount()

        private fun initialChipStrip(): ChipStripConfig =
            ChipStripConfig(
                chips =
                    listOf(
                        ChipStripConfig.Chip(EmergencyFilter.All.id, "All"),
                        ChipStripConfig.Chip(EmergencyFilter.Shutoff.id, "Shutoffs", PantopusIcon.Power),
                        ChipStripConfig.Chip(EmergencyFilter.Contact.id, "Contacts", PantopusIcon.Phone),
                        ChipStripConfig.Chip(EmergencyFilter.Evac.id, "Evac", PantopusIcon.Navigation),
                        ChipStripConfig.Chip(EmergencyFilter.Medical.id, "Medical", PantopusIcon.HeartPulse),
                    ),
                selectedId = _selectedFilter.value,
                onSelect = ::selectFilter,
            )

        companion object {
            /** The number the standing red bar dials (RN `emergency.tsx:107`). */
            const val EMERGENCY_NUMBER: String = "911"

            /** Bar copy — word-for-word with RN and the iOS screen. */
            const val EMERGENCY_BANNER_TITLE: String = "Emergency? Call 911"

            /**
             * Dialable phone number carried by [projection], or null when
             * the row has no number. Only contact / medical rows put a
             * phone in `actionTarget`; shutoff / evac carry a map or
             * photo URL instead.
             */
            @JvmStatic
            fun emergencyPhoneNumber(projection: EmergencyRowProjection): String? =
                when (projection.category) {
                    EmergencyCategory.Contact, EmergencyCategory.Medical ->
                        projection.actionTarget?.takeIf { it.isNotBlank() }
                    EmergencyCategory.Shutoff, EmergencyCategory.Evac -> null
                }

            private val allCategoriesInOrder =
                listOf(
                    EmergencyCategory.Shutoff,
                    EmergencyCategory.Contact,
                    EmergencyCategory.Evac,
                    EmergencyCategory.Medical,
                )

            /** Pure mapping from a DTO to display strings. */
            @JvmStatic
            fun project(
                dto: HomeEmergencyDto,
                pinned: Boolean,
            ): EmergencyRowProjection {
                val category = EmergencyCategory.fromType(dto.type)
                val glyph = EmergencyCategory.glyph(forType = dto.type)
                val body = detailString(dto)
                val bodyIcon = bodyIconFor(category, dto)
                val lastReviewed = dto.details?.get("reviewed")?.let { "Reviewed $it" }
                val needsReview = dto.details?.get("needs_review") == "1"
                val actionTarget = actionTargetFor(category, dto)
                return EmergencyRowProjection(
                    id = dto.id,
                    category = category,
                    glyph = glyph,
                    title = dto.label,
                    body = body,
                    bodyIcon = bodyIcon,
                    lastReviewed = lastReviewed,
                    needsReview = needsReview,
                    pinned = pinned,
                    actionTarget = actionTarget,
                )
            }

            @JvmStatic
            fun summarize(emergencies: List<HomeEmergencyDto>): EmergencyBannerSummary {
                val total = emergencies.size
                val needsReview = emergencies.count { it.details?.get("needs_review") == "1" }
                val mostRecent =
                    emergencies
                        .mapNotNull { it.details?.get("reviewed") }
                        .sortedDescending()
                        .firstOrNull()
                val label = mostRecent?.let { "reviewed $it" }
                return EmergencyBannerSummary(
                    totalItems = total,
                    lastReviewedLabel = label,
                    needsReviewCount = needsReview,
                )
            }

            private fun detailString(dto: HomeEmergencyDto): String {
                val details = dto.details
                val detail = details?.get("detail").orEmpty()
                val phone = details?.get("phone").orEmpty()
                val note = details?.get("note").orEmpty()
                return when {
                    detail.isNotEmpty() -> detail
                    phone.isNotEmpty() && note.isNotEmpty() -> "$phone · $note"
                    phone.isNotEmpty() -> phone
                    !dto.location.isNullOrEmpty() -> dto.location
                    else -> ""
                }
            }

            private fun bodyIconFor(
                category: EmergencyCategory,
                dto: HomeEmergencyDto,
            ): PantopusIcon? =
                when (category) {
                    EmergencyCategory.Contact ->
                        if (dto.details?.get("phone") != null) PantopusIcon.Phone else PantopusIcon.Info
                    EmergencyCategory.Shutoff, EmergencyCategory.Evac -> PantopusIcon.MapPin
                    EmergencyCategory.Medical ->
                        if (dto.details?.get("phone") != null) PantopusIcon.Phone else PantopusIcon.MapPin
                }

            private fun actionTargetFor(
                category: EmergencyCategory,
                dto: HomeEmergencyDto,
            ): String? =
                when (category) {
                    EmergencyCategory.Contact, EmergencyCategory.Medical -> dto.details?.get("phone")
                    EmergencyCategory.Evac, EmergencyCategory.Shutoff ->
                        dto.details?.get("map_url") ?: dto.details?.get("photo_url")
                }
        }
    }
