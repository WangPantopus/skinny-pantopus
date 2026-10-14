//
//  PulseIntent.swift
//  Pantopus
//
//  Ten-way classification for Pulse posts. Drives the chip-row filter,
//  the per-card colored chip, the reaction-verb set, and the compose
//  FAB's pre-fill. The `all` case is a chip-row-only sentinel; real
//  posts resolve to one of the other nine, or to `generic` when their
//  type is one this build doesn't know (Pulse S2: a plain card).
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
    /// A post whose type this build doesn't know (one added later): a plain
    /// card with no type-specific actions. Never a filter chip.
    case generic

    /// The chips of the filter row and the filter picker: every intent but `generic`.
    public static let filterCases: [PulseIntent] = allCases.filter { $0 != .generic }

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
        case .generic: "Post"
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
        case .generic: "Post"
        }
    }

    /// The card chip's word for one post: a found Lost & Found post says
    /// "Found", not "Lost".
    public func chipLabel(lostFoundType: String?) -> String {
        self == .lost && lostFoundType == "found" ? "Found" : cardChipLabel
    }

    /// Backend `post_type` filter value sent on `/api/posts/feed`. `all`
    /// returns `nil` so the backend skips the filter.
    public var postType: String? {
        switch self {
        case .all, .generic: nil
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

    /// Resolve a backend `post_type` string back to a UI intent. The older
    /// types with no chip of their own (`general`, a cold-start fact's
    /// `discussion`, …) and a missing type read as `.announce`, as they
    /// always have; a type this build doesn't know (one added later, such
    /// as `share` or `offer`) is `.generic`, never another type's chip.
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
        case "local_update", "announcement", "heads_up", "",
             "general", "personal_update", "service_offer", "resources_howto", "progress_wins",
             "discussion", "gig":
            .announce
        default: .generic
        }
    }

    /// The type is one this build knows, so its chip and actions apply.
    public static func knows(postType: String?) -> Bool {
        from(postType: postType) != .generic
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
        case .generic: .messageSquare
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
        case .generic:
            // A type this build doesn't know: only the plain like every post has.
            [PulseReaction(kind: .heart, icon: .heart, label: "", count: helpfulCount, isInteractive: true)]
        }
    }
}
