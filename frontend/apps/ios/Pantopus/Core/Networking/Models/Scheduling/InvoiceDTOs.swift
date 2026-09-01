//
//  InvoiceDTOs.swift
//  Pantopus
//
//  DTOs for business scheduling invoices — routes `/api/scheduling/invoices*`
//  (business-only; empty for non-business owners). See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// A business invoice (gig-system reuse).
public struct InvoiceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let businessUserId: String?
    public let recipientUserId: String?
    public let totalCents: Int?
    public let currency: String?
    /// Structured line items (shape varies); kept as flexible JSON.
    public let lineItems: JSONValue?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case businessUserId = "business_user_id"
        case recipientUserId = "recipient_user_id"
        case totalCents = "total_cents"
        case currency
        case lineItems = "line_items"
        case createdAt = "created_at"
    }
}

/// `GET /invoices` → `{ invoices }`.
public struct InvoicesResponse: Decodable, Sendable, Hashable {
    public let invoices: [InvoiceDTO]
}

/// `GET /invoices/:id` → `{ invoice }`.
public struct InvoiceResponse: Decodable, Sendable, Hashable {
    public let invoice: InvoiceDTO
}
