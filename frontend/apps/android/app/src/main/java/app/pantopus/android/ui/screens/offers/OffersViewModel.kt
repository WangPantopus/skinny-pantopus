@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
    "ReturnCount",
)

package app.pantopus.android.ui.screens.offers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.BidderUserDto
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilter
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivitySortOrder
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** Stable tab ids exposed for tests + the screen. */
object OffersTab {
    const val RECEIVED = "received"
    const val SENT = "sent"
}

/** Which list the row was projected from — drives subtitle copy. */
enum class OfferPerspective { Received, Sent }

/** Transient toast surfaced by the Offers screen after a row action. */
data class OffersToast(
    val text: String,
    val isError: Boolean = false,
)

/** One-shot side effects the screen performs (Stripe PaymentSheet). */
sealed interface OffersEvent {
    data class PresentCheckout(val params: PaymentIntentSheetParamsDto) : OffersEvent
}

/**
 * Eight lifecycle states the design's STATUS map calls out. Common-case
 * statuses are `pending / countered / accepted / declined / withdrawn /
 * expired`; `new` (recently-created pending) and `expiring` (pending
 * within 4h of `expires_at`) are derived variants of `pending`.
 */
enum class OfferStatus {
    New,
    Expiring,
    Countered,
    Accepted,
    Pending,
    Declined,
    Withdrawn,
    Expired,
    ;

    val label: String
        get() =
            when (this) {
                New -> "New offer"
                Expiring -> "Expiring soon"
                Countered -> "Countered"
                Accepted -> "Accepted"
                Pending -> "Pending response"
                Declined -> "Declined"
                Withdrawn -> "Withdrawn"
                Expired -> "Expired"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                New -> PantopusIcon.Sparkles
                Expiring -> PantopusIcon.Timer
                Countered -> PantopusIcon.ArrowsRepeat
                Accepted -> PantopusIcon.Check
                Pending -> PantopusIcon.Hourglass
                Declined -> PantopusIcon.X
                Withdrawn -> PantopusIcon.ArrowLeft
                Expired -> PantopusIcon.AlertCircle
            }

    val chipVariant: StatusChipVariant
        get() =
            when (this) {
                New -> StatusChipVariant.Personal
                Expiring -> StatusChipVariant.ErrorVariant
                Countered -> StatusChipVariant.Warning
                Accepted -> StatusChipVariant.Success
                Pending, Declined, Withdrawn, Expired -> StatusChipVariant.Neutral
            }

    companion object {
        const val NEW_WINDOW_SECONDS: Long = 12 * 60 * 60
        const val EXPIRING_WINDOW_SECONDS: Long = 4 * 60 * 60
    }
}

/**
 * Eight gig-category buckets the row's leading icon represents. Wraps
 * the existing category color tokens in a [PantopusIcon] + theme-token
 * [GradientPair] pair so the shell can render
 * [RowLeading.CategoryGradientIcon] without any raw `Color(0xFF…)` at
 * the call site.
 */
enum class OffersCategory {
    Handyman,
    Cleaning,
    Moving,
    PetCare,
    ChildCare,
    Tutoring,
    Tech,
    Delivery,
    Other,
    ;

    val icon: PantopusIcon
        get() =
            when (this) {
                Handyman -> PantopusIcon.Hammer
                Cleaning -> PantopusIcon.Briefcase
                Moving -> PantopusIcon.Package
                PetCare -> PantopusIcon.Heart
                ChildCare -> PantopusIcon.UserPlus
                Tutoring -> PantopusIcon.Lightbulb
                Tech -> PantopusIcon.Info
                Delivery -> PantopusIcon.Send
                Other -> PantopusIcon.Briefcase
            }

