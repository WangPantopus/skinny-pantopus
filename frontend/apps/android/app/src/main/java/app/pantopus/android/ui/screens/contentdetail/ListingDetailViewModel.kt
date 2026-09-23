@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.listing_offers.ListingOffersRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.ui.screens.marketplace.ListingGradient
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

        private val _saved = MutableStateFlow(false)

        /** Whether the viewer has saved this listing (`userHasSaved`); drives the cover's bookmark chip. */
        val saved: StateFlow<Boolean> = _saved.asStateFlow()
        private var saveInFlight = false

        /** Current listing snapshot — null until the first fetch resolves. */
        fun listingSnapshot(): ListingDto? = rawListing

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
            _state.value = ContentDetailUiState.Loading
            viewModelScope.launch {
                when (val result = repo.detail(listingId)) {
                    is NetworkResult.Success -> {
                        rawListing = result.data.listing
                        _saved.value = result.data.listing.userHasSaved == true
                        _state.value =
                            ContentDetailUiState.Loaded(
                                Projection.project(
                                    result.data.listing,
                                    isViewerOwner = isOwnedByMe(),
                                ),
                            )
                    }
                    is NetworkResult.Failure -> {
                        _state.value = ContentDetailUiState.Error(result.error.displayMessage("Couldn't load detail."))
                    }
                }
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
                    is NetworkResult.Success -> onResult(true)
                    is NetworkResult.Failure -> {
                        onFailure(result.error.displayMessage("Couldn't send your offer. Please try again."))
                        onResult(false)
                    }
                }
            }
        }

        object Projection {
            fun project(
                listing: ListingDto,
                isViewerOwner: Boolean = false,
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
                val dock =
                    if (sold) {
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Seller", icon = PantopusIcon.ShoppingBag),
                            primary = ContentDetailDockButton(label = "Find similar", icon = PantopusIcon.Search),
                        )
                    } else if (onHold && !isViewerOwner) {
                        // A held listing takes no new offers (the server refuses them); its seller still reaches the offers.
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = "Pickup pending", icon = PantopusIcon.Clock, enabled = false),
                        )
                    } else {
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = if (isViewerOwner) "View offers" else "Make offer"),
                        )
                    }
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
