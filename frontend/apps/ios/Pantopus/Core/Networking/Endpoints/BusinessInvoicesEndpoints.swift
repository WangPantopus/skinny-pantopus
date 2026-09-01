//
//  BusinessInvoicesEndpoints.swift
//  Pantopus
//
//  Recipient-side business invoices (`backend/routes/businesses.js`, mounted
//  at `/api/businesses`). These are the three literal `/invoices/*` routes the
//  backend declares *before* its `/:businessId/...` catch-all: read the
//  invoice you were billed, start a Stripe PaymentIntent for it, then confirm
//  the charge landed. The server owns the amount, the fee split and the
//  status transitions — the client never computes money.
//

import Foundation

public enum BusinessInvoicesEndpoints {
    /// `GET /api/businesses/invoices/{invoiceId}` — route
    /// `backend/routes/businesses.js:4596`. Returns `{ invoice }` scoped to
    /// the calling recipient (404 for anyone else).
    public static func receivedInvoice(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/invoices/\(id)")
    }

    /// `GET /api/businesses/invoices/received` — route
    /// `backend/routes/businesses.js:4562`. Paged list of invoices billed to
    /// the caller (`sent / viewed / overdue / paid`).
    public static func receivedInvoices(page: Int = 1, pageSize: Int = 20) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/invoices/received",
            query: ["page": String(page), "page_size": String(pageSize)]
        )
    }

    /// `POST /api/businesses/invoices/{invoiceId}/pay` — route
    /// `backend/routes/businesses.js:4632`. Creates the PaymentIntent for the
    /// invoice total and returns its `client_secret`; the invoice itself stays
    /// unpaid until `confirmInvoicePayment` (or the Stripe webhook) lands.
    public static func payInvoice(id: String, body: PayInvoiceRequest = .init()) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/invoices/\(id)/pay", body: body)
    }

    /// `POST /api/businesses/invoices/{invoiceId}/confirm` — route
    /// `backend/routes/businesses.js:4715`. Idempotent: flips the invoice to
    /// `paid` (with `paid_at`) once the PaymentIntent has been confirmed
    /// client-side. Returns the updated `{ invoice }`.
    public static func confirmInvoicePayment(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/invoices/\(id)/confirm")
    }
}
