//
//  MailDayContent.swift
//  Pantopus
//
//  A13.16 — My Mail Day data shapes. The bespoke `MailThumb`
//  illustration lives in `Components/MailThumb.swift`.
//
//  Two states: `.populated` (mid-afternoon triage — pending pieces + a
//  Reviewed-today rail, latest reviewed row carrying a 5-second undo) and
//  `.empty` (no scan yet today — hero illustration + yesterday recap +
//  setup nudges). The view-model projects a `MailDayContent` into one
//  of those state cases.
//

import SwiftUI

// MARK: - State

/// State machine for the mail-day editor. `.populated` carries today's
/// mid-afternoon triage view; `.empty` carries the "nothing new" hero
/// (still backed by `MailDayContent` so the streak / recap / nudges have
/// a place to live).
public enum MailDayState: Sendable {
    case loading
    case populated(MailDayContent)
    case empty(MailDayContent)
    case error(message: String)
}

// MARK: - Content payload

/// Single content payload that both populated and empty states project
/// off. The empty hero ignores `unreviewed` / `reviewed` and renders
/// `yesterdayRecap` + `setupNudges` instead.
public struct MailDayContent: Sendable, Hashable {
    public let dateLabel: String
    public let streakDays: Int
    public let lastScanLabel: String
    public let unreviewed: [UnreviewedMailDayItem]
    public let reviewed: [ReviewedMailDayItem]
    public let yesterdayRecap: YesterdayRecap?
    public let setupNudges: [MailDaySetupNudge]
}

/// A piece of mail that needs a routing decision. The AI suggestion
/// carries a name + avatar swatch + a confidence percent the design
/// renders as `· 94%` next to the suggested name.
public struct UnreviewedMailDayItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: MailDayKind
    public let label: String
    public let sender: String
    public let suggestedName: String
    public let suggestedAvatar: MailDaySuggestedAvatar
    public let confidencePercent: Int
    public let secondaryLabel: String
}

/// A piece of mail that's already been routed / junked / returned. The
/// latest row's `undoCountdown` carries a non-nil seconds-remaining value
/// so the row pulses warm amber while the user can still tap "Undo".
public struct ReviewedMailDayItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: MailDayKind
    public let label: String
    public let action: ReviewedMailAction
    public let routedTo: String?
    public let routedTint: MailDayRoutedTint?
    public let whenLabel: String
    public let undoCountdown: Int?
}

/// What the user did with a piece of mail. `routed` carries a recipient
/// chip; `junked` puts a line-through on the label; `returned` dims the
/// thumb and reads "Returned to sender".
public enum ReviewedMailAction: String, Sendable, Hashable {
    case routed
    case junked
    case returned
}

/// The drawer the row is routed to drives the chip tint. Two semantic
/// stops are enough — `personPrimary` for individuals (Maria / Marcus)
/// and `householdHome` for the House drawer.
public enum MailDayRoutedTint: String, Sendable, Hashable {
    case personPrimary
    case householdHome

    /// Soft fill behind the recipient chip.
    public var background: Color {
        switch self {
        case .personPrimary: Theme.Color.primary100
        case .householdHome: Theme.Color.homeBg
        }
    }
}

/// AI suggestion avatar swatch. The JSX renders these as a sky-blue or
/// home-green linear gradient; we collapse them to the identity-pillar
/// solids since the avatar is a 22pt pill carrying initials and would
/// read identically.
public enum MailDaySuggestedAvatar: String, Sendable, Hashable {
    case personalSky
    case householdGreen

    public var background: Color {
        switch self {
        case .personalSky: Theme.Color.primary700
        case .householdGreen: Theme.Color.home
        }
    }
}

/// Yesterday's recap card — stacked bar segments + count chips below.
public struct YesterdayRecap: Sendable, Hashable {
    public let dateLabel: String
    public let pieces: Int
    public let closedAtLabel: String
    public let segments: [Segment]

    public struct Segment: Sendable, Hashable, Identifiable {
        public let id: String
        public let percent: Double
        public let label: String
        public let tint: SegmentTint
    }

    public enum SegmentTint: String, Sendable, Hashable {
        case personPrimary
        case household
        case junked
        case returned

        public var color: Color {
            switch self {
            case .personPrimary: Theme.Color.primary600
            case .household: Theme.Color.home
            case .junked: Theme.Color.error
            case .returned: Theme.Color.appTextMuted
            }
        }
    }
}

/// A setup nudge card (Daily reminder · Auto-route rules) on the empty
/// hero. Two cards stacked in one container.
public struct MailDaySetupNudge: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let tint: MailDayNudgeTint
    public let title: String
    public let subtitle: String

    public enum MailDayNudgeTint: String, Sendable, Hashable {
        case primary
        case home

        public var foreground: Color {
            switch self {
            case .primary: Theme.Color.primary600
            case .home: Theme.Color.home
            }
        }

        public var background: Color {
            switch self {
            case .primary: Theme.Color.primary50
            case .home: Theme.Color.homeBg
            }
        }
    }
}

// MARK: - Mail kind

/// Faux-photo treatment for a piece of mail. The six cases mirror the
/// `MailThumb` `kind=` switch in `mail-day-frames.jsx`. Distinct from
/// `MailItemCategory` (the 19-case backend taxonomy) because the
/// `MailItemCategory` rowBackground / icon vocabulary is for list-row
/// tiles, not faux-photo paper.
public enum MailDayKind: String, Sendable, Hashable, CaseIterable {
    case envelope
    case magazine
    case postcard
    case bill
    case package
    case flyer
}
