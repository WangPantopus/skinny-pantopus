//
//  VacationHoldContent.swift
//  Pantopus
//
//  A14.8 — render-only models for the Vacation Hold screen. The screen
//  has two modes: `scheduling` (the user is composing a hold) and
//  `active` (a hold is currently in effect). Models below cover both
//  shapes so the view can switch between them without re-fetching.
//

import Foundation

// MARK: - Hold scope

/// One row in the "Hold during this period" toggle card. Locked rows
/// render the toggle disabled with an "always on" eyebrow chip (civic
/// notices must always deliver, per the design's helper copy).
public struct VacationHoldScope: Sendable, Hashable, Identifiable {
    public enum Kind: String, Sendable, Hashable {
        case mail
        case packages
        case marketplacePickups
        case civic
    }

    public let id: String
    public let kind: Kind
    public let label: String
    public let sub: String
    public let isOn: Bool
    public let isLocked: Bool

    public init(
        kind: Kind,
        label: String,
        sub: String,
        isOn: Bool,
        isLocked: Bool = false
    ) {
        id = kind.rawValue
        self.kind = kind
        self.label = label
        self.sub = sub
        self.isOn = isOn
        self.isLocked = isLocked
    }
}

// MARK: - Forwarding + emergency

/// Forwarding address row payload. `nil` collapses the chevron row into
/// "Set a forward-to address" placeholder copy.
public struct VacationForwardingTarget: Sendable, Hashable {
    public let title: String
    public let sub: String

    public init(title: String, sub: String) {
        self.title = title
        self.sub = sub
    }
}

/// Emergency-contact row payload — used in scheduling and read-only on
/// the active variant.
public struct VacationEmergencyContact: Sendable, Hashable {
    public let name: String
    public let initials: String
    public let relation: String
    public let phone: String

    public init(name: String, initials: String, relation: String, phone: String) {
        self.name = name
        self.initials = initials
        self.relation = relation
        self.phone = phone
    }
}

// MARK: - Held item ledger (active mode)

/// A single row in the `HeldList` ledger on the active-hold screen.
public struct VacationHeldItem: Sendable, Hashable, Identifiable {
    public enum Icon: String, Sendable, Hashable {
        case packages
        case mail
        case forwarded
        case civic
    }

    public let id: String
    public let icon: Icon
    public let label: String
    public let sub: String
    public let count: Int

    public init(icon: Icon, label: String, sub: String, count: Int) {
        id = icon.rawValue
        self.icon = icon
        self.label = label
        self.sub = sub
        self.count = count
    }
}

/// 3-cell stat grid inside the `HoldStatusHero` glass strip.
public struct VacationHoldStat: Sendable, Hashable, Identifiable {
    public let id: String
    public let count: Int
    public let label: String

    public init(id: String, count: Int, label: String) {
        self.id = id
        self.count = count
        self.label = label
    }
}

// MARK: - Active hold snapshot

/// Snapshot of an in-flight hold. The view-model exposes this only when
/// `mode == .active` so the view can render the sky-gradient hero, the
/// held-item ledger, and the read-only forwarding + emergency contact.
public struct VacationActiveHold: Sendable, Hashable {
    public let daysLeft: Int
    public let untilLabel: String
    public let resumeBlurb: String
    public let stats: [VacationHoldStat]
    public let heldItems: [VacationHeldItem]
    public let forwarding: VacationForwardingTarget?
    public let emergency: VacationEmergencyContact?
    public let activeSinceLabel: String

    public init(
        daysLeft: Int,
        untilLabel: String,
        resumeBlurb: String,
        stats: [VacationHoldStat],
        heldItems: [VacationHeldItem],
        forwarding: VacationForwardingTarget?,
        emergency: VacationEmergencyContact?,
        activeSinceLabel: String
    ) {
        self.daysLeft = daysLeft
        self.untilLabel = untilLabel
        self.resumeBlurb = resumeBlurb
        self.stats = stats
        self.heldItems = heldItems
        self.forwarding = forwarding
        self.emergency = emergency
        self.activeSinceLabel = activeSinceLabel
    }
}

