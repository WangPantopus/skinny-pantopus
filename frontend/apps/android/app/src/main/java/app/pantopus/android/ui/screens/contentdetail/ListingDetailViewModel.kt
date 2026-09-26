@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.listing_offers.ListingOfferDto
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.payments.CreatePaymentIntentRequest
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.listing_offers.ListingOffersRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.ui.screens.marketplace.ListingGradient
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ListingDetailViewModel
    @Inject
    constructor(
        private val repo: ListingsRepository,
        private val offersRepo: ListingOffersRepository,
        private val auth: AuthRepository,
        private val paymentsRepo: PaymentsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        companion object {
            const val LISTING_ID_KEY = "listingId"

            /** The listing's public web page, the link the cover's share chip sends (as the gig detail's share does). */
            fun shareUrl(listingId: String): String = "https://pantopus.com/listing/$listingId"
        }

        private val listingId: String = savedStateHandle.get<String>(LISTING_ID_KEY) ?: ""

        private val _state = MutableStateFlow<ContentDetailUiState>(ContentDetailUiState.Loading)
        val state: StateFlow<ContentDetailUiState> = _state.asStateFlow()

        private var rawListing: ListingDto? = null
        private var acceptedOffer: ListingOfferDto? = null

        /** The viewer's own open (pending or countered) offer; the dock then shows it in place of "Make offer". */
        private var myOffer: ListingOfferDto? = null
        private var checkoutReadFailed = false
        private var isCheckingOut = false
        private var checkoutUserId: String? = null
        private var checkoutOfferId: String? = null
        private var readInFlight = false

        private val _saved = MutableStateFlow(false)

        /** Whether the viewer has saved this listing (`userHasSaved`); drives the cover's bookmark chip. */
        val saved: StateFlow<Boolean> = _saved.asStateFlow()
        private var saveInFlight = false

        /** Current listing snapshot — null until the first fetch resolves. */
        fun listingSnapshot(): ListingDto? = rawListing

        /** The viewer's open offer on this listing, shown with Withdraw when they tap "Your offer". */
        fun myOfferSnapshot(): ListingOfferDto? = myOffer

        /**
         * True when the loaded listing is owned by the currently signed-in
         * user. Drives the dock's "Make offer" → "View offers" swap.
         */
        fun isOwnedByMe(): Boolean {
            val owner = rawListing?.userId?.takeIf { it.isNotEmpty() } ?: return false
            val me = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return false
            return owner == me
        }

        /** True when the loaded listing is sold; its dock then offers "Find similar" instead of an offer. */
        fun isSold(): Boolean = rawListing?.let { Projection.isSold(it) } == true

        /**
         * The cover's bookmark chip. `POST /api/listings/:id/save` toggles the save and answers the new state:
         * the chip flips at once and settles on that answer, or flips back and reports through [onError].
         */
        fun toggleSave(onError: (String) -> Unit = {}) {
            if (saveInFlight || rawListing == null) return
            saveInFlight = true
            val target = !_saved.value
            _saved.value = target
            viewModelScope.launch {
                when (val result = repo.save(listingId)) {
                    is NetworkResult.Success -> _saved.value = result.data.saved ?: target
                    is NetworkResult.Failure -> {
                        _saved.value = !target
                        onError(if (target) "Couldn't save this listing." else "Couldn't remove the save.")
                    }
                }
                saveInFlight = false
            }
        }

        fun load() {
            if (readInFlight || isCheckingOut) return
            viewModelScope.launch { refreshContent() }
        }

        private suspend fun refreshContent() {
            readInFlight = true
            _state.value = ContentDetailUiState.Loading
            try {
                when (val result = repo.detail(listingId)) {
                    is NetworkResult.Success -> {
                        rawListing = result.data.listing
                        _saved.value = result.data.listing.userHasSaved == true
                        refreshCheckout()
                        rebuild()
                    }
                    is NetworkResult.Failure ->
                        _state.value = ContentDetailUiState.Error(result.error.displayMessage("Couldn't load detail."))
                }
            } finally {
                readInFlight = false
            }
        }

        private suspend fun refreshCheckout() {
            acceptedOffer = null
            myOffer = null
            checkoutReadFailed = false
            val viewerId = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return
            if (isOwnedByMe() || isSold()) return
            when (val offers = offersRepo.listOffers(listingId)) {
                is NetworkResult.Success -> {
                    acceptedOffer =
                        offers.data.offers.firstOrNull {
                            it.status == "accepted" && (it.buyerId ?: it.buyer?.id) == viewerId
                        }
                    // The server allows one open offer per buyer; a new one is refused while it stands.
                    myOffer =
                        offers.data.offers.firstOrNull {
                            it.status in setOf("pending", "countered") && (it.buyerId ?: it.buyer?.id) == viewerId
                        }
                    acceptedOffer?.let { paymentsRepo.reconcileListingConfirmation(viewerId, listingId, it) }
                }
                is NetworkResult.Failure -> checkoutReadFailed = true
            }
        }

        private val isAwaitingConfirmation: Boolean
            get() =
                paymentsRepo.isListingConfirmationPending(
                    (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id,
                    listingId,
                )

        fun hasCheckoutAction(): Boolean =
            !isSold() && !isOwnedByMe() && (acceptedOffer != null || checkoutReadFailed || isAwaitingConfirmation)

        private fun checkoutButton(): ContentDetailDockButton? {
            val summary = acceptedOffer?.checkout
            return when {
                isCheckingOut -> ContentDetailDockButton("Checking payment…", PantopusIcon.Clock, enabled = false)
                isAwaitingConfirmation -> ContentDetailDockButton("Check payment status", PantopusIcon.Clock)
                checkoutReadFailed -> ContentDetailDockButton("Check payment", PantopusIcon.Clock)
                acceptedOffer == null -> null
                summary == null -> ContentDetailDockButton("Check payment", PantopusIcon.Clock)
                summary.canContinue && summary.state in setOf("ready", "retry", "pending") ->
                    ContentDetailDockButton(if (summary.state == "retry") "Retry checkout" else "Continue checkout")
                else -> checkoutStatusButton(summary.state)
            }
        }

        private fun checkoutStatusButton(state: String): ContentDetailDockButton {
            val label =
                when (state) {
                    "authorized" -> "Payment authorized"
                    "processing" -> "Payment processing"
                    "paid" -> "Payment received"
                    "refund_pending" -> "Refund processing"
                    "partially_refunded" -> "Partially refunded"
                    "refunded" -> "Payment refunded"
                    "disputed" -> "Payment disputed"
                    "not_payable" -> "Pickup pending"
                    else -> null
                }
            return if (label == null) {
                ContentDetailDockButton("Check payment", PantopusIcon.Clock)
            } else {
                ContentDetailDockButton(label, PantopusIcon.Clock, enabled = false)
            }
        }

        private fun canContinueCheckout(): Boolean {
            val summary = acceptedOffer?.checkout ?: return false
            return !checkoutReadFailed && !isAwaitingConfirmation && summary.canContinue &&
                summary.state in setOf("ready", "retry", "pending")
        }

        private fun rebuild() {
            val listing = rawListing ?: return
            _state.value = ContentDetailUiState.Loaded(Projection.project(listing, isOwnedByMe(), checkoutButton(), myOffer))
        }

        fun continueCheckout(
            onReady: (PaymentIntentSheetParamsDto) -> Unit,
            onError: (String) -> Unit,
            onPending: () -> Unit = {},
        ) {
            if (isCheckingOut || readInFlight) return
            val offer = acceptedOffer
            if (offer == null || !canContinueCheckout()) {
                viewModelScope.launch {
                    refreshContent()
                    if (checkoutReadFailed || acceptedOffer?.checkout == null || acceptedOffer?.checkout?.state == "unavailable") {
                        onError("Payment status is unavailable. Please try again.")
                    } else if (isAwaitingConfirmation) {
                        onPending()
                    }
                }
                return
            }
            checkoutUserId = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
            checkoutOfferId = offer.id
            isCheckingOut = true
            rebuild()
            viewModelScope.launch {
                when (
                    val result =
                        paymentsRepo.createPaymentIntent(
                            CreatePaymentIntentRequest(listingId = listingId, offerId = offer.id),
                        )
                ) {
                    is NetworkResult.Success -> {
                        if (result.data.clientSecret.isNullOrBlank()) {
                            isCheckingOut = false
                            rebuild()
                            onError("Couldn't start checkout. Please try again.")
                        } else {
                            onReady(result.data)
                        }
                    }
                    is NetworkResult.Failure -> {
                        isCheckingOut = false
                        rebuild()
                        onError(result.error.displayMessage("Couldn't start checkout. Please try again."))
                    }
                }
            }
        }

        fun onCheckoutOutcome(
            outcome: CheckoutOutcome,
            onError: (String) -> Unit,
            onPending: () -> Unit = {},
        ) {
            viewModelScope.launch {
                if (outcome == CheckoutOutcome.Paid) {
                    // Keep the submission across screen re-entry while the webhook is pending.
                    val viewerId = checkoutUserId
                    val offerId = checkoutOfferId
                    if (viewerId != null && offerId != null) {
                        paymentsRepo.markListingConfirmationPending(viewerId, listingId, offerId)
                    }
                    refreshContent()
                    if (isAwaitingConfirmation) onPending()
                }
                checkoutUserId = null
                checkoutOfferId = null
                isCheckingOut = false
                if (_state.value !is ContentDetailUiState.Error) rebuild()
                if (outcome is CheckoutOutcome.Declined) onError(outcome.message ?: "Payment failed. Please try again.")
            }
        }

        /**
         * The buyer's offer → `POST /api/listings/:id/offers`, the route whose offers the seller sees under
         * "View offers". [onFailure] gets the server's reason (e.g. an offer is already pending).
         */
        fun makeOffer(
            amount: Double?,
            message: String?,
            onFailure: (String) -> Unit = {},
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = offersRepo.create(listingId, amount, message)) {
                    is NetworkResult.Success -> {
                        // The dock shows the sent offer at once ("Your offer $X").
                        myOffer = result.data.offer
                        rebuild()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        onFailure(result.error.displayMessage("Couldn't send your offer. Please try again."))
                        onResult(false)
                    }
                }
            }
        }

        /**
         * The buyer withdraws their open offer → `POST /api/listings/:id/offers/:offerId/withdraw`, as on web; the dock
         * returns to "Make offer". [onFailure] gets the server's reason.
         */
        fun withdrawOffer(
            onFailure: (String) -> Unit = {},
            onResult: (Boolean) -> Unit = {},
        ) {
            val offer = myOffer ?: return onResult(false)
            viewModelScope.launch {
                when (val result = offersRepo.withdraw(listingId, offer.id)) {
                    is NetworkResult.Success -> {
                        myOffer = null
                        rebuild()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        onFailure(result.error.displayMessage("Couldn't withdraw your offer. Please try again."))
                        onResult(false)
                    }
                }
            }
        }

        object Projection {
            fun project(
                listing: ListingDto,
                isViewerOwner: Boolean = false,
                checkoutButton: ContentDetailDockButton? = null,
                myOffer: ListingOfferDto? = null,
            ): ContentDetailContent {
                val isFree = listing.isFree ?: false
                val sold = isSold(listing)
                // An accepted offer or trade holds the listing for that buyer until the handoff.
                val onHold = !sold && listing.status == "pending_pickup"
                val priceLine = listingPriceLine(listing, isFree)
                val imageUrl = listing.firstImage ?: listing.mediaUrls?.firstOrNull()
                val cover =
                    ContentDetailCover(
                        imageUrl = imageUrl,
                        gradient = ListingGradient.from(listing.id),
                        placeholderIcon = placeholderIcon(listing.category, listing.layer),
                        pageCount = (listing.mediaUrls?.size ?: 1).coerceAtLeast(1),
                        activePage = 0,
                        sold = sold,
                        glassActions = listOf(PantopusIcon.Share, PantopusIcon.Bookmark),
                    )
                // The real seller (name, photo, verification) from the listing's creator identity.
                val seller = listing.creator
                val sellerName = seller?.resolvedDisplayName() ?: "Seller"
                val counterparty =
                    ContentDetailCounterparty(
                        displayName = sellerName,
                        initials = GigDetailViewModel.Projection.initialsFromName(sellerName),
                        avatarUrl = seller?.resolvedAvatarUrl(),
                        identityKind = "personal",
                        verified = seller?.resolvedVerified() == true,
                        rating = null,
                        trailing = listing.locationName,
                        // The seller viewing their own listing has no one to message here.
                        showsMessageButton = !isViewerOwner,
                    )
                val modules =
                    buildList {
                        listing.description?.takeIf { it.isNotEmpty() }?.let {
                            add(ContentDetailModule.Description(id = "desc", title = "Description", icon = null, body = it))
                        }
                        val detailRows =
                            buildList {
                                conditionLabel(listing.condition)?.let {
                                    add(ContentDetailModule.DetailsGrid.Row("Condition", it))
                                }
                                listing.locationName?.takeIf { it.isNotEmpty() }?.let {
                                    add(ContentDetailModule.DetailsGrid.Row("Location", it))
                                }
                            }
                        if (detailRows.isNotEmpty()) {
                            add(
                                ContentDetailModule.DetailsGrid(
                                    id = "details",
                                    title = "Details",
                                    icon = PantopusIcon.AlertCircle,
                                    rows = detailRows,
                                ),
                            )
                        }
                    }
                val dock = dock(sold, onHold, isViewerOwner, checkoutButton, myOffer)
                return ContentDetailContent(
                    kind = ContentDetailKind.Listing,
                    cover = cover,
                    statusPill = statusPill(sold = sold, onHold = onHold),
                    hero =
                        ContentDetailHero(
                            title = listing.title ?: "Listing",
                            priceLine = priceLine,
                            priceCaption = if (listing.layer == "rentals") "per week" else null,
                            priceStrikethrough = sold,
                            inlinePills = inlinePills(listing, isFree),
                        ),
                    counterparty = counterparty,
                    modules = modules,
                    trustCapsules = emptyList(),
                    dock = dock,
                )
            }

            private fun dock(
                sold: Boolean,
                onHold: Boolean,
                isViewerOwner: Boolean,
                checkoutButton: ContentDetailDockButton?,
                myOffer: ListingOfferDto?,
            ): ContentDetailDock =
                if (sold) {
                    ContentDetailDock(
                        secondary = ContentDetailDockButton(label = "Seller", icon = PantopusIcon.ShoppingBag),
                        primary = ContentDetailDockButton(label = "Find similar", icon = PantopusIcon.Search),
                    )
                } else if (!isViewerOwner && checkoutButton != null) {
                    ContentDetailDock(
                        secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                        primary = checkoutButton,
                    )
                } else if (onHold && !isViewerOwner) {
                    // A held listing takes no new offers (the server refuses them); its seller still reaches the offers.
                    ContentDetailDock(
                        secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                        primary = ContentDetailDockButton(label = "Pickup pending", icon = PantopusIcon.Clock, enabled = false),
                    )
                } else {
                    // The buyer's open offer replaces "Make offer": "Your offer $20" (free-listing interest has no amount).
                    val myOfferAmount = myOffer?.amount?.takeIf { it > 0 }
                    val primaryLabel =
                        when {
                            isViewerOwner -> "View offers"
                            myOffer == null -> "Make offer"
                            myOfferAmount != null -> "Your offer ${usd(myOfferAmount)}"
                            else -> "Your offer"
                        }
                    ContentDetailDock(
                        secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                        primary = ContentDetailDockButton(label = primaryLabel),
                    )
                }

            /** "$20" or "$20.50", as the price line shows amounts. */
            fun usd(amount: Double): String =
                if (amount % 1.0 == 0.0) "$${amount.toInt()}" else String.format(java.util.Locale.US, "$%.2f", amount)

            fun isSold(listing: ListingDto): Boolean = listing.soldAt != null || listing.status == "sold"

            // "Pickup pending" is the My Listings vocabulary for a listing held for a buyer.
            private fun statusPill(
                sold: Boolean,
                onHold: Boolean,
            ): ContentDetailPill? =
                if (sold) {
                    ContentDetailPill(
                        id = "status",
                        label = "Sold",
                        icon = PantopusIcon.AlertCircle,
                        tone = ContentDetailPill.Tone.Error,
                    )
                } else if (onHold) {
                    ContentDetailPill(
                        id = "status",
                        label = "Pickup pending",
                        icon = PantopusIcon.Clock,
                        tone = ContentDetailPill.Tone.Warning,
                    )
                } else {
                    null
                }

            private fun listingPriceLine(
                listing: ListingDto,
                isFree: Boolean,
            ): String =
                when {
                    isFree -> "Free"
                    listing.price == null -> "—"
                    listing.price % 1.0 == 0.0 -> "$${listing.price.toInt()}"
                    else -> String.format("$%.2f", listing.price)
                }

            private fun inlinePills(
                listing: ListingDto,
                isFree: Boolean,
            ): List<ContentDetailPill> =
                buildList {
                    conditionLabel(listing.condition)?.let {
                        add(
                            ContentDetailPill(
                                id = "cond",
                                label = it,
                                icon = PantopusIcon.Sparkles,
                                tone = ContentDetailPill.Tone.Success,
                            ),
                        )
                    }
                    when {
                        listing.layer == "rentals" ->
                            add(
                                ContentDetailPill(
                                    id = "rental",
                                    label = "Rental",
                                    icon = PantopusIcon.Calendar,
                                    tone = ContentDetailPill.Tone.Business,
                                ),
                            )
                        isFree ->
                            add(
                                ContentDetailPill(
                                    id = "free",
                                    label = "Free",
                                    icon = PantopusIcon.Heart,
                                    tone = ContentDetailPill.Tone.Success,
                                ),
                            )
                        else ->
                            add(
                                ContentDetailPill(
                                    id = "pickup",
                                    label = "Pickup",
                                    icon = PantopusIcon.Hand,
                                    tone = ContentDetailPill.Tone.Neutral,
                                ),
                            )
                    }
                    distanceLabel(listing.distanceMeters)?.let {
                        add(ContentDetailPill(id = "dist", label = it, tone = ContentDetailPill.Tone.Neutral))
                    }
                }

            private fun placeholderIcon(
                category: String?,
                layer: String?,
            ): PantopusIcon {
                if (layer == "vehicles") return PantopusIcon.Send
                if (layer == "rentals") return PantopusIcon.Calendar
                return when (category) {
                    "furniture" -> PantopusIcon.Home
                    "electronics" -> PantopusIcon.Lightbulb
                    "clothing" -> PantopusIcon.ShoppingBag
                    "tools" -> PantopusIcon.Hammer
                    "books_media" -> PantopusIcon.File
                    "free_stuff" -> PantopusIcon.Heart
                    else -> PantopusIcon.ShoppingBag
                }
            }

            private fun conditionLabel(condition: String?): String? {
                if (condition.isNullOrEmpty()) return null
                return when (condition) {
                    "new" -> "New"
                    "like_new" -> "Like new"
                    "good" -> "Good"
                    "fair" -> "Fair"
                    "for_parts" -> "For parts"
                    else -> condition.replace("_", " ").replaceFirstChar { it.uppercase() }
                }
            }

            private fun distanceLabel(meters: Double?): String? {
                if (meters == null) return null
                val miles = meters / 1609.344
                return when {
                    miles < 0.1 -> "< 0.1 mi"
                    miles < 10 -> String.format("%.1f mi", miles)
                    else -> "${miles.toInt()} mi"
                }
            }
        }
    }
