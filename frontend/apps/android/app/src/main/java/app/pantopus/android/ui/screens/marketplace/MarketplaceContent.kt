@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.marketplace

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Five chips on the Marketplace tab. Maps onto backend `layer` +
 * `is_free` query params.
 */
enum class MarketplaceCategory(
    val key: String,
    val label: String,
) {
    All("all", "All"),
    Goods("goods", "Goods"),
    Rentals("rentals", "Rentals"),
    Free("free", "Free"),
    Vehicles("vehicles", "Vehicles"),
    ;

    /** Backend `layer` param. `All` / `Free` don't constrain layer. */
    val layerParam: String?
        get() =
            when (this) {
                Goods -> "goods"
                Rentals -> "rentals"
                Vehicles -> "vehicles"
                All, Free -> null
            }

    /** Suppresses the condition chip on the image (per design). */
    val suppressesConditionBadge: Boolean
        get() = this == Rentals || this == Free

    companion object {
        fun fromKey(key: String): MarketplaceCategory = entries.firstOrNull { it.key == key } ?: All
    }
}

/** One marketplace card. */
@Immutable
data class MarketplaceCardContent(
    val id: String,
    val title: String,
    /** `firstImage` URL when set, otherwise `null` → gradient + glyph. */
    val imageUrl: String?,
    val placeholderGradient: ListingGradient,
    val placeholderIcon: PantopusIcon,
    val price: String,
    val isFree: Boolean,
    val metaLine: String,
    val conditionBadge: String?,
)

/** Gradient pair for the listing image placeholder. */
@Immutable
data class ListingGradient(
    val start: Color,
    val end: Color,
) {
    companion object {
        /** One of six design-spec gradient pairs, hashed by id. */
        fun from(id: String): ListingGradient {
            val palette =
                listOf(
                    ListingGradient(Color(0xFFBAE6FD), Color(0xFF0284C7)),
                    ListingGradient(Color(0xFFFEF3C7), Color(0xFFF59E0B)),
                    ListingGradient(Color(0xFFDDD6FE), Color(0xFF7C3AED)),
                    ListingGradient(Color(0xFFD1FAE5), Color(0xFF059669)),
                    ListingGradient(Color(0xFFFECACA), Color(0xFFDC2626)),
                    ListingGradient(Color(0xFFE0F2FE), Color(0xFF0EA5E9)),
                )
            val index = kotlin.math.abs(id.hashCode()) % palette.size
            return palette[index]
        }
    }
}

/** Render state for the Marketplace screen. */
sealed interface MarketplaceUiState {
    data object Loading : MarketplaceUiState

    data class Empty(val radiusMiles: Double) : MarketplaceUiState

    data class Loaded(val rows: List<MarketplaceCardContent>) : MarketplaceUiState

    data class Error(val message: String) : MarketplaceUiState
}
