//
//  MailItemSampleData.swift
//  Pantopus
//
//  Deterministic fixtures for mailbox item-detail bodies. Backend is out
//  of the repo, so previews and snapshot tests build these directly rather
//  than round-tripping the network. Mirrors the A17.6 gig.jsx sample data.
//

import Foundation

/// Sample payloads for the mailbox item-detail bodies.
public enum MailItemSampleData {}

public extension MailItemSampleData {
    /// A17.5 primary coupon state — ready to scan in store.
    static let couponUnused = CouponDetailDTO(
        brandLogoURL: nil,
        brandName: "Brass Owl Bakery",
        headline: "25% OFF",
        subcopy: "Your next in-store purchase",
        code: "BRASS25",
        expiresAt: "2026-06-30",
        merchant: "Brass Owl Bakery",
        terms: "Valid for one in-store transaction. Cannot be combined with daily specials or loyalty rewards.",
        minimumSpend: "$8 minimum",
        finePrint: "Excludes whole-cake orders, catering trays, gift cards, and already-marked-down items."
    )

    /// A17.5 redeemed secondary state — success ribbon replaces the hero.
    static let couponRedeemed = CouponDetailDTO(
        brandLogoURL: nil,
        brandName: "Brass Owl Bakery",
        headline: "25% OFF",
        subcopy: "Your next in-store purchase",
        code: "BRASS25",
        expiresAt: "2026-06-30",
        merchant: "Brass Owl Bakery",
        terms: "Redeemed offers cannot be reused or transferred.",
        minimumSpend: "$8 minimum",
        finePrint: "Coupon was single-use and has been retired after checkout."
    )

    /// A17.5 terminal expired state.
    static let couponExpired = CouponDetailDTO(
        brandLogoURL: nil,
        brandName: "Brass Owl Bakery",
        headline: "25% OFF",
        subcopy: "Your next in-store purchase",
        code: "BRASS25",
        expiresAt: "2026-05-01",
        merchant: "Brass Owl Bakery",
        terms: "Expired offers cannot be scanned, copied, or restored.",
        minimumSpend: "$8 minimum",
        finePrint: "This offer expired before redemption."
    )

    /// A17.5 SimilarOffers rail entry — decorative mini-coupon card
    /// (coupon.jsx SIMILAR). No backend feed yet, so the rail is
    /// fixture-driven like the rest of the coupon body.
    struct SimilarOffer: Identifiable, Sendable, Hashable {
        public let id: String
        public let brand: String
        public let initials: String
        public let distance: String
        public let amount: String
        public let subline: String
        public let expires: String
    }

    /// A17.5 "Similar offers near you" fixtures, per coupon.jsx SIMILAR.
    static let couponSimilarOffers: [SimilarOffer] = [
        SimilarOffer(
            id: "hazel-coffee",
            brand: "Hazel Coffee",
            initials: "HC",
            distance: "0.2 mi",
            amount: "$2 off",
            subline: "any drip + pastry",
            expires: "Fri"
        ),
        SimilarOffer(
            id: "pier-florals",
            brand: "Pier Florals",
            initials: "PF",
            distance: "0.6 mi",
            amount: "BOGO",
            subline: "cut-flower bunches",
            expires: "May 28"
        ),
        SimilarOffer(
            id: "north-bay-tackle",
            brand: "North Bay Tackle",
            initials: "NT",
            distance: "1.1 mi",
            amount: "15% off",
            subline: "all bait & line",
            expires: "Jun 10"
        )
    ]

    /// A17.5 wallet-pass helper-chip fixtures (coupon.jsx WalletPreview).
    /// Previews / snapshots only — the live body leaves these nil so the
    /// redeemed pass never claims a reminder or geofence the user never set.
    static let couponWalletReminderDetail = "Sat Jun 27"
    static let couponWalletArrivalDetail = "On · 200 ft"
}

