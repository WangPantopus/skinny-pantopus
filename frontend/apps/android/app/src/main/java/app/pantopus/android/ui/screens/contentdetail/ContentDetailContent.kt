@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.marketplace.ListingGradient
import app.pantopus.android.ui.theme.PantopusIcon

/** Which entity is being shown. */
enum class ContentDetailKind { Gig, Listing, Invoice }

/** Cover image for the listing variant. */
@Immutable
data class ContentDetailCover(
    val imageUrl: String?,
    val gradient: ListingGradient,
    val placeholderIcon: PantopusIcon,
    val pageCount: Int = 1,
    val activePage: Int = 0,
    /** Sold treatment: desaturates the hero + stamps a tilted SOLD badge. */
    val sold: Boolean = false,
    /** Decorative glass action chips overlaid top-right (share / bookmark). */
    val glassActions: List<PantopusIcon> = emptyList(),
)

/** Status / trust pill. */
@Immutable
data class ContentDetailPill(
    val id: String,
    val label: String,
    val icon: PantopusIcon? = null,
    val tone: Tone = Tone.Info,
) {
    enum class Tone { Info, Success, Warning, Business, Neutral, Error }
}

@Immutable
data class ContentDetailCategoryChip(
    val label: String,
    val category: GigsCategory,
)

@Immutable
data class ContentDetailHero(
    val title: String,
    val categoryChip: ContentDetailCategoryChip? = null,
    val meta: String? = null,
    val monoId: String? = null,
    val priceLine: String? = null,
    val priceCaption: String? = null,
    /** `Auto` → primary600 for listings / appText elsewhere; `Success` → green. */
    val priceTone: PriceTone = PriceTone.Auto,
    /** Strikes through the price (listing sold). */
    val priceStrikethrough: Boolean = false,
    /** Green sale tag next to a struck price ("Sold for $385"). */
    val saleTag: String? = null,
    /** Right-aligned faded label trailing the price ("paid in full"). */
    val priceTrailingLabel: String? = null,
    /** Green check disc after the price (invoice paid). */
    val priceCheckDisc: Boolean = false,
    /** Pill row under the price (listing condition / pickup / distance). */
    val inlinePills: List<ContentDetailPill> = emptyList(),
) {
    enum class PriceTone { Auto, Success }
}

@Immutable
data class ContentDetailStat(
    val top: String,
    val bottom: String,
)

@Immutable
data class ContentDetailCounterparty(
    val displayName: String,
    val initials: String,
    val avatarUrl: String? = null,
    val identityKind: String?,
    val verified: Boolean,
    val rating: Double?,
    val trailing: String?,
    val showsMessageButton: Boolean = true,
)

@Immutable
data class ContentDetailDockButton(
    val label: String,
    val icon: PantopusIcon? = null,
    /** `false` renders the disabled treatment (sunken fill, muted text). */
    val enabled: Boolean = true,
)

@Immutable
data class ContentDetailDock(
    val secondary: ContentDetailDockButton? = null,
    val primary: ContentDetailDockButton,
)

// MARK: - Modules

sealed interface ContentDetailModule {
    val id: String

    @Immutable
    data class Description(
        override val id: String,
        val title: String,
        val icon: PantopusIcon? = null,
        val body: String,
    ) : ContentDetailModule

    @Immutable
    data class DetailRow(
        override val id: String,
        val title: String,
        val sectionIcon: PantopusIcon? = null,
        val rowIcon: PantopusIcon,
        val label: String,
        val trailing: String? = null,
    ) : ContentDetailModule

    @Immutable
    data class CaptionedText(
        override val id: String,
        val title: String,
        val icon: PantopusIcon? = null,
        val label: String,
    ) : ContentDetailModule

    @Immutable
    data class PhotoStrip(
        override val id: String,
        val title: String,
        val icon: PantopusIcon? = PantopusIcon.File,
        val countLabel: String? = null,
        val tiles: List<ContentDetailPhotoTile>,
    ) : ContentDetailModule

    /** Pickup → drop-off two-stop card (Magic Task V2). */
    @Immutable
    data class TwoStop(
        override val id: String,
        val title: String,
        val icon: PantopusIcon? = PantopusIcon.MapPin,
        val stops: List<Stop>,
    ) : ContentDetailModule {
        enum class StopTone { Primary, Success }

        @Immutable
        data class Stop(
            val letter: String,
            val tone: StopTone,
            val address: String,
            val distance: String?,
        )
    }

    /** Inline wrap of trust/status capsules placed mid-flow. */
    @Immutable
    data class CapsuleRow(
        override val id: String,
        val capsules: List<ContentDetailPill>,
    ) : ContentDetailModule

