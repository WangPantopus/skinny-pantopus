//
//  PaymentHistoryDTOs.swift
//  Pantopus
//
//  Decodable models for `GET /api/payments/history`
//  (`backend/routes/pays.js:732`). The handler merges two row shapes into one
//  stream and normalises the parts a client needs: `entry_type`
//  (`payment | payout`), `amount_cents`, `direction` (`debit | credit`) and
//  `status`. Everything else is the underlying `Payment` / `Payout` row.
//

import Foundation

/// `GET /api/payments/history` — `transactions` is the canonical key;
/// `payments` is the same array under a legacy alias.
public struct PaymentHistoryResponse: Decodable, Sendable, Hashable {
    public let transactions: [PaymentHistoryEntryDTO]
    public let total: Int?
    public let limit: Int?
    public let offset: Int?

    private enum CodingKeys: String, CodingKey {
        case transactions
        case payments
        case total
        case limit
        case offset
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let primary = try? container.decodeIfPresent([PaymentHistoryEntryDTO].self, forKey: .transactions)
        let legacy = try? container.decodeIfPresent([PaymentHistoryEntryDTO].self, forKey: .payments)
        transactions = primary ?? legacy ?? []
        total = try? container.decodeIfPresent(Int.self, forKey: .total)
        limit = try? container.decodeIfPresent(Int.self, forKey: .limit)
        offset = try? container.decodeIfPresent(Int.self, forKey: .offset)
    }

    public init(transactions: [PaymentHistoryEntryDTO], total: Int? = nil, limit: Int? = nil, offset: Int? = nil) {
        self.transactions = transactions
        self.total = total
        self.limit = limit
        self.offset = offset
    }
}

/// One merged history row. Payout rows carry `destination_last4`; payment
/// rows carry `payment_type`, the joined `gig` and both parties.
public struct PaymentHistoryEntryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// `payment` | `payout`.
    public let entryType: String
    /// Signed-user-relative amount in cents (payer total for a debit, payee
    /// share for a credit) — computed server-side at `pays.js:815`.
    public let amountCents: Int
    public let currency: String?
    /// `debit` (money out) | `credit` (money in).
    public let direction: String?
    /// `payment_status` for payments, `payout_status` for payouts.
    public let status: String?
    /// `gig_payment | tip | listing_purchase | …` (payments only).
    public let paymentType: String?
    public let description: String?
    public let createdAt: String?
    public let destinationLast4: String?
    public let gig: PaymentHistoryGigDTO?
    public let payer: PaymentHistoryPartyDTO?
    public let payee: PaymentHistoryPartyDTO?
    /// Server-set convenience flag: the caller is the payer on this row.
    public let isSender: Bool?

    private enum CodingKeys: String, CodingKey {
        case id
        case entryType = "entry_type"
        case amountCents = "amount_cents"
        case currency
        case direction
        case status
        case paymentType = "payment_type"
        case description
        case createdAt = "created_at"
        case destinationLast4 = "destination_last4"
        case gig
        case payer
        case payee
        case isSender = "_isSender"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        entryType = (try? container.decodeIfPresent(String.self, forKey: .entryType)) ?? "payment"
        amountCents = (try? container.decodeIfPresent(Int.self, forKey: .amountCents)) ?? 0
        currency = try? container.decodeIfPresent(String.self, forKey: .currency)
        direction = try? container.decodeIfPresent(String.self, forKey: .direction)
        status = try? container.decodeIfPresent(String.self, forKey: .status)
        paymentType = try? container.decodeIfPresent(String.self, forKey: .paymentType)
        description = try? container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try? container.decodeIfPresent(String.self, forKey: .createdAt)
        destinationLast4 = try? container.decodeIfPresent(String.self, forKey: .destinationLast4)
        gig = try? container.decodeIfPresent(PaymentHistoryGigDTO.self, forKey: .gig)
        payer = try? container.decodeIfPresent(PaymentHistoryPartyDTO.self, forKey: .payer)
        payee = try? container.decodeIfPresent(PaymentHistoryPartyDTO.self, forKey: .payee)
        isSender = try? container.decodeIfPresent(Bool.self, forKey: .isSender)
    }

    public init(
        id: String,
        entryType: String = "payment",
        amountCents: Int = 0,
        currency: String? = "usd",
        direction: String? = nil,
        status: String? = nil,
        paymentType: String? = nil,
        description: String? = nil,
        createdAt: String? = nil,
        destinationLast4: String? = nil,
        gig: PaymentHistoryGigDTO? = nil,
        payer: PaymentHistoryPartyDTO? = nil,
        payee: PaymentHistoryPartyDTO? = nil,
        isSender: Bool? = nil
    ) {
        self.id = id
        self.entryType = entryType
        self.amountCents = amountCents
        self.currency = currency
        self.direction = direction
        self.status = status
        self.paymentType = paymentType
        self.description = description
        self.createdAt = createdAt
        self.destinationLast4 = destinationLast4
        self.gig = gig
        self.payer = payer
        self.payee = payee
        self.isSender = isSender
    }
}

/// Joined `gig:gig_id(id, title, category)`.
public struct PaymentHistoryGigDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let title: String?
    public let category: String?

    public init(id: String? = nil, title: String? = nil, category: String? = nil) {
        self.id = id
        self.title = title
        self.category = category
    }
}

/// Joined `payer` / `payee` (`id, username, name, profile_picture_url`).
public struct PaymentHistoryPartyDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let name: String?
    public let username: String?
    public let profilePictureUrl: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case username
        case profilePictureUrl = "profile_picture_url"
    }

    public init(id: String? = nil, name: String? = nil, username: String? = nil, profilePictureUrl: String? = nil) {
        self.id = id
        self.name = name
        self.username = username
        self.profilePictureUrl = profilePictureUrl
    }

    /// `nil` when the join carried no usable label — callers then omit the
    /// counterparty clause rather than printing a placeholder.
    public var displayName: String? {
        let trimmedName = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedName.isEmpty { return trimmedName }
        let handle = (username ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return handle.isEmpty ? nil : "@\(handle)"
    }
}
