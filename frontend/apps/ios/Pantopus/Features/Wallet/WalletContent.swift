//
//  WalletContent.swift
//  Pantopus
//
//  A10.10 — pure value types backing the Wallet screen. Mirrors the
//  shape of `wallet-frames.jsx` so the populated / hold variants
//  snapshot reproducibly. UI types stay out of the model; the view
//  maps `WalletActivityCategory` → `Theme.Color` and `PantopusIcon`.
//

import Foundation

/// Activity-row category — drives the per-row icon tile colour + glyph.
public enum WalletActivityCategory: String, Equatable, Sendable, CaseIterable {
    case cleaning
    case childCare = "child-care"
    case handyman
    case petCare = "pet-care"
    case bank
    case fee
}

/// Clearing status for a single activity row. The view renders a
/// trailing label ("Cleared" / "On hold" / "Payout" / "Fee") and
/// optionally an amber "Pending" chip beside the description.
public enum ActivityStatus: Equatable, Sendable {
    /// Earned and cleared — counts toward the available balance.
    case available
    /// Earned but still in escrow. `clearsLabel` is the user-facing
    /// "clears Dec 4" copy rendered after the counterparty line.
    case pending(clearsLabel: String)
    /// Already-settled outbound payout or fee.
    case complete
}

/// Direction of money flow for a row.
public enum ActivityDirection: Equatable, Sendable {
    case `in`
    case out
}

/// A single transaction row inside the Recent activity card.
public struct WalletActivityItem: Identifiable, Equatable, Sendable {
    public let id: String
    /// Day group label — "Today" / "Yesterday" / "Nov 28" / …
    public let day: String
    /// Time-of-day or sub-day timestamp ("2:14 pm").
    public let dateLabel: String
    /// Headline description ("Patio cleanup · 3 hr").
    public let description: String
    /// Counterparty ("Marcus P." / "Chase ••••7421" / "Pantopus").
    public let counterparty: String
    public let category: WalletActivityCategory
    public let direction: ActivityDirection
    public let status: ActivityStatus
    /// Pre-formatted amount string without the leading sign or "$".
    /// Example: `"140.00"`. The row renders "+$140.00" / "−$2.40"
    /// based on `direction`.
    public let amount: String
    /// `true` for the service-fee row — switches the trailing label to
    /// "Fee" and uses the neutral fee category tint.
    public let isFee: Bool

    public init(
        id: String,
        day: String,
        dateLabel: String,
        description: String,
        counterparty: String,
        category: WalletActivityCategory,
        direction: ActivityDirection,
        status: ActivityStatus,
        amount: String,
        isFee: Bool = false
    ) {
        self.id = id
        self.day = day
        self.dateLabel = dateLabel
        self.description = description
        self.counterparty = counterparty
        self.category = category
        self.direction = direction
        self.status = status
        self.amount = amount
        self.isFee = isFee
    }
}

/// Payout-method card payload. The view renders a debit-card-shaped
/// `CHASE` tile plus the meta line; `warn == true` flips the card to
/// the amber re-verify state.
public struct WalletPayoutMethod: Equatable, Sendable {
    public let bankLabel: String
    public let last4: String
    /// Body line rendered under the bank label. In the default state
    /// the view prepends the green `zap` flash icon; in the warn state
    /// it prepends the amber `alert-circle` icon.
    public let bodyText: String
    /// `true` swaps the card to amber gradient + `Re-verify` button.
    public let warn: Bool

    public init(bankLabel: String, last4: String, bodyText: String, warn: Bool) {
        self.bankLabel = bankLabel
        self.last4 = last4
        self.bodyText = bodyText
        self.warn = warn
    }
}

/// One Connect capability tile — "CARD PAYMENTS · Enabled" /
/// "PAYOUTS · Disabled". Mirrors RN `PayoutsTab`'s `detailsGrid`, which
/// renders `charges_enabled` and `payouts_enabled` as separate tiles
/// instead of collapsing the account to a single boolean.
public struct WalletPayoutCapability: Identifiable, Equatable, Sendable {
    public var id: String {
        key
    }

    /// Stable key used for the accessibility identifier / Android test tag —
    /// `cardPayments` / `payouts`.
    public let key: String
    /// Tile overline, rendered uppercased — "Card payments" / "Payouts".
    public let label: String
    /// Server-reported flag; the view renders "Enabled" / "Disabled".
    public let enabled: Bool

    public init(key: String, label: String, enabled: Bool) {
        self.key = key
        self.label = label
        self.enabled = enabled
    }
}

