@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.listings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailImage
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailSize
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.util.Locale
import javax.inject.Inject

/** Tab id rendered in the My listings tab strip. */
enum class MyListingsTab(
    val id: String,
    val label: String,
    val statuses: Set<String>,
) {
    Active(
        id = "active",
        label = "Active",
        statuses = setOf("active", "pending_pickup"),
    ),
    Sold(
        id = "sold",
        label = "Sold",
        statuses = setOf("sold"),
    ),
    Drafts(
        id = "drafts",
        label = "Drafts",
        statuses = setOf("draft"),
    ),
    ;

    companion object {
        fun fromId(id: String): MyListingsTab = entries.firstOrNull { it.id == id } ?: Active
    }
}

/**
 * ViewModel for My listings — wraps `GET /api/listings/me`. Loads the
 * full set once and buckets client-side so tab counts stay honest
 * without a per-tab refetch.
 */
@HiltViewModel
class MyListingsViewModel
    @Inject
    constructor(
        private val repo: ListingsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(MyListingsTab.Active.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(zeroCountTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private var onOpenListing: (String) -> Unit = {}
        private var onCompose: () -> Unit = {}

        private var allListings: List<ListingDto> = emptyList()

        /** Override the clock in tests for deterministic relative-time labels. */
        var now: () -> Instant = { Instant.now() }

        fun configureNavigation(
            onOpenListing: (String) -> Unit,
            onCompose: () -> Unit,
        ) {
            this.onOpenListing = onOpenListing
            this.onCompose = onCompose
        }

        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.myListings(limit = 100)) {
                    is NetworkResult.Success -> {
                        allListings = result.data.listings
                        recomputeTabs()
                        rebuildState()
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            ListOfRowsUiState.Error(
                                result.error.displayMessage("Couldn't load the list."),
                            )
                }
            }
        }

        fun selectTab(id: String) {
            _selectedTab.value = id
            rebuildState()
        }

        private fun zeroCountTabs(): List<ListOfRowsTab> =
            MyListingsTab.entries.map { ListOfRowsTab(id = it.id, label = it.label, count = 0) }

        private fun recomputeTabs() {
            _tabs.value =
                MyListingsTab.entries.map { tab ->
                    val count =
                        allListings.count { l ->
                            tab.statuses.contains(l.status ?: "")
                        }
                    ListOfRowsTab(id = tab.id, label = tab.label, count = count)
                }
        }

        private fun rebuildState() {
            val tab = MyListingsTab.fromId(_selectedTab.value)
            val rows =
                allListings
                    .filter { tab.statuses.contains(it.status ?: "") }
                    .map(::rowFor)
            if (rows.isEmpty()) {
                _state.value = emptyForTab(tab)
                return
            }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "my-listings-${tab.id}", rows = rows)),
                    hasMore = false,
                )
        }

        private fun emptyForTab(tab: MyListingsTab): ListOfRowsUiState.Empty =
            when (tab) {
                MyListingsTab.Active ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Camera,
                        headline = "No active listings",
                        subcopy = "Post your first item to start hearing from neighbors.",
                        ctaTitle = "List something",
                        onCta = onCompose,
                    )
                MyListingsTab.Sold ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCircle,
                        headline = "Nothing sold yet",
                        subcopy = "Items move here automatically once you mark them sold.",
                    )
                MyListingsTab.Drafts ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.File,
                        headline = "No drafts",
                        subcopy = "Saved drafts will appear here so you can finish them later.",
                    )
            }

        private fun rowFor(listing: ListingDto): RowModel {
            val title = listing.title?.takeIf { it.isNotEmpty() } ?: "Untitled listing"
            val price = formatPrice(listing.price, listing.isFree)
            val ago = formatRelative(listing.createdAt)
            val subtitle =
                listOfNotNull(price, ago)
                    .joinToString(" · ")
                    .takeIf { it.isNotEmpty() }
            return RowModel(
                id = listing.id,
                title = title,
                subtitle = subtitle,
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.Thumbnail(
                        image = thumbnailFor(listing),
                        size = ThumbnailSize.Large,
                    ),
                trailing = RowTrailing.Chevron,
                onTap = { onOpenListing(listing.id) },
                chips = chipMeta(listing),
            )
        }

        private fun thumbnailFor(listing: ListingDto): ThumbnailImage {
            val gradient = GradientPair(start = PantopusColors.primary50, end = PantopusColors.primary100)
            val firstUrl = listing.mediaUrls?.firstOrNull() ?: listing.firstImage
            return if (firstUrl != null && firstUrl.isNotEmpty()) {
                ThumbnailImage.Remote(url = firstUrl, fallback = PantopusIcon.Camera, gradient = gradient)
            } else {
                ThumbnailImage.IconOnGradient(icon = PantopusIcon.Camera, gradient = gradient)
            }
        }

        private fun chipMeta(listing: ListingDto): List<RowChip> {
            val chips = mutableListOf<RowChip>()
            val views = listing.viewCount ?: 0
            chips +=
                RowChip(
                    text = "$views ${if (views == 1) "view" else "views"}",
                    icon = PantopusIcon.Eye,
                    tint =
                        RowChip.Tint.Custom(
                            background = PantopusColors.appSurfaceSunken,
                            foreground = PantopusColors.appTextSecondary,
                        ),
                )
            val offers = listing.activeOfferCount ?: 0
            chips +=
                if (offers > 0) {
                    RowChip(
                        text = "$offers ${if (offers == 1) "offer" else "offers"}",
                        icon = PantopusIcon.HandCoins,
                        tint =
                            RowChip.Tint.Custom(
                                background = PantopusColors.primary50,
                                foreground = PantopusColors.primary700,
                            ),
                    )
                } else {
                    RowChip(
                        text = "0 offers",
                        icon = PantopusIcon.HandCoins,
                        tint =
                            RowChip.Tint.Custom(
                                background = PantopusColors.appSurfaceSunken,
                                foreground = PantopusColors.appTextSecondary,
                            ),
                    )
                }
            chips += statusChip(listing.status ?: "active")
            return chips
        }

        private fun statusChip(status: String): RowChip =
            when (status) {
                "active" ->
                    RowChip(
                        text = "Active",
                        icon = PantopusIcon.Circle,
                        tint = RowChip.Tint.Status(StatusChipVariant.Success),
                    )
                "pending_pickup" ->
                    RowChip(
                        text = "Pickup pending",
                        icon = PantopusIcon.Clock,
                        tint = RowChip.Tint.Status(StatusChipVariant.Warning),
                    )
                "sold" ->
                    RowChip(
                        text = "Sold",
                        icon = PantopusIcon.CheckCircle,
                        tint = RowChip.Tint.Status(StatusChipVariant.Success),
                    )
                "archived" ->
                    RowChip(
                        text = "Archived",
                        icon = PantopusIcon.File,
                        tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                    )
                "draft" ->
                    RowChip(
                        text = "Draft",
                        icon = PantopusIcon.Pencil,
                        tint = RowChip.Tint.Status(StatusChipVariant.Info),
                    )
                else ->
                    RowChip(
                        text = status.replaceFirstChar { it.uppercase() },
                        tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                    )
            }

        private fun formatPrice(
            price: Double?,
            isFree: Boolean?,
        ): String? {
            if (isFree == true) return "Free"
            if (price == null) return null
            val nf = NumberFormat.getCurrencyInstance(Locale.US)
            nf.maximumFractionDigits = if (price % 1.0 == 0.0) 0 else 2
            return nf.format(price)
        }

        private fun formatRelative(iso: String?): String? {
            if (iso.isNullOrEmpty()) return null
            return try {
                val created = Instant.parse(iso)
                val duration = Duration.between(created, now())
                val seconds = duration.seconds
                when {
                    seconds < 60L -> "now"
                    seconds < 3_600L -> "${seconds / 60L}m"
                    seconds < 86_400L -> "${seconds / 3_600L}h"
                    seconds < 604_800L -> "${seconds / 86_400L}d"
                    seconds < 2_419_200L -> "${seconds / 604_800L}w"
                    else -> "${seconds / 2_628_000L}mo".replace("0mo", "1mo")
                }
            } catch (_: Throwable) {
                null
            }
        }
    }