public extension MailItemSampleData {
    /// A17.2 primary booklet sample — neighborhood civic guide.
    static let bookletVoterGuide = BookletDetailDTO(
        pages: [
            sampleURL("https://example.com/pantopus/booklets/voter-guide/page-1.png"),
            sampleURL("https://example.com/pantopus/booklets/voter-guide/page-2.png"),
            sampleURL("https://example.com/pantopus/booklets/voter-guide/page-3.png"),
            sampleURL("https://example.com/pantopus/booklets/voter-guide/page-4.png")
        ],
        summary: "Nonpartisan voter guide for the June 2026 primary, including local races and ballot measures.",
        pageCount: 4,
        ocrTexts: [
            "LEAGUE OF WOMEN VOTERS\nJune 2026 primary voter guide\nVolume 47\n"
                + "Polls open 7 AM – 8 PM · Tuesday, June 2, 2026\nAlameda County · Nonpartisan",
            "HOW TO VOTE\nFour steps to a ballot you trust.\n1. Check that you are registered.\n"
                + "2. Find your polling place.\n3. Bring your ID — or vote by mail.\n"
                + "4. Mark, sign, and return your ballot.",
            "ON YOUR BALLOT\nCity Council · District 3\nThree candidates are running. "
                + "Statements appear exactly as submitted.",
            "MEASURE K\nParks parcel tax renewal\nRenews the existing $48 parcel tax "
                + "for park maintenance. No rate increase."
        ]
    )

    /// A17.2 secondary booklet sample — merchant catalog mailed to a neighborhood.
    static let bookletNeighborhoodCatalog = BookletDetailDTO(
        pages: [
            sampleURL("https://example.com/pantopus/booklets/catalog/page-1.png"),
            sampleURL("https://example.com/pantopus/booklets/catalog/page-2.png"),
            sampleURL("https://example.com/pantopus/booklets/catalog/page-3.png")
        ],
        summary: "Spring catalog with seasonal services, repair windows, and neighborhood-only pricing.",
        pageCount: 3,
        ocrTexts: [
            "SPRING CATALOG\nNeighborhood services & seasonal pricing\nValid through June 15",
            "GUTTER & ROOF\nSpring repair windows now booking\nNeighborhood-only pricing on inspections",
            "GARDEN & YARD\nWeekly and one-time visits\nBundle two services and save 10%"
        ]
    )
}

public extension MailItemSampleData {
    /// A17.1 generic elf bullets, per mail-detail.jsx ELF.bullets.
    static let genericElfBullets: [AIElfBullet] = [
        AIElfBullet(id: "affects", icon: .mapPin, label: "Affects 412 Elm St", text: "next door to you"),
        AIElfBullet(id: "hearing", icon: .calendar, label: "Hearing Tue Jun 3, 6:00 PM", text: "City Hall, Room 1"),
        AIElfBullet(id: "comment", icon: .pencil, label: "Written comment by May 30", text: "optional")
    ]

    /// A17.1 acknowledged-state elf bullets, per mail-detail.jsx ELF_ACK.bullets.
    static let genericAckElfBullets: [AIElfBullet] = [
        AIElfBullet(id: "reminder", icon: .bell, label: "Comment-window reminder", text: "Fri May 30, 9:00 AM"),
        AIElfBullet(id: "hearing", icon: .calendar, label: "Hearing reminder", text: "Tue Jun 3, 5:00 PM"),
        AIElfBullet(id: "vault", icon: .archive, label: "Moved to Vault", text: "after hearing closes")
    ]
}

public extension MailItemSampleData {
    /// Next-steps timeline shown once a bid is accepted (A17.6 NEXT_STEPS).
    static let gigNextSteps: [GigDetailDTO.NextStep] = [
        .init(id: "accepted", label: "Bid accepted", whenText: "Just now", state: .active),
        .init(id: "confirm", label: "Marcus confirms · expects 12m", whenText: "Pending", state: .pending),
        .init(id: "job", label: "Job · Sat May 24, 9 AM", whenText: "Calendar reminder set", state: .upcoming),
        .init(
            id: "complete",
            label: "Both mark complete · funds release",
            whenText: "After the job",
            state: .upcoming
        ),
        .init(id: "review", label: "Review each other", whenText: "Within 7 days", state: .upcoming)
    ]

