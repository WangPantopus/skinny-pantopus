@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.listing

import java.util.UUID

/**
 * The six pre-success steps of the Snap & Sell wizard, in order. The
 * success state is a sentinel terminal step used to render the success
 * hero block.
 */
enum class ListingComposeStep(
    val ordinal0: Int,
) {
    Photos(0),
    TitleCategory(1),
    ConditionDescription(2),
    Price(3),
    Location(4),
    Review(5),
    Success(6),
    ;

    /** One-indexed position used in the "N of M" top-bar readout, or null
     *  for the success terminal. */
    val stepNumber: Int?
        get() =
            when (this) {
                Photos -> 1
                TitleCategory -> 2
                ConditionDescription -> 3
                Price -> 4
                Location -> 5
                Review -> 6
                Success -> null
            }

    companion object {
        /** Total number of "step N of M" steps shown in the readout. */
        const val PROGRESS_TOTAL: Int = 6

        fun fromOrdinal(value: Int): ListingComposeStep = entries.firstOrNull { it.ordinal0 == value } ?: Photos
    }
}

/** A12.9 create-mode entry path. Snap starts with camera capture; Manual preserves the old grid wizard. */
enum class ListingComposeEntryMode { Snap, Manual }

/**
 * Category selectable in step 2. Mirrors the five Marketplace chips and
 * resolves onto backend `layer` + the wanted/free flags.
 */
enum class ListingComposeCategory(
    val key: String,
    val label: String,
    val subtitle: String,
) {
    Goods("goods", "Goods", "Sell something you own."),
    Rentals("rentals", "Rentals", "Rent something out by the day or week."),
    Vehicles("vehicles", "Vehicles", "Cars, bikes, scooters, trailers."),
    Free("free", "Free", "Give something away to a neighbor."),
    Wanted("wanted", "Wanted", "Ask the neighborhood for something."),
    ;

    /** Backend `layer`. Free + Wanted both map to `goods`. */
    val layer: String
        get() =
            when (this) {
                Goods, Free, Wanted -> "goods"
                Rentals -> "rentals"
                Vehicles -> "vehicles"
            }

    /** Backend `listing_type` (`backend/constants/marketplace.js` LISTING_TYPES). */
    val listingType: String
        get() =
            when (this) {
                Goods -> "sell_item"
                Rentals -> "rent_sublet"
                Vehicles -> "vehicle_sale"
                Free -> "free_item"
                Wanted -> "wanted_request"
            }

    /**
     * Backend `category` used when the AI draft didn't supply one.
     * Must be a member of LISTING_CATEGORIES — the wizard chip keys
     * themselves are not valid backend categories.
     */
    val fallbackBackendCategory: String
        get() =
            when (this) {
                Vehicles -> "vehicles"
                Free -> "free_stuff"
                Goods, Rentals, Wanted -> "other"
            }

    val isFreeDefault: Boolean get() = this == Free
    val isWanted: Boolean get() = this == Wanted

    /** Wanted requests skip the condition step. */
    val requiresCondition: Boolean
        get() =
            when (this) {
                Goods, Vehicles, Free, Rentals -> true
                Wanted -> false
            }
}

/** Condition selectable in step 3. */
enum class ListingComposeCondition(
    val key: String,
    val label: String,
    val subtitle: String,
) {
    New("new", "New", "Unused, in original packaging."),
    LikeNew("like_new", "Like new", "Barely used, no visible wear."),
    Good("good", "Good", "Lightly used, minor wear."),
    Fair("fair", "Fair", "Used, with visible wear."),
    ForParts("for_parts", "For parts", "Not working — usable for parts."),
}

/** Pricing kind in step 4. */
enum class ListingComposePriceKind(
    val key: String,
    val label: String,
    val subtitle: String,
) {
    Free("free", "Free", "No price — first to claim."),
    Fixed("fixed", "Fixed price", "Buyers see one price."),
    Negotiable("negotiable", "Open to offers", "Asking price, buyers can offer."),
}

/** Pickup vs delivery preference in step 4. */
enum class ListingComposeFulfillment(
    val key: String,
    val label: String,
    val subtitle: String,
) {
    Pickup("pickup", "Pickup", "Buyer comes to you."),
    Delivery("delivery", "Delivery", "You drop off within the neighborhood."),
    ;

    /** Maps onto the backend `meetup_preference` enum — only
     *  `porch_pickup` / `public_meetup` / `flexible` are accepted, so
     *  delivery rides on `flexible` + `deliveryAvailable=true`. */
    val meetupPreference: String
        get() =
            when (this) {
                Pickup -> "public_meetup"
                Delivery -> "flexible"
            }
}

