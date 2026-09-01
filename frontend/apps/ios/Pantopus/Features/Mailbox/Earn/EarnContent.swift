//
//  EarnContent.swift
//  Pantopus
//
//  A10.11 — pure value types backing the Earn dashboard. The earnings-IN
//  sibling of the A10.10 Wallet: same dark-hero vocabulary, but framed
//  around MAKING money (weekly-goal momentum, ways to earn, earnings
//  list, payout settings, tax docs). Mirrors the shape of
//  `docs/designs/A10/earn-frames.jsx` so the populated / empty variants
//  snapshot reproducibly. UI types stay out of the model — the view maps
//  `EarnCategory` → `Theme.Color` + `PantopusIcon` and `EarnAccent` →
//  a token.
//

import Foundation

/// Earnings-row category — drives the per-row icon tile colour + glyph.
/// A focused subset of the Wallet activity palette (no bank / fee rows —
/// the Earn list is money-in only).
public enum EarnCategory: String, Equatable, Sendable, CaseIterable {
    case cleaning
    case childCare = "child-care"
    case handyman
    case petCare = "pet-care"
}

/// Clearing status for a single earnings row. `paid` renders the green
/// cleared amount; `pending` renders the amber "Pending" chip + amount
/// and the "clears …" sub-line.
public enum EarnStatus: Equatable, Sendable {
    case paid
    case pending(clearsLabel: String)
}

/// A single earnings row inside the Recent-earnings card.
public struct EarnEarning: Identifiable, Equatable, Sendable {
    public let id: String
    /// Day group label — "Today" / "Yesterday" / "Dec 1" / …
    public let day: String
    /// Time-of-day stamp ("2:14 pm").
    public let dateLabel: String
    /// Headline description ("Patio cleanup · 3 hr").
    public let description: String
    /// Counterparty ("Marcus P." / "Reyes household").
    public let counterparty: String
    /// Gig category drives the row's tinted tile. Live ad-payout rows have
    /// no gig category, so this is nil and the row renders a neutral tile.
    public let category: EarnCategory?
    public let status: EarnStatus
    /// Pre-formatted amount string without the leading sign or "$" —
    /// e.g. `"140.00"`. The row renders "+$140.00".
    public let amount: String

    public init(
        id: String,
        day: String,
        dateLabel: String,
        description: String,
        counterparty: String,
        category: EarnCategory? = nil,
        status: EarnStatus,
        amount: String
    ) {
        self.id = id
        self.day = day
        self.dateLabel = dateLabel
        self.description = description
        self.counterparty = counterparty
        self.category = category
        self.status = status
        self.amount = amount
    }
}

/// Accent role for a `Ways to earn` row. The view maps the role onto a
/// design token so colour stays out of the model (per the tokens-only
/// rule): `primary` (Browse), `home` green (Refer), `business` violet
/// (Offer a service).
public enum EarnAccent: String, Equatable, Sendable {
    case primary
    case home
    case business
}

/// Which `Ways to earn` entry was tapped — lets the host route each row
/// to the right destination.
public enum EarnWayKind: String, Equatable, Sendable {
    case browse
    case refer
    case offer
}

/// A single `Ways to earn` row. `featured` lifts the first row onto the
/// `primary50` tinted surface with a filled `primary600` icon tile.
public struct EarnWayToEarn: Identifiable, Equatable, Sendable {
    public var id: String {
        kind.rawValue
    }

    public let kind: EarnWayKind
    public let title: String
    public let meta: String
    public let accent: EarnAccent
    public let featured: Bool

    public init(
        kind: EarnWayKind,
        title: String,
        meta: String,
        accent: EarnAccent,
        featured: Bool = false
    ) {
        self.kind = kind
        self.title = title
        self.meta = meta
        self.accent = accent
        self.featured = featured
    }
}

