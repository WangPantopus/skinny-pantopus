//
//  BusinessProfileSampleData.swift
//  Pantopus
//
//  A10.6 — the two hand-authored design frames used by previews, the
//  snapshot reference, and Android parity: `FrameBizPopulated`
//  (Marlow & Co. Cleaning — open, verified, full profile) and
//  `FrameBizNew` (Tide Pool Pet Care — newly-claimed + closed, with
//  `EmptyBlock`s for the unfilled sections).
//
//  Design reference: `docs/designs/A10/business-frames.jsx`.
//

import Foundation

enum BusinessProfileSampleData {
    /// FrameBizPopulated — Marlow & Co. Cleaning (open, verified).
    static let populated = BusinessProfileContent(
        businessId: "marlow",
        header: BusinessProfileHeader(
            displayName: "Marlow & Co. Cleaning",
            handle: "marlowco",
            locality: "Elm Park",
            isVerified: true,
            logoIcon: .sparkles
        ),
        stats: [
            BusinessStatCell(id: "rating", value: "4.9", label: "128 reviews", leadingStar: true, tint: .star),
            BusinessStatCell(id: "jobs", value: "340", label: "Jobs done"),
            BusinessStatCell(id: "response", value: "~20m", label: "Response")
        ],
        categories: [
            BusinessCategoryChip(id: "cleaning", label: "Cleaning", icon: .sparkles, accent: .cleaning),
            BusinessCategoryChip(id: "home", label: "Home & apartment", icon: .home, accent: .neutral),
            BusinessCategoryChip(id: "moveout", label: "Move-out", icon: .package, accent: .neutral),
            BusinessCategoryChip(id: "eco", label: "Eco products", icon: .leaf, accent: .neutral)
        ],
        about: "Family-run cleaning crew that's worked Elm Park homes since 2019. "
            + "Two-person teams, your own checklist, same crew each visit. We bring "
            + "eco-safe supplies — you don't stock a thing. Bonded and insured.",
        aboutChips: [
            BusinessAboutChip(id: "bonded", label: "Bonded & insured", icon: .shield),
            BusinessAboutChip(id: "team", label: "3 team members", icon: .users),
            BusinessAboutChip(id: "since", label: "Since 2019", icon: .calendarCheck)
        ],
        status: BusinessOpenState(
            isOpen: true,
            statusLabel: "Open now",
            statusDetail: "Closes 6:00 PM",
            chipLabel: "Open now"
        ),
        hours: [
            BusinessHoursRow(id: "mon", dayLabel: "Monday", timeLabel: "8:00 AM – 6:00 PM", isClosed: false, isToday: true),
            BusinessHoursRow(id: "tue", dayLabel: "Tuesday", timeLabel: "8:00 AM – 6:00 PM", isClosed: false),
            BusinessHoursRow(id: "wed", dayLabel: "Wednesday", timeLabel: "8:00 AM – 6:00 PM", isClosed: false),
            BusinessHoursRow(id: "thu", dayLabel: "Thursday", timeLabel: "8:00 AM – 6:00 PM", isClosed: false),
            BusinessHoursRow(id: "fri", dayLabel: "Friday", timeLabel: "8:00 AM – 5:00 PM", isClosed: false),
            BusinessHoursRow(id: "sat", dayLabel: "Saturday", timeLabel: "9:00 AM – 2:00 PM", isClosed: false),
            BusinessHoursRow(id: "sun", dayLabel: "Sunday", timeLabel: "Closed", isClosed: true)
        ],
        serviceArea: BusinessServiceArea(
            title: "Based near 5th & Birch",
            detail: "Exact address shared after booking",
            serviceArea: "Serves Elm Park & Cedar Heights — within 4 mi",
            latitude: 42.37,
            longitude: -71.11
        ),
        services: [
            BusinessServiceRow(
                id: "standard",
                name: "Standard clean",
                detail: "2 hr · 2-person team",
                priceLabel: "from $90",
                unit: "per visit",
                icon: .droplets
            ),
            BusinessServiceRow(
                id: "deep",
                name: "Deep clean",
                detail: "4 hr · baseboards, inside oven",
                priceLabel: "from $180",
                unit: "per visit",
                icon: .sparkles
            ),
            BusinessServiceRow(
                id: "moveout",
                name: "Move-out clean",
                detail: "Empty home · deposit-ready",
                priceLabel: "from $240",
                unit: "flat",
                icon: .package
            )
        ],
        gallery: [
            BusinessGalleryItem(id: "kitchen", label: "Kitchen", tint: .primary),
            BusinessGalleryItem(id: "bath", label: "Bathroom", tint: .success),
            BusinessGalleryItem(id: "living", label: "Living room", tint: .slate),
            BusinessGalleryItem(id: "more", label: nil, tint: .deep, moreCount: 9)
        ],
        reviewSummary: BusinessReviewSummary(
            average: 4.9,
            count: 128,
            distribution: [0.92, 0.06, 0.02, 0, 0]
        ),
        reviews: [
            BusinessReviewCard(
                id: "jt",
                reviewerName: "Jamal T.",
                reviewerAvatarURL: nil,
                rating: 5,
                body: "Same two folks every time, which I love. They remember the dog and shut "
                    + "the gate. Place smells like nothing, which is exactly right.",
                timestamp: "1w · Standard clean",
                verified: true
            )
        ],
        dock: BusinessActionDock(secondary: .book, note: nil),
        savedPlace: PendingSavePlace(
            label: "Marlow & Co. Cleaning",
            latitude: 42.37,
            longitude: -71.11,
            city: "Elm Park",
            sourceId: "marlow"
        ),
        isNewlyClaimed: false,
        phoneNumber: "+15555550100",
        websiteURL: nil,
        viewerIsOwner: false
    )

