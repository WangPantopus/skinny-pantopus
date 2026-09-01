@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
    "ReturnCount",
    "TooGenericExceptionCaught",
)

package app.pantopus.android.ui.screens.my_tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.MyGigDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.offers.OffersCategory
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilter
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivitySortOrder
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.Bidder
import app.pantopus.android.ui.screens.shared.list_of_rows.BidderStackData
import app.pantopus.android.ui.screens.shared.list_of_rows.BidderTone
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject
import kotlin.math.ceil

/** Stable tab ids exposed for tests + the screen. */
object MyTasksTab {
    const val OPEN = "open"
    const val ACTIVE = "active"
    const val DONE = "done"
    const val CLOSED = "closed"
}

/**
 * Nine design statuses the chip row renders. Derived from
 * `(gig.status, bid_count, deadline, scheduled_start)` by
 * [MyTasksViewModel.derivedStatus].
 */
sealed class MyTasksStatus {
    abstract val label: String
    abstract val icon: PantopusIcon
    abstract val chipVariant: StatusChipVariant

    data object Reviewing : MyTasksStatus() {
        override val label = "Reviewing bids"
        override val icon = PantopusIcon.Inbox
        override val chipVariant = StatusChipVariant.Info
    }

    data class Urgent(val hoursLeft: Int) : MyTasksStatus() {
        override val label = "Closes in ${hoursLeft}h"
        override val icon = PantopusIcon.Timer
        override val chipVariant = StatusChipVariant.ErrorVariant
    }

    data object NoBids : MyTasksStatus() {
        override val label = "No bids yet"
        override val icon = PantopusIcon.CircleSlash
        override val chipVariant = StatusChipVariant.Neutral
    }

    data object InProgress : MyTasksStatus() {
        override val label = "In progress"
        override val icon = PantopusIcon.Play
        override val chipVariant = StatusChipVariant.Success
    }

    data class Scheduled(val weekday: String) : MyTasksStatus() {
        override val label = "Starts $weekday"
        override val icon = PantopusIcon.Calendar
        override val chipVariant = StatusChipVariant.Info
    }

    data object AwaitReview : MyTasksStatus() {
        override val label = "Leave a review"
        override val icon = PantopusIcon.Star
        override val chipVariant = StatusChipVariant.Info
    }

    data object Completed : MyTasksStatus() {
        override val label = "Completed"
        override val icon = PantopusIcon.CheckCheck
        override val chipVariant = StatusChipVariant.Success
    }

    data object Cancelled : MyTasksStatus() {
        override val label = "Cancelled"
        override val icon = PantopusIcon.X
        override val chipVariant = StatusChipVariant.Neutral
    }

    data object Expired : MyTasksStatus() {
        override val label = "Expired"
        override val icon = PantopusIcon.Ban
        override val chipVariant = StatusChipVariant.Neutral
    }

    companion object {
        /** Window inside which an open-tab chip flips to "Closes in Xh". */
        const val URGENT_WINDOW_SECONDS: Long = 4 * 60 * 60
    }
}

/**
 * T6.0b — Magic Task archetype taxonomy. Maps the backend's
 * `task_archetype` enum to the design's row chrome — uppercase
 * overline label, leading-tile icon, and the two-stop gradient used to
 * tint the tile background. Mirrors iOS [MyTasksArchetype].
 */
enum class MyTasksArchetype(val wireValue: String) {
    QuickHelp("quick_help"),
    DeliveryErrand("delivery_errand"),
    HomeService("home_service"),
    ProServiceQuote("pro_service_quote"),
    CareTask("care_task"),
    EventShift("event_shift"),
    RemoteTask("remote_task"),
    RecurringService("recurring_service"),
    General("general"),
    ;

