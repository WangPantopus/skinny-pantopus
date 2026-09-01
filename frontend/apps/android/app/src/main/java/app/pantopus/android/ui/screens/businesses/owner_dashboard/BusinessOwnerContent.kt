@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.owner_dashboard

import app.pantopus.android.ui.screens.business_profile.BusinessProfileContent
import app.pantopus.android.ui.theme.PantopusIcon

// A10.7 — render-only models for the single-business owner dashboard, the
// owner-facing twin of A10.6. The shared business truth lives in
// [BusinessOwnerContent.publicProfile] (the exact A10.6 render reused by the
// preview frame and read by the owner frame); the rest are owner-only
// overlays (live status, insight tiles, profile strength, review replies).
// Mirrors iOS `BusinessOwnerContent.swift`.

/** One "This week" insight tile — views / saves / contacts, optional delta. */
data class OwnerInsightTile(
    val id: String,
    val icon: PantopusIcon,
    val value: String,
    val label: String,
    /** Week-over-week delta ("18%"); `null` renders no trend pill. */
    val delta: String? = null,
)

/** One checklist row in the profile-strength card. */
data class OwnerStrengthStep(
    val id: String,
    val label: String,
    val done: Boolean,
    /** Inline CTA label on a pending step ("Add"); `null` on done steps. */
    val ctaLabel: String? = null,
)

/** Profile-strength card content: a percentage + caption + completion list. */
data class OwnerProfileStrength(
    val percent: Int,
    val caption: String,
    val steps: List<OwnerStrengthStep>,
)

/** One recent review in the owner frame; [reply] non-null = already answered. */
data class OwnerReviewItem(
    val id: String,
    val reviewerName: String,
    val reviewerAvatarUrl: String?,
    /** Relative time + service context ("2d · Deep clean"). */
    val meta: String,
    val rating: Int,
    val body: String,
    /** The owner's reply, if sent. `null` → show the reply composer. */
    val reply: String? = null,
)

/**
 * First-50 "Founding Business" offer banner. Present only when the offer is
 * still active, this business has not already claimed a slot, and the owner
 * has not dismissed the banner — the same three-way gate RN applies
 * (`src/app/businesses/[id]/index.tsx:108-119`).
 */
data class OwnerFoundingOffer(
    /** `slots_remaining` from `GET /api/businesses/founding-offer/status`. */
    val slotsRemaining: Int,
    /** True while `POST …/founding-offer/claim` is in flight. */
    val isClaiming: Boolean = false,
)

/**
 * Top-level content for the owner dashboard. [publicProfile] is the A10.6
 * render reused verbatim by the preview frame and read by the owner frame's
 * shared sections, so the two frames always describe one business.
 */
data class BusinessOwnerContent(
    val businessId: String,
    val isLive: Boolean,
    val editedMeta: String,
    val insights: List<OwnerInsightTile>,
    val profileStrength: OwnerProfileStrength,
    /** Section-header affordance on Reviews ("2 to reply"); `null` when none. */
    val reviewsToReplyLabel: String?,
    val reviews: List<OwnerReviewItem>,
    val publicProfile: BusinessProfileContent,
    /**
     * True when `access.role_base` is owner / admin / editor — the same gate
     * React Native puts on its "Post as this business" composer
     * (`src/app/businesses/[id]/index.tsx:67`). `POST
     * /api/businesses/:businessId/posts` requires `profile.edit`, so a staff
     * or viewer seat never sees the affordance.
     */
    val canPostAsBusiness: Boolean = false,
    /** Founding-business offer banner; `null` renders nothing. */
    val foundingOffer: OwnerFoundingOffer? = null,
) {
    /** Returns a copy with [reply] set on the review matching [reviewId]. */
    fun applyingReply(
        reply: String,
        reviewId: String,
    ): BusinessOwnerContent {
        val updated =
            reviews.map { review ->
                if (review.id == reviewId) review.copy(reply = reply) else review
            }
        val pending = updated.count { it.reply == null }
        return copy(
            reviews = updated,
            reviewsToReplyLabel = if (pending > 0) "$pending to reply" else null,
        )
    }

    companion object {
        /**
         * Roles the backend's `profile.edit` permission resolves to for the
         * business-post route (`backend/routes/businesses.js:4198`).
         */
        val POSTING_ROLES = setOf("owner", "admin", "editor")
    }
}

/** Observed UI state for the owner dashboard. */
sealed interface BusinessOwnerUiState {
    data object Loading : BusinessOwnerUiState

    data class Loaded(val content: BusinessOwnerContent) : BusinessOwnerUiState

    data object NotFound : BusinessOwnerUiState

    data class Error(val message: String) : BusinessOwnerUiState
}
