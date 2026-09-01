//
//  BusinessInvoiceDTOs.swift
//  Pantopus
//
//  Decodable models for the recipient-side business-invoice routes in
//  `backend/routes/businesses.js` (`/api/businesses/invoices/*`). Columns
//  mirror the `BusinessInvoice` table (`database/schema.sql:5107`):
//  `line_items` jsonb + `subtotal_cents` / `fee_cents` / `total_cents` /
//  `currency` / `status` / `due_date` / `memo` / `paid_at`. Money is only
//  ever *formatted* on the client — never re-derived.
//

import Foundation

/// `GET /api/businesses/invoices/{id}` and
/// `POST /api/businesses/invoices/{id}/confirm` both return `{ invoice }`.
public struct BusinessInvoiceResponse: Decodable, Sendable, Hashable {
    public let invoice: BusinessInvoiceDTO
}

/// `GET /api/businesses/invoices/received` — route
/// `backend/routes/businesses.js:4562`.
public struct BusinessInvoicesResponse: Decodable, Sendable, Hashable {
    public let invoices: [BusinessInvoiceDTO]
}

/// One `BusinessInvoice` row plus the joined billing business.
public struct BusinessInvoiceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let businessUserId: String?
    public let recipientUserId: String?
    public let gigId: String?
    public let lineItems: [BusinessInvoiceLineItemDTO]
    /// Sum of the line items, in cents (server-computed).
    public let subtotalCents: Int
    /// Platform fee, in cents. Deducted from the *business* payout — it is
    /// NOT added to what the recipient owes (`businesses.js:4796`).
    public let feeCents: Int
    /// What the recipient owes, in cents.
    public let totalCents: Int
    /// ISO-4217, lowercase server-side (`'usd'`).
    public let currency: String?
    /// `draft | sent | viewed | paid | void | overdue`.
    public let status: String
    public let dueDate: String?
    public let memo: String?
    public let createdAt: String?
    public let paidAt: String?
    public let business: BusinessInvoicePartyDTO?
    /// Joined only on the biller-side list/detail reads
    /// (`recipient:recipient_user_id(…)`, `businesses.js:4863`). Nil on the
    /// recipient-side routes, which join `business` instead.
    public let recipient: BusinessInvoicePartyDTO?

    private enum CodingKeys: String, CodingKey {
        case id
        case businessUserId = "business_user_id"
        case recipientUserId = "recipient_user_id"
        case gigId = "gig_id"
        case lineItems = "line_items"
        case subtotalCents = "subtotal_cents"
        case feeCents = "fee_cents"
        case totalCents = "total_cents"
        case currency
        case status
        case dueDate = "due_date"
        case memo
        case createdAt = "created_at"
        case paidAt = "paid_at"
        case business
        case recipient
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        businessUserId = try container.decodeIfPresent(String.self, forKey: .businessUserId)
        recipientUserId = try container.decodeIfPresent(String.self, forKey: .recipientUserId)
        gigId = try container.decodeIfPresent(String.self, forKey: .gigId)
        lineItems = (try? container.decodeIfPresent([BusinessInvoiceLineItemDTO].self, forKey: .lineItems)) ?? []
        subtotalCents = (try? container.decodeIfPresent(Int.self, forKey: .subtotalCents)) ?? 0
        feeCents = (try? container.decodeIfPresent(Int.self, forKey: .feeCents)) ?? 0
        totalCents = (try? container.decodeIfPresent(Int.self, forKey: .totalCents)) ?? 0
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
        status = (try? container.decodeIfPresent(String.self, forKey: .status)) ?? "sent"
        dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        memo = try container.decodeIfPresent(String.self, forKey: .memo)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        paidAt = try container.decodeIfPresent(String.self, forKey: .paidAt)
        business = try container.decodeIfPresent(BusinessInvoicePartyDTO.self, forKey: .business)
        recipient = try container.decodeIfPresent(BusinessInvoicePartyDTO.self, forKey: .recipient)
    }

    public init(
        id: String,
        businessUserId: String? = nil,
        recipientUserId: String? = nil,
        gigId: String? = nil,
        lineItems: [BusinessInvoiceLineItemDTO] = [],
        subtotalCents: Int = 0,
        feeCents: Int = 0,
        totalCents: Int = 0,
        currency: String? = "usd",
        status: String = "sent",
        dueDate: String? = nil,
        memo: String? = nil,
        createdAt: String? = nil,
        paidAt: String? = nil,
        business: BusinessInvoicePartyDTO? = nil,
        recipient: BusinessInvoicePartyDTO? = nil
    ) {
        self.id = id
        self.businessUserId = businessUserId
        self.recipientUserId = recipientUserId
        self.gigId = gigId
        self.lineItems = lineItems
        self.subtotalCents = subtotalCents
        self.feeCents = feeCents
        self.totalCents = totalCents
        self.currency = currency
        self.status = status
        self.dueDate = dueDate
        self.memo = memo
        self.createdAt = createdAt
        self.paidAt = paidAt
        self.business = business
        self.recipient = recipient
    }
}

