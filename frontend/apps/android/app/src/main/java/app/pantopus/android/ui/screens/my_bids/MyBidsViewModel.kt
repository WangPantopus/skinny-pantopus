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

package app.pantopus.android.ui.screens.my_bids

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.BidGigDto
import app.pantopus.android.data.api.models.offers.UpdateBidBody
import app.pantopus.android.data.api.models.offers.WithdrawBidReason
import app.pantopus.android.data.api.models.reviews.CreateReviewBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.data.reviews.ReviewsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.offers.OffersCategory
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilter
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivitySortOrder
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
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
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject
import kotlin.math.ceil

/** Stable tab ids exposed for tests + the screen. */
object MyBidsTab {
    const val ACTIVE = "active"
    const val ACCEPTED = "accepted"
    const val REJECTED = "rejected"
    const val DONE = "done"
}

/**
 * Eleven design statuses the chip row renders. Derived from
 * `(bid.status, gig.status, expires_at, shortlisted, your_rank,
 * top_price)` by [MyBidsViewModel.derivedStatus].
 */
sealed class MyBidsStatus {
    abstract val label: String
    abstract val icon: PantopusIcon
    abstract val chipVariant: StatusChipVariant

    data object TopBid : MyBidsStatus() {
        override val label = "Top bid"
        override val icon = PantopusIcon.Crown
        override val chipVariant = StatusChipVariant.Success
    }

    data object Shortlisted : MyBidsStatus() {
        override val label = "Shortlisted"
        override val icon = PantopusIcon.Star
        override val chipVariant = StatusChipVariant.Info
    }

    data object Pending : MyBidsStatus() {
        override val label = "Pending"
        override val icon = PantopusIcon.Hourglass
        override val chipVariant = StatusChipVariant.Neutral
    }

    data object Outbid : MyBidsStatus() {
        override val label = "Outbid"
        override val icon = PantopusIcon.TrendingDown
        override val chipVariant = StatusChipVariant.Warning
    }

    /** Phase 5 — the poster countered; the bidder must respond. */
    data class Countered(val amount: String) : MyBidsStatus() {
        override val label = "Countered $amount"
        override val icon = PantopusIcon.ArrowsRepeat
        override val chipVariant = StatusChipVariant.Warning
    }

    data class Expiring(val hoursLeft: Int) : MyBidsStatus() {
        override val label = "Closes in ${hoursLeft}h"
        override val icon = PantopusIcon.Timer
        override val chipVariant = StatusChipVariant.ErrorVariant
    }

    data object Accepted : MyBidsStatus() {
        override val label = "Accepted"
        override val icon = PantopusIcon.Check
        override val chipVariant = StatusChipVariant.Success
    }

    data class Scheduled(val weekday: String) : MyBidsStatus() {
        override val label = "Starts $weekday"
        override val icon = PantopusIcon.Calendar
        override val chipVariant = StatusChipVariant.Info
    }

    data object NotSelected : MyBidsStatus() {
        override val label = "Not selected"
        override val icon = PantopusIcon.X
        override val chipVariant = StatusChipVariant.Neutral
    }

    data object TaskCancelled : MyBidsStatus() {
        override val label = "Task cancelled"
        override val icon = PantopusIcon.Ban
        override val chipVariant = StatusChipVariant.Neutral
    }

    data class Paid(val amount: String) : MyBidsStatus() {
        override val label = "Paid · $amount"
        override val icon = PantopusIcon.CheckCheck
        override val chipVariant = StatusChipVariant.Success
    }

    data object LeaveReview : MyBidsStatus() {
        override val label = "Leave review"
        override val icon = PantopusIcon.Star
        override val chipVariant = StatusChipVariant.Info
    }

    companion object {
        /** Window inside which a pending bid flips to "Closes in Xh". */
        const val EXPIRING_WINDOW_SECONDS: Long = 4 * 60 * 60
    }
}

/** Footer archetype per the design's `actions` prop. */
sealed class MyBidsFooter {
    data object Edit : MyBidsFooter()

    data object Message : MyBidsFooter()

    data object Complete : MyBidsFooter()

    data class Review(val firstName: String) : MyBidsFooter()

    data object Rebid : MyBidsFooter()

    /** Phase 5 — pending counter from the poster: Accept / Decline. */
    data object CounterRespond : MyBidsFooter()

