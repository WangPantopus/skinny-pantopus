//
//  PublicProfileSampleData.swift
//  Pantopus
//
//  B.2 (A10.5) — deterministic neighbor-profile fixtures for the two
//  design frames (Derek R. populated · Sasha M. new neighbor). Backend
//  has been removed, so previews + tests project these directly; the
//  view-model synthesises the same shape from the live DTO.
//

import Foundation

public enum PublicProfileSampleData {
    /// FRAME 1 — populated handyman with 47 reviews + 4 verifications.
    public static let derekPopulated = NeighborProfileContent(
        hero: NeighborHero(
            name: "Derek Reyes",
            locality: "Elm Park · 5th & Elm",
            avatarURL: nil,
            isVerified: true,
            identity: .personal,
            kicker: "Neighbor since 2022"
        ),
        stats: [
            NeighborStat(
                id: "rating",
                value: "4.9",
                label: "47 reviews",
                icon: .star,
                iconColor: Theme.Color.warning
            ),
            NeighborStat(id: "jobs", value: "32", label: "Jobs done"),
            NeighborStat(id: "response", value: "~45m", label: "Response")
        ],
        bio: "Handyman who lives two doors down. Hangs shelves, patches drywall, fixes the "
            + "stuff your landlord won't. Bike-commutes everywhere — happy to drop a tool by "
            + "on the way home. Weekend mornings work best.",
        skills: ["Handyman", "Patch & paint", "Plumbing (light)", "Cycling", "Help moving", "EN · ES"],
        verifications: [
            NeighborVerification(id: "address", icon: .home, label: "Address", meta: "Verified Mar 2022 · postcard"),
            NeighborVerification(id: "identity", icon: .badgeCheck, label: "Identity", meta: "Government ID"),
            NeighborVerification(id: "email", icon: .mail, label: "Email", meta: "derek@…"),
            NeighborVerification(id: "phone", icon: .phone, label: "Phone", meta: "+1 ••• ••• 0193")
        ],
        reviews: [
            ProfileReviewCard(
                id: "r1",
                reviewerName: "Maria K.",
                reviewerAvatarURL: nil,
                rating: 5,
                body: "Showed up early, brought his own anchors, and noticed the stud finder was "
                    + "lying. Shelves are level a month later. Already booked him for the closet.",
                timestamp: "2w · for \u{201C}Hang 3 shelves\u{201D}"
            )
        ],
        reviewCount: 47,
        posts: [
            PublicProfilePost(
                id: "dp1",
                body: "Free leftover deck screws + a half-bag of anchors on my stoop. First come.",
                timeAgo: "3d ago",
                locality: "5th & Elm",
                reactions: 9,
                replies: 4,
                intent: .offer
            )
        ],
        isNewNeighbor: false,
        primaryCtaLabel: "Message"
    )

    /// FRAME 2 — new verified neighbor, 0 reviews, graceful degradation.
    public static let sashaNewNeighbor = NeighborProfileContent(
        hero: NeighborHero(
            name: "Sasha Mendel",
            locality: "Elm Park · 6th St",
            avatarURL: nil,
            isVerified: true,
            identity: .fresh,
            kicker: "Joined 4 days ago"
        ),
        stats: [
            NeighborStat(
                id: "rating",
                value: "—",
                label: "No reviews yet",
                icon: .star,
                valueColor: Theme.Color.appTextMuted,
                iconColor: Theme.Color.appTextMuted
            ),
            NeighborStat(id: "jobs", value: "0", label: "Jobs done"),
            NeighborStat(id: "response", value: "New", label: "Response", valueColor: Theme.Color.primary600)
        ],
        bio: nil,
        skills: [],
        verifications: [
            NeighborVerification(
                id: "address",
                icon: .home,
                label: "Address verified",
                meta: "Postcard delivered to 6th St",
                tile: .success,
                trailing: .status("Today")
            ),
            NeighborVerification(
                id: "identity",
                icon: .badgeCheck,
                label: "Identity verified",
                meta: "Government ID matched",
                tile: .success,
                trailing: .status("4d ago")
            ),
            NeighborVerification(
                id: "email",
                icon: .mail,
                label: "Email confirmed",
                meta: "sasha@…",
                tile: .success,
                trailing: .status("4d ago")
            )
        ],
        reviews: [],
        reviewCount: 0,
        mutuals: NeighborMutuals(
            count: 4,
            names: "Jamal, Ravi, Lena, Amina",
            initials: ["JT", "RD", "LP", "AS"]
        ),
        welcome: NeighborWelcome(
            title: "Be the welcome wagon",
            body: "Sasha just moved in. A quick \u{201C}hi, welcome to the block\u{201D} goes a long way — "
                + "and first messages from verified neighbors travel fast."
        ),
        posts: [],
        isNewNeighbor: true,
        primaryCtaLabel: "Say hi"
    )
}
