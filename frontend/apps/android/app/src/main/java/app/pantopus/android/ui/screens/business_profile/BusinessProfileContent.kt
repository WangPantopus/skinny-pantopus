@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.business_profile

import app.pantopus.android.ui.screens.saved_places.PendingSavePlace
import app.pantopus.android.ui.theme.PantopusIcon

// A10.6 — render-only models for the single-scroll Business Profile.
// B3.1 reshape: no more tabs. The view-model projects the backend detail
// (+ optional public + reviews) onto the section models below, which back
// both the populated frame and the newly-claimed + closed secondary frame.

/** Banner-header content (rendered through the shared `BizBannerHeader`). */
data class BusinessProfileHeader(
    val displayName: String,
    val handle: String?,
    val locality: String?,
    val isVerified: Boolean,
    /** Optional logo glyph; `null` falls back to initials from [displayName]. */
    val logoIcon: PantopusIcon? = null,
)

/** Tint applied to a stat cell's value (and its leading star). */
enum class BusinessStatTint { Standard, Star, Business, Muted }

/** One cell in the stat strip — rating · jobs done · followers / "New". */
data class BusinessStatCell(
    val id: String,
    val value: String,
    val label: String,
    val leadingStar: Boolean = false,
    val tint: BusinessStatTint = BusinessStatTint.Standard,
)

/** Per-category accent. The lead category is tinted; the rest are neutral. */
enum class BusinessCategoryAccent { Business, Cleaning, Handyman, Pet, Neutral }

/** One category chip in the `CategoryRow`. */
data class BusinessCategoryChip(
    val id: String,
    val label: String,
    val icon: PantopusIcon?,
    val accent: BusinessCategoryAccent,
)

/** A trust chip under the About copy ("Bonded & insured", "Since 2019"). */
data class BusinessAboutChip(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
)

/** Open / Closed status header for the Hours table + banner status chip. */
data class BusinessOpenState(
    val isOpen: Boolean,
    /** "Open now" / "Closed now". */
    val statusLabel: String,
    /** "Closes 6:00 PM" / "Opens tomorrow at 8:00 AM". */
    val statusDetail: String,
    /** Banner chip label: "Open now" / "Closed · opens 8 AM". */
    val chipLabel: String,
)

/** One Hours-table day row. */
data class BusinessHoursRow(
    val id: String,
    val dayLabel: String,
    val timeLabel: String,
    val isClosed: Boolean,
    val isToday: Boolean = false,
)

/** Service-area card content (a `MapPreview` + address summary + directions). */
data class BusinessServiceArea(
    val title: String,
    val detail: String?,
    val serviceArea: String?,
    val latitude: Double?,
    val longitude: Double?,
) {
    val hasCoordinates: Boolean
        get() = latitude != null && longitude != null
}

/** One priced service offering. */
data class BusinessServiceRow(
    val id: String,
    val name: String,
    val detail: String?,
    val priceLabel: String,
    val unit: String? = null,
    val icon: PantopusIcon = PantopusIcon.Tag,
)

/** Tint role for a "Recent work" gallery tile placeholder. */
enum class BusinessGalleryTint { Primary, Success, Slate, Deep }

/** One "Recent work" gallery item (maps to the `GalleryStrip` primitive). */
data class BusinessGalleryItem(
    val id: String,
    val label: String?,
    val tint: BusinessGalleryTint = BusinessGalleryTint.Slate,
    val imageUrl: String? = null,
    val moreCount: Int? = null,
)

/** Rating histogram summary for the Reviews section. */
data class BusinessReviewSummary(
    val average: Double,
    val count: Int,
    /** Five fractions in `0..1`, ordered 5★→1★. */
    val distribution: List<Double>,
)

/** One review card. */
data class BusinessReviewCard(
    val id: String,
    val reviewerName: String,
    val reviewerAvatarUrl: String?,
    val rating: Int,
    val body: String,
    val timestamp: String,
    val verified: Boolean = false,
)

/** The sticky bottom dock. Primary is always "Contact" (message). */
data class BusinessActionDock(
    val secondary: Secondary,
    /** Closed note; `null` when open. */
    val note: String?,
) {
    enum class Secondary { Book, Call }
}

/** Render-ready payload emitted by [BusinessProfileViewModel]. */
data class BusinessProfileContent(
    val businessId: String,
    val header: BusinessProfileHeader,
    val stats: List<BusinessStatCell>,
    val categories: List<BusinessCategoryChip>,
    val about: String?,
    val aboutChips: List<BusinessAboutChip>,
    val status: BusinessOpenState?,
    val hours: List<BusinessHoursRow>,
    val serviceArea: BusinessServiceArea?,
    val services: List<BusinessServiceRow>,
    val gallery: List<BusinessGalleryItem>,
    val reviewSummary: BusinessReviewSummary?,
    val reviews: List<BusinessReviewCard>,
    val dock: BusinessActionDock,
    val savedPlace: PendingSavePlace? = null,
    val isNewlyClaimed: Boolean,
    val phoneNumber: String?,
    val websiteUrl: String?,
    val viewerIsOwner: Boolean,
)

/** Observed UI state for the Business Profile screen. */
sealed interface BusinessProfileUiState {
    data object Loading : BusinessProfileUiState

    data class Loaded(val content: BusinessProfileContent) : BusinessProfileUiState

    data object NotFound : BusinessProfileUiState

    data class Error(val message: String) : BusinessProfileUiState
}

/** Save action state. */
sealed interface BusinessProfileSaveState {
    data object Idle : BusinessProfileSaveState

    data object InFlight : BusinessProfileSaveState

    data object Saved : BusinessProfileSaveState

    data class Failed(val message: String) : BusinessProfileSaveState
}
