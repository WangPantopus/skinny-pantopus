//
//  EarnOffersContent.swift
//  Pantopus
//
//  Projections for the Earn drawer's **paid-offer wall** (the `Offers`
//  tab of A10.11). Presentation-ready value types only — every string is
//  formatted in `EarnOffersViewModel` so the view does no arithmetic and
//  no date maths.
//

import Foundation

/// The dwell contract shared by the view-model and the card. Lives outside
/// the (MainActor-isolated) view-model so nonisolated view code can read it.
public enum EarnOfferDwell {
    /// The server's `MIN_DWELL_MS / 1000` — `backend/routes/mailboxV2.js:955`.
    /// `POST /earn/close/:offerId` only banks the reward at or above this.
    public static let seconds = 15
}

/// Server-computed earn balance, formatted for display. Never mutated
/// locally — the view-model re-reads `GET /earn/balance` after every
/// state-changing call so the hero always shows the server's number.
public struct EarnOffersBalance: Equatable, Sendable, Hashable {
    /// `available + pending`, e.g. `"3.40"` (no leading glyph).
    public let total: String
    /// Cleared payouts (`available | paid` transactions).
    public let available: String
    /// Held payouts (`pending | verified` transactions).
    public let pending: String
    /// Whether the pending line should render at all.
    public let hasPending: Bool

    public init(total: String, available: String, pending: String, hasPending: Bool) {
        self.total = total
        self.available = available
        self.pending = pending
        self.hasPending = hasPending
    }

    /// Zeroed placeholder used before the first balance read resolves.
    public static let zero = EarnOffersBalance(
        total: "0.00",
        available: "0.00",
        pending: "0.00",
        hasPending: false
    )
}

/// One offer envelope on the wall.
public struct EarnOfferItem: Identifiable, Equatable, Sendable, Hashable {
    /// Where this offer sits in the open → dwell → bank cycle.
    public enum Engagement: Equatable, Sendable, Hashable {
        /// Sealed envelope — tapping it calls `POST /earn/open`.
        case unopened
        /// Opened in this session; the 15s dwell window is still running.
        /// `secondsRemaining` counts down to the server's `MIN_DWELL_MS`.
        case dwelling(secondsRemaining: Int)
        /// Opened, but the dwell never completed — the transaction is
        /// still `pending` and the payout has not been banked.
        case pending
        /// The server accepted the dwell (`verified | available | paid`).
        case earned
        /// The transaction is `flagged` — held while fraud review runs.
        case held

        /// Whether the offer body (title, actions) is revealed.
        public var isOpen: Bool {
            self != .unopened
        }
    }

    public let id: String
    public let businessName: String
    /// One-or-two letter avatar tile text.
    public let initials: String
    public let title: String
    public let subtitle: String?
    /// `"Offer expires Mar 4"` or `"Limited time"`.
    public let expiryLabel: String
    /// `"25¢"` under a dollar, `"$1.50"` at or above it.
    public let payoutLabel: String
    public var engagement: Engagement

    public init(
        id: String,
        businessName: String,
        initials: String,
        title: String,
        subtitle: String?,
        expiryLabel: String,
        payoutLabel: String,
        engagement: Engagement
    ) {
        self.id = id
        self.businessName = businessName
        self.initials = initials
        self.title = title
        self.subtitle = subtitle
        self.expiryLabel = expiryLabel
        self.payoutLabel = payoutLabel
        self.engagement = engagement
    }
}

/// First-class daily-cap state. The backend answers `POST /earn/open`
/// with **429** `{ capped: true }` after 10 opens in a calendar day
/// (`backend/routes/mailboxV2.js:869`); RN surfaces exactly this copy.
public struct EarnCapNotice: Equatable, Sendable, Hashable {
    public let headline: String
    public let body: String

    public init(
        headline: String = "Daily cap reached",
        body: String = "You can open up to 10 offers per day."
    ) {
        self.headline = headline
        self.body = body
    }
}

/// Payload for the reveal-code dialog. `code` is nil when the advertiser
/// never attached one — the dialog says so rather than showing a blank.
public struct EarnRevealedCode: Equatable, Sendable, Hashable, Identifiable {
    public let id: String
    public let businessName: String
    public let code: String?

    public init(id: String, businessName: String, code: String?) {
        self.id = id
        self.businessName = businessName
        self.code = code
    }
}
