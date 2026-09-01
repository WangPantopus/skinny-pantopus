//
//  BusinessFinanceEndpoints.swift
//  Pantopus
//
//  Owner-side money + legal surface for a business. Three route families,
//  all mounted at `/api/businesses`:
//
//    · Stripe Connect  — `backend/routes/businesses.js` `/:businessId/stripe/…`
//    · Invoicing       — `backend/routes/businesses.js` `/:businessId/invoices…`
//    · Private record  — `backend/routes/businesses.js` `/:businessId/private`
//    · Verification    — `backend/routes/businessVerification.js`
//                        `/:businessId/verify/…` (mounted `app.js:347`, BEFORE
//                        the businesses router so the `/:businessId` catch-all
//                        never swallows `/verify/*`).
//
//  The recipient side of invoicing (pay / confirm) lives in
//  `BusinessInvoicesEndpoints`; this namespace is strictly the biller's view.
//  Legal / PII values (legal name, tax id) travel in JSON bodies only — never
//  in a query string, never in a log line.
//

import Foundation

/// Owner-scoped `/api/businesses/:businessId/{stripe,invoices,private,verify}` routes.
public enum BusinessFinanceEndpoints {
    // MARK: - Stripe Connect

    /// `GET /api/businesses/:businessId/stripe/account` — route
    /// `backend/routes/businesses.js:4468`. Returns `{ account }` for the
    /// business's connected account; 404 when the business has never
    /// connected one.
    public static func stripeAccount(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/stripe/account")
    }

    /// `POST /api/businesses/:businessId/stripe/connect` — route
    /// `backend/routes/businesses.js:4414`. Owner-only. Creates the Express
    /// connected account linked to the business user. Answers
    /// `{ message, account, stripeAccountId }` — note it does NOT hand back an
    /// onboarding link, so the caller follows up with
    /// [stripeRefreshLink(businessId:)] to get the Stripe-hosted URL.
    public static func connectStripe(
        businessId: String,
        body: BusinessStripeConnectRequest = .init()
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/stripe/connect", body: body)
    }

    /// `POST /api/businesses/:businessId/stripe/refresh-link` — route
    /// `backend/routes/businesses.js:4495`. Owner-only. Mints a fresh
    /// single-use Account Link (`{ accountLink, expiresAt }`) to open in the
    /// in-app browser; used both to start and to resume onboarding.
    public static func stripeRefreshLink(businessId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/stripe/refresh-link")
    }

    /// `POST /api/businesses/:businessId/stripe/dashboard-link` — route
    /// `backend/routes/businesses.js:4522`. Express dashboard login link
    /// (`{ dashboardUrl }`) for an onboarded business.
    public static func stripeDashboardLink(businessId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/stripe/dashboard-link")
    }

    // MARK: - Invoicing (biller side)

    /// `GET /api/businesses/:businessId/invoices` — route
    /// `backend/routes/businesses.js:4847`. Paged, newest-first, optionally
    /// filtered by `status`. `page_size` is clamped to 50 server-side.
    /// Answers `{ invoices, pagination: { page, page_size, total } }`.
    public static func invoices(
        businessId: String,
        page: Int = 1,
        pageSize: Int = 20,
        status: String? = nil
    ) -> Endpoint {
        var query = ["page": String(page), "page_size": String(pageSize)]
        if let status, !status.isEmpty { query["status"] = status }
        return Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/invoices",
            query: query
        )
    }

    /// `POST /api/businesses/:businessId/invoices` — route
    /// `backend/routes/businesses.js:4766`. Requires `profile.edit`. The
    /// server computes `subtotal_cents` / `fee_cents` / `total_cents` from the
    /// line items and sends the invoice (`status: 'sent'`) plus a notification
    /// to the recipient. 201 `{ invoice }`.
    public static func createInvoice(
        businessId: String,
        body: CreateBusinessInvoiceRequest
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/businesses/\(businessId)/invoices", body: body)
    }

    /// `PATCH /api/businesses/:businessId/invoices/:invoiceId` — route
    /// `backend/routes/businesses.js:4923`. The only supported transition is
    /// `{ status: 'void' }`; a paid or already-void invoice answers 400.
    /// Returns the updated `{ invoice }`.
    public static func voidInvoice(businessId: String, invoiceId: String) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/businesses/\(businessId)/invoices/\(invoiceId)",
            body: VoidBusinessInvoiceRequest()
        )
    }

    // MARK: - Private (legal / finance) record

    /// `GET /api/businesses/:businessId/private` — route
    /// `backend/routes/businesses.js:3812`. Requires `sensitive.view` (owner
    /// by default); 403 otherwise. Answers `{ private }`, `{}` when the row
    /// has never been created.
    ///
    /// The body carries the legal name and tax-id last four, and the route
    /// sends no `Cache-Control`, so the shared on-disk HTTP cache would
    /// otherwise keep a copy. `.reloadIgnoringLocalCacheData` opts out of the
    /// protocol cache and makes `APIClient` purge any stored entry after the
    /// response lands.
    public static func privateRecord(businessId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/private",
            headers: ["Cache-Control": "no-store"],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `PATCH /api/businesses/:businessId/private` — route
    /// `backend/routes/businesses.js:3844`. Upserts the row. The server's
    /// allow-list is `legal_name / tax_id_last4 / support_email /
    /// banking_info / legal_doc_ids`; this client only ever writes the first
    /// three. Answers `{ private }`.
    public static func updatePrivateRecord(
        businessId: String,
        body: UpdateBusinessPrivateRequest
    ) -> Endpoint {
        Endpoint(method: .patch, path: "/api/businesses/\(businessId)/private", body: body)
    }

    // MARK: - Verification

    /// `GET /api/businesses/:businessId/verify/status` — route
    /// `backend/routes/businessVerification.js:261`. Status + tier + the
    /// evidence ledger + the `can_self_attest` / `can_upload_evidence` gates,
    /// plus a `nonprofit_verification` block for `nonprofit_501c3` businesses.
    public static func verificationStatus(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/verify/status")
    }

    /// `POST /api/businesses/:businessId/verify/self-attest` — route
    /// `backend/routes/businessVerification.js:36`. Requires `profile.edit`
    /// plus at least one active geocoded location, else 400
    /// `NO_VERIFIED_LOCATION`. Idempotent above `self_attested`. Stores the
    /// legal name on `BusinessPrivate` and lifts the tier to `self_attested`.
    public static func selfAttest(
        businessId: String,
        body: BusinessSelfAttestRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/verify/self-attest",
            body: body
        )
    }

    /// `POST /api/businesses/:businessId/verify/upload-evidence` — route
    /// `backend/routes/businessVerification.js:170`. `file_id` is the UUID of
    /// a `File` row already created by `POST /api/files/upload`. 409
    /// `DUPLICATE_PENDING` / `ALREADY_VERIFIED` when that evidence type is
    /// already in flight or approved. 201 `{ evidence_id, status, message }`.
    public static func uploadVerificationEvidence(
        businessId: String,
        body: BusinessUploadEvidenceRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/verify/upload-evidence",
            body: body
        )
    }
}