/// Connected-payout-account card payload, derived from the real Stripe
/// Connect status (`GET /api/payments/connect/account`). Stripe does not
/// hand the platform a bank name or last-4 for an Express account, so this
/// card describes the *account* (what it can do, and how to manage it in
/// Stripe's own dashboard) rather than inventing bank details.
public struct WalletPayoutAccount: Equatable, Sendable {
    /// `Stripe account connected` / `Account verification in progress`.
    public let headline: String
    /// Supporting line — capability summary or the verification note.
    public let bodyText: String
    /// Dock label for the trailing control — "Open Stripe Dashboard" once
    /// onboarded, "Continue setup" while Stripe is still verifying.
    public let actionLabel: String
    /// `true` → the account exists but isn't onboarded yet: amber treatment,
    /// and the action resumes hosted onboarding instead of the dashboard.
    public let warn: Bool
    /// Per-capability tiles rendered under the row once the account is
    /// connected — "CARD PAYMENTS" (`charges_enabled`) and "PAYOUTS"
    /// (`payouts_enabled`), each Enabled/Disabled. Empty while the account is
    /// still verifying (Stripe has not reported capabilities yet), which keeps
    /// the verifying frame identical to RN's.
    public let capabilities: [WalletPayoutCapability]

    public init(
        headline: String,
        bodyText: String,
        actionLabel: String,
        warn: Bool,
        capabilities: [WalletPayoutCapability] = []
    ) {
        self.headline = headline
        self.bodyText = bodyText
        self.actionLabel = actionLabel
        self.warn = warn
        self.capabilities = capabilities
    }
}

/// Escrow breakdown behind the hero's single "Pending" figure, projected
/// from `GET /api/wallet/pending-release`. RN renders the same two lines
/// (`WalletTab.tsx:161-173`); collapsing them to `total_pending_cents`
/// hides *why* money is held — funds still inside the cooling-off review
/// window read very differently from funds already queued for transfer.
/// Both strings are pre-formatted (`"$140.00"`); the counts come straight
/// from the same payload.
public struct WalletPendingBreakdown: Equatable, Sendable {
    /// `in_review_cents` — still inside the cooling-off window.
    public let inReview: String
    /// `releasing_soon_cents` — past cooling-off, awaiting the transfer job.
    public let releasingSoon: String
    /// `in_review_count`.
    public let inReviewCount: Int
    /// `releasing_soon_count`.
    public let releasingSoonCount: Int

    public init(
        inReview: String,
        releasingSoon: String,
        inReviewCount: Int = 0,
        releasingSoonCount: Int = 0
    ) {
        self.inReview = inReview
        self.releasingSoon = releasingSoon
        self.inReviewCount = inReviewCount
        self.releasingSoonCount = releasingSoonCount
    }
}

/// Tax-docs row payload. `ready` lights up the home-green icon tile +
/// `New` chip + "1099-NEC ready" body. Otherwise the row renders the
/// neutral grey YTD line.
public struct WalletTaxDocs: Equatable, Sendable {
    public let ready: Bool
    public let bodyText: String

    public init(ready: Bool, bodyText: String) {
        self.ready = ready
        self.bodyText = bodyText
    }
}

/// Hold-state payload — populated only in the `.hold` variant. Drives
/// the amber top banner above the BalanceHero and the locked Withdraw
/// CTA footnote at the bottom.
public struct WalletHoldState: Equatable, Sendable {
    public let bannerHeadline: String
    public let bannerBody: String
    /// Compact one-line summary surfaced inside the BalanceHero's
    /// inset amber strip ("Re-verify your bank to release funds.").
    public let heroBannerHeadline: String
    public let heroBannerBody: String
    /// Centred footnote under the locked Withdraw CTA.
    public let withdrawFootnote: String

    public init(
        bannerHeadline: String,
        bannerBody: String,
        heroBannerHeadline: String,
        heroBannerBody: String,
        withdrawFootnote: String
    ) {
        self.bannerHeadline = bannerHeadline
        self.bannerBody = bannerBody
        self.heroBannerHeadline = heroBannerHeadline
        self.heroBannerBody = heroBannerBody
        self.withdrawFootnote = withdrawFootnote
    }
}

