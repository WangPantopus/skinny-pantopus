//
//  EarnOfferDTOs.swift
//  Pantopus
//
//  Wire models for the Mailbox **Earn drawer paid-offer wall** —
//  `backend/routes/mailboxV2.js` § EARN ENDPOINTS (lines 793-1000).
//  The offer wall is the money-IN half of A10.11: advertisers fund
//  `EarnOffer` rows, the user opens an envelope (creating a pending
//  `EarnTransaction`), dwells on it for 15s, and the close call banks
//  the reward. Balances are always read back from the server —
//  `GET /earn/balance` recomputes from `EarnTransaction`, so the client
//  never increments a local total.
//
//  Column truth: `backend/database/migrations/046_mailbox_phase1.sql`
//  lines 155-198 (`EarnOffer`, `EarnTransaction`).
//

import Foundation

// MARK: - Offers

/// Envelope for `GET /api/mailbox/v2/earn/offers`.
public struct EarnOffersResponse: Decodable, Sendable, Hashable {
    public let offers: [EarnOfferDTO]

    public init(offers: [EarnOfferDTO]) {
        self.offers = offers
    }
}

/// One `EarnOffer` row, enriched by the handler with the caller's
/// engagement (`opened` + the matching `EarnTransaction`).
public struct EarnOfferDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// Advertiser display name — `EarnOffer.business_name` (NOT NULL).
    public let businessName: String
    /// One or two letters the advertiser supplied for the avatar tile.
    public let businessInit: String?
    /// Advertiser brand hex (`#RRGGBB`). Not rendered — the app paints
    /// offers with the shared warm-amber Earn accent so the surface stays
    /// inside the token system.
    public let businessColor: String?
    public let offerTitle: String
    public let offerSubtitle: String?
    /// Promo code — the list response omits it; only `POST /earn/reveal/:id`
    /// returns it.
    public let offerCode: String?
    /// Payout in dollars (`numeric(10,2)`), e.g. `0.25`.
    public let payoutAmount: Double
    /// ISO-8601 expiry, or nil for an open-ended offer.
    public let expiresAt: String?
    /// `draft | active | paused | expired | completed`.
    public let status: String?
    /// True when the caller already has an `EarnTransaction` for this offer.
    public let opened: Bool
    /// The caller's transaction, when one exists.
    public let transaction: EarnTransactionDTO?

    enum CodingKeys: String, CodingKey {
        case id
        case businessName = "business_name"
        case businessInit = "business_init"
        case businessColor = "business_color"
        case offerTitle = "offer_title"
        case offerSubtitle = "offer_subtitle"
        case offerCode = "offer_code"
        case payoutAmount = "payout_amount"
        case expiresAt = "expires_at"
        case status
        case opened
        case transaction
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        businessName = try container.decodeIfPresent(String.self, forKey: .businessName) ?? ""
        businessInit = try container.decodeIfPresent(String.self, forKey: .businessInit)
        businessColor = try container.decodeIfPresent(String.self, forKey: .businessColor)
        offerTitle = try container.decodeIfPresent(String.self, forKey: .offerTitle) ?? ""
        offerSubtitle = try container.decodeIfPresent(String.self, forKey: .offerSubtitle)
        offerCode = try container.decodeIfPresent(String.self, forKey: .offerCode)
        payoutAmount = EarnMoney.decode(container, forKey: .payoutAmount)
        expiresAt = try container.decodeIfPresent(String.self, forKey: .expiresAt)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        opened = try container.decodeIfPresent(Bool.self, forKey: .opened) ?? false
        transaction = try container.decodeIfPresent(EarnTransactionDTO.self, forKey: .transaction)
    }

    public init(
        id: String,
        businessName: String,
        businessInit: String? = nil,
        businessColor: String? = nil,
        offerTitle: String,
        offerSubtitle: String? = nil,
        offerCode: String? = nil,
        payoutAmount: Double,
        expiresAt: String? = nil,
        status: String? = "active",
        opened: Bool = false,
        transaction: EarnTransactionDTO? = nil
    ) {
        self.id = id
        self.businessName = businessName
        self.businessInit = businessInit
        self.businessColor = businessColor
        self.offerTitle = offerTitle
        self.offerSubtitle = offerSubtitle
        self.offerCode = offerCode
        self.payoutAmount = payoutAmount
        self.expiresAt = expiresAt
        self.status = status
        self.opened = opened
        self.transaction = transaction
    }
}

/// The caller's `EarnTransaction` for an offer — the projection the
/// `/earn/offers` handler selects (`offer_id, status, dwell_ms, amount`).
public struct EarnTransactionDTO: Decodable, Sendable, Hashable {
    /// `pending | verified | available | paid | flagged | rejected`.
    public let status: String?
    /// Milliseconds the user has been recorded as dwelling on the offer.
    public let dwellMs: Int?
    public let amount: Double

    enum CodingKeys: String, CodingKey {
        case status
        case dwellMs = "dwell_ms"
        case amount
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        dwellMs = try container.decodeIfPresent(Int.self, forKey: .dwellMs)
        amount = EarnMoney.decode(container, forKey: .amount)
    }

