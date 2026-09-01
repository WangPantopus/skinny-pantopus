@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.ui.screens.marketplace.ListingGradient
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Sample-data provider for the A09.3 Listing detail frames (populated +
 * sold). The marketplace `ListingDto` doesn't carry the seller
 * identity/rating, the structured details grid, the similar-nearby tiles,
 * or the final sale price, so those are rendered from sample JSONB here.
 * Frames use literal strings so the Paparazzi baselines stay deterministic.
 */
object ListingDetailSampleData {
    // Shared pieces (declared before the frames so the object's
    // top-to-bottom initialization order is satisfied).

    private val inlinePills =
        listOf(
            ContentDetailPill(
                id = "cond",
                label = "Excellent",
                icon = PantopusIcon.Sparkles,
                tone = ContentDetailPill.Tone.Success,
            ),
            ContentDetailPill(
                id = "pickup",
                label = "Pickup",
                icon = PantopusIcon.Hand,
                tone = ContentDetailPill.Tone.Neutral,
            ),
            ContentDetailPill(id = "dist", label = "0.8 mi", tone = ContentDetailPill.Tone.Neutral),
        )

    private val description =
        ContentDetailModule.Description(
            id = "desc",
            title = "Description",
            icon = null,
            body =
                "Late-80s Bianchi Sport SX, celeste paint, Campagnolo Veloce groupset. " +
                    "New tires last spring (Continental Gatorskins), recent tune, brand-new bar " +
                    "tape. 56cm c-t, fits ~5'10\"–6'0\". Pickup only — won't ship. Cash, Venmo, " +
                    "or Pantopus pay.",
        )

    private val alertSimilar =
        ContentDetailModule.Callout(
            id = "alert-similar",
            style = ContentDetailModule.Callout.Style.Banner,
            tone = ContentDetailModule.Callout.Tone.Neutral,
            icon = PantopusIcon.Bell,
            iconTone = ContentDetailModule.Callout.IconTone.Primary,
            title = "Alert me when similar appears",
            subtitle = "Vintage road bike · 0.5 mi · under $450",
            trailingActionLabel = "Set",
        )

    val populated: ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Listing,
            cover = cover(sold = false),
            statusPill = null,
            hero =
                ContentDetailHero(
                    title = "Vintage Bianchi road bike · 56cm",
                    priceLine = "$410",
                    inlinePills = inlinePills,
                ),
            counterparty = seller(trailing = "28 listings · 0.8 mi"),
            modules =
                listOf(
                    description,
                    detailsGrid(soldRow = false),
                    similar(label = "Similar nearby"),
                ),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary = ContentDetailDockButton(label = "Make offer"),
                ),
        )

    val sold: ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Listing,
            cover = cover(sold = true),
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Sold",
                    icon = PantopusIcon.AlertCircle,
                    tone = ContentDetailPill.Tone.Error,
                ),
            hero =
                ContentDetailHero(
                    title = "Vintage Bianchi road bike · 56cm",
                    meta = "· 6h ago",
                    priceLine = "$410",
                    priceStrikethrough = true,
                    saleTag = "Sold for $385",
                    inlinePills = inlinePills,
                ),
            counterparty = seller(trailing = "27 active listings · 0.8 mi"),
            modules =
                listOf(
                    description,
                    detailsGrid(soldRow = true),
                    similar(label = "Similar still available"),
                    alertSimilar,
                ),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Seller", icon = PantopusIcon.ShoppingBag),
                    primary = ContentDetailDockButton(label = "Find similar", icon = PantopusIcon.Search),
                ),
        )

    private fun cover(sold: Boolean): ContentDetailCover =
        ContentDetailCover(
            imageUrl = null,
            gradient = ListingGradient.from("a09-bianchi"),
            placeholderIcon = PantopusIcon.Image,
            pageCount = 4,
            activePage = 0,
            sold = sold,
            glassActions = listOf(PantopusIcon.Share, PantopusIcon.Bookmark),
        )

    private fun seller(trailing: String): ContentDetailCounterparty =
        ContentDetailCounterparty(
            displayName = "Manny R.",
            initials = "MR",
            identityKind = "personal",
            verified = true,
            rating = 4.9,
            trailing = trailing,
            showsMessageButton = true,
        )

    private fun detailsGrid(soldRow: Boolean): ContentDetailModule.DetailsGrid =
        ContentDetailModule.DetailsGrid(
            id = "details",
            title = "Details",
            icon = PantopusIcon.AlertCircle,
            rows =
                listOf(
                    ContentDetailModule.DetailsGrid.Row("Brand", "Bianchi"),
                    ContentDetailModule.DetailsGrid.Row("Frame size", "56cm c-t"),
                    ContentDetailModule.DetailsGrid.Row("Condition", "Excellent · 1 small chip"),
                    if (soldRow) {
                        ContentDetailModule.DetailsGrid.Row("Sold", "6 hours ago")
                    } else {
                        ContentDetailModule.DetailsGrid.Row("Posted", "3 days ago")
                    },
                ),
        )

    private fun similar(label: String): ContentDetailModule.SimilarStrip =
        ContentDetailModule.SimilarStrip(
            id = "similar",
            title = label,
            sub = "0.5 mi",
            items =
                listOf(
                    ContentDetailSimilarItem("trek", "Trek 520 · 54cm", "$340", ListingGradient.from("a09-trek")),
                    ContentDetailSimilarItem("cannondale", "Cannondale CAAD", "$520", ListingGradient.from("a09-cannondale")),
                    ContentDetailSimilarItem("surly", "Surly Cross-Check", "$390", ListingGradient.from("a09-surly")),
                ),
        )
}