// MARK: - Scheduling state

/// Mutable scheduling state. The view-model owns one of these whenever
/// `mode == .scheduling` and feeds it back into the form.
public struct VacationScheduleDraft: Sendable, Hashable {
    /// Start of the hold (00:00 of that day).
    public var fromDate: Date
    /// Resume day (00:00 of that day; deliveries pick up that morning).
    public var toDate: Date
    public var scopes: [VacationHoldScope]
    public var forwardingEnabled: Bool
    public var forwarding: VacationForwardingTarget?
    public var emergency: VacationEmergencyContact?
    public let footerBlurb: String

    public init(
        fromDate: Date,
        toDate: Date,
        scopes: [VacationHoldScope],
        forwardingEnabled: Bool,
        forwarding: VacationForwardingTarget?,
        emergency: VacationEmergencyContact?,
        footerBlurb: String
    ) {
        self.fromDate = fromDate
        self.toDate = toDate
        self.scopes = scopes
        self.forwardingEnabled = forwardingEnabled
        self.forwarding = forwarding
        self.emergency = emergency
        self.footerBlurb = footerBlurb
    }

    /// Inclusive span in days between `fromDate` and `toDate`. The design
    /// labels the strip "13 days" for May 28 → Jun 9, so the count is
    /// inclusive of both endpoints.
    public var spanDays: Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        let from = calendar.startOfDay(for: fromDate)
        let to = calendar.startOfDay(for: toDate)
        let components = calendar.dateComponents([.day], from: from, to: to)
        return max(0, (components.day ?? 0) + 1)
    }

    /// The form is valid when there is at least 1 day of hold and at
    /// least one scope toggled on (locked civic notices don't count —
    /// they're delivery, not hold).
    public var isValid: Bool {
        spanDays >= 1 && scopes.contains { $0.isOn && !$0.isLocked }
    }

    /// Blank composer the live screen opens with when
    /// `GET /vacation/status` reports no hold. Only the scope copy is
    /// canned (it's UI labelling, not user data) — the dates default to
    /// today → +7 days the way RN's `vacation.tsx:37-41` does, and the
    /// forwarding address / emergency contact stay empty rather than
    /// showing a fixture as if it were the user's own. Mirrors Android
    /// `VacationScheduleDraft.liveDefault`.
    public static func liveDefault(today: Date = Date()) -> VacationScheduleDraft {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        let from = calendar.startOfDay(for: today)
        let to = calendar.date(byAdding: .day, value: 7, to: from) ?? from
        return VacationScheduleDraft(
            fromDate: from,
            toDate: to,
            scopes: [
                VacationHoldScope(
                    kind: .mail,
                    label: "Mail & flyers",
                    sub: "Postal hold via USPS API",
                    isOn: true
                ),
                VacationHoldScope(
                    kind: .packages,
                    label: "Packages",
                    sub: "Carriers hold at neighborhood hub",
                    isOn: true
                ),
                VacationHoldScope(
                    kind: .marketplacePickups,
                    label: "Marketplace pickups",
                    sub: "Buyers see away status",
                    isOn: true
                ),
                VacationHoldScope(
                    kind: .civic,
                    label: "Civic notices",
                    sub: "Permits, voting, service alerts",
                    isOn: false,
                    isLocked: true
                )
            ],
            forwardingEnabled: false,
            forwarding: nil,
            emergency: nil,
            footerBlurb: "Applies to your primary home address."
        )
    }
}

// MARK: - Top-level mode

/// What the screen is doing. Decided by the view-model on `load()` —
/// re-running `load()` after the user saves a draft swaps `.scheduling`
/// for `.active` without a full screen replacement.
public enum VacationHoldMode: Sendable, Hashable {
    case scheduling(VacationScheduleDraft)
    case active(VacationActiveHold)
}