/// Top-level Wallet render payload.
public struct WalletContent: Equatable, Sendable {
    /// Pre-formatted available balance — e.g. `"847.50"`.
    public let available: String
    public let pending: String
    public let pendingMeta: String
    /// Split of `pending` into "In review" / "Releasing soon". `nil` when
    /// nothing is in escrow (or the supplementary call failed) — the
    /// section is hidden rather than showing two `$0.00` lines, matching
    /// RN's `total_pending_cents > 0` gate.
    public let pendingBreakdown: WalletPendingBreakdown?
    public let monthValue: String
    public let monthMeta: String
    public let activity: [WalletActivityItem]
    /// `nil` until a real payout method is known — the live read path has
    /// no Stripe payout-method feed yet, and the section is hidden rather
    /// than filled with fabricated bank details.
    public let payoutMethod: WalletPayoutMethod?
    /// The seller's Stripe Connect account, when they have one. Drives the
    /// "Payout account" card — and with it the "Open Stripe Dashboard"
    /// action, which is otherwise unreachable. `nil` when no connected
    /// account exists (the bottom bar's "Set up payouts" covers that case).
    public let payoutAccount: WalletPayoutAccount?
    /// `nil` until real tax-document data is known — same rule as
    /// `payoutMethod`; never show invented YTD earnings.
    public let taxDocs: WalletTaxDocs?
    /// Populated only in the `.hold` variant.
    public let holdState: WalletHoldState?
    /// Block 3C — whether the seller's Stripe Connect account has payouts
    /// enabled. `false` gates the Withdraw CTA behind a "Set up payouts" entry.
    /// Defaults `true` so the existing fixtures / snapshots render the Withdraw
    /// CTA unchanged; the live path sets it from `GET /connect/account`.
    public let payoutsEnabled: Bool
    /// Lifetime credited earnings (`Wallet.lifetime_received`), pre-formatted
    /// as `"$4,120.00"`. RN surfaces this as "Total Earned" beside the balance
    /// (`WalletTab.tsx:152`). `nil` when the payload omitted the column — the
    /// section hides rather than claiming `$0.00`.
    public let lifetimeEarned: String?
    /// Lifetime withdrawals (`Wallet.lifetime_withdrawals`), pre-formatted.
    /// RN's "Withdrawn" figure (`WalletTab.tsx:157`).
    public let lifetimeWithdrawn: String?
    /// The server's `Wallet.frozen` flag (`GET /api/wallet`). A frozen wallet
    /// rejects `POST /api/wallet/withdraw` with 403, so the CTA is locked
    /// rather than left tappable — RN's `canWithdraw` includes `!frozen`
    /// (`components/payments/WalletTab.tsx:121`).
    public let frozen: Bool
    /// `false` when the available balance is zero — RN's `balance > 0` leg of
    /// `canWithdraw`, which renders the disabled "No funds to withdraw" CTA.
    public let hasBalance: Bool

    /// `true` when the server sent at least one lifetime total — drives the
    /// "Lifetime" section's visibility.
    public var hasLifetimeTotals: Bool {
        lifetimeEarned != nil || lifetimeWithdrawn != nil
    }

    public var isOnHold: Bool {
        holdState != nil
    }

    /// RN `canWithdraw = hasWallet && !wallet.frozen && balance > 0`, plus the
    /// native payouts-enabled gate (the server also requires a verified
    /// Connect account) and the designed hold frame.
    public var canWithdraw: Bool {
        payoutsEnabled && !frozen && hasBalance && !isOnHold
    }

    public init(
        available: String,
        pending: String,
        pendingMeta: String,
        pendingBreakdown: WalletPendingBreakdown? = nil,
        monthValue: String,
        monthMeta: String,
        activity: [WalletActivityItem],
        payoutMethod: WalletPayoutMethod? = nil,
        payoutAccount: WalletPayoutAccount? = nil,
        taxDocs: WalletTaxDocs? = nil,
        holdState: WalletHoldState? = nil,
        payoutsEnabled: Bool = true,
        lifetimeEarned: String? = nil,
        lifetimeWithdrawn: String? = nil,
        frozen: Bool = false,
        hasBalance: Bool = true
    ) {
        self.available = available
        self.pending = pending
        self.pendingMeta = pendingMeta
        self.pendingBreakdown = pendingBreakdown
        self.monthValue = monthValue
        self.monthMeta = monthMeta
        self.activity = activity
        self.payoutMethod = payoutMethod
        self.payoutAccount = payoutAccount
        self.taxDocs = taxDocs
        self.holdState = holdState
        self.payoutsEnabled = payoutsEnabled
        self.lifetimeEarned = lifetimeEarned
        self.lifetimeWithdrawn = lifetimeWithdrawn
        self.frozen = frozen
        self.hasBalance = hasBalance
    }
}
