@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.listing

import app.pantopus.android.data.api.models.ai.AIListingDraftDto
import app.pantopus.android.data.api.models.ai.AIListingVisionResponse
import java.util.Locale

/**
 * Pure mapping between the AI vision draft and the wizard form —
 * mirrors the iOS `apply(visionResponse:)` / `wizardCategory(fromDraft:)`
 * / `backendCategory(fromAICategory:)` helpers. Lives outside the
 * view model so unit tests can exercise the contract directly.
 */
internal object ListingComposeVisionMapping {
    /** Category side-effects shared by `setCategory` and [applyVision]. */
    fun formWithCategory(
        form: ListingComposeFormState,
        category: ListingComposeCategory,
    ): ListingComposeFormState {
        var next = form.copy(category = category)
        // Category implies price kind for Free; clear stale state when switching out of Free.
        if (category == ListingComposeCategory.Free) {
            next = next.copy(priceKind = ListingComposePriceKind.Free, priceAmount = "")
        } else if (next.priceKind == ListingComposePriceKind.Free) {
            next = next.copy(priceKind = null)
        }
        if (!category.requiresCondition) {
            next = next.copy(condition = null)
        }
        return next
    }

    /**
     * Merge a vision-draft response into the form, filling empty
     * fields only — user edits always win.
     */
    fun applyVision(
        form: ListingComposeFormState,
        response: AIListingVisionResponse,
    ): ListingComposeFormState {
        var next = applyDraftFields(form, response.draft)
        next = applyPricing(next, response)
        response.draft.deliveryAvailable?.let { next = next.copy(deliveryEnabled = it) }
        return next
    }

    private fun applyDraftFields(
        form: ListingComposeFormState,
        draft: AIListingDraftDto,
    ): ListingComposeFormState {
        var next = form
        if (next.title.trim().isEmpty() && !draft.title.isNullOrEmpty()) {
            next = next.copy(title = draft.title.take(ListingComposeFormState.TITLE_MAX_LENGTH))
        }
        if (next.bodyText.trim().isEmpty() && !draft.description.isNullOrEmpty()) {
            next = next.copy(bodyText = draft.description)
        }
        if (next.category == null) {
            next = formWithCategory(next, wizardCategoryFromDraft(draft))
        }
        backendCategoryFromAI(draft.category)?.let { mapped ->
            next = next.copy(backendCategory = mapped)
        }
        if (next.condition == null && next.category?.requiresCondition != false) {
            ListingComposeCondition.entries
                .firstOrNull { it.key == draft.condition }
                ?.let { next = next.copy(condition = it) }
        }
        return next
    }

    private fun applyPricing(
        form: ListingComposeFormState,
        response: AIListingVisionResponse,
    ): ListingComposeFormState {
        var next = form
        response.priceSuggestion?.let { suggestion ->
            next =
                next.copy(
                    priceSuggestion =
                        ListingComposePriceSuggestion(
                            low = suggestion.low,
                            median = suggestion.median,
                            high = suggestion.high,
                            basis = suggestion.basis,
                            comparableCount = suggestion.comparableCount,
                        ),
                )
        }
        if (next.priceKind == null) {
            next =
                next.copy(
                    priceKind =
                        if (response.draft.isFree == true || next.category == ListingComposeCategory.Free) {
                            ListingComposePriceKind.Free
                        } else {
                            ListingComposePriceKind.Fixed
                        },
                )
        }
        if (next.priceAmount.isEmpty() && next.priceKind != ListingComposePriceKind.Free) {
            val amount = response.priceSuggestion?.median ?: response.draft.price?.takeIf { it > 0 }
            amount?.let { next = next.copy(priceAmount = formatAmount(it)) }
        }
        return next
    }

    /** Wizard chip implied by the AI draft. */
    fun wizardCategoryFromDraft(draft: AIListingDraftDto): ListingComposeCategory =
        when {
            draft.isFree == true -> ListingComposeCategory.Free
            draft.listingType == "free_item" -> ListingComposeCategory.Free
            draft.listingType == "wanted_request" -> ListingComposeCategory.Wanted
            draft.listingType == "rent_sublet" || draft.listingType == "vehicle_rent" -> ListingComposeCategory.Rentals
            draft.listingType == "vehicle_sale" -> ListingComposeCategory.Vehicles
            draft.category == "automotive" -> ListingComposeCategory.Vehicles
            else -> ListingComposeCategory.Goods
        }

    /** AI product categories that need renaming onto LISTING_CATEGORIES. */
    private val AI_CATEGORY_RENAMES =
        mapOf(
            "sports" to "sports_outdoors",
            "books" to "books_media",
            "music" to "books_media",
            "toys" to "kids_baby",
            "baby_kids" to "kids_baby",
            "automotive" to "vehicles",
        )

    /** Canonical backend categories — `backend/constants/marketplace.js` LISTING_CATEGORIES. */
    private val BACKEND_CATEGORIES =
        setOf(
            "furniture", "electronics", "clothing", "kids_baby", "tools",
            "home_garden", "sports_outdoors", "vehicles", "books_media",
            "collectibles", "appliances", "free_stuff",
            "food_baked_goods", "plants_garden", "pet_supplies",
            "arts_crafts", "tickets_events", "other",
        )

    /**
     * Map an AI draft category onto a valid backend category; unknown
     * values degrade to `other`.
     */
    fun backendCategoryFromAI(raw: String?): String? {
        if (raw.isNullOrEmpty()) return null
        AI_CATEGORY_RENAMES[raw]?.let { return it }
        return if (raw in BACKEND_CATEGORIES) raw else "other"
    }

    /** "280" for whole dollars, "279.99" otherwise — mirrors iOS `formatAmount`. */
    fun formatAmount(value: Double): String =
        if (value % 1.0 == 0.0) {
            value.toInt().toString()
        } else {
            String.format(Locale.US, "%.2f", value)
        }
}