/** Location kind in step 5. */
enum class ListingComposeLocationKind(
    val key: String,
    val label: String,
    val subtitle: String,
) {
    SavedAddress(
        "saved_address",
        "Use my saved address",
        "We'll share it after a buyer commits.",
    ),
    MeetPoint(
        "meet_point",
        "Pick a meet point",
        "Park, plaza, or storefront within walking distance.",
    ),
}

/**
 * One photo in the wizard's photo grid. The id is stable so reorder
 * and remove operations can identify rows. `localImageData` carries
 * the processed JPEG for camera/library picks; it is deliberately not
 * persisted (mirrors iOS excluding it from Codable) — remote photos
 * carry their hosted URL in `token` instead.
 */
data class ListingComposePhoto(
    val id: String = UUID.randomUUID().toString(),
    val token: String,
    val localImageData: ByteArray? = null,
) {
    /** Hosted media URL → goes into `mediaUrls`; local bytes upload separately. */
    val isRemote: Boolean
        get() = token.startsWith("http://") || token.startsWith("https://")

    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is ListingComposePhoto &&
                    id == other.id &&
                    token == other.token &&
                    (
                        localImageData === other.localImageData ||
                            (localImageData != null && other.localImageData != null && localImageData.contentEquals(other.localImageData))
                    )
            )

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + token.hashCode()
        result = 31 * result + (localImageData?.contentHashCode() ?: 0)
        return result
    }
}

/** Comp-range band from the vision draft's `priceSuggestion`. */
data class ListingComposePriceSuggestion(
    val low: Double,
    val median: Double,
    val high: Double,
    val basis: String? = null,
    val comparableCount: Int? = null,
)

/** Persistable form state for the wizard. */
data class ListingComposeFormState(
    val step: Int = ListingComposeStep.Photos.ordinal0,
    val entryMode: ListingComposeEntryMode = ListingComposeEntryMode.Snap,
    val photos: List<ListingComposePhoto> = emptyList(),
    val title: String = "",
    val category: ListingComposeCategory? = null,
    val condition: ListingComposeCondition? = null,
    val bodyText: String = "",
    val priceKind: ListingComposePriceKind? = null,
    val priceAmount: String = "",
    val fulfillment: ListingComposeFulfillment = ListingComposeFulfillment.Pickup,
    val deliveryEnabled: Boolean = false,
    val locationKind: ListingComposeLocationKind? = null,
    val locationLabel: String = "",
    /** Backend category from the AI draft (LISTING_CATEGORIES member).
     *  Falls back to the wizard chip's `fallbackBackendCategory` at submit. */
    val backendCategory: String? = null,
    /** Comp band from the vision draft; drives the snap-review price track. */
    val priceSuggestion: ListingComposePriceSuggestion? = null,
) {
    val currentStep: ListingComposeStep get() = ListingComposeStep.fromOrdinal(step)

    companion object {
        val EMPTY = ListingComposeFormState()

        /** Max photos in the grid. */
        const val MAX_PHOTOS = 8

        /** Max photos sent to the vision draft endpoint. */
        const val MAX_VISION_IMAGES = 5

        /** A12.9 camera coaching target before review. */
        const val TARGET_CAPTURE_ANGLES = 4

        /** Min / max bounds enforced on step transitions. */
        const val TITLE_MIN_LENGTH = 5
        const val TITLE_MAX_LENGTH = 80
        const val DESCRIPTION_MIN_LENGTH = 20
        const val DESCRIPTION_MAX_LENGTH = 2000
    }
}

/** Outbound navigation events the screen consumes. */
sealed interface ListingComposeOutboundEvent {
    /** Pop the wizard with no further navigation. */
    data object Dismiss : ListingComposeOutboundEvent

    /** Pop the wizard and navigate to the new listing's detail. */
    data class OpenListingDetail(
        val listingId: String,
    ) : ListingComposeOutboundEvent

    /** Pop the wizard after an edit save — the host pops back to the
     *  detail underneath so it refreshes from its own .task block. */
    data class ListingUpdated(
        val listingId: String,
    ) : ListingComposeOutboundEvent
}

/**
 * Whether the wizard is creating a new listing or editing an existing
 * one. Edit mode carries the listing id (POST → PATCH switch) and an
 * optional `jumpToStep` so entry points like "Edit price" can land
 * directly on the price step instead of step one.
 */
sealed interface ListingComposeMode {
    data object Create : ListingComposeMode

    data class Edit(
        val listingId: String,
        val jumpToStep: ListingComposeStep? = null,
    ) : ListingComposeMode

    val isEdit: Boolean get() = this is Edit

    val editingListingId: String? get() = (this as? Edit)?.listingId
}