    data object None : MyBidsFooter()
}

/** Lightweight presentation contract for the "Withdraw bid" sheet. */
data class WithdrawSheetTarget(
    val id: String,
    val gigId: String,
    val gigTitle: String,
)

/** Transient toast pushed from the VM after a successful mutation. */
data class MyBidsToast(
    val text: String,
    val isError: Boolean = false,
)

/**
 * T5.3.1 — My bids. Drives the screen against the shared
 * [ListOfRowsScreen] archetype. See header comment in the iOS
 * counterpart (MyBidsViewModel.swift) for the mapping tables.
 */
@HiltViewModel
class MyBidsViewModel
    @Inject
    constructor(
        private val offersRepo: OffersRepository,
        private val gigsRepo: GigsRepository,
        private val reviewsRepo: ReviewsRepository,
    ) : ViewModel() {
        private var bids: List<BidDto> = emptyList()
        private var loadedAtLeastOnce = false
        private var nowProvider: () -> Instant = { Instant.now() }

        private var openBidHandler: (BidDto) -> Unit = {}
        private var browseTasksHandler: () -> Unit = {}
        private var messageClientHandler: (BidDto) -> Unit = {}

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(MyBidsTab.ACTIVE)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(defaultTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(
                TopBarAction(
                    icon = PantopusIcon.Filter,
                    contentDescription = "Filter bids",
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
        val statusFilterTitle = "Bid status"

        /** Per-surface status chips (coarse bid lifecycle buckets). */
        val statusFilterOptions =
            listOf(
                FilterOption("pending", "Pending"),
                FilterOption("accepted", "Accepted"),
                FilterOption("declined", "Declined"),
                FilterOption("completed", "Completed"),
            )

        /** Bids carry an amount, so the full sort set applies. */
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
                    icon = PantopusIcon.Compass,
                    contentDescription = "Browse tasks",
                    variant = FabVariant.ExtendedNav(label = "Browse tasks"),
                    onClick = { browseTasksHandler() },
                ),
            )
        val fab: StateFlow<FabAction?> = _fab.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private val _withdrawTarget = MutableStateFlow<WithdrawSheetTarget?>(null)
        val withdrawTarget: StateFlow<WithdrawSheetTarget?> = _withdrawTarget.asStateFlow()

        private val _editBidTarget = MutableStateFlow<EditBidSheetTarget?>(null)
        val editBidTarget: StateFlow<EditBidSheetTarget?> = _editBidTarget.asStateFlow()

        private val _leaveReviewTarget = MutableStateFlow<LeaveReviewSheetTarget?>(null)
        val leaveReviewTarget: StateFlow<LeaveReviewSheetTarget?> = _leaveReviewTarget.asStateFlow()

        private val _toast = MutableStateFlow<MyBidsToast?>(null)
        val toast: StateFlow<MyBidsToast?> = _toast.asStateFlow()

        /**
         * Wire in the navigation callbacks before [load]. Mirrors the
         * Offers / Connections pattern — the screen composable owns the
         * NavController and calls this once. Edit-bid and Leave-review
         * are sheet-presented locally (P3.4) so they're not in this
         * callback bundle.
         */
        fun bindCallbacks(
            onOpenBid: (BidDto) -> Unit,
            onBrowseTasks: () -> Unit,
            onMessageClient: (BidDto) -> Unit,
        ) {
            openBidHandler = onOpenBid
            browseTasksHandler = onBrowseTasks
            messageClientHandler = onMessageClient
            _fab.value =
                FabAction(
                    icon = PantopusIcon.Compass,
                    contentDescription = "Browse tasks",
                    variant = FabVariant.ExtendedNav(label = "Browse tasks"),
                    onClick = { browseTasksHandler() },
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
                when (val result = offersRepo.myBids()) {
                    is NetworkResult.Success -> {
                        bids = result.data.bids
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
                bids.map { dto ->
                    val tab = tabFor(dto, now)
                    val status = derivedStatus(dto, now)
                    BidProjection(
                        dto = dto,
                        tab = tab,
                        status = status,
                        footer = footerFor(dto, tab, status),
                    )
                }
            val counts = tabCounts(projections, now)
            _tabs.value =
                listOf(
                    ListOfRowsTab(id = MyBidsTab.ACTIVE, label = "Active", count = counts.active),
                    ListOfRowsTab(id = MyBidsTab.ACCEPTED, label = "Accepted", count = counts.accepted),
                    ListOfRowsTab(id = MyBidsTab.REJECTED, label = "Rejected", count = counts.rejected),
                    ListOfRowsTab(id = MyBidsTab.DONE, label = "Done", count = counts.done),
                )
            _banner.value = bannerFor(_selectedTab.value, counts)

            val tabItems = projections.filter { it.tab == _selectedTab.value }
            val visible =
                _activityFilter.value.apply(
                    items = tabItems,
                    now = now,
                    statusId = { statusFilterId(it.status) },
                    date = { parseInstant(it.dto.createdAt) },
                    value = { it.dto.bidAmount },
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
                headline = "No bids match your filters",
                subcopy =
                    "Try a different status, date range, or sort — or clear " +
                        "your filters to see everything in this tab.",
                ctaTitle = "Clear filters",
                onCta = { applyFilter(ActivityFilter()) },
            )

        private fun emptyStateFor(tab: String): ListOfRowsUiState.Empty =
            when (tab) {
                MyBidsTab.ACTIVE ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Gavel,
                        headline = "You haven’t bid on any tasks yet",
                        subcopy =
                            "Neighbors post small jobs here all the time — moves, " +
                                "mounts, dog walks, repairs. Place a bid and they’ll " +
                                "get back to you within a day or two.",
                        ctaTitle = "Browse tasks",
                        onCta = { browseTasksHandler() },
                    )
                MyBidsTab.ACCEPTED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Check,
                        headline = "No accepted bids yet",
                        subcopy =
                            "Bids the poster accepts will show up here so you can " +
                                "coordinate the work.",
                        ctaTitle = "Browse tasks",
                        onCta = { browseTasksHandler() },
                    )
                MyBidsTab.REJECTED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.X,
                        headline = "Nothing here",
                        subcopy = "Rejected, withdrawn, or expired bids will land here.",
                        ctaTitle = null,
                        onCta = null,
                    )
                MyBidsTab.DONE ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCheck,
                        headline = "No completed gigs yet",
                        subcopy = "Finished gigs and their reviews will show up here.",
                        ctaTitle = null,
                        onCta = null,
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Gavel,
                        headline = "Nothing here",
                        subcopy = "",
                        ctaTitle = null,
                        onCta = null,
                    )
            }

        // MARK: - Mutations

        fun requestWithdraw(dto: BidDto) {
            val gigId = dto.gigId ?: return
            _withdrawTarget.value =
                WithdrawSheetTarget(
                    id = dto.id,
                    gigId = gigId,
                    gigTitle = dto.gig?.title ?: "this task",
                )
        }

        fun cancelWithdraw() {
            _withdrawTarget.value = null
        }

        fun confirmWithdraw(reason: WithdrawBidReason?) {
            val target = _withdrawTarget.value ?: return
            _withdrawTarget.value = null
            val previous = bids
            val index = bids.indexOfFirst { it.id == target.id }
            if (index < 0) return
            bids = bids.toMutableList().also { it[index] = withdrawnCopy(bids[index], reason) }
            applyState()
            viewModelScope.launch {
                when (offersRepo.withdrawBid(target.gigId, target.id, reason?.wireValue)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        bids = previous
                        applyState()
                    }
                }
            }
        }

        // MARK: - Edit bid sheet

        /** Open the Edit Bid sheet pre-filled with the bid's current values. */
        fun requestEditBid(dto: BidDto) {
            val gigId = dto.gigId ?: return
            val (msg, terms) = splitMessageAndTerms(dto.message)
            _editBidTarget.value =
                EditBidSheetTarget(
                    id = dto.id,
                    gigId = gigId,
                    gigTitle = dto.gig?.title ?: "this task",
                    bidId = dto.id,
                    initialAmount = dto.bidAmount,
                    initialMessage = msg,
                    initialProposedTime = dto.proposedTime,
                    initialTerms = terms,
                )
        }

        /** Tear down the Edit Bid sheet without committing. */
        fun cancelEditBid() {
            _editBidTarget.value = null
        }

        /** Dismiss the toast (called by the screen after the auto-hide delay). */
        fun dismissToast() {
            _toast.value = null
        }

        /**
         * Submit the Edit Bid draft. Returns `true` on success — the
         * sheet uses this to self-dismiss. On success we also optimistically
         * mutate the cached bid so the row reflects the new amount without
         * a full refetch.
         */
        suspend fun submitEditBid(draft: EditBidDraft): Boolean {
            val target = _editBidTarget.value ?: return false
            val bidId = target.bidId ?: return false
            val body =
                UpdateBidBody(
                    bidAmount = draft.amount,
                    message = draft.message,
                    proposedTime = draft.proposedTime,
                )
            return when (val result = offersRepo.updateBid(target.gigId, bidId, body)) {
                is NetworkResult.Success -> {
                    val index = bids.indexOfFirst { it.id == bidId }
                    if (index >= 0) {
                        bids =
                            bids.toMutableList().also {
                                it[index] = updatedCopy(bids[index], draft)
                            }
                        applyState()
                    }
                    _editBidTarget.value = null
                    _toast.value = MyBidsToast(text = "Bid updated.")
                    true
                }
                is NetworkResult.Failure -> {
                    _toast.value =
                        MyBidsToast(
                            text = result.error.message.ifEmpty { "Couldn't update bid." },
                            isError = true,
                        )
                    false
                }
            }
        }

        // MARK: - Leave review sheet

        /**
         * Open the Leave Review sheet for the bid's gig. The reviewee is
         * the gig poster (worker → poster review after completion).
         */
        fun requestLeaveReview(dto: BidDto) {
            val gigId = dto.gigId ?: return
            val revieweeId = dto.gig?.userId ?: return
            _leaveReviewTarget.value =
                LeaveReviewSheetTarget(
                    id = dto.id,
                    gigId = gigId,
                    revieweeId = revieweeId,
                    gigTitle = dto.gig?.title ?: "this task",
                    revieweeName = null,
                )
        }

        /** Tear down the Leave Review sheet without committing. */
        fun cancelLeaveReview() {
            _leaveReviewTarget.value = null
        }

        /** Submit the review draft. Returns `true` on success. */
        suspend fun submitLeaveReview(draft: LeaveReviewDraft): Boolean {
            val target = _leaveReviewTarget.value ?: return false
            val body =
                CreateReviewBody(
                    gigId = target.gigId,
                    revieweeId = target.revieweeId,
                    rating = draft.rating,
                    comment = draft.comment,
                )
            return when (val result = reviewsRepo.create(body)) {
                is NetworkResult.Success -> {
                    _leaveReviewTarget.value = null
                    _toast.value = MyBidsToast(text = "Review submitted. Thanks!")
                    true
                }
                is NetworkResult.Failure -> {
                    _toast.value =
                        MyBidsToast(
                            text = result.error.message.ifEmpty { "Couldn't submit review." },
                            isError = true,
                        )
                    false
                }
            }
        }

        // MARK: - Phase 5 · counter responses (work item 2)

        /**
         * Bidder accepts the poster's counter — `POST
         * /api/gigs/:gigId/bids/:bidId/counter/accept`
         * (`backend/routes/gigs.js:5182`). Optimistic: the bid amount
         * becomes the counter amount and the row returns to Pending.
         */
        fun acceptCounter(dto: BidDto) {
            val gigId = dto.gigId ?: return
            val previous = bids
            val index = bids.indexOfFirst { it.id == dto.id }
            if (index < 0) return
            bids = bids.toMutableList().also { it[index] = counterAcceptedCopy(bids[index]) }
            applyState()
            viewModelScope.launch {
                when (val result = gigsRepo.acceptCounterOffer(gigId, dto.id)) {
                    is NetworkResult.Success -> _toast.value = MyBidsToast(text = "Counter accepted — new amount locked in.")
                    is NetworkResult.Failure -> {
                        bids = previous
                        applyState()
                        _toast.value =
                            MyBidsToast(
                                text = result.error.message.ifEmpty { "Couldn't accept the counter." },
                                isError = true,
                            )
                    }
                }
            }
        }

        /**
         * Bidder declines the poster's counter — `POST
         * /api/gigs/:gigId/bids/:bidId/counter/decline`
         * (`backend/routes/gigs.js:5260`). The original bid stands.
         */
        fun declineCounter(dto: BidDto) {
            val gigId = dto.gigId ?: return
            val previous = bids
            val index = bids.indexOfFirst { it.id == dto.id }
            if (index < 0) return
            bids = bids.toMutableList().also { it[index] = counterDeclinedCopy(bids[index]) }
            applyState()
            viewModelScope.launch {
                when (val result = gigsRepo.declineCounterOffer(gigId, dto.id)) {
                    is NetworkResult.Success -> _toast.value = MyBidsToast(text = "Counter declined — your bid stands.")
                    is NetworkResult.Failure -> {
                        bids = previous
                        applyState()
                        _toast.value =
                            MyBidsToast(
                                text = result.error.message.ifEmpty { "Couldn't decline the counter." },
                                isError = true,
                            )
                    }
                }
            }
        }

        fun markComplete(dto: BidDto) {
            val gigId = dto.gigId ?: return
            val previous = bids
            val index = bids.indexOfFirst { it.id == dto.id }
            if (index < 0) return
            bids = bids.toMutableList().also { it[index] = markedCompleteCopy(bids[index]) }
            applyState()
            viewModelScope.launch {
                when (gigsRepo.markCompleted(gigId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        bids = previous
                        applyState()
                    }
                }
            }
        }

        // MARK: - Pure projections (test surface)

        data class BidProjection(
            val dto: BidDto,
            val tab: String,
            val status: MyBidsStatus,
            val footer: MyBidsFooter,
        )

        data class TabCounts(
            val active: Int = 0,
            val accepted: Int = 0,
            val rejected: Int = 0,
            val done: Int = 0,
            val leading: Int = 0,
            val closingSoon: Int = 0,
        )

        private fun row(
            projection: BidProjection,
            now: Instant,
        ): RowModel {
            val dto = projection.dto
            val category = OffersCategory.fromRaw(dto.gig?.category)
            val amount = formatPrice(dto.bidAmount)
            val budget = formatBudgetSublabel(dto.gig?.price)
            val title = dto.gig?.title?.takeIf { it.isNotBlank() } ?: "Bid"
            return RowModel(
                id = dto.id,
                title = title,
                subtitle = subtitle(dto, now),
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.CategoryGradientIcon(
                        icon = category.icon,
                        gradient = category.gradient(),
                    ),
                trailing = RowTrailing.PriceStack(amount = amount, sublabel = budget),
                onTap = { openBidHandler(dto) },
                chips =
                    listOf(
                        RowChip(
                            text = projection.status.label,
                            icon = projection.status.icon,
                            tint = RowChip.Tint.Status(projection.status.chipVariant),
                        ),
                    ),
                metaTail = metaTail(dto, projection.status, now),
                highlight = highlight(projection),
                footer = footer(projection.footer, dto),
            )
        }

        private fun footer(
            variant: MyBidsFooter,
            dto: BidDto,
        ): RowFooter? =
            when (variant) {
                is MyBidsFooter.None -> null
                is MyBidsFooter.Edit ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Withdraw",
                                    icon = PantopusIcon.X,
                                    variant = CompactButtonVariant.Destructive,
                                    onClick = { requestWithdraw(dto) },
                                ),
                                RowFooterAction(
                                    title = "Edit bid",
                                    icon = PantopusIcon.Pencil,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { requestEditBid(dto) },
                                ),
                            ),
                    )
                is MyBidsFooter.Message ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "View details",
                                    icon = PantopusIcon.FileText,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { openBidHandler(dto) },
                                ),
                                RowFooterAction(
                                    title = "Message client",
                                    icon = PantopusIcon.MessageCircle,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { messageClientHandler(dto) },
                                ),
                            ),
                    )
                is MyBidsFooter.Complete ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Message",
                                    icon = PantopusIcon.MessageCircle,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { messageClientHandler(dto) },
                                ),
                                RowFooterAction(
                                    title = "Mark complete",
                                    icon = PantopusIcon.CheckCheck,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { markComplete(dto) },
                                ),
                            ),
                    )
                is MyBidsFooter.Review -> {
                    val title =
                        if (variant.firstName.isBlank()) {
                            "Leave a review"
                        } else {
                            "Leave a review for ${variant.firstName}"
                        }
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = title,
                                    icon = PantopusIcon.Star,
                                    variant = CompactButtonVariant.Primary,
                                    onClick = { requestLeaveReview(dto) },
                                ),
                            ),
                    )
                }
                is MyBidsFooter.Rebid ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Bid on similar",
                                    icon = PantopusIcon.ArrowsRepeat,
                                    variant = CompactButtonVariant.Ghost,
                                    onClick = { browseTasksHandler() },
                                ),
                            ),
                    )
                is MyBidsFooter.CounterRespond ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Decline counter",
                                    icon = PantopusIcon.X,
                                    variant = CompactButtonVariant.Destructive,
                                    testTag = "myBids.counter_${dto.id}.decline",
                                    onClick = { declineCounter(dto) },
                                ),
                                RowFooterAction(
                                    title = "Accept counter",
                                    icon = PantopusIcon.Check,
                                    variant = CompactButtonVariant.Primary,
                                    testTag = "myBids.counter_${dto.id}.accept",
                                    onClick = { acceptCounter(dto) },
                                ),
                            ),
                    )
            }

        private fun bannerFor(
            tab: String,
            counts: TabCounts,
        ): BannerConfig? {
            if (tab != MyBidsTab.ACTIVE) return null
            if (counts.active == 0) return null
            val title =
                if (counts.leading > 0) {
                    "Leading on ${counts.leading} of your ${counts.active} active bids"
                } else {
                    "${counts.active} active bid${if (counts.active == 1) "" else "s"}"
                }
            val subtitle =
                if (counts.closingSoon > 0) {
                    "${counts.closingSoon} closing in the next 24h"
                } else {
                    null
                }
            return BannerConfig(
                icon = PantopusIcon.Gavel,
                title = title,
                subtitle = subtitle,
                onTap = null,
            )
        }

        private fun defaultTabs() =
            listOf(
                ListOfRowsTab(id = MyBidsTab.ACTIVE, label = "Active", count = 0),
                ListOfRowsTab(id = MyBidsTab.ACCEPTED, label = "Accepted", count = 0),
                ListOfRowsTab(id = MyBidsTab.REJECTED, label = "Rejected", count = 0),
                ListOfRowsTab(id = MyBidsTab.DONE, label = "Done", count = 0),
            )

        companion object {
            fun tabCounts(
                projections: List<BidProjection>,
                now: Instant,
            ): TabCounts =
                projections.fold(TabCounts()) { acc, proj ->
                    val active = acc.active + if (proj.tab == MyBidsTab.ACTIVE) 1 else 0
                    val accepted = acc.accepted + if (proj.tab == MyBidsTab.ACCEPTED) 1 else 0
                    val rejected = acc.rejected + if (proj.tab == MyBidsTab.REJECTED) 1 else 0
                    val done = acc.done + if (proj.tab == MyBidsTab.DONE) 1 else 0
                    val leading = acc.leading + if (proj.tab == MyBidsTab.ACTIVE && proj.status is MyBidsStatus.TopBid) 1 else 0
                    val closingSoon =
                        acc.closingSoon + if (proj.tab == MyBidsTab.ACTIVE && isClosingSoon(proj.dto, now)) 1 else 0
                    TabCounts(active, accepted, rejected, done, leading, closingSoon)
                }

            private fun isClosingSoon(
                dto: BidDto,
                now: Instant,
            ): Boolean {
                val expires = parseInstant(dto.expiresAt) ?: return false
                val timeLeft = ChronoUnit.SECONDS.between(now, expires)
                return timeLeft in 1 until (24 * 3600).toLong()
            }

            @Suppress("UnusedParameter")
            fun tabFor(
                dto: BidDto,
                now: Instant,
            ): String {
                val bidStatus = (dto.status ?: "").lowercase(Locale.ROOT)
                val gigStatus = (dto.gig?.status ?: "").lowercase(Locale.ROOT)
                if (gigStatus == "cancelled" && bidStatus != "accepted") return MyBidsTab.REJECTED
                if (gigStatus == "completed" && bidStatus == "accepted") return MyBidsTab.DONE
                return when (bidStatus) {
                    "pending", "countered" -> MyBidsTab.ACTIVE
                    "accepted", "assigned" -> MyBidsTab.ACCEPTED
                    "rejected", "declined", "withdrawn", "expired" -> MyBidsTab.REJECTED
                    else -> MyBidsTab.ACTIVE
                }
            }

            fun derivedStatus(
                dto: BidDto,
                now: Instant,
            ): MyBidsStatus {
                val bidStatus = (dto.status ?: "").lowercase(Locale.ROOT)
                val gigStatus = (dto.gig?.status ?: "").lowercase(Locale.ROOT)
                if (gigStatus == "cancelled" && bidStatus != "accepted") return MyBidsStatus.TaskCancelled
                if (gigStatus == "completed" && bidStatus == "accepted") {
                    // TODO(reviews-flag): swap to MyBidsStatus.Paid when a
                    // backend-driven "already_reviewed" signal lands.
                    return MyBidsStatus.LeaveReview
                }
                return when (bidStatus) {
                    "rejected", "declined", "withdrawn", "expired" -> MyBidsStatus.NotSelected
                    "accepted", "assigned" -> {
                        val proposed = parseInstant(dto.proposedTime)
                        if (proposed != null && proposed.isAfter(now)) {
                            MyBidsStatus.Scheduled(formatWeekday(proposed))
                        } else {
                            MyBidsStatus.Accepted
                        }
                    }
                    "pending", "countered" -> {
                        // Phase 5 — an outstanding counter beats every other
                        // pending-tab verdict; the bidder must respond first.
                        if (dto.counterStatus == "pending" && dto.counterAmount != null) {
                            return MyBidsStatus.Countered(formatPrice(dto.counterAmount))
                        }
                        val expires = parseInstant(dto.expiresAt)
                        if (expires != null) {
                            val timeLeft = ChronoUnit.SECONDS.between(now, expires)
                            if (timeLeft in 1 until MyBidsStatus.EXPIRING_WINDOW_SECONDS) {
                                val hours = maxOf(1, ceil(timeLeft / 3600.0).toInt())
                                return MyBidsStatus.Expiring(hours)
                            }
                        }
                        if (dto.shortlisted == true) return MyBidsStatus.Shortlisted
                        if (dto.yourRank == 1) return MyBidsStatus.TopBid
                        if ((dto.yourRank ?: 0) > 1 && dto.topPrice != null) return MyBidsStatus.Outbid
                        MyBidsStatus.Pending
                    }
                    else -> MyBidsStatus.Pending
                }
            }

            fun footerFor(
                dto: BidDto,
                tab: String,
                status: MyBidsStatus,
            ): MyBidsFooter {
                val gigStatus = (dto.gig?.status ?: "").lowercase(Locale.ROOT)
                return when (tab) {
                    MyBidsTab.ACTIVE ->
                        if (status is MyBidsStatus.Countered) MyBidsFooter.CounterRespond else MyBidsFooter.Edit
                    MyBidsTab.ACCEPTED ->
                        if (gigStatus == "in_progress") MyBidsFooter.Complete else MyBidsFooter.Message
                    MyBidsTab.DONE ->
                        if (status is MyBidsStatus.LeaveReview) MyBidsFooter.Review("") else MyBidsFooter.None
                    MyBidsTab.REJECTED -> MyBidsFooter.Rebid
                    else -> MyBidsFooter.None
                }
            }

            fun highlight(projection: BidProjection): RowHighlight? =
                when (projection.status) {
                    is MyBidsStatus.NotSelected, is MyBidsStatus.TaskCancelled -> RowHighlight.Muted
                    else -> null
                }

            /** Map a derived bid status onto one of the four filter chip ids. */
            fun statusFilterId(status: MyBidsStatus): String =
                when (status) {
                    is MyBidsStatus.TopBid, is MyBidsStatus.Shortlisted, is MyBidsStatus.Pending,
                    is MyBidsStatus.Outbid, is MyBidsStatus.Expiring, is MyBidsStatus.Countered,
                    -> "pending"
                    is MyBidsStatus.Accepted, is MyBidsStatus.Scheduled -> "accepted"
                    is MyBidsStatus.NotSelected, is MyBidsStatus.TaskCancelled -> "declined"
                    is MyBidsStatus.Paid, is MyBidsStatus.LeaveReview -> "completed"
                }

            fun metaTail(
                dto: BidDto,
                status: MyBidsStatus,
                now: Instant,
            ): String? =
                when (status) {
                    is MyBidsStatus.Outbid -> dto.topPrice?.let { "top now ${formatPrice(it)}" }
                    is MyBidsStatus.TopBid, is MyBidsStatus.Shortlisted, is MyBidsStatus.Pending -> {
                        val expires = parseInstant(dto.expiresAt)
                        if (expires != null && expires.isAfter(now)) timeLeftLabel(now, expires) else null
                    }
                    else -> null
                }

            fun subtitle(
                dto: BidDto,
                now: Instant,
            ): String {
                val parts = mutableListOf<String>()
                dto.gig?.category?.takeIf { it.isNotBlank() }?.let { parts.add(humanizeCategory(it)) }
                formatRelativeTime(dto.createdAt, now)?.let { parts.add(it) }
                return parts.joinToString(" · ")
            }

            fun humanizeCategory(raw: String): String {
                val cleaned = raw.replace('_', ' ').replace('-', ' ')
                return cleaned.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }
            }

            fun formatPrice(amount: Double?): String {
                if (amount == null) return "$—"
                return "$${kotlin.math.round(amount).toInt()}"
            }

            fun formatBudgetSublabel(price: Double?): String? {
                val p = price ?: return null
                if (p <= 0) return null
                return "budget ${formatPrice(p)}"
            }

            fun timeLeftLabel(
                now: Instant,
                expires: Instant,
            ): String {
                val seconds = ChronoUnit.SECONDS.between(now, expires)
                if (seconds <= 0) return "Closing soon"
                val days = seconds / 86_400
                if (days >= 1) return "${days}d left"
                val hours = seconds / 3600
                if (hours >= 1) return "${hours}h left"
                val minutes = maxOf(1, (seconds / 60).toInt())
                return "${minutes}m left"
            }

            fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            fun formatWeekday(date: Instant): String {
                val zone = ZoneId.systemDefault()
                return date.atZone(zone).dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US)
            }

            fun formatRelativeTime(
                raw: String?,
                now: Instant,
                zone: ZoneId = ZoneId.systemDefault(),
            ): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, now)
                return when {
                    seconds < 60 -> "now"
                    seconds < 3600 -> "${seconds / 60}m"
                    seconds < 86_400 -> "${seconds / 3600}h"
                    else -> {
                        val today = now.atZone(zone).toLocalDate()
                        val createdDate = date.atZone(zone).toLocalDate()
                        val days = ChronoUnit.DAYS.between(createdDate, today)
                        when {
                            days == 1L -> "Yesterday"
                            days < 7L ->
                                createdDate.dayOfWeek.getDisplayName(
                                    TextStyle.SHORT,
                                    Locale.US,
                                )
                            else ->
                                DateTimeFormatter
                                    .ofPattern("MMM d", Locale.US)
                                    .withZone(zone)
                                    .format(date)
                        }
                    }
                }
            }

            fun withdrawnCopy(
                dto: BidDto,
                reason: WithdrawBidReason?,
            ): BidDto =
                dto.copy(
                    status = "withdrawn",
                    withdrawnAt = Instant.now().toString(),
                    withdrawalReason = reason?.wireValue,
                    updatedAt = Instant.now().toString(),
                )

            /**
             * Build an optimistic copy of a bid that's just been edited.
             * Replaces amount + message + proposed_time; leaves everything
             * else (status, rank, etc.) untouched.
             */
            fun updatedCopy(
                dto: BidDto,
                draft: EditBidDraft,
            ): BidDto =
                dto.copy(
                    bidAmount = draft.amount,
                    message = draft.message,
                    proposedTime = draft.proposedTime,
                    updatedAt = Instant.now().toString(),
                )

            /** Optimistic copy after accepting a counter: amount ⇒ counter amount. */
            fun counterAcceptedCopy(dto: BidDto): BidDto =
                dto.copy(
                    bidAmount = dto.counterAmount ?: dto.bidAmount,
                    status = "pending",
                    counterStatus = "accepted",
                    updatedAt = Instant.now().toString(),
                )

            /** Optimistic copy after declining a counter: original bid stands. */
            fun counterDeclinedCopy(dto: BidDto): BidDto =
                dto.copy(
                    counterStatus = "declined",
                    updatedAt = Instant.now().toString(),
                )

            fun markedCompleteCopy(dto: BidDto): BidDto {
                val gig = dto.gig ?: return dto
                return dto.copy(
                    gig =
                        BidGigDto(
                            id = gig.id,
                            title = gig.title,
                            description = gig.description,
                            price = gig.price,
                            category = gig.category,
                            status = "completed",
                            userId = gig.userId,
                        ),
                    updatedAt = Instant.now().toString(),
                )
            }
        }
    }
