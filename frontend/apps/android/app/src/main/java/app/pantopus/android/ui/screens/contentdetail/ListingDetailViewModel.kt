@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.MessageListingBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
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
        private val auth: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        companion object {
            const val LISTING_ID_KEY = "listingId"
        }

        private val listingId: String = savedStateHandle.get<String>(LISTING_ID_KEY) ?: ""

        private val _state = MutableStateFlow<ContentDetailUiState>(ContentDetailUiState.Loading)
        val state: StateFlow<ContentDetailUiState> = _state.asStateFlow()

        private var rawListing: ListingDto? = null

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

        fun load() {
            _state.value = ContentDetailUiState.Loading
            viewModelScope.launch {
                when (val result = repo.detail(listingId)) {
                    is NetworkResult.Success -> {
                        rawListing = result.data.listing
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

        fun sendMessage(
            text: String,
            offerAmount: Double? = null,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                val result =
                    repo.messageListing(
                        id = listingId,
                        body = MessageListingBody(message = text, offerAmount = offerAmount),
                    )
                onResult(result is NetworkResult.Success)
            }
        }

        object Projection {
            fun project(
                listing: ListingDto,
                isViewerOwner: Boolean = false,
            ): ContentDetailContent {
                val isFree = listing.isFree ?: false
                val sold = isSold(listing)
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
                val counterparty =
                    ContentDetailCounterparty(
                        displayName = "Seller",
                        initials = "S",
                        identityKind = "personal",
                        verified = true,
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
                        if (sold) {
                            add(
                                ContentDetailModule.Callout(
                                    id = "alert-similar",
                                    style = ContentDetailModule.Callout.Style.Banner,
                                    tone = ContentDetailModule.Callout.Tone.Neutral,
                                    icon = PantopusIcon.Bell,
                                    iconTone = ContentDetailModule.Callout.IconTone.Primary,
                                    title = "Alert me when similar appears",
                                    subtitle = listing.title,
                                    trailingActionLabel = "Set",
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
                    } else {
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = if (isViewerOwner) "View offers" else "Make offer"),
                        )
                    }
                return ContentDetailContent(
                    kind = ContentDetailKind.Listing,
                    cover = cover,
                    statusPill =
                        if (sold) {
                            ContentDetailPill(
                                id = "status",
                                label = "Sold",
                                icon = PantopusIcon.AlertCircle,
                                tone = ContentDetailPill.Tone.Error,
                            )
                        } else {
                            null
                        },
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

            private fun isSold(listing: ListingDto): Boolean = listing.soldAt != null || listing.status == "sold"

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