    fun gradient(): GradientPair =
        when (this) {
            Handyman -> GradientPair(PantopusColors.handyman, PantopusColors.warning)
            Cleaning -> GradientPair(PantopusColors.cleaning, PantopusColors.primary600)
            Moving -> GradientPair(PantopusColors.moving, PantopusColors.business)
            PetCare -> GradientPair(PantopusColors.petCare, PantopusColors.success)
            ChildCare -> GradientPair(PantopusColors.childCare, PantopusColors.error)
            Tutoring -> GradientPair(PantopusColors.tutoring, PantopusColors.warning)
            Tech -> GradientPair(PantopusColors.tech, PantopusColors.appTextSecondary)
            Delivery -> GradientPair(PantopusColors.delivery, PantopusColors.primary700)
            Other -> GradientPair(PantopusColors.primary600, PantopusColors.primary700)
        }

    companion object {
        fun fromRaw(raw: String?): OffersCategory {
            val key =
                (raw ?: "")
                    .lowercase(Locale.ROOT)
                    .replace("_", "")
                    .replace("-", "")
                    .replace(" ", "")
            return when (key) {
                "handyman", "handy", "repair", "repairs" -> Handyman
                "cleaning", "clean" -> Cleaning
                "moving", "move", "movers" -> Moving
                "petcare", "pet", "pets", "dogwalking", "petsitting" -> PetCare
                "childcare", "child", "babysitting", "nanny" -> ChildCare
                "tutoring", "tutor", "lessons", "teaching" -> Tutoring
                "tech", "technology", "it", "computer", "techsupport" -> Tech
                "delivery", "deliveries", "courier" -> Delivery
                else -> Other
            }
        }
    }
}

/**
 * Drives the T5.2.4 Offers screen against the shared [ListOfRowsScreen].
 * Mirrors iOS `OffersViewModel` field-for-field — same tabs, same
 * status derivation, same row mapping. No optimistic mutations: the row
 * tap pushes a gig-detail destination where the user manages the offer.
 */
