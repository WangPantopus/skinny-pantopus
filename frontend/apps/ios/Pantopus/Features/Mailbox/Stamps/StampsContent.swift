//
//  StampsContent.swift
//  Pantopus
//
//  A17.11 — render-only models for the Stamps (postage wallet) screen.
//  Mirrors `docs/designs/A17/stamps.jsx`. The screen has three render
//  states: `loading` (shimmer), `loaded` (the populated wallet) and
//  `empty` ("No stamps yet" + a previewed starter book). An `error`
//  case completes the four-state contract.
//
//  PALETTE NOTE: the philatelic series ships per-ink swatches the design
//  pack hands over without tokens (Express / Civic / Spring / Business).
//  Per the `MailDayContent` precedent, the bespoke `Color(red:…)` stops
//  live here and this file is listed in `verify-tokens.sh`'s palette
//  exemption — the `#RRGGBB` CI grep never matches a decimal initialiser.
//  The Local ink reuses the shared `Theme.Color.categoryStamps` token.
//

import SwiftUI

// MARK: - Stamp ink palette

/// The five philatelic inks in the wallet. `local` is the Forever-series
/// teal that the shared `categoryStamps` token already names; the other
/// four are bespoke series swatches lifted verbatim from `stamps.jsx`.
public enum StampInk: String, Sendable, Hashable, CaseIterable, Identifiable {
    case local
    case express
    case civic
    case spring
    case business

    public var id: String {
        rawValue
    }

    /// Engraved paper ink for the `PerforatedStamp`.
    public var color: Color {
        switch self {
        case .local: Theme.Color.categoryStamps
        // CSS be123c rose-700 — Priority / Express.
        case .express: Color(red: 0.745, green: 0.071, blue: 0.235)
        // CSS 4338ca indigo-700 — Certified / Civic.
        case .civic: Color(red: 0.263, green: 0.220, blue: 0.792)
        // CSS 4d7c0f lime-700 — Collectible / Spring Bloom.
        case .spring: Color(red: 0.302, green: 0.486, blue: 0.059)
        // CSS b45309 amber-700 — Biz drawer / Business.
        case .business: Color(red: 0.706, green: 0.325, blue: 0.035)
        }
    }
}

/// Slate ink for postmarked (used) sheet cells — CSS 94a3b8 slate-400 per
/// the design's used-cell fork. Bespoke neutral, palette-scoped.
public enum StampPalette {
    public static let usedInk = Color(red: 0.580, green: 0.639, blue: 0.722)
    /// Deep stop for the issuer avatar gradient — CSS 155e75 cyan-800.
    public static let issuerDeep = Color(red: 0.082, green: 0.369, blue: 0.459)
}

// MARK: - The featured book

/// The active Forever-series book in the hero. `used` of `total` are
/// postmarked; the remainder are live postage.
public struct StampBook: Sendable, Hashable {
    public let series: String
    public let total: Int
    public let used: Int
    public let purchasedLabel: String
    public let validityLabel: String

    public init(series: String, total: Int, used: Int, purchasedLabel: String, validityLabel: String) {
        self.series = series
        self.total = total
        self.used = used
        self.purchasedLabel = purchasedLabel
        self.validityLabel = validityLabel
    }

    /// Live postage left in the book.
    public var remaining: Int {
        max(0, total - used)
    }

    /// Fraction of the book still unused — drives the balance ring.
    public var remainingFraction: Double {
        guard total > 0 else { return 0 }
        return Double(remaining) / Double(total)
    }
}

// MARK: - Wallet rail

/// One owned design in the "Other stamps you own" rail.
public struct WalletStamp: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let tag: String
    public let denom: String
    public let quantity: Int
    public let ink: StampInk

    public init(id: String, name: String, tag: String, denom: String, quantity: Int, ink: StampInk) {
        self.id = id
        self.name = name
        self.tag = tag
        self.denom = denom
        self.quantity = quantity
        self.ink = ink
    }
}

// MARK: - Usage history

/// One send in the "Usage history" ledger — which stamp paid for which
/// piece of mail.
public struct StampUsage: Sendable, Hashable, Identifiable {
    public let id: String
    public let recipient: String
    public let kind: String
    public let dateLabel: String
    public let stampName: String
    public let ink: StampInk