/// Weekly-goal momentum payload — drives the `WeeklyGoalCard`'s
/// `ProgressRing` plus its headline / subcopy.
public struct EarnWeeklyGoal: Equatable, Sendable {
    /// Completion in `0...1` (clamped by `ProgressRing`).
    public let progress: Double
    /// Ring centre headline ("74%").
    public let ringLabel: String
    /// Ring centre caption ("to goal").
    public let ringSublabel: String
    /// Card headline ("$52 to go").
    public let headline: String
    /// Card subcopy ("$148 of your $200 goal this week").
    public let subcopy: String

    public init(
        progress: Double,
        ringLabel: String,
        ringSublabel: String,
        headline: String,
        subcopy: String
    ) {
        self.progress = progress
        self.ringLabel = ringLabel
        self.ringSublabel = ringSublabel
        self.headline = headline
        self.subcopy = subcopy
    }
}

/// Linked payout-method payload — renders the debit-card-shaped `CHASE`
/// tile + bank label + last4 + the green instant-payout meta line.
public struct EarnPayoutMethod: Equatable, Sendable {
    public let bankLabel: String
    public let last4: String
    public let bodyText: String

    public init(bankLabel: String, last4: String, bodyText: String) {
        self.bankLabel = bankLabel
        self.last4 = last4
        self.bodyText = bodyText
    }
}

/// Auto-cash-out row payload — the recurring-payout toggle row under the
/// linked bank. `isOn` paints the toggle green.
public struct EarnAutoCashOut: Equatable, Sendable {
    public let title: String
    public let detail: String
    public let isOn: Bool

    public init(title: String, detail: String, isOn: Bool) {
        self.title = title
        self.detail = detail
        self.isOn = isOn
    }
}

/// Tax-docs row payload — file-text row with the YTD / 1099 meta line.
public struct EarnTaxDocs: Equatable, Sendable {
    public let bodyText: String

    public init(bodyText: String) {
        self.bodyText = bodyText
    }
}

/// Top-level populated Earn payload. The empty (new-earner) state carries
/// only `[EarnWayToEarn]` — every other slot collapses to a fixed
/// gated / nudge treatment owned by the view.
public struct EarnContent: Equatable, Sendable {
    /// Pre-formatted available-to-cash-out balance — e.g. `"312.40"`.
    public let available: String
    /// This-week earned (hero split cell), e.g. `"$148.00"`.
    public let thisWeek: String
    public let thisWeekMeta: String
    /// Pending / on-hold earnings (hero split cell), e.g. `"$60.00"`.
    public let pending: String
    public let pendingMeta: String
    // The weekly-goal target, linked payout method, auto-cash-out, and
    // 1099 tax docs have no source on `/earnings/*` (the last three are
    // Stripe Connect — Phase 3), so the live path leaves them nil and the
    // view hides them. `EarnSampleData` fills them for previews/snapshots.
    public let weeklyGoal: EarnWeeklyGoal?
    public let waysToEarn: [EarnWayToEarn]
    public let earnings: [EarnEarning]
    public let payoutMethod: EarnPayoutMethod?
    public let autoCashOut: EarnAutoCashOut?
    public let taxDocs: EarnTaxDocs?

    public init(
        available: String,
        thisWeek: String,
        thisWeekMeta: String,
        pending: String,
        pendingMeta: String,
        weeklyGoal: EarnWeeklyGoal? = nil,
        waysToEarn: [EarnWayToEarn],
        earnings: [EarnEarning],
        payoutMethod: EarnPayoutMethod? = nil,
        autoCashOut: EarnAutoCashOut? = nil,
        taxDocs: EarnTaxDocs? = nil
    ) {
        self.available = available
        self.thisWeek = thisWeek
        self.thisWeekMeta = thisWeekMeta
        self.pending = pending
        self.pendingMeta = pendingMeta
        self.weeklyGoal = weeklyGoal
        self.waysToEarn = waysToEarn
        self.earnings = earnings
        self.payoutMethod = payoutMethod
        self.autoCashOut = autoCashOut
        self.taxDocs = taxDocs
    }
}
