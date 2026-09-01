@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongMethod",
    "TooManyFunctions",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
    "ReturnCount",
)

package app.pantopus.android.ui.screens.listing_offers

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.listing_offers.ListingOfferDto
import app.pantopus.android.data.api.models.listing_offers.ListingOfferUserDto
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.payments.CreatePaymentIntentRequest
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.models.transaction_reviews.CreateTransactionReviewBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.listing_offers.ListingOffersRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.transaction_reviews.TransactionReviewsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.ListingContextConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.ListingContextMeta
import app.pantopus.android.ui.screens.shared.list_of_rows.ListingContextSortOption
import app.pantopus.android.ui.screens.shared.list_of_rows.ListingContextStatus
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailImage
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.screens.transaction_reviews.TransactionReviewContext
import app.pantopus.android.ui.screens.transaction_reviews.TransactionReviewDraft
import app.pantopus.android.ui.screens.transaction_reviews.TransactionReviewSheetTarget
import app.pantopus.android.ui.screens.transaction_reviews.TransactionReviewSubmitResult
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
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** Seven lifecycle states surfaced by the chip on a listing offer row. */
enum class ListingOfferStatus {
    Pending,
    Countered,
    Accepted,
    Declined,
    Expired,
    Withdrawn,
    Completed,
    ;

    val label: String
        get() =
            when (this) {
                Pending -> "Pending"
                Countered -> "Countered"
                Accepted -> "Accepted"
                Declined -> "Declined"
                Expired -> "Expired"
                Withdrawn -> "Withdrawn"
                Completed -> "Completed"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Pending -> PantopusIcon.Sparkles
                Countered -> PantopusIcon.ArrowsRepeat
                Accepted -> PantopusIcon.Check
                Declined -> PantopusIcon.X
                Expired -> PantopusIcon.Timer
                Withdrawn -> PantopusIcon.ArrowLeft
                Completed -> PantopusIcon.CheckCheck
            }

    val chipVariant: StatusChipVariant
        get() =
            when (this) {
                Pending -> StatusChipVariant.Personal
                Countered -> StatusChipVariant.Warning
                Accepted, Completed -> StatusChipVariant.Success
                Declined, Expired, Withdrawn -> StatusChipVariant.Neutral
            }

    companion object {
        fun fromRaw(raw: String?): ListingOfferStatus =
            when ((raw ?: "").lowercase(Locale.ROOT)) {
                "pending" -> Pending
                "countered" -> Countered
                "accepted" -> Accepted
                "declined", "rejected" -> Declined
                "expired" -> Expired
                "withdrawn" -> Withdrawn
                "completed" -> Completed
                else -> Pending
            }
    }
}

/** Footer archetype per the task's status → action contract. */
enum class ListingOfferFooter {
    RespondPending,
    UndoCounter,
    ViewTransaction,
    ReviewTransaction,
    None,
}

/**
 * Sort options surfaced via the sort menu on the listing-context strip.
 * Default is [HighestOffer]. "Buyer rating" isn't offered — the
 * listing-offers payload doesn't carry buyer reputation.
 */
enum class ListingOffersSort {
    HighestOffer,
    LowestOffer,
    NewestFirst,
    OldestFirst,
    ;

    /** Stable id mirrored by the iOS `rawValue` so the per-option
     *  test tags match across platforms. */
    val id: String
        get() =
            when (this) {
                HighestOffer -> "highestOffer"
                LowestOffer -> "lowestOffer"
                NewestFirst -> "newestFirst"
                OldestFirst -> "oldestFirst"
            }

    val label: String
        get() =
            when (this) {
                HighestOffer -> "Highest offer"
                LowestOffer -> "Lowest offer"
                NewestFirst -> "Newest first"
                OldestFirst -> "Oldest first"
            }
}

/** Eight listing-category buckets driving the header thumbnail gradient. */
enum class ListingOffersCategory {
    Furniture,
    Electronics,
    Clothing,
    Tools,
    BooksMedia,
    FreeStuff,
    Rentals,
    Vehicles,
    Other,
    ;