    public init(id: String, recipient: String, kind: String, dateLabel: String, stampName: String, ink: StampInk) {
        self.id = id
        self.recipient = recipient
        self.kind = kind
        self.dateLabel = dateLabel
        self.stampName = stampName
        self.ink = ink
    }
}

// MARK: - Issuer

/// The "From" issuer card — Pantopus Post, the postage authority.
public struct StampIssuer: Sendable, Hashable {
    public let initials: String
    public let name: String
    public let dept: String
    public let kindLabel: String
    public let proofLabel: String

    public init(initials: String, name: String, dept: String, kindLabel: String, proofLabel: String) {
        self.initials = initials
        self.name = name
        self.dept = dept
        self.kindLabel = kindLabel
        self.proofLabel = proofLabel
    }
}

// MARK: - Elf insight

/// One bullet in the Stamps Elf strip. Mapped to the shared `AIElfBullet`
/// at render time; kept as its own `Hashable` type so `StampsContent`
/// stays a value-comparable projection.
public struct StampInsight: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let text: String

    public init(id: String, icon: PantopusIcon, label: String, text: String) {
        self.id = id
        self.icon = icon
        self.label = label
        self.text = text
    }
}

// MARK: - Starter book (empty state)

/// The previewed starter-book offer shown on the empty state.
public struct StampStarterBook: Sendable, Hashable {
    public let title: String
    public let detail: String
    public let priceLabel: String

    public init(title: String, detail: String, priceLabel: String) {
        self.title = title
        self.detail = detail
        self.priceLabel = priceLabel
    }
}

// MARK: - Populated content

/// Everything the populated wallet renders. Built by the view-model from
/// the stamps source and handed to the view as one immutable value.
/// `Equatable` (not `Hashable`) because `MailDetailTrust` is Equatable-only.
public struct StampsContent: Sendable, Equatable {
    public let trust: MailDetailTrust
    public let categoryLabel: String
    public let timeLabel: String
    /// `var` so the "Buy more" refill stub can replace the book in place.
    public var book: StampBook
    public let elfHeadline: String
    public let elfSummary: String
    public let insights: [StampInsight]
    public let wallet: [WalletStamp]
    public let walletSummary: String
    public let usage: [StampUsage]
    public let usageWindow: String
    public let issuer: StampIssuer

    public init(
        trust: MailDetailTrust,
        categoryLabel: String,
        timeLabel: String,
        book: StampBook,
        elfHeadline: String,
        elfSummary: String,
        insights: [StampInsight],
        wallet: [WalletStamp],
        walletSummary: String,
        usage: [StampUsage],
        usageWindow: String,
        issuer: StampIssuer
    ) {
        self.trust = trust
        self.categoryLabel = categoryLabel
        self.timeLabel = timeLabel
        self.book = book
        self.elfHeadline = elfHeadline
        self.elfSummary = elfSummary
        self.insights = insights
        self.wallet = wallet
        self.walletSummary = walletSummary
        self.usage = usage
        self.usageWindow = usageWindow
        self.issuer = issuer
    }
}

// MARK: - Empty content

/// Copy + offer for the "No stamps yet" empty state.
public struct StampsEmptyContent: Sendable, Hashable {
    public let headline: String
    public let body: String
    public let buyLabel: String
    public let starterBook: StampStarterBook
    public let howItWorksTitle: String
    public let howItWorksBody: String

    public init(
        headline: String,
        body: String,
        buyLabel: String,
        starterBook: StampStarterBook,
        howItWorksTitle: String,
        howItWorksBody: String
    ) {
        self.headline = headline
        self.body = body
        self.buyLabel = buyLabel
        self.starterBook = starterBook
        self.howItWorksTitle = howItWorksTitle
        self.howItWorksBody = howItWorksBody
    }
}

// MARK: - Screen state

/// Four-state contract for the Stamps screen.
public enum StampsState: Sendable, Equatable {
    case loading
    case loaded(StampsContent)
    case empty(StampsEmptyContent)
    case error(message: String)
}
