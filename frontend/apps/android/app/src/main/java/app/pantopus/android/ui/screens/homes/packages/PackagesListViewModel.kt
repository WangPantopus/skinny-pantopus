@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "TooManyFunctions",
    "LongMethod",
)

package app.pantopus.android.ui.screens.homes.packages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PackageDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
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
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Nav arg key for the Packages list route. */
const val PACKAGES_HOME_ID_KEY = "homeId"

/** Pure projection of one package into a row's display fields. */
data class PackageRowProjection(
    val title: String,
    val subtitle: String?,
    val body: String?,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon,
    val status: PackageChipStatus,
    val courier: CourierKind,
    val highlight: RowHighlight?,
)

/**
 * Banner summary for the Packages top-of-list strip. Pure projection
 * from the loaded payload + clock.
 */
data class PackagesBannerSummary(
    val inFlightCount: Int,
    val arrivingTodayCount: Int,
    val exceptionCount: Int,
) {
    val hasContent: Boolean
        get() = inFlightCount > 0 || exceptionCount > 0
}

private data class PackagesTabCounts(
    val expected: Int,
    val delivered: Int,
    val archived: Int,
)

/**
 * ViewModel for the per-home Packages list (T6.3d / P14). Wraps
 * `GET /api/homes/:id/packages` and projects each [PackageDto] into a
 * [RowModel] using:
 *  - [RowLeading.TypeIcon] tinted via [CourierKind]
 *  - [RowTrailing.Status] driven by [PackageChipStatus]
 *  - title = description (or tracking number / `Package` fallback)
 *  - subtitle = `[courier] · [drop location]`
 *  - body = recipient label when `picked_up_by` is set and ≠ the
 *    current user
 *
 * Tab projection ([PackagesTab] → backend statuses):
 *     Expected  = expected, out_for_delivery
 *     Delivered = delivered, picked_up
 *     Archived  = lost, returned
 */