    /// Incoming-bid state — the primary A17.6 frame.
    static let gigReceived = GigDetailDTO(
        isAccepted: false,
        bidder: GigDetailDTO.Bidder(
            initials: "MT",
            name: "Marcus T.",
            handle: "@marcus_t",
            blurb: "Lives on Maple St · 0.8 mi from you",
            rating: 4.9,
            jobs: 47,
            responseTime: "~12 min",
            identityLabel: "Personal",
            isVerified: true,
            badges: ["Moving · 24 jobs", "Handyman · 15 jobs", "Has truck"]
        ),
        bid: GigDetailDTO.Bid(
            amount: 65,
            unit: "flat",
            eta: "Saturday · 9–10 AM",
            expires: "Expires in 22h",
            message: [
                "Hi! I can do this Saturday morning — I'll bring my pickup and two furniture dollies " +
                    "so we shouldn't need extra hands.",
                "Happy to wrap the sofa if you want, just have a sheet ready. $65 covers the whole job " +
                    "including drive time."
            ]
        ),
        post: GigDetailDTO.Post(
            title: "Sofa move — garage → living room",
            categoryLabel: "Moving",
            posted: "2 days ago · by you",
            expires: "Bids close in 4 days",
            budget: "$40–80 · flexible",
            schedule: "This Saturday, May 24 · morning",
            location: "1428 Elm St (your address)",
            details: "One 3-seater sofa, about 7 ft. Already has the legs unscrewed. Doorway clearance " +
                "is fine — moved it through there once before.",
            bidCount: 3
        ),
        otherBids: [
            GigDetailDTO.OtherBid(
                id: "devon",
                who: "Devon R.",
                initials: "DR",
                amount: 55,
                rating: 4.7,
                jobs: 18,
                whenText: "40m ago",
                flag: "cheapest"
            ),
            GigDetailDTO.OtherBid(
                id: "sasha",
                who: "Sasha P.",
                initials: "SP",
                amount: 80,
                rating: 5.0,
                jobs: 112,
                whenText: "1h ago",
                flag: "top-rated"
            )
        ],
        nextSteps: gigNextSteps
    )

    /// Bid-accepted secondary state.
    static let gigAccepted = gigReceived.accepted()

    /// Builds a `MailDetailContent` envelope wrapping a gig DTO for the
    /// A17.6 layout. Previews + snapshot tests use this so they don't
    /// have to round-trip the projection.
    static func gigMailContent(
        gig: GigDetailDTO,
        title: String = "New bid · $65 to move your sofa Saturday"
    ) -> MailDetailContent {
        MailDetailContent(
            mailId: "gig-\(gig.isAccepted ? "accepted" : "received")",
            category: .gig,
            trust: .chain,
            detailTrust: .neutral,
            senderDisplayName: gig.bidder.name,
            senderMeta: gig.bidder.handle.isEmpty ? gig.bidder.blurb : gig.bidder.handle,
            senderTypeLabel: "Pantopus user",
            carrierLine: "via Pantopus Mail",
            senderInitials: gig.bidder.initials,
            senderUserId: "gig-bidder",
            title: title,
            excerpt: "Bid on your gig “\(gig.post.title)”.",
            referenceLabel: "Bid GIG-4421",
            createdAtLabel: "12m ago",
            expiresAtLabel: gig.bid.expires,
            readStatusLabel: gig.isAccepted ? "Read" : "Unread",
            bodyParagraphs: [],
            attachments: [],
            aiSummary: nil,
            ackRequired: false,
            isAcknowledged: gig.isAccepted,
            gigDetail: gig
        )
    }
}

