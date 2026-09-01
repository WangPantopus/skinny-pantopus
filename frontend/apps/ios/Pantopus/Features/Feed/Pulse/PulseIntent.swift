//
//  PulseIntent.swift
//  Pantopus
//
//  Ten-way classification for Pulse posts. Drives the chip-row filter,
//  the per-card colored chip, the reaction-verb set, and the compose
//  FAB's pre-fill. The `all` case is a chip-row-only sentinel; real
//  posts always resolve to one of the other nine.
//
//  The chip set mirrors RN's `PLACE_POST_TYPES`
//  (`src/constants/feed.ts:18-28`) 1:1 — `alert` / `deal` /
//  `neighborhoodWin` / `visitorGuide` were previously collapsed into
//  `announce`, which made those four lanes unreachable from the filter
//  row.
//

import Foundation

/// One of the ten chip-row intents.
public enum PulseIntent: String, CaseIterable, Sendable, Hashable {
    case all
    case ask
    case recommend
    case event
    case lost
    case alert
    case deal
    case announce
    case neighborhoodWin
    case visitorGuide

    /// Chip-row display label — RN `PLACE_POST_TYPES` labels.
    public var label: String {
        switch self {
        case .all: "All"
        case .ask: "Ask"
        case .recommend: "Recommend"
        case .event: "Event"
        case .lost: "Lost & Found"
        case .alert: "Alerts"
        case .deal: "Deals"
        case .announce: "Announce"
        case .neighborhoodWin: "Wins"
        case .visitorGuide: "Guide"
        }
    }

    /// Right-aligned per-card chip label (shorter than the chip-row label).
    public var cardChipLabel: String {
        switch self {
        case .all: ""
        case .ask: "Ask"
        case .recommend: "Rec"
        case .event: "Event"
        case .lost: "Lost"
        case .alert: "Alert"
        case .deal: "Deal"
        case .announce: "Announce"
        case .neighborhoodWin: "Win"
        case .visitorGuide: "Guide"
        }
    }

    /// Backend `post_type` filter value sent on `/api/posts/feed`. `all`
    /// returns `nil` so the backend skips the filter.
    public var postType: String? {
        switch self {
        case .all: nil
        case .ask: "ask_local"
        case .recommend: "recommendation"
        case .event: "event"
        case .lost: "lost_found"
        case .alert: "alert"
        case .deal: "deal"
        case .announce: "local_update"
        case .neighborhoodWin: "neighborhood_win"
        case .visitorGuide: "visitor_guide"
        }
    }

    /// Resolve a backend `post_type` string back to a UI intent. Unknown
    /// types fall through to `.announce` — the most generic chip — so
    /// the card still renders a meaningful intent indicator.
    public static func from(postType: String?) -> PulseIntent {
        switch postType ?? "" {
        case "ask_local", "ask": .ask
        case "recommendation", "recommend": .recommend
        case "event": .event
        case "lost_found": .lost
        case "alert", "safety_alert": .alert
        case "deal": .deal
        case "neighborhood_win": .neighborhoodWin
        case "visitor_guide": .visitorGuide
        case "local_update", "announcement", "heads_up": .announce
        default: .announce
        }
    }
}

public extension PulseIntent {
    /// Pantopus icon used inside the per-card intent chip.
    var icon: PantopusIcon {
        switch self {
        case .all: .info
        case .ask: .helpCircle
        case .recommend: .thumbsUp
        case .event: .calendar
        case .lost: .search
        case .alert: .alertTriangle
        case .deal: .tag
        case .announce: .megaphone
        case .neighborhoodWin: .partyPopper
        case .visitorGuide: .compass
        }
    }
}

/// One reaction kind shown in the bottom strip of a post card. The
/// backend only persists `like` (helpful); the other counts are
/// display-only and intent-shaped to match the design.
public struct PulseReaction: Sendable, Hashable, Identifiable {
    public enum Kind: String, Sendable, Hashable {
        case helpful, heart, going, seen, shared
    }

    public let id: Kind
    public let kind: Kind
    public let icon: PantopusIcon
    public let label: String
    public let count: Int
    /// True iff this reaction maps to the `like` toggle endpoint.
    public let isInteractive: Bool

    public init(kind: Kind, icon: PantopusIcon, label: String, count: Int, isInteractive: Bool) {
        id = kind
        self.kind = kind
        self.icon = icon
        self.label = label
        self.count = count
        self.isInteractive = isInteractive
    }
}

public extension PulseIntent {
    /// Returns the reaction strip the design specifies for this intent.
    /// The first kind is always the one wired to `POST /:id/like`; the
    /// rest are display-only counts.
    func reactionTemplate(helpfulCount: Int, secondaryCount: Int = 0) -> [PulseReaction] {
        switch self {
        case .ask:
            [
                PulseReaction(kind: .helpful, icon: .lightbulb, label: "helpful", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .heart, icon: .heart, label: "", count: secondaryCount, isInteractive: false)
            ]
        case .recommend:
            [
                PulseReaction(kind: .helpful, icon: .heart, label: "", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .heart, icon: .lightbulb, label: "helpful", count: secondaryCount, isInteractive: false)
            ]
        case .event:
            [
                PulseReaction(kind: .going, icon: .calendarCheck, label: "going", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .heart, icon: .heart, label: "", count: secondaryCount, isInteractive: false)
            ]
        case .lost:
            [
                PulseReaction(kind: .seen, icon: .eye, label: "seen", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .shared, icon: .share, label: "shared", count: secondaryCount, isInteractive: false)
            ]
        case .announce, .alert:
            // A03 announce card: eye "seen" + heart.
            [
                PulseReaction(kind: .seen, icon: .eye, label: "seen", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .heart, icon: .heart, label: "", count: secondaryCount, isInteractive: false)
            ]
        case .neighborhoodWin:
            [
                PulseReaction(kind: .helpful, icon: .heart, label: "", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .seen, icon: .eye, label: "seen", count: secondaryCount, isInteractive: false)
            ]
        case .deal, .visitorGuide:
            [
                PulseReaction(kind: .helpful, icon: .lightbulb, label: "helpful", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .shared, icon: .share, label: "shared", count: secondaryCount, isInteractive: false)
            ]
        case .all:
            [
                PulseReaction(kind: .helpful, icon: .lightbulb, label: "helpful", count: helpfulCount, isInteractive: true),
                PulseReaction(kind: .heart, icon: .heart, label: "", count: secondaryCount, isInteractive: false)
            ]
        }
    }
}
