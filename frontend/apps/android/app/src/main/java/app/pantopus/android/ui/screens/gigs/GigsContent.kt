@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * The task categories for the Gigs feed: every category the backend
 * accepts (`VALID_CATEGORIES` in backend/services/magicTaskService.js,
 * web's `GIG_CATEGORIES`) plus the `All` filter. `All` is filter-only —
 * gigs in the payload always carry a concrete category. The first eight
 * colors come from the design tokens (`gigs-frames.jsx` CATS), the rest
 * from the same Tailwind 600-level scale, so they stay Gigs-local rather
 * than crowding the shared theme palette. `Other` comes last so pickers
 * that list [entries] end with it.
 */
enum class GigsCategory(
    val key: String,
    val label: String,
    val color: Color,
) {
    All("all", "All", Color(0xFF0284C7)),
    Handyman("handyman", "Handyman", Color(0xFFEA580C)),
    Cleaning("cleaning", "Cleaning", Color(0xFF0EA5E9)),
    Moving("moving", "Moving", Color(0xFF7C3AED)),
    PetCare("petcare", "Pet care", Color(0xFF16A34A)),
    ChildCare("childcare", "Child care", Color(0xFFDB2777)),
    Tutoring("tutoring", "Tutoring", Color(0xFFCA8A04)),
    Tech("tech", "Tech", Color(0xFF475569)),
    Delivery("delivery", "Delivery", Color(0xFF0891B2)),

    /** Indigo-600. */
    Photography("photography", "Photography", Color(0xFF4F46E5)),

    /** Red-600. */
    Cooking("cooking", "Cooking", Color(0xFFDC2626)),

    /** Lime-600. */
    Gardening("gardening", "Gardening", Color(0xFF65A30D)),

    /** Rose-600. */
    EventHelp("eventhelp", "Event help", Color(0xFFE11D48)),

    /** Cyan-700, next to Delivery. */
    Errands("errands", "Errands", Color(0xFF0E7490)),

    /** Emerald-600. */
    GroceryPickup("grocerypickup", "Grocery pickup", Color(0xFF059669)),

    /** Blue-600. */
    Plumbing("plumbing", "Plumbing", Color(0xFF2563EB)),

    /** Amber-600. */
    Electrical("electrical", "Electrical", Color(0xFFD97706)),

    /** Teal-600. */
    Hvac("hvac", "HVAC", Color(0xFF0D9488)),

    /** Stone-600. */
    Roofing("roofing", "Roofing", Color(0xFF57534E)),

    /** Amber-700. */
    GeneralContractor("generalcontractor", "General contractor", Color(0xFFB45309)),

    /** Green-700. */
    LandscapingPro("landscapingpro", "Landscaping pro", Color(0xFF15803D)),

    /** Purple-600. */
    HomeInspector("homeinspector", "Home inspector", Color(0xFF9333EA)),

    /** Fuchsia-600. */
    PaintingPro("paintingpro", "Painting pro", Color(0xFFC026D3)),

    /** Orange-800. */
    Flooring("flooring", "Flooring", Color(0xFF9A3412)),

    /** Gray-500. */
    Other("other", "Other", Color(0xFF6B7280)),
    ;

    companion object {
        /**
         * What the chip rows and the filter sheet offer: web's browse list
         * (`GIG_BROWSE_CATEGORIES`) after [All]. The errand and pro-service
         * categories show on rows, cards and the detail, as on web.
         */
        val filterCases: List<GigsCategory> =
            listOf(
                All, Handyman, Cleaning, Moving, PetCare, ChildCare, Tutoring, Tech, Delivery,
                Photography, Cooking, Gardening, EventHelp, Other,
            )

        /**
         * [filterCases], plus [active] at the end while it's a category
         * reached another way (a browse cluster or a saved search).
         */
        fun filterCases(including: GigsCategory): List<GigsCategory> =
            if (including in filterCases) filterCases else filterCases + including

        /** Backend-key → enum. Unknown keys fall back to Other. */
        fun fromBackendKey(raw: String?): GigsCategory = fromBackendKeyOrNull(raw) ?: Other

        /**
         * Backend-key → enum, or null for a value the backend's list doesn't
         * have. Web labels ("Pet Care", "Event Help") match too.
         */
        @Suppress("CyclomaticComplexMethod")
        fun fromBackendKeyOrNull(raw: String?): GigsCategory? {
            val key =
                (raw ?: "")
                    .lowercase()
                    .replace("_", "")
                    .replace("-", "")
                    .replace(" ", "")
            return when (key) {
                "all" -> All
                "handyman", "handy", "repair", "repairs" -> Handyman
                "cleaning", "clean" -> Cleaning
                "moving", "move", "movers" -> Moving
                "petcare", "pet", "pets", "dogwalking", "petsitting" -> PetCare
                "childcare", "child", "babysitting", "nanny" -> ChildCare
                "tutoring", "tutor", "lessons", "teaching" -> Tutoring
                "tech", "technology", "techsupport", "it", "computer" -> Tech
                "delivery", "deliveries", "courier" -> Delivery
                "photography", "photo", "photos", "photographer" -> Photography
                "cooking", "cook", "chef", "meals", "mealprep" -> Cooking
                "gardening", "garden", "yard", "yardwork", "lawn", "lawncare" -> Gardening
                "eventhelp", "event", "events" -> EventHelp
                "errands", "errand" -> Errands
                "grocerypickup", "grocery", "groceries" -> GroceryPickup
                "plumbing", "plumber" -> Plumbing
                "electrical", "electric", "electrician" -> Electrical
                "hvac", "heating", "cooling" -> Hvac
                "roofing", "roof", "roofer" -> Roofing
                "generalcontractor", "contractor" -> GeneralContractor
                "landscapingpro", "landscaping", "landscaper" -> LandscapingPro
                "homeinspector", "homeinspection", "inspector", "inspection" -> HomeInspector
                "paintingpro", "painting", "painter" -> PaintingPro
                "flooring", "floors" -> Flooring
                "other", "general" -> Other
                else -> null
            }
        }
    }
}

/** Sort options for the Gigs feed (matches backend `sort` enum). */
enum class GigsSort(
    val key: String,
    val label: String,
) {
    Newest("newest", "Newest"),
    Closest("closest", "Closest"),
    HighestPay("highest_pay", "Highest pay"),

    /** P1.F — "Urgent nearby" see-all sort. Backend proxies it to newest + deadline filter. */
    Urgency("urgency", "Most urgent"),
    FewestBids("fewest_bids", "Fewest bids"),
    ;

    companion object {
        fun fromKey(key: String): GigsSort = entries.firstOrNull { it.key == key } ?: Newest
    }
}

/** One row in the populated feed (projected from [GigDto]). */
@Immutable
data class GigCardContent(
    val id: String,
    val category: GigsCategory,
    /** "0.2mi · 2h ago" — composed meta line. */
    val metaLine: String,
    val title: String,
    val body: String,
    /** Free-form price string: "$60", "$22 / walk". */
    val price: String,
    val bidCount: Int,
    /** Right-aligned distance label ("0.2mi"). `null` hides it. */
    val distanceLabel: String?,
    /** P1.A — amber URGENT pill next to the category badge. */
    val isUrgent: Boolean = false,
)

/** P1.F — one ~240dp card in a horizontal browse rail (urgent / high paying). */
@Immutable
data class GigRailCardContent(
    val id: String,
    val category: GigsCategory,
    val title: String,
    val price: String,
    val distanceLabel: String?,
    val bidCount: Int,
    /** Browse `first_image` — replaces the glyph tile when present. */
    val imageUrl: String? = null,
)

/** P1.F — one "Browse by category" cluster chip. */
@Immutable
data class GigsBrowseClusterChip(
    val category: GigsCategory,
    val count: Int,
)

/** P1.F — projected browse sections. Each section renders only when non-empty. */
@Immutable
data class GigsBrowseContent(
    val bestMatches: List<GigCardContent>,
    val urgent: List<GigRailCardContent>,
    val newToday: List<GigCardContent>,
    val highPaying: List<GigRailCardContent>,
    val quickJobs: List<GigCardContent>,
    val clusters: List<GigsBrowseClusterChip>,
    val totalActive: Int,
) {
    val isEmpty: Boolean
        get() =
            bestMatches.isEmpty() && urgent.isEmpty() && newToday.isEmpty() &&
                highPaying.isEmpty() && quickJobs.isEmpty() && clusters.isEmpty()
}

/**
 * P1.B — radius suggestion exposed when a flat load lands < 3 rows with
 * no active filters. `suggestedRadiusMiles` is the next ladder step
 * (1 → 3 → 5 → 10 cap).
 */
@Immutable
data class GigsRadiusSuggestion(
    val visibleCount: Int,
    val currentRadiusMiles: Double,
    val suggestedRadiusMiles: Double,
)

/** P1.D — undo target carried on a feed toast. */
sealed interface GigsFeedUndo {
    data class Dismiss(
        val gigId: String,
    ) : GigsFeedUndo

    data class HideCategory(
        val category: GigsCategory,
    ) : GigsFeedUndo
}

/** P1.D — transient toast over the feed (mirrors the MyBids overlay). */
@Immutable
data class GigsFeedToast(
    val text: String,
    val isError: Boolean = false,
    val undo: GigsFeedUndo? = null,
)

/**
 * P6c — slim offline-draft banner ("1 draft waiting — Post now /
 * Discard"). Shown only when online with queued composer drafts.
 */
@Immutable
data class GigsDraftBanner(
    val count: Int,
    /** Title of the oldest draft (the one Post now / Discard act on). */
    val title: String,
)

/**
 * P6a — one row in the "Saved searches" manage sheet (projected from
 * `GigSavedSearchDto`).
 */
@Immutable
data class GigSavedSearchRowContent(
    val id: String,
    /** Stored name, falling back to the derived criteria label. */
    val title: String,
    /** Derived criteria summary; `null` when identical to [title]. */
    val summary: String?,
    /** "Saved 2d ago" relative caption; `null` without a timestamp. */
    val savedAgo: String?,
    val notify: Boolean,
)

/** P6a — render state for the "Saved searches" manage sheet. */
sealed interface GigSavedSearchesUiState {
    data object Loading : GigSavedSearchesUiState

    data object Empty : GigSavedSearchesUiState

    data class Loaded(
        val rows: List<GigSavedSearchRowContent>,
    ) : GigSavedSearchesUiState

    data class Error(
        val message: String,
    ) : GigSavedSearchesUiState
}

/**
 * Render state for the Gigs feed screen. The browse pair (P1.F) joins
 * the four base states: `BrowseLoading` renders stacked section
 * skeletons, `BrowseLoaded` the sectioned discovery feed.
 */
sealed interface GigsFeedUiState {
    data object Loading : GigsFeedUiState

    data object BrowseLoading : GigsFeedUiState

    data class Empty(
        val radiusMiles: Double,
    ) : GigsFeedUiState

    data class Loaded(
        val rows: List<GigCardContent>,
    ) : GigsFeedUiState

    data class BrowseLoaded(
        val browse: GigsBrowseContent,
    ) : GigsFeedUiState

    data class Error(
        val message: String,
    ) : GigsFeedUiState
}

/** Shown instead of a price while an offers-priced task hasn't accepted anyone. */
const val OPEN_TO_OFFERS_LABEL = "Open to offers"

/**
 * An offers-priced task (`pay_type` "offers") has no price until a bid is accepted: its stored price
 * is only the database floor ($1). True until someone is accepted.
 */
fun isOpenToOffers(
    payType: String?,
    acceptedBy: String?,
): Boolean = payType == "offers" && acceptedBy.isNullOrBlank()
