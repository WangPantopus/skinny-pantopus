//
//  FeedSurface.swift
//  Pantopus
//
//  The A03 feed archetype renders two surfaces from one screen: Pulse
//  (the public neighborhood feed, `surface=place`) and Beacon Updates
//  (broadcasts from verified beacons the user follows, `surface=personas`).
//  Design ref: docs/designs/A03 — feed-frames.jsx (A03.1) + beacons-frames.jsx
//  (A03.2). They share chrome, chip row, card recipe, FAB, and tab bar;
//  only the title, backend surface, verified-floor, and empty state differ.
//

import Foundation

/// Which feed surface a `FeedView` is showing.
public enum FeedSurface: String, Sendable, Hashable, CaseIterable {
    /// A03.1 — public neighborhood feed (`GET /api/posts/feed?surface=place`).
    case pulse
    /// A03.1b — posts from people the viewer is connected to
    /// (`GET /api/posts/feed?surface=connections`). Reached from the Pulse
    /// header's Nearby / Connections toggle — RN
    /// `src/constants/feed.ts:10-13`.
    case connections
    /// A03.2 — beacon broadcasts (`GET /api/posts/feed?surface=personas`).
    case beacons

    /// The two surfaces the in-Pulse toggle switches between. `personas`
    /// lives on its own Beacon Updates route reached from the drawer, so it
    /// is deliberately absent — mirrors RN `SURFACE_TABS`.
    public static let toggleSurfaces: [FeedSurface] = [.pulse, .connections]

    /// Top-bar title. Nearby and Connections are two surfaces of the same
    /// Pulse tab, so they share the chrome title (RN keeps `title="Pulse"`
    /// across the toggle).
    public var title: String {
        switch self {
        case .pulse, .connections: "Pulse"
        case .beacons: "Beacon Updates"
        }
    }

    /// Label on the Nearby / Connections toggle row.
    public var toggleLabel: String {
        switch self {
        case .pulse: "Nearby"
        case .connections: "Connections"
        case .beacons: "Beacons"
        }
    }

    /// Glyph on the Nearby / Connections toggle row.
    public var toggleIcon: PantopusIcon {
        switch self {
        case .pulse: .mapPin
        case .connections: .link
        case .beacons: .rss
        }
    }

    /// Backend `surface` query value sent on `/api/posts/feed`.
    public var backendSurface: String {
        switch self {
        case .pulse: "place"
        case .connections: "connections"
        case .beacons: "personas"
        }
    }

    /// `PostNotHelpful.surface` / `PostMute.surface` value — the moderation
    /// tables normalise `place` to `nearby`
    /// (`backend/routes/posts.js:368-371`).
    public var moderationSurface: String {
        switch self {
        case .pulse: "nearby"
        case .connections: "connections"
        case .beacons: "nearby"
        }
    }

    /// Only the Place surface carries the "not helpful for this area"
    /// signal — RN gates it on `surface === 'place'`
    /// (`PostCard.tsx:445`).
    public var supportsNotHelpful: Bool {
        self == .pulse
    }

    /// Beacons are verified people / businesses / civic accounts, so every
    /// author on that surface carries the verified check disc (A03.2).
    public var authorsAlwaysVerified: Bool {
        switch self {
        case .pulse, .connections: false
        case .beacons: true
        }
    }

    /// Whether the header shows the List / Map toggle. RN hides it on the
    /// `personas` surface because beacon broadcasts aren't geo-pinned —
    /// `src/components/feed/FeedHeader.tsx:36`.
    public var supportsMapMode: Bool {
        switch self {
        case .pulse, .connections: true
        case .beacons: false
        }
    }

    /// Build the empty-state descriptor for this surface.
    ///
    /// - Parameters:
    ///   - scopeLabel: Active neighborhood (Pulse footer). `nil` hides the
    ///     Pulse footer chip.
    ///   - followCount: Beacons followed (Beacons footer).
    public func emptyContent(scopeLabel: String?, followCount: Int) -> FeedEmptyContent {
        switch self {
        case .pulse:
            FeedEmptyContent(
                icon: .radio,
                headline: "No posts yet",
                body: "Be the first to share. Ask a question, recommend a spot, or announce something local.",
                ctaLabel: "Create post",
                ctaIcon: .pencil,
                footerIcon: .mapPin,
                footerLead: "Showing posts within ",
                footerEmphasis: scopeLabel,
                footerTrail: " · change in filter"
            )
        case .connections:
            // RN copy — `FeedEmptyState.tsx:81-84`.
            FeedEmptyContent(
                icon: .link,
                headline: "Connect with people you trust.",
                body: "Posts from your connections land here."
                    + " Connect with neighbors and businesses to fill this feed.",
                ctaLabel: "Create post",
                ctaIcon: .pencil,
                footerIcon: .users,
                footerLead: "Showing posts from ",
                footerEmphasis: "your connections",
                footerTrail: " · switch to Nearby for local"
            )
        case .beacons:
            FeedEmptyContent(
                icon: .rss,
                headline: "Follow a beacon to see updates here",
                body: "Beacons are verified people, businesses, and civic accounts you can follow."
                    + " Their posts land in this feed only.",
                ctaLabel: "Discover beacons",
                ctaIcon: .compass,
                footerIcon: .users,
                footerLead: "You follow ",
                footerEmphasis: "\(followCount) beacons",
                footerTrail: " · suggestions nearby"
            )
        }
    }
}

/// Render descriptor for a feed empty state. The footer chip reads
/// `footerLead` + bold `footerEmphasis` + `footerTrail`; it is hidden when
/// `footerEmphasis` is `nil`.
public struct FeedEmptyContent: Sendable, Hashable {
    public let icon: PantopusIcon
    public let headline: String
    public let body: String
    public let ctaLabel: String
    public let ctaIcon: PantopusIcon
    public let footerIcon: PantopusIcon
    public let footerLead: String
    public let footerEmphasis: String?
    public let footerTrail: String

    public init(
        icon: PantopusIcon,
        headline: String,
        body: String,
        ctaLabel: String,
        ctaIcon: PantopusIcon,
        footerIcon: PantopusIcon,
        footerLead: String,
        footerEmphasis: String?,
        footerTrail: String
    ) {
        self.icon = icon
        self.headline = headline
        self.body = body
        self.ctaLabel = ctaLabel
        self.ctaIcon = ctaIcon
        self.footerIcon = footerIcon
        self.footerLead = footerLead
        self.footerEmphasis = footerEmphasis
        self.footerTrail = footerTrail
    }
}