    val overlineLabel: String
        get() =
            when (this) {
                QuickHelp -> "Quick help"
                DeliveryErrand -> "Delivery"
                HomeService -> "Mount & install"
                ProServiceQuote -> "Pro service"
                CareTask -> "Pet care"
                EventShift -> "Event help"
                RemoteTask -> "Tech support"
                RecurringService -> "Recurring"
                General -> "Magic task"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                QuickHelp -> PantopusIcon.Sparkles
                DeliveryErrand -> PantopusIcon.Package
                HomeService -> PantopusIcon.Tv
                ProServiceQuote -> PantopusIcon.Hammer
                CareTask -> PantopusIcon.Dog
                EventShift -> PantopusIcon.Calendar
                RemoteTask -> PantopusIcon.Laptop
                RecurringService -> PantopusIcon.ArrowsRepeat
                General -> PantopusIcon.ClipboardList
            }

    fun gradient(): GradientPair =
        when (this) {
            QuickHelp -> GradientPair(PantopusColors.primary400, PantopusColors.primary700)
            DeliveryErrand -> GradientPair(PantopusColors.business, PantopusColors.magic)
            HomeService -> GradientPair(PantopusColors.primary400, PantopusColors.primary700)
            ProServiceQuote -> GradientPair(PantopusColors.warning, PantopusColors.warning)
            CareTask -> GradientPair(PantopusColors.success, PantopusColors.success)
            EventShift -> GradientPair(PantopusColors.error, PantopusColors.error)
            RemoteTask -> GradientPair(PantopusColors.primary500, PantopusColors.primary800)
            RecurringService -> GradientPair(PantopusColors.primary600, PantopusColors.primary800)
            General -> GradientPair(PantopusColors.magicBorder, PantopusColors.magic)
        }

    companion object {
        fun fromRaw(raw: String?): MyTasksArchetype {
            val key = raw?.lowercase(Locale.ROOT).orEmpty()
            if (key.isEmpty()) return General
            return entries.firstOrNull { it.wireValue == key } ?: General
        }
    }
}

/**
 * T6.0b — Helper-engagement format taxonomy. Per T6 Q13 the design's
 * `engagement_mode` concept is renamed `task_format` on the backend.
 * Drives the neutral-tinted badge that sits flush after the status
 * chip on a My tasks V2 row.
 */
enum class MyTasksFormat(val wireValue: String) {
    InPerson("in_person"),
    DropOff("drop_off"),
    Remote("remote"),
    Hybrid("hybrid"),
    ;

    val label: String
        get() =
            when (this) {
                InPerson -> "In person"
                DropOff -> "Drop-off"
                Remote -> "Remote"
                Hybrid -> "Hybrid"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                InPerson -> PantopusIcon.MapPin
                DropOff -> PantopusIcon.Package
                Remote -> PantopusIcon.Monitor
                Hybrid -> PantopusIcon.Shuffle
            }

    companion object {
        fun fromRaw(raw: String?): MyTasksFormat? {
            val key = raw?.lowercase(Locale.ROOT).orEmpty()
            if (key.isEmpty()) return null
            return entries.firstOrNull { it.wireValue == key }
        }
    }
}

/** True when a gig was posted via the Magic Task flow. Mirrors iOS isMagicTask(). */
fun isMagicTask(dto: MyGigDto): Boolean = (dto.sourceFlow ?: "").lowercase(Locale.ROOT) == "magic"

/** Footer archetype per the design's `actions` prop. */
sealed class MyTasksFooter {
    data class Open(val bidCount: Int) : MyTasksFooter()

    data class Urgent(val bidCount: Int) : MyTasksFooter()

    data object Boost : MyTasksFooter()

    data object InProgress : MyTasksFooter()

    data object Review : MyTasksFooter()

    data object Repost : MyTasksFooter()

    data object None : MyTasksFooter()
}

/**
 * T5.3.2 — My tasks V2. Drives the screen against the shared
 * [ListOfRowsScreen] archetype. See header comment in the iOS
 * counterpart (MyTasksViewModel.swift) for the mapping tables.
 */