@HiltViewModel
class OffersViewModel
    @Inject
    constructor(
        private val repo: OffersRepository,
        // Accept / reject live on the gig bid routes, not the offers ones.
        private val gigsRepo: GigsRepository,
    ) : ViewModel() {
        private var received: List<BidDto> = emptyList()
        private var sent: List<BidDto> = emptyList()
        private var loadedAtLeastOnce: Boolean = false
        private var rowTapHandler: (BidDto) -> Unit = {}
        private var browseHandler: () -> Unit = {}
        private var postTaskHandler: () -> Unit = {}

        // MARK: - Row actions (RN `offers.tsx`)

        /** Bid awaiting the Accept confirm (payment-authorization copy). */
        private val _acceptCandidate = MutableStateFlow<BidDto?>(null)
        val acceptCandidate: StateFlow<BidDto?> = _acceptCandidate.asStateFlow()

        /** Bid awaiting the Reject confirm. */
        private val _rejectCandidate = MutableStateFlow<BidDto?>(null)
        val rejectCandidate: StateFlow<BidDto?> = _rejectCandidate.asStateFlow()

        /** Bid awaiting the Withdraw confirm. */
        private val _withdrawCandidate = MutableStateFlow<BidDto?>(null)
        val withdrawCandidate: StateFlow<BidDto?> = _withdrawCandidate.asStateFlow()

        /** Id of the bid whose mutation is in flight — the footer disables. */
        private val _actionInFlight = MutableStateFlow<String?>(null)
        val actionInFlight: StateFlow<String?> = _actionInFlight.asStateFlow()

        private val _toast = MutableStateFlow<OffersToast?>(null)
        val toast: StateFlow<OffersToast?> = _toast.asStateFlow()

        private val _events = MutableSharedFlow<OffersEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<OffersEvent> = _events.asSharedFlow()

        /** Bid whose PaymentSheet is on screen, awaiting its outcome. */
        private var pendingAccept: PendingAccept? = null

        private data class PendingAccept(
            val gigId: String,
            val bidId: String,
        )

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _tabs =
            MutableStateFlow(
                listOf(
                    ListOfRowsTab(id = OffersTab.RECEIVED, label = "Received", count = 0),
                    ListOfRowsTab(id = OffersTab.SENT, label = "Sent", count = 0),
                ),
            )
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _selectedTab = MutableStateFlow(OffersTab.RECEIVED)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(
                TopBarAction(
                    icon = PantopusIcon.Filter,
                    contentDescription = "Filter offers",
                    label = null,
                    isEnabled = true,
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
        val statusFilterTitle = "Offer status"

        /** Per-surface status chips (the three offer lifecycle buckets). */
        val statusFilterOptions =
            listOf(
                FilterOption("pending", "Pending"),
                FilterOption("accepted", "Accepted"),
                FilterOption("declined", "Declined"),
            )

        /** Offers carry an amount, so the full sort set applies. */
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

        /**
         * Inject the screen-level callbacks (row tap → detail push,
         * empty-state CTAs). Called from the Screen composable's
         * [androidx.compose.runtime.LaunchedEffect].
         */
        fun bindCallbacks(
            onOpenOfferDetail: (BidDto) -> Unit,
            onBrowseListings: () -> Unit,
            onPostTask: () -> Unit,
        ) {
            rowTapHandler = onOpenOfferDetail
            browseHandler = onBrowseListings
            postTaskHandler = onPostTask
        }

        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && loadedAtLeastOnce) return
            reload()
        }

        fun refresh() = reload()

        /** Tab switch — no refetch needed; we already have both lists in memory. */
        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            applyState()
        }

        /** Cross-tab paging isn't part of T5.2.4 — both endpoints return the full list. */
        fun loadMoreIfNeeded() = Unit

        private fun reload() {
            if (!loadedAtLeastOnce) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val receivedDeferred = async { repo.receivedOffers() }
                val sentDeferred = async { repo.myBids() }
                val receivedResult = receivedDeferred.await()
                val sentResult = sentDeferred.await()
                when {
                    receivedResult is NetworkResult.Success && sentResult is NetworkResult.Success -> {
                        received = receivedResult.data.offers
                        sent = sentResult.data.bids
                        loadedAtLeastOnce = true
                        applyState()
                    }
                    !loadedAtLeastOnce -> {
                        val failure =
                            (receivedResult as? NetworkResult.Failure)
                                ?: (sentResult as? NetworkResult.Failure)
                        _state.value =
                            ListOfRowsUiState.Error(
                                failure?.error?.message ?: "Couldn't load offers.",
                            )
                    }
                }
            }
        }

        private fun applyState() {
            _tabs.value =
                listOf(
                    ListOfRowsTab(
                        id = OffersTab.RECEIVED,
                        label = "Received",
                        count = received.size,
                    ),
                    ListOfRowsTab(
                        id = OffersTab.SENT,
                        label = "Sent",
                        count = sent.size,
                    ),
                )
            val items = if (_selectedTab.value == OffersTab.SENT) sent else received
            val perspective =
                if (_selectedTab.value == OffersTab.SENT) OfferPerspective.Sent else OfferPerspective.Received
            val now = Instant.now()
            val visible =
                _activityFilter.value.apply(
                    items = items,
                    now = now,
                    statusId = { statusFilterId(derivedStatus(it, now)) },
                    date = { parseInstant(it.createdAt) },
                    value = { it.bidAmount },
                )
            if (visible.isEmpty()) {
                _state.value =
                    if (_activityFilter.value.isActive && items.isNotEmpty()) {
                        filteredEmptyState()
                    } else {
                        emptyState()
                    }
                return
            }
            val isBusy = _actionInFlight.value != null
            val rows =
                visible.map { dto ->
                    row(
                        dto = dto,
                        perspective = perspective,
                        now = now,
                        footer =
                            footer(
                                dto = dto,
                                perspective = perspective,
                                isBusy = isBusy,
                                onAccept = { _acceptCandidate.value = dto },
                                onReject = { _rejectCandidate.value = dto },
                                onWithdraw = { _withdrawCandidate.value = dto },
                            ),
                    ) { rowTapHandler(dto) }
                }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = _selectedTab.value, rows = rows)),
                    hasMore = false,
                )
        }

        // MARK: - Mutations (RN `offers.tsx`)

        fun dismissAcceptConfirm() {
            _acceptCandidate.value = null
        }

        fun dismissRejectConfirm() {
            _rejectCandidate.value = null
        }

        fun dismissWithdrawConfirm() {
            _withdrawCandidate.value = null
        }

        fun consumeToast() {
            _toast.value = null
        }

        /**
         * Poster accepts a received bid: `POST .../bids/:bidId/accept`;
         * paid gigs return PaymentSheet params → present →
         * `finalize-accept` (or `abort-accept` on cancel/decline).
         */
        fun confirmAccept() {
            val dto = _acceptCandidate.value ?: return
            _acceptCandidate.value = null
            val gigId = dto.gigId ?: dto.gig?.id
            if (gigId.isNullOrBlank()) {
                _toast.value = OffersToast("Gig not found for this offer.", isError = true)
                return
            }
            if (_actionInFlight.value != null) return
            _actionInFlight.value = dto.id
            applyState()
            viewModelScope.launch {
                when (val result = gigsRepo.acceptBid(gigId, dto.id)) {
                    is NetworkResult.Success -> {
                        val params = result.data.sheetParams()
                        val needsPayment =
                            result.data.requiresPaymentSetup == true || !params.clientSecret.isNullOrBlank()
                        if (needsPayment) {
                            pendingAccept = PendingAccept(gigId = gigId, bidId = dto.id)
                            _events.emit(OffersEvent.PresentCheckout(params))
                        } else {
                            _toast.value = OffersToast("Offer accepted.")
                            finishAction(refetch = true)
                        }
                    }
                    is NetworkResult.Failure -> {
                        _toast.value =
                            OffersToast(result.error.displayMessage("Couldn't accept this offer."), isError = true)
                        finishAction(refetch = false)
                    }
                }
            }
        }

        /** PaymentSheet result → `finalize-accept` or `abort-accept`. */
        fun onCheckoutOutcome(outcome: CheckoutOutcome) {
            val pending = pendingAccept ?: return
            pendingAccept = null
            viewModelScope.launch {
                when (outcome) {
                    CheckoutOutcome.Paid -> {
                        when (val result = gigsRepo.finalizeAcceptBid(pending.gigId, pending.bidId)) {
                            is NetworkResult.Success ->
                                _toast.value = OffersToast("Offer accepted and payment authorized.")
                            is NetworkResult.Failure ->
                                _toast.value =
                                    OffersToast(
                                        result.error.displayMessage("Couldn't finish accepting this offer."),
                                        isError = true,
                                    )
                        }
                    }
                    CheckoutOutcome.Canceled -> {
                        gigsRepo.abortAcceptBid(pending.gigId, pending.bidId)
                        _toast.value =
                            OffersToast(
                                "Payment authorization is required before accepting this offer.",
                                isError = true,
                            )
                    }
                    is CheckoutOutcome.Declined -> {
                        gigsRepo.abortAcceptBid(pending.gigId, pending.bidId)
                        _toast.value =
                            OffersToast(outcome.message ?: "Your card was declined.", isError = true)
                    }
                }
                finishAction(refetch = true)
            }
        }

        /** Poster rejects a received bid — `POST .../bids/:bidId/reject`. */
        fun confirmReject() {
            val dto = _rejectCandidate.value ?: return
            _rejectCandidate.value = null
            val gigId = dto.gigId ?: dto.gig?.id
            if (gigId.isNullOrBlank()) {
                _toast.value = OffersToast("Gig not found for this offer.", isError = true)
                return
            }
            mutate(dto.id, "Offer rejected.", "Couldn't reject this offer.") {
                gigsRepo.rejectBid(gigId, dto.id)
            }
        }

        /**
         * Bidder withdraws their own sent offer —
         * `DELETE /api/gigs/:gigId/bids/:bidId` with `reason=other`,
         * exactly as RN's `withdrawBid(gigId, bidId, 'other')`.
         */
        fun confirmWithdraw() {
            val dto = _withdrawCandidate.value ?: return
            _withdrawCandidate.value = null
            val gigId = dto.gigId ?: dto.gig?.id
            if (gigId.isNullOrBlank()) {
                _toast.value = OffersToast("Gig not found for this offer.", isError = true)
                return
            }
            mutate(dto.id, "Offer withdrawn.", "Couldn't withdraw this offer.") {
                repo.withdrawBid(gigId, dto.id, WITHDRAW_REASON_OTHER)
            }
        }

        private fun mutate(
            bidId: String,
            success: String,
            failure: String,
            call: suspend () -> NetworkResult<*>,
        ) {
            if (_actionInFlight.value != null) return
            _actionInFlight.value = bidId
            applyState()
            viewModelScope.launch {
                when (val result = call()) {
                    is NetworkResult.Success -> {
                        _toast.value = OffersToast(success)
                        finishAction(refetch = true)
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = OffersToast(result.error.displayMessage(failure), isError = true)
                        finishAction(refetch = false)
                    }
                }
            }
        }

        private fun finishAction(refetch: Boolean) {
            _actionInFlight.value = null
            if (refetch) reload() else applyState()
        }

        private fun filteredEmptyState(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.Filter,
                headline = "No offers match your filters",
                subcopy =
                    "Try a different status, date range, or sort — or clear " +
                        "your filters to see everything in this tab.",
                ctaTitle = "Clear filters",
                onCta = { applyFilter(ActivityFilter()) },
            )

        private fun emptyState(): ListOfRowsUiState.Empty =
            when (_selectedTab.value) {
                OffersTab.SENT ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.HandCoins,
                        headline = "No offers sent yet",
                        subcopy =
                            "Browse listings and gigs you'd like to buy or help " +
                                "with — your offers will show up here.",
                        ctaTitle = "Browse listings",
                        onCta = { browseHandler() },
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.HandCoins,
                        headline = "No offers yet",
                        subcopy =
                            "When a neighbor offers a price on one of your listings, " +
                                "it’ll land here. Listings with photos and a fair ask tend " +
                                "to draw offers within a day.",
                        ctaTitle = "Post a task",
                        onCta = { postTaskHandler() },
                    )
            }

        companion object {
            /** RN sends `'other'` as the withdraw reason (`offers.tsx:89`). */
            const val WITHDRAW_REASON_OTHER = "other"

            /**
             * Pure projection from a [BidDto] to a [RowModel]. Public so
             * the test suite can assert the mapping (status derivation,
             * perspective subtitle, price stack) without standing up the
             * ViewModel.
             */
            fun row(
                dto: BidDto,
                perspective: OfferPerspective,
                now: Instant = Instant.now(),
                footer: RowFooter? = null,
                onTap: () -> Unit = {},
            ): RowModel {
                val status = derivedStatus(dto = dto, now = now)
                val category = OffersCategory.fromRaw(dto.gig?.category)
                val amount = formatPrice(dto.bidAmount)
                val askingSublabel = formatAskingSublabel(dto.gig?.price)
                val title = dto.gig?.title?.takeIf { it.isNotBlank() } ?: "Offer"
                return RowModel(
                    id = dto.id,
                    title = title,
                    subtitle = subtitle(dto = dto, perspective = perspective, now = now),
                    template = RowTemplate.StatusChip,
                    leading =
                        RowLeading.CategoryGradientIcon(
                            icon = category.icon,
                            gradient = category.gradient(),
                        ),
                    trailing =
                        RowTrailing.PriceStack(
                            amount = amount,
                            sublabel = askingSublabel,
                        ),
                    onTap = onTap,
                    chips =
                        listOf(
                            RowChip(
                                text = status.label,
                                icon = status.icon,
                                tint = RowChip.Tint.Status(status.chipVariant),
                            ),
                        ),
                    metaTail = metaTail(dto = dto, status = status, perspective = perspective),
                    footer = footer,
                )
            }

            /**
             * In-card action footer. Mirrors RN `offers.tsx`: the Received
             * tab exposes Accept + Reject on a still-pending bid, the Sent
             * tab exposes Withdraw while the bid is `pending` or
             * `countered`. Every other lifecycle state renders
             * footer-less (managed from the gig detail).
             */
            fun footer(
                dto: BidDto,
                perspective: OfferPerspective,
                isBusy: Boolean,
                onAccept: () -> Unit,
                onReject: () -> Unit,
                onWithdraw: () -> Unit,
            ): RowFooter? {
                val status = (dto.status ?: "").lowercase(Locale.ROOT)
                return when (perspective) {
                    OfferPerspective.Received ->
                        if (status != "pending") {
                            null
                        } else {
                            RowFooter(
                                actions =
                                    listOf(
                                        RowFooterAction(
                                            title = "Reject",
                                            icon = PantopusIcon.X,
                                            variant = CompactButtonVariant.Destructive,
                                            testTag = "offers.${dto.id}.reject",
                                            onClick = { if (!isBusy) onReject() },
                                        ),
                                        RowFooterAction(
                                            title = "Accept",
                                            icon = PantopusIcon.Check,
                                            variant = CompactButtonVariant.Primary,
                                            testTag = "offers.${dto.id}.accept",
                                            onClick = { if (!isBusy) onAccept() },
                                        ),
                                    ),
                            )
                        }
                    OfferPerspective.Sent ->
                        if (status != "pending" && status != "countered") {
                            null
                        } else {
                            RowFooter(
                                actions =
                                    listOf(
                                        RowFooterAction(
                                            title = "Withdraw",
                                            icon = PantopusIcon.X,
                                            variant = CompactButtonVariant.Destructive,
                                            testTag = "offers.${dto.id}.withdraw",
                                            onClick = { if (!isBusy) onWithdraw() },
                                        ),
                                    ),
                            )
                        }
                }
            }

            /**
             * Confirm copy for Accept. Paid offers authorize a hold first,
             * so the dialog quotes the exact amount (RN `handleAcceptBid`).
             */
            fun acceptConfirmTitle(dto: BidDto): String = if ((dto.bidAmount ?: 0.0) > 0) "Authorize payment method?" else "Accept offer"

            fun acceptConfirmMessage(dto: BidDto): String {
                val amount = dto.bidAmount ?: 0.0
                if (amount <= 0) return "Accept this offer?"
                return "Pantopus will place a temporary authorization hold of ${formatUsd(amount)}. " +
                    "You are charged only after you confirm the task is completed. " +
                    "If canceled per policy, the hold is released (or only applicable fees apply)."
            }

            fun acceptConfirmCta(dto: BidDto): String = if ((dto.bidAmount ?: 0.0) > 0) "Continue to Payment" else "Accept"

            fun acceptConfirmCancel(dto: BidDto): String = if ((dto.bidAmount ?: 0.0) > 0) "Not now" else "Cancel"

            /** `$120.00` — the accept dialog quotes cents, unlike the row. */
            fun formatUsd(amount: Double): String = String.format(Locale.US, "$%.2f", amount)

            /** Map a backend bid to one of the eight design statuses. Pure + time-deterministic. */
            fun derivedStatus(
                dto: BidDto,
                now: Instant,
            ): OfferStatus {
                val hasLiveCounter =
                    (dto.counterAmount ?: 0.0) > 0 || (dto.counterStatus?.isNotEmpty() == true)
                if (hasLiveCounter && isPending(dto.status)) return OfferStatus.Countered

                return when ((dto.status ?: "").lowercase(Locale.ROOT)) {
                    "accepted", "assigned" -> OfferStatus.Accepted
                    "rejected", "declined" -> OfferStatus.Declined
                    "withdrawn" -> OfferStatus.Withdrawn
                    "expired" -> OfferStatus.Expired
                    "pending" -> {
                        val expires = parseInstant(dto.expiresAt)
                        if (expires != null) {
                            val timeLeft = ChronoUnit.SECONDS.between(now, expires)
                            if (timeLeft in 1 until OfferStatus.EXPIRING_WINDOW_SECONDS) {
                                return OfferStatus.Expiring
                            }
                            if (timeLeft <= 0) return OfferStatus.Expired
                        }
                        val created = parseInstant(dto.createdAt)
                        if (created != null &&
                            ChronoUnit.SECONDS.between(created, now) < OfferStatus.NEW_WINDOW_SECONDS
                        ) {
                            return OfferStatus.New
                        }
                        OfferStatus.Pending
                    }
                    else -> OfferStatus.Pending
                }
            }

            /** Render the row subtitle: counterparty + city + relative time. */
            fun subtitle(
                dto: BidDto,
                perspective: OfferPerspective,
                now: Instant,
            ): String {
                val parts = mutableListOf<String>()
                when (perspective) {
                    OfferPerspective.Received -> {
                        parts.add("From ${displayName(dto.bidder)}")
                        dto.bidder?.city?.takeIf { it.isNotBlank() }?.let { parts.add(it) }
                    }
                    OfferPerspective.Sent -> {
                        parts.add("Your offer")
                    }
                }
                formatRelativeTime(dto.createdAt, now)?.let { parts.add(it) }
                return parts.joinToString(" · ")
            }

            /** Optional chip-row meta tail (counter amount when status is Countered). */
            fun metaTail(
                dto: BidDto,
                status: OfferStatus,
                perspective: OfferPerspective,
            ): String? {
                if (status != OfferStatus.Countered) return null
                val counter = dto.counterAmount ?: return null
                if (counter <= 0) return null
                return when (perspective) {
                    OfferPerspective.Received -> "you countered ${formatPrice(counter)}"
                    OfferPerspective.Sent -> "counter ${formatPrice(counter)}"
                }
            }

            /** Map a derived offer status onto one of the three filter chip ids. */
            fun statusFilterId(status: OfferStatus): String =
                when (status) {
                    OfferStatus.New, OfferStatus.Expiring, OfferStatus.Countered, OfferStatus.Pending -> "pending"
                    OfferStatus.Accepted -> "accepted"
                    OfferStatus.Declined, OfferStatus.Withdrawn, OfferStatus.Expired -> "declined"
                }

            fun isPending(raw: String?): Boolean = (raw ?: "").lowercase(Locale.ROOT) == "pending"

            /** `12` → `"$12"`. Whole dollars to match the headline price geometry. */
            fun formatPrice(amount: Double?): String {
                if (amount == null) return "$—"
                return "$${kotlin.math.round(amount).toInt()}"
            }

            /** Sub-label used by the price stack: `"asking $240"`. */
            fun formatAskingSublabel(askingPrice: Double?): String? {
                val price = askingPrice ?: return null
                if (price <= 0) return null
                return "asking ${formatPrice(price)}"
            }

            fun displayName(bidder: BidderUserDto?): String {
                val name = bidder?.name?.takeIf { it.isNotBlank() }
                if (name != null) return name
                val first = bidder?.firstName?.takeIf { it.isNotBlank() }
                if (first != null) return first
                val username = bidder?.username?.takeIf { it.isNotBlank() }
                if (username != null) return username
                return "Someone"
            }

            fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            /** "12m" / "3h" / "Yesterday" / "Tue" / "Mar 10" — mirrors iOS. */
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
        }
    }
