//
//  PaymentsEarningsDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/payments/earnings` (backend/routes/pays.js:1111) and
//  `GET /api/payments/spending` (backend/routes/pays.js:1142).
//
//  Both handlers respond with the summary under a named key *and* spread at
//  the envelope root (`res.json({ earnings, ...earnings })`), and each figure
//  is emitted twice — camelCase and snake_case. We decode the nested key and
//  fall back to the root spread, preferring snake_case, so either shape maps.
//
//  All monetary values are integer cents. The RPC path can hand back a JSON
//  number with a fractional zero (`1234.0`), so the numbers are read
//  tolerantly and rounded — never re-derived beyond that.
//

import Foundation

/// Read one integer-cents figure from either the snake_case or camelCase key,
/// tolerating a JSON float. Shared by both summaries below.
private func decodeCents<K: CodingKey>(
    _ container: KeyedDecodingContainer<K>,
    _ snake: K,
    _ camel: K
) -> Int {
    for key in [snake, camel] {
        if let value = try? container.decodeIfPresent(Int.self, forKey: key) { return value }
        if let value = try? container.decodeIfPresent(Double.self, forKey: key) { return Int(value.rounded()) }
    }
    return 0
}

// MARK: - Earnings

/// `GET /api/payments/earnings` envelope. Named apart from Mailbox's
/// `EarningsSummaryResponse`, which decodes the unrelated Earn dashboard.
public struct PaymentsEarningsResponse: Decodable, Sendable, Hashable {
    public let earnings: EarningsSummary

    private enum CodingKeys: String, CodingKey {
        case earnings
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let nested = try container.decodeIfPresent(EarningsSummary.self, forKey: .earnings) {
            earnings = nested
        } else {
            earnings = try EarningsSummary(from: decoder)
        }
    }

    public init(earnings: EarningsSummary) {
        self.earnings = earnings
    }
}

/// Lifetime earnings for the signed-in user. `totalEarned` **includes funds
/// still in review / escrow** — the wallet balance is the withdrawable slice.
public struct EarningsSummary: Decodable, Sendable, Hashable {
    /// Lifetime earned, integer cents.
    public let totalEarned: Int
    /// Already paid out to the seller, integer cents.
    public let totalPaid: Int
    /// Still held in escrow, integer cents.
    public let totalEscrowed: Int
    /// Released and available, integer cents.
    public let totalAvailable: Int
    public let currency: String?

    private enum CodingKeys: String, CodingKey {
        case totalEarnedSnake = "total_earned"
        case totalEarned
        case totalPaidSnake = "total_paid"
        case totalPaid
        case totalEscrowedSnake = "total_escrowed"
        case totalEscrowed
        case totalAvailableSnake = "total_available"
        case totalAvailable
        case currency
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalEarned = decodeCents(container, .totalEarnedSnake, .totalEarned)
        totalPaid = decodeCents(container, .totalPaidSnake, .totalPaid)
        totalEscrowed = decodeCents(container, .totalEscrowedSnake, .totalEscrowed)
        totalAvailable = decodeCents(container, .totalAvailableSnake, .totalAvailable)
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
    }

    public init(
        totalEarned: Int,
        totalPaid: Int = 0,
        totalEscrowed: Int = 0,
        totalAvailable: Int = 0,
        currency: String? = "USD"
    ) {
        self.totalEarned = totalEarned
        self.totalPaid = totalPaid
        self.totalEscrowed = totalEscrowed
        self.totalAvailable = totalAvailable
        self.currency = currency
    }
}

// MARK: - Spending

/// `GET /api/payments/spending` envelope.
public struct SpendingSummaryResponse: Decodable, Sendable, Hashable {
    public let spending: SpendingSummary

    private enum CodingKeys: String, CodingKey {
        case spending
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let nested = try container.decodeIfPresent(SpendingSummary.self, forKey: .spending) {
            spending = nested
        } else {
            spending = try SpendingSummary(from: decoder)
        }
    }

    public init(spending: SpendingSummary) {
        self.spending = spending
    }
}

/// Lifetime spending for the signed-in user, integer cents.
public struct SpendingSummary: Decodable, Sendable, Hashable {
    public let totalSpent: Int
    public let totalPaid: Int
    public let totalRefunded: Int
    public let currency: String?

    private enum CodingKeys: String, CodingKey {
        case totalSpentSnake = "total_spent"
        case totalSpent
        case totalPaidSnake = "total_paid"
        case totalPaid
        case totalRefundedSnake = "total_refunded"
        case totalRefunded
        case currency
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalSpent = decodeCents(container, .totalSpentSnake, .totalSpent)
        totalPaid = decodeCents(container, .totalPaidSnake, .totalPaid)
        totalRefunded = decodeCents(container, .totalRefundedSnake, .totalRefunded)
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
    }

    public init(
        totalSpent: Int,
        totalPaid: Int = 0,
        totalRefunded: Int = 0,
        currency: String? = "USD"
    ) {
        self.totalSpent = totalSpent
        self.totalPaid = totalPaid
        self.totalRefunded = totalRefunded
        self.currency = currency
    }
}