    public init(status: String?, dwellMs: Int? = nil, amount: Double = 0) {
        self.status = status
        self.dwellMs = dwellMs
        self.amount = amount
    }
}

// MARK: - Balance

/// Envelope for `GET /api/mailbox/v2/earn/balance`.
public struct EarnBalanceResponse: Decodable, Sendable, Hashable {
    public let balance: EarnBalanceDTO

    public init(balance: EarnBalanceDTO) {
        self.balance = balance
    }
}

/// Server-computed payout sums (dollars). The handler sums the caller's
/// `EarnTransaction` rows — `available` covers `available | paid`,
/// `pending` covers `pending | verified`, `total` is their sum.
public struct EarnBalanceDTO: Decodable, Sendable, Hashable {
    public let total: Double
    public let available: Double
    public let pending: Double

    enum CodingKeys: String, CodingKey {
        case total, available, pending
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        total = EarnMoney.decode(container, forKey: .total)
        available = EarnMoney.decode(container, forKey: .available)
        pending = EarnMoney.decode(container, forKey: .pending)
    }

    public init(total: Double = 0, available: Double = 0, pending: Double = 0) {
        self.total = total
        self.available = available
        self.pending = pending
    }
}

// MARK: - Open / close / save / reveal

/// Body for `POST /api/mailbox/v2/earn/open` — Joi `openOfferSchema`
/// (`backend/routes/mailboxV2.js:26`) requires a camelCase `offerId` uuid.
public struct EarnOpenOfferRequest: Encodable, Sendable {
    public let offerId: String

    public init(offerId: String) {
        self.offerId = offerId
    }
}

/// `POST /api/mailbox/v2/earn/open` 200 body. A 429 (daily cap) is thrown
/// by `APIClient` as `.clientError(status: 429, …)` and never decoded here.
public struct EarnOpenOfferResponse: Decodable, Sendable, Hashable {
    public let message: String?
    /// Payout the server recorded on the new pending transaction.
    public let amount: Double?
    /// Transaction status after the open (`pending`).
    public let status: String?
    /// True when a transaction already existed for this offer.
    public let alreadyOpened: Bool?

    enum CodingKeys: String, CodingKey {
        case message, amount, status, alreadyOpened
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        amount = container.contains(.amount) ? EarnMoney.decode(container, forKey: .amount) : nil
        status = try container.decodeIfPresent(String.self, forKey: .status)
        alreadyOpened = try container.decodeIfPresent(Bool.self, forKey: .alreadyOpened)
    }

    public init(message: String?, amount: Double? = nil, status: String? = nil, alreadyOpened: Bool? = nil) {
        self.message = message
        self.amount = amount
        self.status = status
        self.alreadyOpened = alreadyOpened
    }
}

/// Body for `POST /api/mailbox/v2/earn/close/:offerId` — Joi
/// `closeOfferSchema` (`backend/routes/mailboxV2.js:30`) requires a
/// camelCase `dwellMs` integer.
public struct EarnCloseOfferRequest: Encodable, Sendable {
    public let dwellMs: Int

    public init(dwellMs: Int) {
        self.dwellMs = dwellMs
    }
}

/// `POST /api/mailbox/v2/earn/close/:offerId` response. `consumed` is the
/// server's verdict on the 15 000 ms minimum dwell — only a `true` banks
/// the reward (transaction → `verified`).
public struct EarnCloseOfferResponse: Decodable, Sendable, Hashable {
    public let consumed: Bool
    public let dwellMs: Int?
    /// Transaction status after the close (`verified`, or the prior status
    /// when the dwell was too short / the row was flagged).
    public let status: String?

    enum CodingKeys: String, CodingKey {
        case consumed, dwellMs, status
    }

    public init(consumed: Bool, dwellMs: Int? = nil, status: String? = nil) {
        self.consumed = consumed
        self.dwellMs = dwellMs
        self.status = status
    }
}

/// `POST /api/mailbox/v2/earn/save/:offerId` response.
public struct EarnSaveOfferResponse: Decodable, Sendable, Hashable {
    public let message: String?

    public init(message: String?) {
        self.message = message
    }
}

/// `POST /api/mailbox/v2/earn/reveal/:offerId` response — `code` is null
/// when the advertiser never attached a promo code.
public struct EarnRevealOfferResponse: Decodable, Sendable, Hashable {
    public let code: String?

    public init(code: String?) {
        self.code = code
    }
}

// MARK: - Money decoding

/// PostgREST hands `numeric` columns back as either a JSON number or a
/// quoted string depending on the driver path (the backend itself calls
/// `parseFloat` on `EarnTransaction.amount`), so every money field decodes
/// leniently. Mirrors Android's `BillDecimalAdapter`.
enum EarnMoney {
    static func decode<K: CodingKey>(
        _ container: KeyedDecodingContainer<K>,
        forKey key: K
    ) -> Double {
        if let value = try? container.decodeIfPresent(Double.self, forKey: key) {
            return value
        }
        if let raw = try? container.decodeIfPresent(String.self, forKey: key) {
            return Double(raw) ?? 0
        }
        return 0
    }
}
