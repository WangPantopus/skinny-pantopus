//
//  ViewAsSampleData.swift
//  Pantopus
//
//  B5.2 (A18.5) — the sample privacy matrix that drives the "View as"
//  preview. This stands in for real per-field privacy resolution from the
//  backend (out of scope this pass); it mirrors the A14.7 privacy model as
//  a per-audience disclosure ladder over one canonical profile (Dana
//  Okafor). The two endpoints — `public` (heavily redacted) and
//  `connection` (rich) — reproduce `docs/designs/A18/view-as-frames.jsx`
//  verbatim; the four middle audiences interpolate the gradient.
//
//  Rule of thumb encoded below: trust widens left→right (Public · Persona
//  audience · Neighbor · Gig participant · Household · Connection), so each
//  step unlocks a coarse value, then a precise one, then the withheld
//  fields (mutuals, contact), and flips locked verification chips on.
//

import SwiftUI

public enum ViewAsSampleData {
    /// Rating is the same trust signal for every audience.
    private static let rating = "4.9 · 38 reviews"

    private static func field(
        _ id: String,
        _ icon: PantopusIcon,
        _ label: String,
        _ disclosure: ViewAsFieldDisclosure
    ) -> ViewAsField {
        ViewAsField(id: id, icon: icon, label: label, disclosure: disclosure)
    }

    /// Resolve the full render the given audience would see. Exhaustive over
    /// `ViewerAudience`, so the view-model never has to deal with a miss.
    public static func render(for viewer: ViewerAudience) -> ViewAsRender {
        switch viewer {
        case .public: publicRender
        case .personaAudience: personaRender
        case .neighbor: neighborRender
        case .gigParticipant: gigRender
        case .household: householdRender
        case .connection: connectionRender
        }
    }

    /// Every render, picker order. Handy for previews / snapshot sweeps.
    public static var all: [ViewAsRender] {
        ViewerAudience.allCases.map(render(for:))
    }

    // MARK: - Public (most redacted — design frame B)

    private static let publicRender = ViewAsRender(
        viewer: .public,
        banner: ViewAsBanner(
            icon: .globe,
            viewerLabel: "the public",
            subtitle: "Most details are hidden",
            tone: .restricted
        ),
        head: ViewAsHead(
            name: "Dana O.",
            handle: "Maple Heights area",
            initials: "D",
            avatarTone: .masked,
            identity: .personal,
            verified: true
        ),
        badges: [
            ViewAsBadge(id: "neighbor", icon: .badgeCheck, label: "Verified neighbor", isOn: true),
            ViewAsBadge(id: "id", icon: .lock, label: "ID verified", isOn: false),
            ViewAsBadge(id: "phone", icon: .lock, label: "Phone verified", isOn: false)
        ],
        fields: [
            field("location", .mapPin, "Location", .coarse("Maple Heights district")),
            field("memberSince", .calendar, "Member since", .visible("2023")),
            field("rating", .star, "Rating", .visible(rating)),
            field("mutuals", .users, "Mutual connections", .hidden),
            field("contact", .phone, "Contact", .hidden)
        ],
        note: ViewAsContextNote(
            icon: .eyeOff,
            text: "Exact address, contacts, and connections stay private to the public.",
            tone: .restricted
        ),
        footerText: "Anyone not connected to you sees only this minimal card."
    )

    // MARK: - Persona audience (followers of your public face)

    private static let personaRender = ViewAsRender(
        viewer: .personaAudience,
        banner: ViewAsBanner(
            icon: .megaphone,
            viewerLabel: "your audience",
            subtitle: "Most details are hidden",
            tone: .restricted
        ),
        head: ViewAsHead(
            name: "Dana O.",
            handle: "@dana.o · Public profile",
            initials: "DO",
            avatarTone: .personal,
            identity: .personal,
            verified: true
        ),
        badges: [
            ViewAsBadge(id: "creator", icon: .badgeCheck, label: "Verified creator", isOn: true),
            ViewAsBadge(id: "id", icon: .lock, label: "ID verified", isOn: false),
            ViewAsBadge(id: "phone", icon: .lock, label: "Phone verified", isOn: false)
        ],
        fields: [
            field("location", .mapPin, "Location", .coarse("Maple Heights district")),
            field("memberSince", .calendar, "Member since", .visible("Since 2023")),
            field("rating", .star, "Rating", .visible(rating)),
            field("mutuals", .users, "Mutual connections", .hidden),
            field("contact", .phone, "Contact", .hidden)
        ],
        note: ViewAsContextNote(
            icon: .eyeOff,
            text: "Followers see your public creator card — your neighbor identity stays separate.",
            tone: .restricted
        ),
        footerText: "Followers of your public profile see only what you broadcast."
    )

    // MARK: - Neighbor (verified neighbors nearby)

