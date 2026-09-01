//
//  GigDetailSampleData.swift
//  Pantopus
//
//  Sample-data provider for the A09.1 (Task V2) and A09.2 (Gig V1)
//  transactional-detail frames. Per P8.2 the Magic Task ingest backend
//  is out of scope — the rich V2 surface (3-photo strip, pickup→drop-off
//  two-stop card, trust capsules with ratings, per-bid tags) and the V1
//  awarded state are rendered from sample JSONB here until the backend
//  wires real payloads through `GigDTO`. The four frames are hand-built
//  with literal strings so the snapshot baselines stay deterministic
//  (the live `GigDetailViewModel.project` path is time-relative).
//

import Foundation

enum GigDetailSampleData {
    // MARK: - A09.1 Task V2 · populated (6 bids)

    static var taskV2Populated: ContentDetailContent {
        ContentDetailContent(
            kind: .gig,
            cover: nil,
            statusPill: ContentDetailPill(label: "Open · 6 bids", icon: .circle, tone: .warning),
            hero: ContentDetailHero(
                title: "Move queen mattress + frame",
                categoryChip: ContentDetailCategoryChip(label: "Moving", category: .moving),
                meta: "0.6 mi · posted 4h ago",
                priceLine: "$85",
                priceCaption: "budget · cash or transfer"
            ),
            statStrip: [
                ContentDetailStat(top: "Sun Nov 17", bottom: "fixed date"),
                ContentDetailStat(top: "~45 min", bottom: "duration"),
                ContentDetailStat(top: "2 helpers", bottom: "needed")
            ],
            counterparty: nil,
            modules: [
                whatNeedsDoing,
                pickupDropoff,
                whenWindow,
                photoStrip,
                trustRow,
                .bids(ContentDetailBidsModule(title: "6 bids", sub: "low $55 · high $95", bids: v2Bids))
            ],
            trustCapsules: [],
            dock: ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Place bid")
            )
        )
    }

    // MARK: - A09.1 Task V2 · no bids yet

    static var taskV2NoBids: ContentDetailContent {
        ContentDetailContent(
            kind: .gig,
            cover: nil,
            statusPill: ContentDetailPill(label: "Open · No bids yet", icon: .circle, tone: .warning),
            hero: ContentDetailHero(
                title: "Move queen mattress + frame",
                categoryChip: ContentDetailCategoryChip(label: "Moving", category: .moving),
                meta: "0.6 mi · posted 8 min ago",
                priceLine: "$85",
                priceCaption: "budget · cash or transfer"
            ),
            statStrip: [
                ContentDetailStat(top: "Sun Nov 17", bottom: "fixed date"),
                ContentDetailStat(top: "~45 min", bottom: "duration"),
                ContentDetailStat(top: "2 helpers", bottom: "needed")
            ],
            counterparty: nil,
            modules: [
                whatNeedsDoing,
                pickupDropoff,
                whenWindow,
                photoStrip,
                trustRow,
                .callout(ContentDetailCallout(
                    identifier: "be-first",
                    style: .empty,
                    tone: .dashed,
                    icon: .handCoins,
                    iconTone: .primary,
                    title: "Be the first to bid",
                    subtitle: "Fresh posts usually get a hire in the first hour. First three bids land at the top of the list.",
                    footerPill: "7 neighbors viewing"
                ))
            ],
            trustCapsules: [],
            dock: ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Place bid")
            )
        )
    }

    // MARK: - A09.2 Gig V1 · populated (3 bids, plain description)

    static var gigV1Populated: ContentDetailContent {
        ContentDetailContent(
            kind: .gig,
            cover: nil,
            statusPill: ContentDetailPill(label: "Open", icon: .circle, tone: .warning),
            hero: ContentDetailHero(
                title: "Dog walk · 45 min",
                categoryChip: nil,
                meta: "0.4 mi · Thu Nov 14 · 5:30pm",
                priceLine: "$22",
                priceCaption: "budget"
            ),
            statStrip: [],
            counterparty: nil,
            modules: [
                v1Description,
                postedBy,
                .bids(ContentDetailBidsModule(title: "3 bids", bids: v1Bids))
            ],
            trustCapsules: [],
            dock: ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Place bid")
            )
        )
    }

    // MARK: - A09.2 Gig V1 · awarded

    static var gigV1Awarded: ContentDetailContent {
        ContentDetailContent(
            kind: .gig,
            cover: nil,
            statusPill: ContentDetailPill(label: "Awarded", icon: .check, tone: .success),
            hero: ContentDetailHero(
                title: "Dog walk · 45 min",
                categoryChip: nil,
                meta: "0.4 mi · Thu Nov 14 · 5:30pm",
                priceLine: "$22",
                priceCaption: "winning bid"
            ),
            statStrip: [],
            counterparty: nil,
            modules: [
                .callout(ContentDetailCallout(
                    identifier: "awarded",
                    style: .banner,
                    tone: .success,
                    icon: .check,
                    iconTone: .success,
                    title: "Awarded to Tomás G.",
                    subtitle: "14 min ago · bidding now closed"
                )),
                v1Description,
                postedBy,
                .bids(ContentDetailBidsModule(title: "3 bids", sub: "closed", bids: v1AwardedBids))
            ],
            trustCapsules: [],
            dock: ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Bidding closed", icon: .lock, enabled: false)
            )
        )
    }

    // MARK: - Shared Magic Task modules

    private static var whatNeedsDoing: ContentDetailModule {
        .description(ContentDetailDescription(
            title: "What needs doing",
            icon: .clipboardList,
            body: "Queen mattress (Casper, ~70 lb) plus metal bed frame, disassembled. "
                + "Apt is 2nd floor walk-up — straight shot, no tight turns. Truck or van "
                + "required; I do not have one."
        ))
    }

    private static var pickupDropoff: ContentDetailModule {
        .twoStop(ContentDetailTwoStop(
            title: "Pickup → drop-off",
            icon: .mapPin,
            stops: [
                ContentDetailTwoStop.Stop(letter: "A", tone: .primary, address: "712 Maplewood, Apt 2B", distance: "0.6 mi"),
                ContentDetailTwoStop.Stop(letter: "B", tone: .success, address: "209 Cedar Ave, Apt 7", distance: "2.1 mi")
            ]
        ))
    }

    private static var whenWindow: ContentDetailModule {
        .captionedText(ContentDetailCaptionedText(
            title: "When",
            icon: .calendar,
            label: "Sun Nov 17 · 10am – 12pm window"
        ))
    }

    private static var photoStrip: ContentDetailModule {
        .photoStrip(ContentDetailPhotoStrip(
            title: "Photos",
            icon: .image,
            countLabel: "3",
            tiles: [
                ContentDetailPhotoTile(gradient: ListingGradient.from(id: "a09-photo-0"), icon: .home),
                ContentDetailPhotoTile(gradient: ListingGradient.from(id: "a09-photo-1"), icon: .package),
                ContentDetailPhotoTile(gradient: ListingGradient.from(id: "a09-photo-2"), icon: .doorOpen)
            ]
        ))
    }

    private static var trustRow: ContentDetailModule {
        .capsuleRow(ContentDetailCapsuleRow(capsules: [
            ContentDetailPill(label: "Verified address", icon: .shieldCheck, tone: .info),
            ContentDetailPill(label: "5.0★ rating", icon: .star, tone: .warning),
            ContentDetailPill(label: "14 jobs done", icon: .check, tone: .success)
        ]))
    }

    private static var v2Bids: [ContentDetailBidRow] {
        [
            bid("MK", "Marcus K.", "5.0 · 47 jobs", "$55", tag: "fastest reply"),
            bid("AT", "Aaliyah T.", "4.9 · 28 jobs", "$70"),
            bid("BV", "Ben V.", "4.8 · 63 jobs", "$75", tag: "has van"),
            bid("PC", "Priya C.", "4.9 · 12 jobs", "$80"),
            bid("DN", "Devon N.", "4.7 · 31 jobs", "$85"),
            bid("IH", "Isla H.", "5.0 · 8 jobs", "$95")
        ]
    }

    // MARK: - Shared V1 modules

    private static var v1Description: ContentDetailModule {
        .description(ContentDetailDescription(
            title: "Description",
            icon: nil,
            body: "Need someone to walk Biscuit (corgi, 24 lb, friendly) for ~45 min while I'm "
                + "in a late meeting. Leash + poop bags by the door. Lockbox code shared after "
                + "award. One-time, possibly recurring on Thursdays."
        ))
    }

    private static var postedBy: ContentDetailModule {
        .captionedText(ContentDetailCaptionedText(
            title: "Posted by",
            icon: nil,
            label: "Hana O. · 3 gigs posted · 2h ago"
        ))
    }

    private static var v1Bids: [ContentDetailBidRow] {
        [
            bid("TG", "Tomás G.", "4.9 · 21 jobs", "$20"),
            bid("RN", "Rae N.", "5.0 · 6 jobs", "$22"),
            bid("CW", "Carla W.", "4.8 · 34 jobs", "$25")
        ]
    }

    private static var v1AwardedBids: [ContentDetailBidRow] {
        [
            bid("TG", "Tomás G.", "4.9 · 21 jobs", "$20", won: true),
            bid("RN", "Rae N.", "5.0 · 6 jobs", "$22", dimmed: true),
            bid("CW", "Carla W.", "4.8 · 34 jobs", "$25", dimmed: true)
        ]
    }

    private static func bid(
        _ initials: String,
        _ name: String,
        _ ratingLine: String,
        _ amount: String,
        tag: String? = nil,
        won: Bool = false,
        dimmed: Bool = false
    ) -> ContentDetailBidRow {
        ContentDetailBidRow(
            id: "\(initials)-\(amount)",
            initials: initials,
            displayName: name,
            avatarColor: "primary",
            ratingLine: ratingLine,
            amount: amount,
            verified: true,
            tag: tag,
            won: won,
            dimmed: dimmed
        )
    }
}