    /// FrameBizNew — Tide Pool Pet Care (newly-claimed + closed).
    /// About / Hours / Service area / Recent work / Reviews are all empty
    /// so the secondary frame demonstrates the `EmptyBlock` states.
    static let newlyClaimed = BusinessProfileContent(
        businessId: "tidepool",
        header: BusinessProfileHeader(
            displayName: "Tide Pool Pet Care",
            handle: "tidepoolpets",
            locality: "Cedar Heights",
            isVerified: true,
            logoIcon: .pawPrint
        ),
        stats: [
            BusinessStatCell(id: "rating", value: "—", label: "No reviews yet", leadingStar: true, tint: .muted),
            BusinessStatCell(id: "jobs", value: "0", label: "Jobs done"),
            BusinessStatCell(id: "new", value: "New", label: "On Pantopus", tint: .business)
        ],
        categories: [
            BusinessCategoryChip(id: "pet", label: "Pet care", icon: .pawPrint, accent: .pet),
            BusinessCategoryChip(id: "dog", label: "Dog walking", icon: .dog, accent: .neutral)
        ],
        about: nil,
        aboutChips: [],
        status: BusinessOpenState(
            isOpen: false,
            statusLabel: "Closed now",
            statusDetail: "Opens tomorrow at 8:00 AM",
            chipLabel: "Closed · opens 8 AM"
        ),
        hours: [],
        serviceArea: nil,
        services: [
            BusinessServiceRow(
                id: "walk",
                name: "30-min dog walk",
                detail: "Solo walk · your route",
                priceLabel: "$22",
                unit: "per walk",
                icon: .pawPrint
            ),
            BusinessServiceRow(
                id: "dropin",
                name: "Drop-in visit",
                detail: "Feed, water, playtime",
                priceLabel: "$20",
                unit: "per visit",
                icon: .home
            )
        ],
        gallery: [],
        reviewSummary: nil,
        reviews: [],
        dock: BusinessActionDock(
            secondary: .call,
            note: "Closed now — messages answered at 8 AM"
        ),
        isNewlyClaimed: true,
        phoneNumber: "+15555550111",
        websiteURL: nil,
        viewerIsOwner: false
    )
}
