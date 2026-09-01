//
//  EarningsDTOs.swift
//  Pantopus
//
//  DTOs for the gig/ad earnings endpoints in `backend/routes/mailbox.js`.
//  These back the Earn dashboard's balance + recent-earnings list. The
//  weekly-goal target, payout method, auto-cash-out, and 1099 tax docs
//  have no source here (the latter three are Stripe Connect — Phase 3),
//  so the Earn screen hides those slots rather than faking them.
//

import Foundation

/// `GET /api/mailbox/earnings/summary` — route `backend/routes/mailbox.js:2899`.
/// `{ pendingEarnings, totalEarned, currency }`.
public struct EarningsSummaryResponse: Decodable, Sendable, Hashable {
    public let pendingEarnings: Double
    public let totalEarned: Double
    public let currency: String?
}

/// One ad-view payout row from `GET /api/mailbox/earnings/history`
/// (route `backend/routes/mailbox.js:2935`).
public struct EarningEntryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let type: String?
    public let subject: String?
    public let senderBusinessName: String?
    public let payoutAmount: Double?
    public let payoutStatus: String?
    public let viewedAt: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, type, subject
        case senderBusinessName = "sender_business_name"
        case payoutAmount = "payout_amount"
        case payoutStatus = "payout_status"
        case viewedAt = "viewed_at"
        case createdAt = "created_at"
    }
}

/// Envelope for `GET /api/mailbox/earnings/history` — `{ earnings }`.
public struct EarningsHistoryResponse: Decodable, Sendable, Hashable {
    public let earnings: [EarningEntryDTO]
}
