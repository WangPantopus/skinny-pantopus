@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.listing

import androidx.lifecycle.SavedStateHandle

/**
 * Mirrors the wizard form into [SavedStateHandle] so the wizard
 * survives config changes and process death. Photo bytes are
 * deliberately not persisted (mirrors iOS excluding `localImageData`
 * from Codable) — only ids + tokens come back after process death.
 */
internal class ListingComposeFormPersistence(
    private val handle: SavedStateHandle,
) {
    fun persist(form: ListingComposeFormState) {
        handle[KEY_STEP] = form.step
        handle[KEY_ENTRY_MODE] = form.entryMode.name
        handle[KEY_PHOTOS_IDS] = form.photos.map { it.id }
        handle[KEY_PHOTOS_TOKENS] = form.photos.map { it.token }
        handle[KEY_TITLE] = form.title
        handle[KEY_CATEGORY] = form.category?.name
        handle[KEY_CONDITION] = form.condition?.name
        handle[KEY_BODY] = form.bodyText
        handle[KEY_PRICE_KIND] = form.priceKind?.name
        handle[KEY_PRICE_AMOUNT] = form.priceAmount
        handle[KEY_FULFILLMENT] = form.fulfillment.name
        handle[KEY_DELIVERY_ENABLED] = form.deliveryEnabled
        handle[KEY_LOCATION_KIND] = form.locationKind?.name
        handle[KEY_LOCATION_LABEL] = form.locationLabel
        handle[KEY_BACKEND_CATEGORY] = form.backendCategory
        handle[KEY_PRICE_SUGGESTION] =
            form.priceSuggestion?.let { suggestion ->
                doubleArrayOf(suggestion.low, suggestion.median, suggestion.high)
            }
        handle[KEY_PRICE_BASIS] = form.priceSuggestion?.basis
        handle[KEY_PRICE_COMPARABLES] = form.priceSuggestion?.comparableCount
    }

    fun restore(): ListingComposeFormState {
        val step: Int = handle[KEY_STEP] ?: ListingComposeStep.Photos.ordinal0
        val entryModeName: String? = handle[KEY_ENTRY_MODE]
        val entryMode =
            entryModeName?.let { name -> ListingComposeEntryMode.entries.firstOrNull { it.name == name } }
                ?: ListingComposeEntryMode.Snap
        val ids: List<String> = handle[KEY_PHOTOS_IDS] ?: emptyList()
        val tokens: List<String> = handle[KEY_PHOTOS_TOKENS] ?: emptyList()
        val photos =
            ids.zip(tokens).map { (id, token) ->
                ListingComposePhoto(id = id, token = token)
            }
        val title: String = handle[KEY_TITLE] ?: ""
        val categoryName: String? = handle[KEY_CATEGORY]
        val category = categoryName?.let { name -> ListingComposeCategory.entries.firstOrNull { it.name == name } }
        val conditionName: String? = handle[KEY_CONDITION]
        val condition =
            conditionName?.let { name ->
                ListingComposeCondition.entries.firstOrNull { it.name == name }
            }
        val body: String = handle[KEY_BODY] ?: ""
        val priceKindName: String? = handle[KEY_PRICE_KIND]
        val priceKind = priceKindName?.let { name -> ListingComposePriceKind.entries.firstOrNull { it.name == name } }
        val priceAmount: String = handle[KEY_PRICE_AMOUNT] ?: ""
        val fulfillmentName: String? = handle[KEY_FULFILLMENT]
        val fulfillment =
            fulfillmentName?.let { name ->
                ListingComposeFulfillment.entries.firstOrNull { it.name == name }
            } ?: ListingComposeFulfillment.Pickup
        val deliveryEnabled: Boolean = handle[KEY_DELIVERY_ENABLED] ?: false
        val locationKindName: String? = handle[KEY_LOCATION_KIND]
        val locationKind =
            locationKindName?.let { name ->
                ListingComposeLocationKind.entries.firstOrNull { it.name == name }
            }
        val locationLabel: String = handle[KEY_LOCATION_LABEL] ?: ""
        val backendCategory: String? = handle[KEY_BACKEND_CATEGORY]
        return ListingComposeFormState(
            step = step,
            entryMode = entryMode,
            photos = photos,
            title = title,
            category = category,
            condition = condition,
            bodyText = body,
            priceKind = priceKind,
            priceAmount = priceAmount,
            fulfillment = fulfillment,
            deliveryEnabled = deliveryEnabled,
            locationKind = locationKind,
            locationLabel = locationLabel,
            backendCategory = backendCategory,
            priceSuggestion = restorePriceSuggestion(),
        )
    }

    /** Rebuild the persisted comp band, or null when absent/corrupt. */
    private fun restorePriceSuggestion(): ListingComposePriceSuggestion? {
        val band: DoubleArray = handle[KEY_PRICE_SUGGESTION] ?: return null
        if (band.size != PRICE_BAND_SIZE) return null
        return ListingComposePriceSuggestion(
            low = band[0],
            median = band[1],
            high = band[2],
            basis = handle[KEY_PRICE_BASIS],
            comparableCount = handle[KEY_PRICE_COMPARABLES],
        )
    }

    private companion object {
        const val KEY_STEP = "listingCompose.step"
        const val KEY_ENTRY_MODE = "listingCompose.entryMode"
        const val KEY_PHOTOS_IDS = "listingCompose.photoIds"
        const val KEY_PHOTOS_TOKENS = "listingCompose.photoTokens"
        const val KEY_TITLE = "listingCompose.title"
        const val KEY_CATEGORY = "listingCompose.category"
        const val KEY_CONDITION = "listingCompose.condition"
        const val KEY_BODY = "listingCompose.body"
        const val KEY_PRICE_KIND = "listingCompose.priceKind"
        const val KEY_PRICE_AMOUNT = "listingCompose.priceAmount"
        const val KEY_FULFILLMENT = "listingCompose.fulfillment"
        const val KEY_DELIVERY_ENABLED = "listingCompose.deliveryEnabled"
        const val KEY_LOCATION_KIND = "listingCompose.locationKind"
        const val KEY_LOCATION_LABEL = "listingCompose.locationLabel"
        const val KEY_BACKEND_CATEGORY = "listingCompose.backendCategory"
        const val KEY_PRICE_SUGGESTION = "listingCompose.priceSuggestion"
        const val KEY_PRICE_BASIS = "listingCompose.priceBasis"
        const val KEY_PRICE_COMPARABLES = "listingCompose.priceComparables"
        const val PRICE_BAND_SIZE = 3
    }
}