    val icon: PantopusIcon
        get() =
            when (this) {
                Furniture -> PantopusIcon.Home
                Electronics -> PantopusIcon.Lightbulb
                Clothing -> PantopusIcon.ShoppingBag
                Tools -> PantopusIcon.Hammer
                BooksMedia -> PantopusIcon.File
                FreeStuff -> PantopusIcon.Heart
                Rentals -> PantopusIcon.Calendar
                Vehicles -> PantopusIcon.Send
                Other -> PantopusIcon.ShoppingBag
            }

    fun gradient(): GradientPair =
        when (this) {
            Furniture -> GradientPair(PantopusColors.business, PantopusColors.primary700)
            Electronics -> GradientPair(PantopusColors.tech, PantopusColors.primary700)
            Clothing -> GradientPair(PantopusColors.personal, PantopusColors.primary600)
            Tools -> GradientPair(PantopusColors.handyman, PantopusColors.warning)
            BooksMedia -> GradientPair(PantopusColors.tutoring, PantopusColors.primary600)
            FreeStuff -> GradientPair(PantopusColors.success, PantopusColors.petCare)
            Rentals -> GradientPair(PantopusColors.home, PantopusColors.primary600)
            Vehicles -> GradientPair(PantopusColors.delivery, PantopusColors.primary700)
            Other -> GradientPair(PantopusColors.primary600, PantopusColors.primary700)
        }

    companion object {
        fun fromRaw(
            rawCategory: String?,
            layer: String?,
        ): ListingOffersCategory {
            if ((layer ?: "").lowercase(Locale.ROOT) == "vehicles") return Vehicles
            if ((layer ?: "").lowercase(Locale.ROOT) == "rentals") return Rentals
            val key =
                (rawCategory ?: "")
                    .lowercase(Locale.ROOT)
                    .replace("_", "")
                    .replace("-", "")
                    .replace(" ", "")
            return when (key) {
                "furniture", "home", "homegoods" -> Furniture
                "electronics", "tech", "tv" -> Electronics
                "clothing", "clothes", "apparel" -> Clothing
                "tools", "hardware" -> Tools
                "books", "booksmedia", "media" -> BooksMedia
                "freestuff", "free" -> FreeStuff
                else -> Other
            }
        }
    }
}

/** Six categorical avatar tones used by the row leading. */
enum class ListingOffersAvatarTone {
    Sky,
    Teal,
    Amber,
    Rose,
    Violet,
    Slate,
    ;

    fun background(): AvatarBackground =
        when (this) {
            Sky -> AvatarBackground.Solid(PantopusColors.personalBg)
            Teal -> AvatarBackground.Solid(PantopusColors.successBg)
            Amber -> AvatarBackground.Solid(PantopusColors.warningBg)
            Rose -> AvatarBackground.Solid(PantopusColors.errorBg)
            Violet -> AvatarBackground.Solid(PantopusColors.businessBg)
            Slate -> AvatarBackground.Solid(PantopusColors.appSurfaceSunken)
        }

    companion object {
        fun deterministic(seed: String): ListingOffersAvatarTone {
            val values = entries.toTypedArray()
            val sum = seed.toByteArray(Charsets.UTF_8).fold(0) { acc, b -> (acc * 31) + b.toInt() }
            val index = (sum.let { if (it < 0) -it else it }) % values.size
            return values[index]
        }
    }
}

/** Lightweight presentation contract for the counter-offer sheet. */
data class CounterSheetTarget(
    val id: String,
    val buyerName: String,
    val originalAmount: Double?,
    val suggestedAmount: Double?,
)

/** One-shot effects emitted by [ListingOffersViewModel]. */
sealed interface ListingOffersEvent {
    data class PresentCheckout(val params: PaymentIntentSheetParamsDto) : ListingOffersEvent
}

/**
 * T5.3.4 — Listing offers. Drives the screen against the shared
 * [ListOfRowsScreen]. See iOS counterpart for the mapping tables.
 */