    private static let neighborRender = ViewAsRender(
        viewer: .neighbor,
        banner: ViewAsBanner(
            icon: .mapPin,
            viewerLabel: "a neighbor",
            subtitle: "This is what they see",
            tone: .info
        ),
        head: ViewAsHead(
            name: "Dana Okafor",
            handle: "@dana.o · Maple Heights",
            initials: "DO",
            avatarTone: .personal,
            identity: .personal,
            verified: true
        ),
        badges: [
            ViewAsBadge(id: "address", icon: .mapPin, label: "Address verified", isOn: true),
            ViewAsBadge(id: "id", icon: .badgeCheck, label: "ID verified", isOn: true),
            ViewAsBadge(id: "phone", icon: .lock, label: "Phone verified", isOn: false)
        ],
        fields: [
            field("location", .mapPin, "Location", .visible("Maple Heights · 4 blocks away")),
            field("memberSince", .calendar, "Member since", .visible("March 2023 · 2 yrs")),
            field("rating", .star, "Rating", .visible(rating)),
            field("mutuals", .users, "Mutual connections", .visible("3 neighbors in common")),
            field("contact", .phone, "Contact", .hidden)
        ],
        note: ViewAsContextNote(
            icon: .mapPin,
            text: "Verified neighbors nearby see your local profile and approximate location.",
            tone: .info
        ),
        footerText: "Verified neighbors see your local profile within your area."
    )

    // MARK: - Gig participant (someone on a shared job)

    private static let gigRender = ViewAsRender(
        viewer: .gigParticipant,
        banner: ViewAsBanner(
            icon: .briefcase,
            viewerLabel: "a gig participant",
            subtitle: "This is what they see",
            tone: .info
        ),
        head: ViewAsHead(
            name: "Dana Okafor",
            handle: "@dana.o · Gig partner",
            initials: "DO",
            avatarTone: .personal,
            identity: .personal,
            verified: true
        ),
        badges: [
            ViewAsBadge(id: "id", icon: .badgeCheck, label: "ID verified", isOn: true),
            ViewAsBadge(id: "phone", icon: .phone, label: "Phone verified", isOn: true),
            ViewAsBadge(id: "background", icon: .shieldCheck, label: "Background check", isOn: true)
        ],
        fields: [
            field("location", .mapPin, "Location", .coarse("Maple Heights area")),
            field("memberSince", .calendar, "Member since", .visible("March 2023 · 2 yrs")),
            field("rating", .star, "Rating", .visible(rating)),
            field("mutuals", .users, "Mutual connections", .visible("2 in common · this gig")),
            field("contact", .phone, "Contact", .visible("Shared for this gig"))
        ],
        note: ViewAsContextNote(
            icon: .briefcase,
            text: "Gig participants see what's needed to coordinate the job, shared only while it's active.",
            tone: .info
        ),
        footerText: "Gig participants see job-relevant details while the gig is active."
    )

    // MARK: - Household (people who share your home)

    private static let householdRender = ViewAsRender(
        viewer: .household,
        banner: ViewAsBanner(
            icon: .home,
            viewerLabel: "your household",
            subtitle: "This is what they see",
            tone: .info
        ),
        head: ViewAsHead(
            name: "Dana Okafor",
            handle: "Maple Heights · Household",
            initials: "DO",
            avatarTone: .home,
            identity: .home,
            verified: true
        ),
        badges: [
            ViewAsBadge(id: "address", icon: .mapPin, label: "Address verified", isOn: true),
            ViewAsBadge(id: "id", icon: .badgeCheck, label: "ID verified", isOn: true),
            ViewAsBadge(id: "phone", icon: .phone, label: "Phone verified", isOn: true)
        ],
        fields: [
            field("location", .mapPin, "Location", .visible("412 Maple Heights · Home")),
            field("memberSince", .calendar, "Member since", .visible("March 2023 · 2 yrs")),
            field("rating", .star, "Rating", .visible(rating)),
            field("mutuals", .users, "Mutual connections", .visible("Household of 4")),
            field("contact", .phone, "Contact", .visible("Shared with household"))
        ],
        note: ViewAsContextNote(
            icon: .home,
            text: "People in your household see shared home details and contacts.",
            tone: .info
        ),
        footerText: "People in your household see shared home details."
    )

    // MARK: - Connection (full trust — design frame A)

    private static let connectionRender = ViewAsRender(
        viewer: .connection,
        banner: ViewAsBanner(
            icon: .userCheck,
            viewerLabel: "a connection",
            subtitle: "This is what they see",
            tone: .info
        ),
        head: ViewAsHead(
            name: "Dana Okafor",
            handle: "@dana.o · Maple Heights",
            initials: "DO",
            avatarTone: .personal,
            identity: .personal,
            verified: true
        ),
        badges: [
            ViewAsBadge(id: "address", icon: .mapPin, label: "Address verified", isOn: true),
            ViewAsBadge(id: "id", icon: .badgeCheck, label: "ID verified", isOn: true),
            ViewAsBadge(id: "phone", icon: .phone, label: "Phone verified", isOn: true)
        ],
        fields: [
            field("location", .mapPin, "Location", .visible("Maple Heights · 2 blocks away")),
            field("memberSince", .calendar, "Member since", .visible("March 2023 · 2 yrs")),
            field("rating", .star, "Rating", .visible(rating)),
            field("mutuals", .users, "Mutual connections", .visible("6 neighbors in common")),
            field("contact", .phone, "Contact", .visible("Available on request"))
        ],
        note: ViewAsContextNote(
            icon: .users,
            text: "You completed 2 tasks together. Connections see your shared history.",
            tone: .info
        ),
        footerText: "Connections see more because you've interacted before."
    )
}
