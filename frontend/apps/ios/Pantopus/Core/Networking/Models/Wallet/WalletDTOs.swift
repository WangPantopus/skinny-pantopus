//
//  WalletDTOs.swift
//  Pantopus
//
//  DTOs for the read-path wallet endpoints in `backend/routes/wallet.js`.
//  Monetary values are integer cents (the `WalletTransaction.amount` /
//  `Wallet.balance` columns are `bigint`); the view-model formats them into
//  display strings. Field names are preserved verbatim from the route
//  responses via explicit `CodingKeys` (the client does not apply
//  `convertFromSnakeCase`).
//

import Foundation

// MARK: - Balance (GET /api/wallet — backend/routes/wallet.js:55)

/// `GET /api/wallet` envelope.
public struct WalletBalanceResponse: Decodable, Sendable, Hashable {
    public let wallet: Wallet

    public struct Wallet: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        /// Available balance in integer cents.
        public let balance: Int
        public let currency: String
        public let frozen: Bool
        public let lifetimeWithdrawals: Int?
        public let lifetimeReceived: Int?

        private enum CodingKeys: String, CodingKey {
            case id
            case balance
            case currency
            case frozen
            case lifetimeWithdrawals = "lifetime_withdrawals"
            case lifetimeReceived = "lifetime_received"
        }
    }
}

// MARK: - Transactions (GET /api/wallet/transactions — backend/routes/wallet.js:124)

/// `GET /api/wallet/transactions` envelope.
public struct WalletTransactionsResponse: Decodable, Sendable, Hashable {
    public let transactions: [WalletTransactionDTO]
    public let total: Int?
    public let limit: Int?
    public let offset: Int?
}

/// A single `WalletTransaction` row. Only the fields the Recent-activity feed
/// renders are modelled; the decoder ignores the rest (`wallet_id`,
/// `payment_id`, `gig_id`, `metadata`, …).
public struct WalletTransactionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// One of `deposit | withdrawal | gig_income | gig_payment | tip_income |
    /// tip_sent | refund | adjustment | transfer_in | transfer_out |
    /// cancellation_fee`.
    public let type: String
    /// Positive integer cents (the DB enforces `amount > 0`); the sign comes
    /// from `direction`.
    public let amount: Int
    /// `credit | debit` — authoritative, `NOT NULL` with a CHECK constraint on
    /// `WalletTransaction` (backend/database/schema.sql:4526,4541) and returned
    /// by `select('*')` in `walletService.getTransactions`. Optional here only
    /// so an older payload still decodes; callers fall back to the `type`
    /// heuristic when it is absent.
    public let direction: String?
    public let description: String?
    public let currency: String?
    /// One of `completed | pending | failed | reversed`.
    public let status: String
    public let counterpartyId: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case amount
        case direction
        case description
        case currency
        case status
        case counterpartyId = "counterparty_id"
        case createdAt = "created_at"
    }
}

// MARK: - Withdraw (POST /api/wallet/withdraw — backend/routes/wallet.js:84)

/// Body for `POST /api/wallet/withdraw`. `amount` is integer cents (min 100).
/// `idempotencyKey` deduplicates double-taps server-side.
public struct WalletWithdrawRequest: Encodable, Sendable, Hashable {
    public let amount: Int
    public let idempotencyKey: String?

    public init(amount: Int, idempotencyKey: String? = nil) {
        self.amount = amount
        self.idempotencyKey = idempotencyKey
    }
}

/// `POST /api/wallet/withdraw` envelope. The new outbound `WalletTransaction`
/// row is returned so the client can optimistically reflect it; we still
/// refresh from the backend (source of truth).
public struct WalletWithdrawResponse: Decodable, Sendable, Hashable {
    public let success: Bool
    public let transaction: WalletTransactionDTO?
    public let message: String?
}

// MARK: - Pending release (GET /api/wallet/pending-release — backend/routes/wallet.js:160)

/// `GET /api/wallet/pending-release` — escrow breakdown. All values are
/// integer cents / counts.
public struct WalletPendingReleaseResponse: Decodable, Sendable, Hashable {
    public let inReviewCents: Int
    public let releasingSoonCents: Int
    public let totalPendingCents: Int
    public let inReviewCount: Int
    public let releasingSoonCount: Int

    private enum CodingKeys: String, CodingKey {
        case inReviewCents = "in_review_cents"
        case releasingSoonCents = "releasing_soon_cents"
        case totalPendingCents = "total_pending_cents"
        case inReviewCount = "in_review_count"
        case releasingSoonCount = "releasing_soon_count"
    }
}