@HiltViewModel
class ListingOffersViewModel
    @Inject
    constructor(
        private val offersRepo: ListingOffersRepository,
        private val listingsRepo: ListingsRepository,
        private val authRepo: AuthRepository,
        private val transactionReviewsRepo: TransactionReviewsRepository,
        private val paymentsRepo: PaymentsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        companion object {
            const val LISTING_ID_KEY = "listingId"
            const val LISTING_TITLE_HINT_KEY = "listingTitle"

            /** Pure projection — public so tests assert the mapping without
             *  standing up the full VM. */
            fun row(
                offer: ListingOfferDto,
                index: Int,
                total: Int,
                askingPrice: Double?,
                isLeading: Boolean,
                now: Instant = Instant.now(),
                callbacks: RowCallbacks = RowCallbacks(),
            ): RowModel {
                val status = ListingOfferStatus.fromRaw(offer.status)
                val footer = footerFor(status)
                val buyerName = displayName(offer.buyer)
                val tone = ListingOffersAvatarTone.deterministic(offer.buyer?.id ?: offer.id)
                val amount = formatPrice(offer.amount)
                val asking = formatAskingSublabel(askingPrice)
                val chips =
                    mutableListOf<RowChip>(
                        RowChip(
                            text = status.label,
                            icon = status.icon,
                            tint = RowChip.Tint.Status(status.chipVariant),
                        ),
                    )
                if (status == ListingOfferStatus.Countered && offer.counterAmount != null) {
                    chips.add(
                        RowChip(
                            text = "Your counter ${formatPrice(offer.counterAmount)}",
                            icon = PantopusIcon.ArrowsRepeat,
                            tint =
                                RowChip.Tint.Custom(
                                    background = PantopusColors.appSurfaceSunken,
                                    foreground = PantopusColors.appTextStrong,
                                ),
                        ),
                    )
                }
                return RowModel(
                    id = offer.id,
                    title = buyerName,
                    subtitle = subtitle(offer, now),
                    template = RowTemplate.StatusChip,
                    leading =
                        RowLeading.AvatarWithBadge(
                            name = buyerName,
                            imageUrl = offer.buyer?.profilePictureUrl,
                            background = tone.background(),
                            size = AvatarBadgeSize.Large,
                            verified = false,
                        ),
                    trailing = RowTrailing.PriceStack(amount = amount, sublabel = asking),
                    onTap = callbacks.onTap,
                    chips = chips,
                    metaTail = metaTail(offer, index, total, now),
                    note = offer.message?.takeIf { it.isNotEmpty() },
                    highlight = if (isLeading) RowHighlight.Leading else null,
                    footer = footerActions(footer, callbacks),
                )
            }

            fun footerFor(status: ListingOfferStatus): ListingOfferFooter =
                when (status) {
                    ListingOfferStatus.Pending -> ListingOfferFooter.RespondPending
                    ListingOfferStatus.Countered -> ListingOfferFooter.UndoCounter
                    ListingOfferStatus.Accepted -> ListingOfferFooter.ViewTransaction
                    ListingOfferStatus.Completed -> ListingOfferFooter.ReviewTransaction
                    else -> ListingOfferFooter.None
                }

            private fun footerActions(
                variant: ListingOfferFooter,
                callbacks: RowCallbacks,
            ): RowFooter? =
                when (variant) {
                    ListingOfferFooter.None -> null
                    ListingOfferFooter.RespondPending ->
                        RowFooter(
                            actions =
                                listOf(
                                    RowFooterAction(
                                        title = "Counter",
                                        icon = PantopusIcon.ArrowsRepeat,
                                        variant = CompactButtonVariant.Ghost,
                                        onClick = callbacks.onCounter,
                                    ),
                                    RowFooterAction(
                                        title = "Accept",
                                        icon = PantopusIcon.Check,
                                        variant = CompactButtonVariant.Primary,
                                        onClick = callbacks.onAccept,
                                    ),
                                ),
                        )
                    ListingOfferFooter.UndoCounter ->
                        RowFooter(
                            actions =
                                listOf(
                                    RowFooterAction(
                                        title = "Withdraw counter",
                                        icon = PantopusIcon.X,
                                        variant = CompactButtonVariant.Destructive,
                                        onClick = callbacks.onDecline,
                                    ),
                                    RowFooterAction(
                                        title = "Send counter",
                                        icon = PantopusIcon.ArrowsRepeat,
                                        variant = CompactButtonVariant.Primary,
                                        onClick = callbacks.onCounter,
                                    ),
                                ),
                        )
                    ListingOfferFooter.ViewTransaction ->
                        RowFooter(
                            actions =
                                listOf(
                                    RowFooterAction(
                                        title = "View transaction",
                                        icon = PantopusIcon.FileText,
                                        variant = CompactButtonVariant.Primary,
                                        onClick = callbacks.onViewTransaction,
                                    ),
                                ),
                        )
                    ListingOfferFooter.ReviewTransaction ->
                        RowFooter(
                            actions =
                                listOf(
                                    RowFooterAction(
                                        title = "View transaction",
                                        icon = PantopusIcon.FileText,
                                        variant = CompactButtonVariant.Ghost,
                                        onClick = callbacks.onViewTransaction,
                                    ),
                                    RowFooterAction(
                                        title = "Leave a review",
                                        icon = PantopusIcon.Star,
                                        variant = CompactButtonVariant.Primary,
                                        onClick = callbacks.onLeaveReview,
                                    ),
                                ),
                        )
                }

            fun subtitle(
                offer: ListingOfferDto,
                now: Instant,
            ): String {
                val parts = mutableListOf<String>()
                formatRelativeTime(offer.createdAt, now)?.let { parts.add(it) }
                return parts.joinToString(" · ")
            }

            fun metaTail(
                offer: ListingOfferDto,
                index: Int,
                total: Int,
                now: Instant,
            ): String? {
                val parts = mutableListOf<String>()
                val age = ageInDays(offer.createdAt, now)
                if (age != null && age >= 1) {
                    parts.add("$age day${if (age == 1) "" else "s"} old")
                }
                if (total > 1) parts.add("${index + 1} of $total offers")
                return if (parts.isEmpty()) null else parts.joinToString(" · ")
            }

            fun displayName(user: ListingOfferUserDto?): String {
                val first = user?.firstName?.takeIf { it.isNotEmpty() }
                if (first != null) {
                    val last = user.lastName?.takeIf { it.isNotEmpty() }
                    return if (last != null) "$first $last" else first
                }
                val username = user?.username?.takeIf { it.isNotEmpty() }
                if (username != null) return username
                return "Someone"
            }

            fun context(
                listing: ListingDto,
                offerCount: Int,
                sortLabel: String?,
                sortOptions: List<ListingContextSortOption> = emptyList(),
                onSort: (() -> Unit)? = null,
                onEditPrice: (() -> Unit)? = null,
            ): ListingContextConfig {
                val category = ListingOffersCategory.fromRaw(listing.category, listing.layer)
                val thumbnail: ThumbnailImage =
                    listing.firstImage?.takeIf { it.isNotBlank() }?.let { url ->
                        ThumbnailImage.Remote(
                            url = url,
                            fallback = category.icon,
                            gradient = category.gradient(),
                        )
                    } ?: listing.mediaUrls?.firstOrNull()?.takeIf { it.isNotBlank() }?.let { url ->
                        ThumbnailImage.Remote(
                            url = url,
                            fallback = category.icon,
                            gradient = category.gradient(),
                        )
                    } ?: ThumbnailImage.IconOnGradient(
                        icon = category.icon,
                        gradient = category.gradient(),
                    )
                return ListingContextConfig(
                    thumbnail = thumbnail,
                    title = listing.title ?: "Listing",
                    askPrice = headerPrice(listing.price, listing.isFree),
                    meta = headerMeta(listing),
                    statusChip = headerStatus(listing.status),
                    offerCount = offerCount,
                    sortLabel = sortLabel,
                    sortOptions = sortOptions,
                    onSort = onSort,
                    onEditPrice = onEditPrice,
                )
            }

            private fun headerMeta(listing: ListingDto): List<ListingContextMeta> {
                val items = mutableListOf<ListingContextMeta>()
                postedAgo(listing.createdAt)?.let {
                    items.add(ListingContextMeta(icon = PantopusIcon.Clock, text = "Listed $it"))
                }
                return items
            }

            private fun headerStatus(raw: String?): ListingContextStatus {
                val key = (raw ?: "active").lowercase(Locale.ROOT)
                return when (key) {
                    "active" -> ListingContextStatus("Active", PantopusIcon.Circle, StatusChipVariant.Success)
                    "reserved" -> ListingContextStatus("Reserved", PantopusIcon.Check, StatusChipVariant.Info)
                    "sold" -> ListingContextStatus("Sold", PantopusIcon.CheckCheck, StatusChipVariant.Success)
                    "expired" -> ListingContextStatus("Expired", PantopusIcon.Timer, StatusChipVariant.Neutral)
                    "draft" -> ListingContextStatus("Draft", PantopusIcon.Pencil, StatusChipVariant.Neutral)
                    else ->
                        ListingContextStatus(
                            label = key.replaceFirstChar { it.uppercase() },
                            variant = StatusChipVariant.Neutral,
                        )
                }
            }

            private fun headerPrice(
                amount: Double?,
                isFree: Boolean?,
            ): String =
                if (isFree == true) {
                    "Free"
                } else {
                    formatPrice(amount)
                }

            fun postedAgo(raw: String?): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, Instant.now())
                return when {
                    seconds < 60 -> "just now"
                    seconds < 3600 -> "${seconds / 60}m ago"
                    seconds < 86_400 -> "${seconds / 3600}h ago"
                    seconds < 2 * 86_400 -> "yesterday"
                    else -> "${seconds / 86_400} days ago"
                }
            }

            fun formatPrice(amount: Double?): String = if (amount == null) "$—" else "$${kotlin.math.round(amount).toInt()}"

            fun formatAskingSublabel(askingPrice: Double?): String? {
                val price = askingPrice ?: return null
                if (price <= 0) return null
                return "asking ${formatPrice(price)}"
            }

            fun ageInDays(
                raw: String?,
                now: Instant,
            ): Int? {
                val date = parseInstant(raw) ?: return null
                return ChronoUnit.DAYS.between(date, now).toInt()
            }

            fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            fun formatRelativeTime(
                raw: String?,
                now: Instant,
            ): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, now)
                return when {
                    seconds < 60 -> "now"
                    seconds < 3600 -> "${seconds / 60}m"
                    seconds < 86_400 -> "${seconds / 3600}h"
                    seconds < 2 * 86_400 -> "yesterday"
                    seconds < 7 * 86_400 -> "${seconds / 86_400}d"
                    else -> {
                        val days = seconds / 86_400
                        "${days}d"
                    }
                }
            }
        }

        private val listingId: String = savedStateHandle.get<String>(LISTING_ID_KEY) ?: ""
        private val listingTitleHint: String? = savedStateHandle.get<String>(LISTING_TITLE_HINT_KEY)

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _events = MutableSharedFlow<ListingOffersEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<ListingOffersEvent> = _events.asSharedFlow()

        private val _listingContext = MutableStateFlow<ListingContextConfig?>(null)
        val listingContext: StateFlow<ListingContextConfig?> = _listingContext.asStateFlow()

        private val _subtitle = MutableStateFlow<String?>(null)
        val subtitle: StateFlow<String?> = _subtitle.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(
                TopBarAction(
                    icon = PantopusIcon.Share,
                    contentDescription = "Share listing",
                    onClick = { shareHandler() },
                ),
            )
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        private val _counterTarget = MutableStateFlow<CounterSheetTarget?>(null)
        val counterTarget: StateFlow<CounterSheetTarget?> = _counterTarget.asStateFlow()

        // BLOCK 2D — transaction-review sheet on a completed offer.
        private val _leaveReviewTarget = MutableStateFlow<TransactionReviewSheetTarget?>(null)
        val leaveReviewTarget: StateFlow<TransactionReviewSheetTarget?> = _leaveReviewTarget.asStateFlow()

        private var listing: ListingDto? = null
        private var offers: List<ListingOfferDto> = emptyList()
        private var loadedAtLeastOnce = false
        private var sort: ListingOffersSort = ListingOffersSort.HighestOffer
        private var pendingCheckoutOfferId: String? = null

        private var nowProvider: () -> Instant = { Instant.now() }
        private var shareHandler: () -> Unit = {}
        private var openBuyerHandler: (ListingOfferUserDto) -> Unit = {}
        private var openTransactionHandler: (ListingOfferDto) -> Unit = {}
        private var editPriceHandler: () -> Unit = {}

        init {
            // Seed the title hint subtitle so the top-bar surfaces the
            // listing before the first fetch resolves.
            listingTitleHint?.let { hint ->
                _subtitle.value = hint
                _listingContext.value = loadingContext(hint)
            }
        }

        /** Wire the screen-level callbacks before [load]. */
        fun bindCallbacks(
            onShareListing: () -> Unit,
            onOpenBuyer: (ListingOfferUserDto) -> Unit,
            onOpenTransaction: (ListingOfferDto) -> Unit,
            onEditPrice: () -> Unit = {},
            now: () -> Instant = { Instant.now() },
        ) {
            shareHandler = onShareListing
            openBuyerHandler = onOpenBuyer
            openTransactionHandler = onOpenTransaction
            editPriceHandler = onEditPrice
            nowProvider = now
            _topBarAction.value =
                TopBarAction(
                    icon = PantopusIcon.Share,
                    contentDescription = "Share listing",
                    onClick = { shareHandler() },
                )
        }

        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && loadedAtLeastOnce) return
            reload()
        }

        fun refresh() = reload()

        fun loadMoreIfNeeded() = Unit

        /** Switch the active sort and re-project. Selection is in-memory,
         *  so it persists for the session but resets on a fresh push. */
        fun selectSort(newSort: ListingOffersSort) {
            if (newSort == sort) return
            sort = newSort
            applyState()
        }

        private fun reload() {
            if (!loadedAtLeastOnce) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val listingDeferred = async { listingsRepo.detail(listingId) }
                val offersDeferred = async { offersRepo.listOffers(listingId) }
                val listingResult = listingDeferred.await()
                val offersResult = offersDeferred.await()
                when {
                    listingResult is NetworkResult.Success && offersResult is NetworkResult.Success -> {
                        listing = listingResult.data.listing
                        offers = offersResult.data.offers
                        loadedAtLeastOnce = true
                        applyState()
                    }
                    !loadedAtLeastOnce -> {
                        val failure =
                            (listingResult as? NetworkResult.Failure)
                                ?: (offersResult as? NetworkResult.Failure)
                        _state.value =
                            ListOfRowsUiState.Error(
                                failure?.error?.message ?: "Couldn't load offers.",
                            )
                    }
                }
            }
        }

        private fun applyState() {
            val listingSnapshot = listing
            if (listingSnapshot != null) {
                _listingContext.value =
                    context(
                        listing = listingSnapshot,
                        offerCount = offers.size,
                        sortLabel = sort.label,
                        sortOptions = sortMenuOptions(),
                        onEditPrice = { editPriceHandler() },
                    )
                _subtitle.value = listingSnapshot.title ?: listingTitleHint
            }
            if (offers.isEmpty()) {
                _state.value = emptyState()
                return
            }
            val sorted = sortedOffers()
            val leadingId = leadingOfferId()
            val total = sorted.size
            val now = nowProvider()
            val rows =
                sorted.mapIndexed { index, dto ->
                    row(
                        offer = dto,
                        index = index,
                        total = total,
                        askingPrice = listingSnapshot?.price,
                        isLeading = dto.id == leadingId,
                        now = now,
                        callbacks = callbacksFor(dto),
                    )
                }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "offers", rows = rows)),
                    hasMore = false,
                )
        }

        private fun sortMenuOptions(): List<ListingContextSortOption> =
            ListingOffersSort.entries.map { option ->
                ListingContextSortOption(
                    id = option.id,
                    label = option.label,
                    isSelected = option == sort,
                    select = { selectSort(option) },
                )
            }

        /** Order the offers for display per the active sort. The LEADING
         *  badge is computed separately so it always tracks the top offer. */
        private fun sortedOffers(): List<ListingOfferDto> =
            when (sort) {
                ListingOffersSort.HighestOffer -> offers.sortedByDescending { it.amount ?: 0.0 }
                ListingOffersSort.LowestOffer -> offers.sortedBy { it.amount ?: 0.0 }
                ListingOffersSort.NewestFirst -> offers.sortedByDescending { sortInstant(it) }
                ListingOffersSort.OldestFirst -> offers.sortedBy { sortInstant(it) }
            }

        private fun sortInstant(offer: ListingOfferDto): Instant = parseInstant(offer.createdAt) ?: Instant.EPOCH

        private fun leadingOfferId(): String? =
            offers
                .sortedByDescending { it.amount ?: 0.0 }
                .firstOrNull { ListingOfferStatus.fromRaw(it.status) == ListingOfferStatus.Pending }
                ?.id

        private fun emptyState(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.HandCoins,
                headline = "No offers on this listing yet",
                subcopy =
                    "Most listings draw their first offer within 24 hours. Share it " +
                        "with a few neighborhoods to speed things up.",
                ctaTitle = "Share listing",
                onCta = { shareHandler() },
            )

        private fun loadingContext(titleHint: String): ListingContextConfig =
            ListingContextConfig(
                thumbnail =
                    ThumbnailImage.IconOnGradient(
                        icon = PantopusIcon.ShoppingBag,
                        gradient = GradientPair(PantopusColors.primary600, PantopusColors.primary700),
                    ),
                title = titleHint,
                askPrice = "",
                meta = emptyList(),
                statusChip = ListingContextStatus("Loading…", variant = StatusChipVariant.Neutral),
            )

        // MARK: - Row callbacks

        data class RowCallbacks(
            val onTap: () -> Unit = {},
            val onAccept: () -> Unit = {},
            val onCounter: () -> Unit = {},
            val onDecline: () -> Unit = {},
            val onViewTransaction: () -> Unit = {},
            val onLeaveReview: () -> Unit = {},
        )

        private fun callbacksFor(dto: ListingOfferDto): RowCallbacks =
            RowCallbacks(
                onTap = { dto.buyer?.let(openBuyerHandler) },
                onAccept = { acceptOffer(dto) },
                onCounter = { requestCounter(dto) },
                onDecline = { declineOffer(dto) },
                onViewTransaction = { openTransactionHandler(dto) },
                onLeaveReview = { requestLeaveReview(dto) },
            )

        // MARK: - Mutations

        fun acceptOffer(dto: ListingOfferDto) {
            val previous = offers
            applyOptimisticStatus(dto.id, "accepted")
            viewModelScope.launch {
                when (val result = offersRepo.accept(listingId, dto.id)) {
                    is NetworkResult.Success -> {
                        val accepted = result.data.offer
                        replaceOffer(accepted)
                        checkoutAcceptedOfferIfNeeded(accepted, dto)
                    }
                    is NetworkResult.Failure -> {
                        offers = previous
                        applyState()
                    }
                }
            }
        }

        private suspend fun checkoutAcceptedOfferIfNeeded(
            offer: ListingOfferDto,
            fallback: ListingOfferDto,
        ) {
            if (!shouldCheckoutAcceptedOffer(offer, fallback)) return
            val result =
                paymentsRepo.createPaymentIntent(
                    CreatePaymentIntentRequest(
                        listingId = offer.listingId ?: fallback.listingId ?: listingId,
                        offerId = offer.id,
                        description = listing?.title ?: listingTitleHint,
                    ),
                )
            when (result) {
                is NetworkResult.Success -> {
                    pendingCheckoutOfferId = offer.id
                    _events.emit(ListingOffersEvent.PresentCheckout(result.data))
                }
                is NetworkResult.Failure -> Unit
            }
        }

        fun onCheckoutOutcome(outcome: CheckoutOutcome) {
            val offerId = pendingCheckoutOfferId ?: return
            pendingCheckoutOfferId = null
            if (outcome == CheckoutOutcome.Paid) {
                refresh()
            } else {
                offers.find { it.id == offerId }?.let { replaceOffer(it) }
            }
        }

        private fun shouldCheckoutAcceptedOffer(
            offer: ListingOfferDto,
            fallback: ListingOfferDto,
        ): Boolean {
            if (ListingOfferStatus.fromRaw(offer.status) != ListingOfferStatus.Accepted) return false
            val buyerId = offer.buyerId ?: offer.buyer?.id ?: fallback.buyerId ?: fallback.buyer?.id ?: return false
            return buyerId == currentUserId()
        }

        fun declineOffer(dto: ListingOfferDto) {
            val previous = offers
            applyOptimisticStatus(dto.id, "declined")
            viewModelScope.launch {
                when (val result = offersRepo.decline(listingId, dto.id)) {
                    is NetworkResult.Success -> replaceOffer(result.data.offer)
                    is NetworkResult.Failure -> {
                        offers = previous
                        applyState()
                    }
                }
            }
        }

        fun requestCounter(dto: ListingOfferDto) {
            _counterTarget.value =
                CounterSheetTarget(
                    id = dto.id,
                    buyerName = displayName(dto.buyer),
                    originalAmount = dto.amount,
                    suggestedAmount = dto.amount ?: listing?.price,
                )
        }

        fun cancelCounter() {
            _counterTarget.value = null
        }

        // MARK: - Leave review (BLOCK 2D)

        private fun currentUserId(): String? = (authRepo.state.value as? AuthRepository.State.SignedIn)?.user?.id

        /**
         * Open the transaction-review sheet for a completed offer. The
         * reviewee is whichever party the signed-in viewer is not; this panel
         * is seller-side, so it defaults to reviewing the buyer.
         */
        fun requestLeaveReview(dto: ListingOfferDto) {
            val me = currentUserId()
            val reviewedId: String?
            val reviewedName: String?
            if (me != null && me == dto.buyerId) {
                reviewedId = dto.sellerId ?: dto.seller?.id
                reviewedName = displayName(dto.seller)
            } else {
                reviewedId = dto.buyerId ?: dto.buyer?.id
                reviewedName = displayName(dto.buyer)
            }
            if (reviewedId == null) return
            _leaveReviewTarget.value =
                TransactionReviewSheetTarget(
                    id = dto.id,
                    context = TransactionReviewContext.ListingSale,
                    reviewedId = reviewedId,
                    reviewedName = reviewedName,
                    transactionTitle = listing?.title ?: listingTitleHint ?: "this sale",
                    listingId = dto.listingId,
                    offerId = dto.id,
                )
        }

        fun cancelLeaveReview() {
            _leaveReviewTarget.value = null
        }

        /**
         * Submit the review draft. The sheet renders the result (submitted /
         * duplicate / failed); only [cancelLeaveReview] dismisses it.
         */
        suspend fun submitLeaveReview(draft: TransactionReviewDraft): TransactionReviewSubmitResult {
            val target =
                _leaveReviewTarget.value
                    ?: return TransactionReviewSubmitResult.Failed("No review in progress.")
            val body =
                CreateTransactionReviewBody(
                    reviewedId = target.reviewedId,
                    context = target.context.wireValue,
                    listingId = target.listingId,
                    offerId = target.offerId,
                    tradeId = target.tradeId,
                    gigId = target.gigId,
                    rating = draft.rating,
                    comment = draft.comment,
                    communicationRating = draft.communicationRating,
                    accuracyRating = draft.accuracyRating,
                    punctualityRating = draft.punctualityRating,
                )
            return when (val result = transactionReviewsRepo.create(body)) {
                is NetworkResult.Success -> TransactionReviewSubmitResult.Submitted
                is NetworkResult.Failure -> {
                    val error = result.error
                    if (error is NetworkError.ClientError && error.code == 409) {
                        TransactionReviewSubmitResult.Duplicate
                    } else {
                        TransactionReviewSubmitResult.Failed(error.message)
                    }
                }
            }
        }

        fun confirmCounter(
            amount: Double,
            message: String?,
        ) {
            val target = _counterTarget.value ?: return
            _counterTarget.value = null
            val previous = offers
            applyOptimisticStatus(target.id, "countered", counterAmount = amount)
            viewModelScope.launch {
                when (val result = offersRepo.counter(listingId, target.id, amount, message)) {
                    is NetworkResult.Success -> replaceOffer(result.data.offer)
                    is NetworkResult.Failure -> {
                        offers = previous
                        applyState()
                    }
                }
            }
        }

        private fun applyOptimisticStatus(
            offerId: String,
            status: String,
            counterAmount: Double? = null,
        ) {
            offers =
                offers.map { dto ->
                    if (dto.id != offerId) {
                        dto
                    } else {
                        dto.copy(
                            status = status,
                            counterAmount = counterAmount ?: dto.counterAmount,
                            updatedAt = Instant.now().toString(),
                        )
                    }
                }
            applyState()
        }

        private fun replaceOffer(updated: ListingOfferDto) {
            val previous = offers
            offers =
                previous.map { existing ->
                    if (existing.id != updated.id) {
                        existing
                    } else {
                        // Preserve the enriched buyer/seller cards — the
                        // mutation endpoints return the bare offer row.
                        existing.copy(
                            status = updated.status,
                            amount = updated.amount ?: existing.amount,
                            counterAmount = updated.counterAmount ?: existing.counterAmount,
                            counterMessage = updated.counterMessage ?: existing.counterMessage,
                            respondedAt = updated.respondedAt ?: existing.respondedAt,
                            updatedAt = updated.updatedAt ?: existing.updatedAt,
                        )
                    }
                }
            applyState()
        }
    }