@HiltViewModel
class PackagesListViewModel
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
            checkNotNull(savedStateHandle.get<String>(PACKAGES_HOME_ID_KEY)) {
                "PackagesListViewModel requires a $PACKAGES_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(PackagesTab.Expected.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(initialTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private var packages: List<PackageDto>? = null
        private var currentUserId: String? = null
        private var memberLookup: (String) -> String? = { null }
        private var onOpenPackage: (String) -> Unit = {}
        private var onLogPackage: () -> Unit = {}

        fun configureNavigation(
            currentUserId: String? = null,
            memberLookup: (String) -> String? = { null },
            onOpenPackage: (String) -> Unit = {},
            onLogPackage: () -> Unit = {},
        ) {
            this.currentUserId = currentUserId
            this.memberLookup = memberLookup
            this.onOpenPackage = onOpenPackage
            this.onLogPackage = onLogPackage
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomePackages(homeId)) {
                    is NetworkResult.Success -> applySuccess(result.data.packages)
                    is NetworkResult.Failure -> {
                        packages = null
                        _banner.value = null
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        fun selectTab(id: String) {
            _selectedTab.value = id
            packages?.let(::renderForCurrentTab)
        }

        fun fab(): FabAction =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Log a package",
                variant = FabVariant.CanonicalCreate,
                tint = FabTint.Home,
                onClick = { onLogPackage() },
            )

        /**
         * T6.3d: top-bar action is `null` by design. The design's right-
         * side filter glyph isn't wired to a sheet yet, and the FAB
         * owns the canonical "Log a package" action.
         */
        val topBarAction: TopBarAction? = null

        /** Banner summary for the currently-loaded packages. */
        fun currentBannerSummary(): PackagesBannerSummary {
            val loaded = packages ?: return PackagesBannerSummary(0, 0, 0)
            return summarize(loaded, clock())
        }

        private fun applySuccess(loaded: List<PackageDto>) {
            packages = loaded
            _tabs.value = tabsWithCounts(loaded)
            renderForCurrentTab(loaded)
        }

        private fun renderForCurrentTab(loaded: List<PackageDto>) {
            val tab = PackagesTab.fromId(_selectedTab.value)
            val active = loaded.filter { passes(it, tab) }
            if (active.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Package,
                        headline = emptyHeadline(tab),
                        subcopy = emptySubcopy(tab),
                        ctaTitle = "Log a package",
                        onCta = { onLogPackage() },
                    )
                return
            }
            val rows = active.map { rowFor(it) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "packages", rows = rows)),
                    hasMore = false,
                )
            _banner.value = bannerFor(tab, loaded, clock())
        }

        private fun bannerFor(
            tab: PackagesTab,
            loaded: List<PackageDto>,
            now: Instant,
        ): BannerConfig? {
            if (tab != PackagesTab.Expected) return null
            val summary = summarize(loaded, now)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.Package,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: PackagesBannerSummary): String {
            val inflight = summary.inFlightCount
            val today = summary.arrivingTodayCount
            val word = if (inflight == 1) "package in flight" else "packages in flight"
            return if (today > 0) {
                "$inflight $word · $today arriving today"
            } else {
                "$inflight $word"
            }
        }

        private fun bannerSubtitle(summary: PackagesBannerSummary): String? {
            if (summary.exceptionCount > 0) {
                val count = summary.exceptionCount
                return if (count == 1) {
                    "1 needs attention · address or signature"
                } else {
                    "$count need attention · address or signature"
                }
            }
            return "All on schedule"
        }

        private fun rowFor(pkg: PackageDto): RowModel {
            val projection = project(pkg, currentUserId, memberLookup)
            return RowModel(
                id = pkg.id,
                title = projection.title,
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = projection.courier.icon,
                        background = projection.courier.background,
                        foreground = projection.courier.foreground,
                    ),
                trailing =
                    RowTrailing.Status(
                        text = projection.chipText,
                        variant = projection.chipVariant,
                    ),
                onTap = { onOpenPackage(pkg.id) },
                body = projection.body,
                highlight = projection.highlight,
            )
        }

        private fun passes(
            pkg: PackageDto,
            tab: PackagesTab,
        ): Boolean = PackageChipStatus.from(pkg.status).tab == tab

        private fun tabsWithCounts(loaded: List<PackageDto>): List<ListOfRowsTab> {
            val counts = countsOf(loaded)
            return listOf(
                ListOfRowsTab(PackagesTab.Expected.id, "Expected", counts.expected),
                ListOfRowsTab(PackagesTab.Delivered.id, "Delivered", counts.delivered),
                ListOfRowsTab(PackagesTab.Archived.id, "Archived", counts.archived),
            )
        }

        private fun countsOf(loaded: List<PackageDto>): PackagesTabCounts {
            var expected = 0
            var delivered = 0
            var archived = 0
            for (pkg in loaded) {
                when (PackageChipStatus.from(pkg.status).tab) {
                    PackagesTab.Expected -> expected += 1
                    PackagesTab.Delivered -> delivered += 1
                    PackagesTab.Archived -> archived += 1
                }
            }
            return PackagesTabCounts(expected, delivered, archived)
        }

        private fun initialTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(PackagesTab.Expected.id, "Expected"),
                ListOfRowsTab(PackagesTab.Delivered.id, "Delivered"),
                ListOfRowsTab(PackagesTab.Archived.id, "Archived"),
            )

        private fun emptyHeadline(tab: PackagesTab): String =
            when (tab) {
                PackagesTab.Expected -> "No packages tracked yet"
                PackagesTab.Delivered -> "No delivered packages"
                PackagesTab.Archived -> "No archived packages"
            }

        private fun emptySubcopy(tab: PackagesTab): String =
            when (tab) {
                PackagesTab.Expected ->
                    "Log incoming deliveries so the household can see what's arriving — " +
                        "tracking, drop instructions, and who it's for."
                PackagesTab.Delivered ->
                    "Delivered packages show up here once a carrier marks them dropped off."
                PackagesTab.Archived ->
                    "Returned or missing packages move to Archived after their lifecycle closes."
            }

        companion object {
            /** Pure mapping from a package + viewer context to display
             *  strings. Exposed for tests. */
            @JvmStatic
            fun project(
                pkg: PackageDto,
                currentUserId: String?,
                memberLookup: (String) -> String?,
            ): PackageRowProjection {
                val courier = CourierKind.from(pkg.carrier)
                val status = PackageChipStatus.from(pkg.status)

                val title: String =
                    pkg.description?.trim()?.takeIf { it.isNotEmpty() }
                        ?: pkg.trackingNumber?.trim()?.takeIf { it.isNotEmpty() }
                            ?.let { "Tracking #${shortTracking(it)}" }
                        ?: "Package"

                val drop = pkg.deliveryInstructions?.trim()?.takeIf { it.isNotEmpty() }
                val subtitleParts = listOfNotNull(courier.label, drop)
                val subtitle: String? =
                    if (subtitleParts.isEmpty()) null else subtitleParts.joinToString(" · ")

                val body: String? =
                    pkg.pickedUpBy
                        ?.takeIf { it.isNotEmpty() && it != currentUserId }
                        ?.let { id ->
                            memberLookup(id)?.trim()?.takeIf { it.isNotEmpty() }
                        }?.let { label ->
                            if (status == PackageChipStatus.PickedUp) {
                                "Picked up by $label"
                            } else {
                                "For $label"
                            }
                        }

                val highlight: RowHighlight? =
                    if (status == PackageChipStatus.Returned) RowHighlight.Muted else null

                return PackageRowProjection(
                    title = title,
                    subtitle = subtitle,
                    body = body,
                    chipText = status.label,
                    chipVariant = status.chipVariant,
                    chipIcon = status.chipIcon,
                    status = status,
                    courier = courier,
                    highlight = highlight,
                )
            }

            /** Banner projection. Exposed for tests. */
            @JvmStatic
            fun summarize(
                packages: List<PackageDto>,
                now: Instant,
            ): PackagesBannerSummary {
                var inFlight = 0
                var arrivingToday = 0
                var exception = 0
                val zone = ZoneId.of("UTC")
                val today = now.atZone(zone).toLocalDate()
                for (pkg in packages) {
                    val status = PackageChipStatus.from(pkg.status)
                    if (status.isInFlight) {
                        inFlight += 1
                        val expectedDay =
                            pkg.expectedAt?.let(::parseInstant)?.atZone(zone)?.toLocalDate()
                        if (expectedDay != null && expectedDay == today) {
                            arrivingToday += 1
                        }
                    }
                    if (status == PackageChipStatus.Lost) exception += 1
                }
                return PackagesBannerSummary(
                    inFlightCount = inFlight,
                    arrivingTodayCount = arrivingToday,
                    exceptionCount = exception,
                )
            }

            @JvmStatic
            fun shortTracking(raw: String): String {
                val stripped = raw.replace(" ", "")
                if (stripped.length <= 8) return raw
                return "…" + stripped.substring(stripped.length - 7)
            }

            internal fun parseInstant(iso: String): Instant? =
                runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        DateTimeFormatter
                            .ofPattern("yyyy-MM-dd")
                            .parse(iso, java.time.LocalDate::from)
                            .atStartOfDay(ZoneId.of("UTC"))
                            .toInstant()
                    }.getOrNull()
        }
    }
