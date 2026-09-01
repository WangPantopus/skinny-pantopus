@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.runtime.Immutable

/**
 * Render-only ranking metadata for one offer, keyed by bid id on the
 * gig-detail view-model. Present only when the owner's list came from
 * `GET /api/v2/gigs/:gigId/offers` (`backend/routes/offersV2.js:47`);
 * the `/bids` fallback leaves it empty.
 */
@Immutable
data class GigOfferRanking(
    val matchScore: Double? = null,
    val matchRank: Int? = null,
    val isRecommended: Boolean = false,
    val averageRating: Double? = null,
    val reviewCount: Int? = null,
    val gigsCompleted: Int? = null,
) {
    /** "4.9★ · 12 tasks" trust line; `null` when nothing is known. */
    val trustLine: String?
        get() {
            val pieces = mutableListOf<String>()
            averageRating?.let { pieces += String.format(java.util.Locale.US, "%.1f★", it) }
            reviewCount?.takeIf { it > 0 }?.let { pieces += "$it review${if (it == 1) "" else "s"}" }
            gigsCompleted?.takeIf { it > 0 }?.let { pieces += "$it task${if (it == 1) "" else "s"}" }
            return pieces.takeIf { it.isNotEmpty() }?.joinToString(" · ")
        }
}

/**
 * One-shot effect: a freshly minted public status link
 * (`POST /api/gigs/:gigId/share-status`). The screen copies [url] to the
 * clipboard and toasts, mirroring RN's `ETATracker` share button.
 */
@Immutable
data class GigLiveStatusEvent(
    val url: String,
)