public extension MailItemSampleData {
    /// A17.7 fresh-arrival memory — keepsake not yet kept in the vault.
    /// Forwards to the dedicated `MemorySampleData.memory` fixture so
    /// catalog-style call sites can reach memory data through the same
    /// `MailItemSampleData` entry point as the other A17 variants.
    static var memoryFresh: MemoryDetailDTO {
        MemorySampleData.memory
    }

    /// A17.7 saved-state memory — same payload with `isSaved` flipped.
    static var memorySaved: MemoryDetailDTO {
        MemorySampleData.savedMemory
    }

    /// A17.3 open/pre-signature certified mail state.
    static let certifiedUnread = CertifiedDetailDTO(
        referenceNumber: "7014 2026 0411 3344 5577",
        documentType: "Supplemental property tax bill",
        acknowledgeBy: "2026-06-30T17:00:00Z",
        chain: [
            .init(
                id: "delivered",
                label: "Delivered to your Pantopus mailbox",
                occurredAt: "2026-05-15T13:02:00Z",
                isComplete: true
            ),
            .init(id: "out_for_delivery", label: "Out for delivery", occurredAt: "2026-05-15T10:38:00Z", isComplete: true),
            .init(id: "distribution", label: "Arrived at distribution center", occurredAt: "2026-05-14T19:08:00Z", isComplete: true),
            .init(id: "transit", label: "In transit", occurredAt: "2026-05-12T17:42:00Z", isComplete: true),
            .init(id: "accepted", label: "Accepted from sender", occurredAt: "2026-05-12T11:30:00Z", isComplete: true)
        ],
        noticeBody: certifiedNoticeBody,
        termsURL: URL(string: "https://example.com/certified-delivery-terms.pdf"),
        isAcknowledged: false
    )

    /// A17.3 signed state with the Pantopus receipt at the top of the chain.
    static let certifiedSigned = CertifiedDetailDTO(
        referenceNumber: certifiedUnread.referenceNumber,
        documentType: certifiedUnread.documentType,
        acknowledgeBy: certifiedUnread.acknowledgeBy,
        chain: [
            .init(
                id: "acknowledged",
                label: "Acknowledged on Pantopus",
                occurredAt: "2026-05-15T14:14:00Z",
                isComplete: true
            )
        ] + certifiedUnread.chain,
        noticeBody: certifiedUnread.noticeBody,
        termsURL: certifiedUnread.termsURL,
        isAcknowledged: true
    )

    /// Same signed payload used for archived shell snapshots.
    static let certifiedArchived = certifiedSigned
}

public extension MailItemSampleData {
    /// A17.10 open-state records sample — Q1 2026 Meridian Wealth
    /// quarterly statement, freshly arrived in the mailbox.
    static let recordsOpen = RecordsSampleData.record

    /// A17.10 filed-state records sample — same statement, filed in the
    /// Vault › Finance › Statements › 2026 folder.
    static let recordsFiled = RecordsSampleData.filedRecord
}

private extension MailItemSampleData {
    static let certifiedNoticeBody = [
        """
        This is a SUPPLEMENTAL property tax bill issued pursuant to Section 75 et seq. of the \
        California Revenue and Taxation Code following a reassessment triggered by a change in \
        ownership recorded on October 14, 2025.
        """,
        """
        Your previously assessed value of $612,000 has been adjusted to $785,400, producing \
        supplemental taxes for the partial year October 2025 through June 2026 in the amount \
        shown below.
        """,
        """
        Payment must be received or postmarked no later than the delinquency date or a 10% \
        penalty plus 1.5% per month interest will accrue.
        """
    ].joined(separator: "\n\n")

    static func sampleURL(_ string: String) -> URL {
        guard let url = URL(string: string) else {
            preconditionFailure("Invalid sample URL: \(string)")
        }
        return url
    }
}