    /** Key/value detail grid (listing "Details"). */
    @Immutable
    data class DetailsGrid(
        override val id: String,
        val title: String,
        val icon: PantopusIcon? = PantopusIcon.AlertCircle,
        val rows: List<Row>,
    ) : ContentDetailModule {
        @Immutable
        data class Row(val key: String, val value: String)
    }

    /**
     * Flexible callout card — awarded banner, Pantopus Pay receipt
     * capsule, "Alert me when similar appears" row, no-bids empty capsule.
     */
    @Immutable
    data class Callout(
        override val id: String,
        val style: Style = Style.Banner,
        val tone: Tone = Tone.Success,
        val icon: PantopusIcon,
        val iconTone: IconTone = IconTone.Success,
        val title: String,
        val subtitle: String? = null,
        val subtitleMono: Boolean = false,
        val trailingActionLabel: String? = null,
        val footerPill: String? = null,
    ) : ContentDetailModule {
        enum class Style { Banner, Empty }

        enum class Tone { Success, Neutral, Dashed }

        enum class IconTone { Success, SuccessOutline, Primary }
    }

    @Immutable
    data class SimilarStrip(
        override val id: String,
        val title: String,
        val sub: String? = null,
        val items: List<ContentDetailSimilarItem>,
    ) : ContentDetailModule

    @Immutable
    data class Bids(
        override val id: String,
        val title: String,
        val sub: String? = null,
        val bids: List<ContentDetailBidRow>,
    ) : ContentDetailModule

    @Immutable
    data class FromTo(
        override val id: String,
        val from: ContentDetailParty,
        val to: ContentDetailParty,
    ) : ContentDetailModule

    @Immutable
    data class LineItems(
        override val id: String,
        val title: String,
        val icon: PantopusIcon? = PantopusIcon.File,
        val rows: List<ContentDetailLineItem>,
        val fees: List<ContentDetailSummaryRow> = emptyList(),
        val totalLabel: String? = null,
        val totalValue: String? = null,
        val totalTone: TotalTone = TotalTone.Primary,
    ) : ContentDetailModule {
        enum class TotalTone { Primary, Success }
    }

    @Immutable
    data class Summary(
        override val id: String,
        val rows: List<ContentDetailSummaryRow>,
        val totalLabel: String,
        val totalValue: String,
        val totalTone: TotalTone = TotalTone.Primary,
    ) : ContentDetailModule {
        enum class TotalTone { Primary, Success }
    }

    /** Interactive mini map — tap to open full-screen explorer. */
    @Immutable
    data class LocationMap(
        override val id: String = "location_map",
        val latitude: Double,
        val longitude: Double,
        val isApproximate: Boolean,
        val footnote: String,
        val category: GigsCategory,
    ) : ContentDetailModule
}

@Immutable
data class ContentDetailPhotoTile(
    val id: String,
    val gradient: ListingGradient,
    val icon: PantopusIcon,
    /**
     * Real attachment image. When set the tile renders the photo and falls
     * back to the gradient + glyph while loading / on failure.
     */
    val imageUrl: String? = null,
)

@Immutable
data class ContentDetailSimilarItem(
    val id: String,
    val title: String,
    val price: String,
    val gradient: ListingGradient,
)

@Immutable
data class ContentDetailBidRow(
    val id: String,
    val initials: String,
    val displayName: String,
    val ratingLine: String,
    val amount: String,
    val verified: Boolean,
    /** Optional tag pill ("fastest reply" / "has van"). */
    val tag: String? = null,
    /** Winning bid (awarded) — green tint + Winner pill + green amount. */
    val won: Boolean = false,
    /** Losing bid (awarded) — 55% opacity + struck-through amount. */
    val dimmed: Boolean = false,
)

@Immutable
data class ContentDetailParty(
    val label: String,
    val name: String,
    val sub: String,
    val accent: Accent,
) {
    enum class Accent { Business, Personal, Neutral }
}

@Immutable
data class ContentDetailLineItem(
    val id: String,
    val item: String,
    val qty: String,
    val unit: String,
    val total: String,
)

@Immutable
data class ContentDetailSummaryRow(
    val id: String,
    val label: String,
    val value: String,
)

@Immutable
data class ContentDetailContent(
    val kind: ContentDetailKind,
    val cover: ContentDetailCover? = null,
    val statusPill: ContentDetailPill? = null,
    val hero: ContentDetailHero,
    val statStrip: List<ContentDetailStat> = emptyList(),
    val counterparty: ContentDetailCounterparty? = null,
    val modules: List<ContentDetailModule> = emptyList(),
    val trustCapsules: List<ContentDetailPill> = emptyList(),
    val dock: ContentDetailDock,
)

sealed interface ContentDetailUiState {
    data object Loading : ContentDetailUiState

    data class Loaded(val content: ContentDetailContent) : ContentDetailUiState

    data class Error(val message: String) : ContentDetailUiState
}