@HiltViewModel
class MyTasksViewModel
    @Inject
    constructor(
        private val gigsRepo: GigsRepository,
    ) : ViewModel() {
        private var gigs: List<MyGigDto> = emptyList()
        private var loadedAtLeastOnce = false
        private var nowProvider: () -> Instant = { Instant.now() }

        private var openTaskHandler: (MyGigDto) -> Unit = {}
        private var openBidsHandler: (MyGigDto) -> Unit = {}
        private var editTaskHandler: (MyGigDto) -> Unit = {}
        private var messageWorkerHandler: (MyGigDto) -> Unit = {}
        private var leaveReviewHandler: (MyGigDto) -> Unit = {}
        private var postTaskHandler: () -> Unit = {}
        private var repostHandler: (MyGigDto) -> Unit = {}

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(MyTasksTab.OPEN)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(defaultTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(
                TopBarAction(
                    icon = PantopusIcon.Filter,
                    contentDescription = "Filter tasks",
                    onClick = { openFilterSheet() },
                ),
            )
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        // Activity filter (P5.4)
        private val _showFilterSheet = MutableStateFlow(false)
        val showFilterSheet: StateFlow<Boolean> = _showFilterSheet.asStateFlow()

        private val _activityFilter = MutableStateFlow(ActivityFilter())
        val activityFilter: StateFlow<ActivityFilter> = _activityFilter.asStateFlow()

        /** Section header for the status chips in the sheet. */
        val statusFilterTitle = "Task status"

        /** Per-surface status chips (the four task lifecycle buckets). */
        val statusFilterOptions =
            listOf(
                FilterOption("open", "Open"),
                FilterOption("in_progress", "In progress"),
                FilterOption("done", "Done"),
                FilterOption("closed", "Closed"),
            )

        /** Tasks carry a budget, so the full sort set applies. */
        val sortFilterOptions = ActivitySortOrder.ALL

        fun openFilterSheet() {
            _showFilterSheet.value = true
        }

        fun dismissFilterSheet() {
            _showFilterSheet.value = false
        }

        fun applyFilter(filter: ActivityFilter) {
            _activityFilter.value = filter
            applyState()
        }

        private val _fab =
            MutableStateFlow<FabAction?>(
                FabAction(
                    icon = PantopusIcon.Plus,
                    contentDescription = "Post a task with Magic Task",
                    variant = FabVariant.MagicCreate,
                    onClick = { postTaskHandler() },
                ),
            )
        val fab: StateFlow<FabAction?> = _fab.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        /**
         * Wire in the navigation callbacks before [load]. Same pattern
         * as MyBids — the screen composable owns the NavController and
         * calls this once.
         */
        fun bindCallbacks(
            onOpenTask: (MyGigDto) -> Unit,
            onOpenBids: (MyGigDto) -> Unit,
            onEditTask: (MyGigDto) -> Unit,
            onMessageWorker: (MyGigDto) -> Unit,
            onLeaveReview: (MyGigDto) -> Unit,
            onPostTask: () -> Unit,
            onRepost: (MyGigDto) -> Unit,
        ) {
            openTaskHandler = onOpenTask
            openBidsHandler = onOpenBids
            editTaskHandler = onEditTask
            messageWorkerHandler = onMessageWorker
            leaveReviewHandler = onLeaveReview
            postTaskHandler = onPostTask
            repostHandler = onRepost
            _fab.value =
                FabAction(
                    icon = PantopusIcon.Plus,
                    contentDescription = "Post a task with Magic Task",
                    variant = FabVariant.MagicCreate,
                    onClick = { postTaskHandler() },
                )
        }

        /** Test hook — override the clock for deterministic time-window verdicts. */
        internal fun overrideNow(provider: () -> Instant) {
            nowProvider = provider
        }

        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && loadedAtLeastOnce) return
            reload()
        }

        fun refresh() = reload()

        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            applyState()
        }

        fun loadMoreIfNeeded() = Unit

        private fun reload() {
            if (!loadedAtLeastOnce) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = gigsRepo.myGigs()) {
                    is NetworkResult.Success -> {
                        gigs = result.data.gigs
                        loadedAtLeastOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedAtLeastOnce) {
                            _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                        }
                    }
                }
            }
        }

        private fun applyState() {
            val now = nowProvider()
            val projections =
                gigs.map { dto ->
                    val status = derivedStatus(dto, now)
                    val tab = tabFor(status)
                    GigProjection(
                        dto = dto,
                        tab = tab,
                        status = status,
                        footer = footerFor(status, dto.bidCount ?: 0),
                    )
                }
            val counts = tabCounts(projections, now)
            _tabs.value =
                listOf(
                    ListOfRowsTab(id = MyTasksTab.OPEN, label = "Open", count = counts.open),
                    ListOfRowsTab(id = MyTasksTab.ACTIVE, label = "Active", count = counts.active),
                    ListOfRowsTab(id = MyTasksTab.DONE, label = "Done", count = counts.done),
                    ListOfRowsTab(id = MyTasksTab.CLOSED, label = "Closed", count = counts.closed),
                )
            _banner.value = bannerFor(_selectedTab.value, counts)

            val tabItems = projections.filter { it.tab == _selectedTab.value }
            val visible =
                _activityFilter.value.apply(
                    items = tabItems,
                    now = now,
                    statusId = { statusFilterId(it.status) },
                    date = { parseInstant(it.dto.createdAt) },
                    value = { it.dto.price },
                )
            if (visible.isEmpty()) {
                _state.value =
                    if (_activityFilter.value.isActive && tabItems.isNotEmpty()) {
                        filteredEmptyState()
                    } else {
                        emptyStateFor(_selectedTab.value)
                    }
                return
            }
            val rows = visible.map { row(it, now) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = _selectedTab.value, rows = rows)),
                    hasMore = false,
                )
        }

        private fun filteredEmptyState(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.Filter,
                headline = "No tasks match your filters",
                subcopy =
                    "Try a different status, date range, or sort — or clear " +
                        "your filters to see everything in this tab.",
                ctaTitle = "Clear filters",
                onCta = { applyFilter(ActivityFilter()) },
            )

        private fun emptyStateFor(tab: String): ListOfRowsUiState.Empty =
            when (tab) {
                MyTasksTab.OPEN ->
                    // T6.0b — Magic Task primary CTA. The shell's
                    // EmptyState renders the headline + body + single
                    // primary button; the FAB stays visible below for
                    // the manual-post fallback.
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ClipboardList,
                        headline = "No tasks posted yet — try Magic Task",
                        subcopy =
                            "Describe what you need in a sentence. Magic Task " +
                                "drafts the title, budget, and schedule — you just " +
                                "confirm and post.",
                        ctaTitle = "Try Magic Task",
                        onCta = { postTaskHandler() },
                    )
                MyTasksTab.ACTIVE ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Play,
                        headline = "No active tasks",
                        subcopy =
                            "Tasks you've assigned to a helper will show up here " +
                                "while the work is in progress.",
                        ctaTitle = null,
                        onCta = null,
                    )
                MyTasksTab.DONE ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCheck,
                        headline = "No completed tasks yet",
                        subcopy = "Finished tasks land here so you can leave reviews.",
                        ctaTitle = null,
                        onCta = null,
                    )
                MyTasksTab.CLOSED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Ban,
                        headline = "Nothing here",
                        subcopy = "Cancelled or expired tasks will land here.",
                        ctaTitle = null,
                        onCta = null,
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ClipboardList,
                        headline = "Nothing here",
                        subcopy = "",
                        ctaTitle = null,
                        onCta = null,
                    )
            }

        // MARK: - Mutations

        fun boost(dto: MyGigDto) {
            val index = gigs.indexOfFirst { it.id == dto.id }
            if (index < 0) return
            val previous = gigs
            gigs = gigs.toMutableList().also { it[index] = boostedCopy(gigs[index], nowProvider()) }
            applyState()
            viewModelScope.launch {
                when (gigsRepo.boostGig(dto.id)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        gigs = previous
                        applyState()
                    }
                }
            }
        }

        fun markComplete(dto: MyGigDto) {
            val index = gigs.indexOfFirst { it.id == dto.id }
            if (index < 0) return
            val previous = gigs
            gigs = gigs.toMutableList().also { it[index] = completedCopy(gigs[index]) }
            applyState()
            viewModelScope.launch {
                when (gigsRepo.completeGigAsPoster(dto.id)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        gigs = previous
                        applyState()
                    }
                }
            }
        }

        // MARK: - Pure projections (test surface)

        data class GigProjection(
            val dto: MyGigDto,
            val tab: String,
            val status: MyTasksStatus,
            val footer: MyTasksFooter,
        )

        data class TabCounts(
            val open: Int = 0,
            val active: Int = 0,
            val done: Int = 0,
            val closed: Int = 0,
            val openTotal: Int = 0,
            val newBidsToday: Int = 0,
            val closingSoon: Int = 0,
        )

        private fun row(
            projection: GigProjection,
            now: Instant,
        ): RowModel {
            val dto = projection.dto
            val category = OffersCategory.fromRaw(dto.category)
            val budget = formatBudget(dto.price, dto.payType)
            val title = dto.title.takeIf { it.isNotBlank() } ?: "Untitled task"
            val isMagic = isMagicTask(dto)
            val archetype = MyTasksArchetype.fromRaw(dto.taskArchetype)

            val statusChip =
                RowChip(
                    text = projection.status.label,
                    icon = projection.status.icon,
                    tint = RowChip.Tint.Status(projection.status.chipVariant),
                )
            val chips =
                buildList {
                    add(statusChip)
                    MyTasksFormat.fromRaw(dto.taskFormat)?.let { add(modeChip(it)) }
                }

            // Magic Task rows use the new sparkles-disc tile + lavender
            // gradient + uppercase overline. Non-magic rows keep the
            // existing 40dp category gradient icon for back-compat.
            val leading: RowLeading =
                if (isMagic) {
                    RowLeading.MagicArchetypeTile(
                        icon = archetype.icon,
                        gradient = archetype.gradient(),
                    )
                } else {
                    RowLeading.CategoryGradientIcon(
                        icon = category.icon,
                        gradient = category.gradient(),
                    )
                }
            val overline: String? = if (isMagic) archetype.overlineLabel else null

            return RowModel(
                id = dto.id,
                title = title,
                subtitle = subtitle(dto, now, projection.status),
                template = RowTemplate.StatusChip,
                leading = leading,
                trailing = RowTrailing.PriceStack(amount = budget, sublabel = null),
                onTap = { openTaskHandler(dto) },
                chips = chips,
                highlight = highlight(projection.status),
                footer = footer(projection.footer, dto),
                bidderStack = bidderStack(dto),
                archetypeOverline = overline,
            )
        }

        /**
         * Neutral-tinted chip rendering for the engagement-mode badge.
         * Distinct shape/tint from the status chip so it reads as a task
         * PROPERTY rather than a state.
         */
        @Suppress("MemberVisibilityCanBePrivate")
        fun modeChip(format: MyTasksFormat): RowChip =
            RowChip(
                text = format.label,
                icon = format.icon,
                tint =
                    RowChip.Tint.Custom(
                        background = PantopusColors.appSurface,
                        foreground = PantopusColors.appTextStrong,
                    ),
            )

        private fun footer(
            variant: MyTasksFooter,
            dto: MyGigDto,
        ): RowFooter? =
            when (variant) {
                is MyTasksFooter.None -> null
                is MyTasksFooter.Open ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Edit",
                                    icon = PantopusIcon.Pencil,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { editTaskHandler(dto) },
                                ),
                                RowFooterAction(
                                    title = if (variant.bidCount > 0) "Review ${variant.bidCount} bids" else "Review bids",
                                    icon = PantopusIcon.Inbox,
                                    variant = CompactButtonVariant.Primary,
                                    flex = 2,
                                    onClick = { openBidsHandler(dto) },
                                ),
                            ),
                    )
                is MyTasksFooter.Urgent ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Extend 24h",
                                    icon = PantopusIcon.ClockPlus,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { editTaskHandler(dto) },
                                ),
                                RowFooterAction(
                                    title = if (variant.bidCount > 0) "Review ${variant.bidCount} bids" else "Review bids",
                                    icon = PantopusIcon.Inbox,
                                    variant = CompactButtonVariant.Primary,
                                    flex = 2,
                                    onClick = { openBidsHandler(dto) },
                                ),
                            ),
                    )
                is MyTasksFooter.Boost ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Edit details",
                                    icon = PantopusIcon.Pencil,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { editTaskHandler(dto) },
                                ),
                                RowFooterAction(
                                    title = "Boost in feed",
                                    icon = PantopusIcon.Rocket,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { boost(dto) },
                                ),
                            ),
                    )
                is MyTasksFooter.InProgress ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Message",
                                    icon = PantopusIcon.MessageCircle,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { messageWorkerHandler(dto) },
                                ),
                                RowFooterAction(
                                    title = "Mark complete",
                                    icon = PantopusIcon.CheckCheck,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { markComplete(dto) },
                                ),
                            ),
                    )
                is MyTasksFooter.Review ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Leave a review",
                                    icon = PantopusIcon.Star,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { leaveReviewHandler(dto) },
                                ),
                            ),
                    )
                is MyTasksFooter.Repost ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Repost task",
                                    icon = PantopusIcon.ArrowsRepeat,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { repostHandler(dto) },
                                ),
                            ),
                    )
            }

        private fun bannerFor(
            tab: String,
            counts: TabCounts,
        ): BannerConfig? {
            if (tab != MyTasksTab.OPEN) return null
            if (counts.openTotal == 0) return null
            val title =
                if (counts.newBidsToday > 0) {
                    val bidWord = if (counts.newBidsToday == 1) "bid" else "bids"
                    "${counts.newBidsToday} new $bidWord since yesterday"
                } else {
                    val taskWord = if (counts.openTotal == 1) "task" else "tasks"
                    "${counts.openTotal} open $taskWord"
                }
            val subtitle =
                if (counts.closingSoon > 0) {
                    "${counts.closingSoon} closing in the next 24h"
                } else {
                    null
                }
            return BannerConfig(
                icon = PantopusIcon.Inbox,
                title = title,
                subtitle = subtitle,
                onTap = null,
            )
        }

        private fun defaultTabs() =
            listOf(
                ListOfRowsTab(id = MyTasksTab.OPEN, label = "Open", count = 0),
                ListOfRowsTab(id = MyTasksTab.ACTIVE, label = "Active", count = 0),
                ListOfRowsTab(id = MyTasksTab.DONE, label = "Done", count = 0),
                ListOfRowsTab(id = MyTasksTab.CLOSED, label = "Closed", count = 0),
            )

        companion object {
            fun tabFor(status: MyTasksStatus): String =
                when (status) {
                    is MyTasksStatus.Reviewing, is MyTasksStatus.Urgent, is MyTasksStatus.NoBids -> MyTasksTab.OPEN
                    is MyTasksStatus.InProgress, is MyTasksStatus.Scheduled -> MyTasksTab.ACTIVE
                    is MyTasksStatus.Completed, is MyTasksStatus.AwaitReview -> MyTasksTab.DONE
                    is MyTasksStatus.Cancelled, is MyTasksStatus.Expired -> MyTasksTab.CLOSED
                }

            fun derivedStatus(
                dto: MyGigDto,
                now: Instant,
            ): MyTasksStatus {
                val gigStatus = (dto.status ?: "").lowercase(Locale.ROOT)
                return when (gigStatus) {
                    "cancelled" -> MyTasksStatus.Cancelled
                    "completed" -> MyTasksStatus.AwaitReview
                    "in_progress" -> MyTasksStatus.InProgress
                    "assigned" -> {
                        val scheduled = parseInstant(dto.scheduledStart)
                        if (scheduled != null && scheduled.isAfter(now)) {
                            MyTasksStatus.Scheduled(formatWeekday(scheduled))
                        } else {
                            MyTasksStatus.InProgress
                        }
                    }
                    "open" -> openStatus(dto, now)
                    else -> MyTasksStatus.Reviewing
                }
            }

            private fun openStatus(
                dto: MyGigDto,
                now: Instant,
            ): MyTasksStatus {
                val deadline = parseInstant(dto.deadline)
                if (deadline != null) {
                    if (!deadline.isAfter(now)) {
                        return MyTasksStatus.Expired
                    }
                    val timeLeft = ChronoUnit.SECONDS.between(now, deadline)
                    if (timeLeft in 1 until MyTasksStatus.URGENT_WINDOW_SECONDS) {
                        val hours = maxOf(1, ceil(timeLeft / 3600.0).toInt())
                        return MyTasksStatus.Urgent(hours)
                    }
                }
                val bidCount = dto.bidCount ?: 0
                return if (bidCount == 0) MyTasksStatus.NoBids else MyTasksStatus.Reviewing
            }

            fun footerFor(
                status: MyTasksStatus,
                bidCount: Int,
            ): MyTasksFooter =
                when (status) {
                    is MyTasksStatus.Reviewing -> MyTasksFooter.Open(bidCount)
                    is MyTasksStatus.Urgent -> MyTasksFooter.Urgent(bidCount)
                    is MyTasksStatus.NoBids -> MyTasksFooter.Boost
                    is MyTasksStatus.InProgress, is MyTasksStatus.Scheduled -> MyTasksFooter.InProgress
                    is MyTasksStatus.AwaitReview -> MyTasksFooter.Review
                    is MyTasksStatus.Completed -> MyTasksFooter.None
                    is MyTasksStatus.Cancelled, is MyTasksStatus.Expired -> MyTasksFooter.Repost
                }

            /** Map a derived task status onto one of the four filter chip ids. */
            fun statusFilterId(status: MyTasksStatus): String =
                when (status) {
                    is MyTasksStatus.Reviewing, is MyTasksStatus.Urgent, is MyTasksStatus.NoBids -> "open"
                    is MyTasksStatus.InProgress, is MyTasksStatus.Scheduled -> "in_progress"
                    is MyTasksStatus.Completed, is MyTasksStatus.AwaitReview -> "done"
                    is MyTasksStatus.Cancelled, is MyTasksStatus.Expired -> "closed"
                }

            fun highlight(status: MyTasksStatus): RowHighlight? =
                when (status) {
                    is MyTasksStatus.Cancelled, is MyTasksStatus.Expired -> RowHighlight.Muted
                    else -> null
                }

            fun bidderStack(dto: MyGigDto): BidderStackData? {
                val topBidders = dto.topBidders ?: emptyList()
                if (topBidders.isEmpty()) return null
                val bidders =
                    topBidders.map { tb ->
                        Bidder(id = tb.id, initials = tb.initials, tone = tone(tb.color))
                    }
                val bidCount = dto.bidCount ?: 0
                val overflow = maxOf(0, bidCount - bidders.size)
                return BidderStackData(bidders = bidders, overflow = overflow)
            }

            fun tone(raw: String): BidderTone =
                when (raw.lowercase(Locale.ROOT)) {
                    "sky" -> BidderTone.Sky
                    "teal" -> BidderTone.Teal
                    "amber" -> BidderTone.Amber
                    "rose" -> BidderTone.Rose
                    "violet" -> BidderTone.Violet
                    else -> BidderTone.Slate
                }

            fun tabCounts(
                projections: List<GigProjection>,
                now: Instant,
            ): TabCounts {
                val yesterday = now.minus(24, ChronoUnit.HOURS)
                return projections.fold(TabCounts()) { acc, proj ->
                    val open = acc.open + if (proj.tab == MyTasksTab.OPEN) 1 else 0
                    val active = acc.active + if (proj.tab == MyTasksTab.ACTIVE) 1 else 0
                    val done = acc.done + if (proj.tab == MyTasksTab.DONE) 1 else 0
                    val closed = acc.closed + if (proj.tab == MyTasksTab.CLOSED) 1 else 0
                    val openTotal = acc.openTotal + if (proj.tab == MyTasksTab.OPEN) 1 else 0
                    val newBidsToday =
                        acc.newBidsToday +
                            if (proj.tab == MyTasksTab.OPEN) {
                                val updated = parseInstant(proj.dto.updatedAt)
                                if (updated != null && updated.isAfter(yesterday)) {
                                    proj.dto.bidCount ?: 0
                                } else {
                                    0
                                }
                            } else {
                                0
                            }
                    val closingSoon =
                        acc.closingSoon +
                            if (proj.tab == MyTasksTab.OPEN && isClosingSoon(proj.dto, now)) 1 else 0
                    TabCounts(open, active, done, closed, openTotal, newBidsToday, closingSoon)
                }
            }

            private fun isClosingSoon(
                dto: MyGigDto,
                now: Instant,
            ): Boolean {
                val deadline = parseInstant(dto.deadline) ?: return false
                val timeLeft = ChronoUnit.SECONDS.between(now, deadline)
                return timeLeft in 1 until (24 * 3600).toLong()
            }

            fun subtitle(
                dto: MyGigDto,
                now: Instant,
                status: MyTasksStatus,
            ): String {
                if (status is MyTasksStatus.InProgress && !dto.acceptedBy.isNullOrBlank()) {
                    val posted = formatRelativeTime(dto.createdAt, now)
                    return if (posted != null) "Helper assigned · $posted" else "Helper assigned"
                }
                val parts = mutableListOf<String>()
                formatRelativeTime(dto.createdAt, now)?.let { parts.add("Posted $it") }
                val bidCount = dto.bidCount ?: 0
                if (bidCount > 0) {
                    parts.add("$bidCount ${if (bidCount == 1) "bid" else "bids"}")
                    formatBidRange(dto.topBidAmount, dto.price)?.let { parts.add(it) }
                }
                return parts.joinToString(" · ")
            }

            fun formatBidRange(
                top: Double?,
                ask: Double?,
            ): String? {
                if (top == null || top <= 0) return null
                if (ask != null && ask > 0 && kotlin.math.abs(top - ask) > 0.01) {
                    val lo = kotlin.math.min(top, ask)
                    val hi = kotlin.math.max(top, ask)
                    return "$${formatAmount(lo)} – $${formatAmount(hi)}"
                }
                return "$${formatAmount(top)}"
            }

            fun formatBudget(
                price: Double?,
                payType: String?,
            ): String {
                if (price == null || price <= 0) return "—"
                val isHourly = (payType ?: "").lowercase(Locale.ROOT) == "hourly"
                return if (isHourly) "$${formatAmount(price)}/hr" else "$${formatAmount(price)}"
            }

            fun formatAmount(value: Double): String = "${kotlin.math.round(value).toInt()}"

            fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            fun formatWeekday(date: Instant): String =
                date.atZone(ZoneId.systemDefault()).dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US)

            fun formatRelativeTime(
                raw: String?,
                now: Instant,
            ): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, now)
                return when {
                    seconds < 60 -> "just now"
                    seconds < 3600 -> "${seconds / 60}m ago"
                    seconds < 86_400 -> "${seconds / 3600}h ago"
                    else -> {
                        val days = (seconds / 86_400).toInt()
                        when {
                            days == 1 -> "1d ago"
                            days < 7 -> "${days}d ago"
                            days < 30 -> "${days / 7}w ago"
                            else -> "${days / 30}mo ago"
                        }
                    }
                }
            }

            fun boostedCopy(
                dto: MyGigDto,
                now: Instant,
            ): MyGigDto {
                val expires = now.plus(24, ChronoUnit.HOURS)
                return dto.copy(
                    boostedAt = now.toString(),
                    boostExpiresAt = expires.toString(),
                    updatedAt = now.toString(),
                )
            }

            fun completedCopy(dto: MyGigDto): MyGigDto =
                dto.copy(
                    status = "completed",
                    updatedAt = Instant.now().toString(),
                )
        }
    }
