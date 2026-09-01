//
//  StartPollFormContent.swift
//  Pantopus
//
//  Supporting types for `StartPollFormView` / `StartPollFormViewModel` —
//  kind enum, audience model, option row, render state, and bounds. Lives
//  in its own file so the ViewModel can focus on behaviour.
//

import Foundation

/// Client-side poll kinds the form lets the user pick. Each kind maps to
/// a backend `poll_type` via `wirePollType`; the form also reconfigures
/// the options list per-kind (yes-no auto-fills, choice kinds let the
/// user add/remove rows).
public enum StartPollKind: String, CaseIterable, Sendable, Hashable, Identifiable {
    case singleChoice
    case multiChoice
    case ranked
    case yesNo
    case approval

    public var id: String {
        rawValue
    }

    /// User-facing label rendered in the kind picker.
    public var label: String {
        switch self {
        case .singleChoice: "Single choice"
        case .multiChoice: "Multi-choice"
        case .ranked: "Ranked"
        case .yesNo: "Yes / No"
        case .approval: "Approval"
        }
    }

    /// Short helper rendered beneath the picker chip — explains the
    /// voting mechanic in one line.
    public var helper: String {
        switch self {
        case .singleChoice: "Voters pick one option."
        case .multiChoice: "Voters pick any number of options."
        case .ranked: "Voters rank the options in order."
        case .yesNo: "Yes or No — a quick binary read."
        case .approval: "Voters approve every option they're okay with."
        }
    }

    /// Lucide icon for the kind chip. We pick from the in-palette
    /// `PantopusIcon` cases — `.checkSquare` isn't in the set, so multi-
    /// choice borrows `.checkCheck` (the closest "tick-multiple" glyph).
    public var icon: PantopusIcon {
        switch self {
        case .singleChoice: .clipboardList
        case .multiChoice: .checkCheck
        case .ranked: .listChecks
        case .yesNo: .checkCircle
        case .approval: .thumbsUp
        }
    }

    /// Backend `poll_type` enum. Approval collapses to `multiple_choice`
    /// because the backend has no separate approval shape today.
    public var wirePollType: String {
        switch self {
        case .singleChoice: "single_choice"
        case .multiChoice, .approval: "multiple_choice"
        case .ranked: "ranking"
        case .yesNo: "yes_no"
        }
    }

    /// True when the options list is user-editable. Yes/No auto-fills.
    public var allowsCustomOptions: Bool {
        self != .yesNo
    }
}

/// Audience visibility model for a poll. Mirrors the backend `visibility`
/// field — `all_members` sends `nil` (server default), `selected` sends a
/// JSON-encoded `selected:<userId,…>` string that the backend treats as
/// an opaque scope token. The default for now is "all members" until a
/// dedicated audience routing endpoint lands; selected just records the
/// ids client-side.
public enum StartPollAudience: Sendable, Hashable {
    case allMembers
    case selectedMembers(Set<String>)

    public var isSelective: Bool {
        if case .selectedMembers = self { return true }
        return false
    }

    public var selectedIds: Set<String> {
        if case let .selectedMembers(ids) = self { return ids }
        return []
    }
}

/// Single editable option in the form. `id` is a stable UUID assigned at
/// creation so SwiftUI can diff rows across edits without losing focus.
public struct StartPollOption: Identifiable, Equatable, Sendable {
    public let id: String
    public var label: String
    /// True when the row is locked (yes-no auto-fills).
    public var isLocked: Bool

    public init(id: String = UUID().uuidString, label: String = "", isLocked: Bool = false) {
        self.id = id
        self.label = label
        self.isLocked = isLocked
    }
}

/// Render state for the Start-a-Poll form.
public enum StartPollFormState: Sendable, Equatable {
    case editing
    case submitting
    case success(pollId: String)
    case error(String)
}

/// Bounds the choice-kind options list. Yes/No bypasses these via
/// `allowsCustomOptions == false`.
public enum StartPollBounds {
    public static let minOptions = 2
    public static let maxOptions = 10
    public static let questionMin = 5
    public static let questionMax = 200
    /// `closesAt` must be at least this many seconds in the future at
    /// submit time. 1 hour matches the prompt.
    public static let closeMinSecondsAhead: TimeInterval = 60 * 60
}

/// Minimal projection of a household member into the audience picker.
public struct StartPollMember: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}
