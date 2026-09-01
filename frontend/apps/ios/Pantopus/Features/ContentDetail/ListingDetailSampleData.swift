//
//  ListingDetailSampleData.swift
//  Pantopus
//
//  Sample-data provider for the A09.3 Listing detail frames (populated +
//  sold). The marketplace `ListingDTO` doesn't yet carry the seller
//  identity/rating, the structured details grid, the similar-nearby
//  tiles, or the final sale price, so those are rendered from sample
//  JSONB here. The live `ListingDetailViewModel.project` path produces
//  the same structure from whatever the DTO provides; these frames keep
//  the snapshot baselines deterministic and design-accurate.
//

import Foundation

enum ListingDetailSampleData {
    // MARK: - A09.3 Listing · populated

    static var populated: ContentDetailContent {
        ContentDetailContent(
            kind: .listing,
            cover: cover(sold: false),
            statusPill: nil,
            hero: ContentDetailHero(
                title: "Vintage Bianchi road bike · 56cm",
                priceLine: "$410",
                inlinePills: inlinePills
            ),
            counterparty: seller(trailing: "28 listings · 0.8 mi"),
            modules: [
                description,
                detailsGrid(soldRow: false),
                similar(label: "Similar nearby")
            ],
            trustCapsules: [],
            dock: ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Make offer")
            )
        )
    }

    // MARK: - A09.3 Listing · sold

    static var sold: ContentDetailContent {
        ContentDetailContent(
            kind: .listing,
            cover: cover(sold: true),
            statusPill: ContentDetailPill(label: "Sold", icon: .alertCircle, tone: .error),
            hero: ContentDetailHero(
                title: "Vintage Bianchi road bike · 56cm",
                meta: "· 6h ago",
                priceLine: "$410",
                priceStrikethrough: true,
                saleTag: "Sold for $385",
                inlinePills: inlinePills
            ),
            counterparty: seller(trailing: "27 active listings · 0.8 mi"),
            modules: [
                description,
                detailsGrid(soldRow: true),
                similar(label: "Similar still available"),
                .callout(ContentDetailCallout(
                    identifier: "alert-similar",
                    style: .banner,
                    tone: .neutral,
                    icon: .bell,
                    iconTone: .primary,
                    title: "Alert me when similar appears",
                    subtitle: "Vintage road bike · 0.5 mi · under $450",
                    trailingActionLabel: "Set"
                ))
            ],
            trustCapsules: [],
            dock: ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Seller", icon: .shoppingBag),
                primary: ContentDetailDockButton(label: "Find similar", icon: .search)
            )
        )
    }

    // MARK: - Shared

    private static func cover(sold: Bool) -> ContentDetailCover {
        ContentDetailCover(
            imageUrl: nil,
            gradient: ListingGradient.from(id: "a09-bianchi"),
            placeholderIcon: .image,
            pageCount: 4,
            activePage: 0,
            sold: sold,
            glassActions: [.share, .bookmark]
        )
    }

    private static var inlinePills: [ContentDetailPill] {
        [
            ContentDetailPill(label: "Excellent", icon: .sparkles, tone: .success),
            ContentDetailPill(label: "Pickup", icon: .hand, tone: .neutral),
            ContentDetailPill(label: "0.8 mi", icon: nil, tone: .neutral)
        ]
    }

    private static func seller(trailing: String) -> ContentDetailCounterparty {
        ContentDetailCounterparty(
            displayName: "Manny R.",
            initials: "MR",
            identityKind: "personal",
            verified: true,
            rating: 4.9,
            trailing: trailing,
            showsMessageButton: true
        )
    }

    private static var description: ContentDetailModule {
        .description(ContentDetailDescription(
            title: "Description",
            icon: nil,
            body: "Late-80s Bianchi Sport SX, celeste paint, Campagnolo Veloce groupset. "
                + "New tires last spring (Continental Gatorskins), recent tune, brand-new bar "
                + "tape. 56cm c-t, fits ~5'10\"–6'0\". Pickup only — won't ship. Cash, Venmo, "
                + "or Pantopus pay."
        ))
    }

    private static func detailsGrid(soldRow: Bool) -> ContentDetailModule {
        .detailsGrid(ContentDetailDetailsGrid(
            title: "Details",
            icon: .info,
            rows: [
                ContentDetailDetailsGrid.Row(key: "Brand", value: "Bianchi"),
                ContentDetailDetailsGrid.Row(key: "Frame size", value: "56cm c-t"),
                ContentDetailDetailsGrid.Row(key: "Condition", value: "Excellent · 1 small chip"),
                soldRow
                    ? ContentDetailDetailsGrid.Row(key: "Sold", value: "6 hours ago")
                    : ContentDetailDetailsGrid.Row(key: "Posted", value: "3 days ago")
            ]
        ))
    }

    private static func similar(label: String) -> ContentDetailModule {
        .similarItems(ContentDetailSimilarStrip(
            title: label,
            sub: "0.5 mi",
            items: [
                ContentDetailSimilarItem(
                    id: "trek", title: "Trek 520 · 54cm", price: "$340", gradient: ListingGradient.from(id: "a09-trek")
                ),
                ContentDetailSimilarItem(
                    id: "cannondale", title: "Cannondale CAAD", price: "$520", gradient: ListingGradient.from(id: "a09-cannondale")
                ),
                ContentDetailSimilarItem(
                    id: "surly", title: "Surly Cross-Check", price: "$390", gradient: ListingGradient.from(id: "a09-surly")
                )
            ]
        ))
    }
}