/// One entry of the invoice's `line_items` jsonb array
/// (`createInvoiceSchema`, `backend/routes/businesses.js:4549`).
public struct BusinessInvoiceLineItemDTO: Decodable, Sendable, Hashable {
    public let description: String
    /// Unit price in cents.
    public let amountCents: Int
    public let quantity: Int

    private enum CodingKeys: String, CodingKey {
        case description
        case amountCents = "amount_cents"
        case quantity
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        description = (try? container.decodeIfPresent(String.self, forKey: .description)) ?? ""
        amountCents = (try? container.decodeIfPresent(Int.self, forKey: .amountCents)) ?? 0
        quantity = (try? container.decodeIfPresent(Int.self, forKey: .quantity)) ?? 1
    }

    public init(description: String, amountCents: Int, quantity: Int = 1) {
        self.description = description
        self.amountCents = amountCents
        self.quantity = quantity
    }
}

/// Joined `business:business_user_id(id, name, username, profile_picture_url)`.
public struct BusinessInvoicePartyDTO: Decodable, Sendable, Hashable {
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

    /// Best display name for the billing business.
    public var displayName: String {
        displayName(fallback: "Business")
    }

    /// Best display name with a caller-chosen fallback — the same join is
    /// reused for the *recipient* on the biller-side reads, where "Business"
    /// would be the wrong word.
    public func displayName(fallback: String) -> String {
        let trimmedName = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedName.isEmpty { return trimmedName }
        let handle = (username ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !handle.isEmpty { return handle }
        return fallback
    }
}

/// Body for `POST /api/businesses/invoices/{id}/pay`. `payment_method_id` is
/// optional — omitted, Stripe's PaymentSheet collects the method.
public struct PayInvoiceRequest: Encodable, Sendable, Hashable {
    public let paymentMethodId: String?

    private enum CodingKeys: String, CodingKey {
        case paymentMethodId = "payment_method_id"
    }

    public init(paymentMethodId: String? = nil) {
        self.paymentMethodId = paymentMethodId
    }
}

/// `POST /api/businesses/invoices/{id}/pay` response
/// (`backend/routes/businesses.js:4697`). Keys are snake_case here — unlike
/// `/api/payments/intent`, which answers camelCase.
public struct PayInvoiceResponse: Decodable, Sendable, Hashable {
    public let clientSecret: String?
    public let paymentIntentId: String?
    public let paymentId: String?
    public let amountCents: Int?
    public let feeCents: Int?

    private enum CodingKeys: String, CodingKey {
        case clientSecret = "client_secret"
        case paymentIntentId = "payment_intent_id"
        case paymentId = "payment_id"
        case amountCents = "amount_cents"
        case feeCents = "fee_cents"
    }

    public init(
        clientSecret: String?,
        paymentIntentId: String? = nil,
        paymentId: String? = nil,
        amountCents: Int? = nil,
        feeCents: Int? = nil
    ) {
        self.clientSecret = clientSecret
        self.paymentIntentId = paymentIntentId
        self.paymentId = paymentId
        self.amountCents = amountCents
        self.feeCents = feeCents
    }

    /// Adapt to the shared PaymentSheet params so `CheckoutCoordinator.present`
    /// can drive the invoice charge with the same plumbing as gigs / listings.
    /// The invoice route returns no customer / ephemeral key — PaymentSheet
    /// still collects a card against the client secret.
    public var sheetParams: PaymentIntentSheetParams {
        PaymentIntentSheetParams(clientSecret: clientSecret, paymentIntentId: paymentIntentId)
    }
}
