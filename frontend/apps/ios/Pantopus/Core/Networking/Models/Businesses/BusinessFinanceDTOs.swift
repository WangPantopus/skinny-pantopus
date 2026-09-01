//
//  BusinessFinanceDTOs.swift
//  Pantopus
//
//  Request / response models for the owner-side money + legal surface —
//  Stripe Connect, invoicing, the private (legal / finance) record, and
//  verification. Routes live in `backend/routes/businesses.js` and
//  `backend/routes/businessVerification.js`; the builders are in
//  `BusinessFinanceEndpoints`.
//
//  PII rule: the private record carries legal name + the LAST FOUR digits of
//  the tax id (the server never stores a full EIN) + a support email. Those
//  values are decoded into short-lived view-model state and are never logged,
//  never cached to disk, and never placed in a URL.
//

import Foundation

// MARK: - Stripe Connect

/// Body for `POST /api/businesses/:id/stripe/connect`. Both fields default
/// server-side (`US` / `company`, `backend/routes/businesses.js:4437`).
public struct BusinessStripeConnectRequest: Encodable, Sendable, Hashable {
    public let country: String?
    public let businessType: String?

    public init(country: String? = nil, businessType: String? = nil) {
        self.country = country
        self.businessType = businessType
    }
}

/// `GET /api/businesses/:id/stripe/account` — route
/// `backend/routes/businesses.js:4468`. Reuses `ConnectAccountDTO`: the row
/// shape is the same `StripeAccount` projection as the personal payout side.
public struct BusinessStripeAccountResponse: Decodable, Sendable, Hashable {
    public let account: ConnectAccountDTO?

    public init(account: ConnectAccountDTO?) {
        self.account = account
    }
}

/// `POST /api/businesses/:id/stripe/connect` — route
/// `backend/routes/businesses.js:4447`. No onboarding link here; the caller
/// follows up with `stripeRefreshLink`.
public struct BusinessStripeConnectResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let account: ConnectAccountDTO?
    public let stripeAccountId: String?
}

/// `POST /api/businesses/:id/stripe/refresh-link` — route
/// `backend/routes/businesses.js:4511`.
public struct BusinessStripeAccountLinkResponse: Decodable, Sendable, Hashable {
    public let accountLink: String
    /// Unix seconds; the link is single-use and short-lived.
    public let expiresAt: Int?

    public init(accountLink: String, expiresAt: Int? = nil) {
        self.accountLink = accountLink
        self.expiresAt = expiresAt
    }
}

/// `POST /api/businesses/:id/stripe/dashboard-link` — route
/// `backend/routes/businesses.js:4534`.
public struct BusinessStripeDashboardLinkResponse: Decodable, Sendable, Hashable {
    public let dashboardUrl: String

    public init(dashboardUrl: String) {
        self.dashboardUrl = dashboardUrl
    }
}

// MARK: - Invoicing (biller side)

/// `GET /api/businesses/:id/invoices` — route
/// `backend/routes/businesses.js:4879`.
public struct BusinessInvoiceListResponse: Decodable, Sendable, Hashable {
    public let invoices: [BusinessInvoiceDTO]
    public let pagination: BusinessInvoicePaginationDTO?

    public init(invoices: [BusinessInvoiceDTO], pagination: BusinessInvoicePaginationDTO? = nil) {
        self.invoices = invoices
        self.pagination = pagination
    }
}

/// `{ page, page_size, total }` — the server clamps `page_size` to 50.
public struct BusinessInvoicePaginationDTO: Decodable, Sendable, Hashable {
    public let page: Int
    public let pageSize: Int
    public let total: Int

    private enum CodingKeys: String, CodingKey {
        case page
        case pageSize = "page_size"
        case total
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        page = (try? container.decodeIfPresent(Int.self, forKey: .page)) ?? 1
        pageSize = (try? container.decodeIfPresent(Int.self, forKey: .pageSize)) ?? 20
        total = (try? container.decodeIfPresent(Int.self, forKey: .total)) ?? 0
    }

    public init(page: Int, pageSize: Int, total: Int) {
        self.page = page
        self.pageSize = pageSize
        self.total = total
    }
}

/// One line item on the way out. `createInvoiceSchema`,
/// `backend/routes/businesses.js:4549` — description ≤255 chars,
/// `amount_cents` a positive integer, `quantity` ≥1.
public struct CreateBusinessInvoiceLineItem: Encodable, Sendable, Hashable {
    public let description: String
    public let amountCents: Int
    public let quantity: Int

    private enum CodingKeys: String, CodingKey {
        case description
        case amountCents = "amount_cents"
        case quantity
    }

    public init(description: String, amountCents: Int, quantity: Int = 1) {
        self.description = description
        self.amountCents = amountCents
        self.quantity = quantity
    }
}

/// Body for `POST /api/businesses/:id/invoices` — route
/// `backend/routes/businesses.js:4766`. 1–50 line items; the server derives
/// every money field, so the client sends only unit price × quantity.
public struct CreateBusinessInvoiceRequest: Encodable, Sendable, Hashable {
    public let recipientUserId: String
    public let gigId: String?
    public let lineItems: [CreateBusinessInvoiceLineItem]
    /// ISO-8601 date (`YYYY-MM-DD`); omitted when the owner leaves it blank.
    public let dueDate: String?
    public let memo: String?

    private enum CodingKeys: String, CodingKey {
        case recipientUserId = "recipient_user_id"
        case gigId = "gig_id"
        case lineItems = "line_items"
        case dueDate = "due_date"
        case memo
    }

    public init(
        recipientUserId: String,
        gigId: String? = nil,
        lineItems: [CreateBusinessInvoiceLineItem],
        dueDate: String? = nil,
        memo: String? = nil
    ) {
        self.recipientUserId = recipientUserId
        self.gigId = gigId
        self.lineItems = lineItems
        self.dueDate = dueDate
        self.memo = memo
    }
}

/// Body for `PATCH /api/businesses/:id/invoices/:invoiceId`. `void` is the
/// only status the route accepts (`backend/routes/businesses.js:4934`).
public struct VoidBusinessInvoiceRequest: Encodable, Sendable, Hashable {
    public let status: String

    public init() {
        status = "void"
    }
}

// MARK: - Private (legal / finance) record

/// `GET`/`PATCH /api/businesses/:id/private` — routes
/// `backend/routes/businesses.js:3812` / `:3844`. The key is the reserved
/// word `private`, hence the backticked property.
public struct BusinessPrivateResponse: Decodable, Sendable, Hashable {
    public let privateRecord: BusinessPrivateDTO

    private enum CodingKeys: String, CodingKey {
        case privateRecord = "private"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        privateRecord =
            (try? container.decodeIfPresent(BusinessPrivateDTO.self, forKey: .privateRecord))
                ?? BusinessPrivateDTO()
    }

    public init(privateRecord: BusinessPrivateDTO) {
        self.privateRecord = privateRecord
    }
}

/// The `BusinessPrivate` row, minus the columns this client has no business
/// reading: `banking_info` and `legal_doc_ids` stay on the server.
public struct BusinessPrivateDTO: Decodable, Sendable, Hashable {
    /// Present only once the row exists — drives Save vs. Update copy.
    public let businessUserId: String?
    public let legalName: String?
    /// LAST FOUR digits only. The backend never stores a full EIN / tax id.
    public let taxIdLast4: String?
    public let supportEmail: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case businessUserId = "business_user_id"
        case legalName = "legal_name"
        case taxIdLast4 = "tax_id_last4"
        case supportEmail = "support_email"
        case updatedAt = "updated_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        businessUserId = try container.decodeIfPresent(String.self, forKey: .businessUserId)
        legalName = try container.decodeIfPresent(String.self, forKey: .legalName)
        taxIdLast4 = try container.decodeIfPresent(String.self, forKey: .taxIdLast4)
        supportEmail = try container.decodeIfPresent(String.self, forKey: .supportEmail)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    public init(
        businessUserId: String? = nil,
        legalName: String? = nil,
        taxIdLast4: String? = nil,
        supportEmail: String? = nil,
        updatedAt: String? = nil
    ) {
        self.businessUserId = businessUserId
        self.legalName = legalName
        self.taxIdLast4 = taxIdLast4
        self.supportEmail = supportEmail
        self.updatedAt = updatedAt
    }
}

/// Body for `PATCH /api/businesses/:id/private`. Only the fields the owner
/// actually edited are sent — the route treats `undefined` as "leave alone".
public struct UpdateBusinessPrivateRequest: Encodable, Sendable, Hashable {
    public let legalName: String?
    public let taxIdLast4: String?
    public let supportEmail: String?

    private enum CodingKeys: String, CodingKey {
        case legalName = "legal_name"
        case taxIdLast4 = "tax_id_last4"
        case supportEmail = "support_email"
    }

    public init(legalName: String?, taxIdLast4: String?, supportEmail: String?) {
        self.legalName = legalName
        self.taxIdLast4 = taxIdLast4
        self.supportEmail = supportEmail
    }
}

// MARK: - Verification

/// `GET /api/businesses/:id/verify/status` — route
/// `backend/routes/businessVerification.js:303`.
public struct BusinessVerificationStatusResponse: Decodable, Sendable, Hashable {
    /// `unverified | self_attested | document_verified | government_verified`.
    public let verificationStatus: String
    public let verificationTier: String
    public let verifiedAt: String?
    public let evidence: [BusinessVerificationEvidenceDTO]
    public let canSelfAttest: Bool
    /// Why self-attestation is unavailable (e.g. no geocoded location).
    public let canSelfAttestReason: String?
    public let canUploadEvidence: Bool
    /// Present only for `business_type == nonprofit_501c3`.
    public let nonprofitVerification: BusinessNonprofitVerificationDTO?

    private enum CodingKeys: String, CodingKey {
        case verificationStatus = "verification_status"
        case verificationTier = "verification_tier"
        case verifiedAt = "verified_at"
        case evidence
        case canSelfAttest = "can_self_attest"
        case canSelfAttestReason = "can_self_attest_reason"
        case canUploadEvidence = "can_upload_evidence"
        case nonprofitVerification = "nonprofit_verification"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        verificationStatus =
            (try? container.decodeIfPresent(String.self, forKey: .verificationStatus)) ?? "unverified"
        verificationTier =
            (try? container.decodeIfPresent(String.self, forKey: .verificationTier)) ?? "unverified"
        verifiedAt = try container.decodeIfPresent(String.self, forKey: .verifiedAt)
        evidence =
            (try? container.decodeIfPresent([BusinessVerificationEvidenceDTO].self, forKey: .evidence)) ?? []
        canSelfAttest = (try? container.decodeIfPresent(Bool.self, forKey: .canSelfAttest)) ?? false
        canSelfAttestReason = try container.decodeIfPresent(String.self, forKey: .canSelfAttestReason)
        canUploadEvidence = (try? container.decodeIfPresent(Bool.self, forKey: .canUploadEvidence)) ?? false
        nonprofitVerification = try container.decodeIfPresent(
            BusinessNonprofitVerificationDTO.self,
            forKey: .nonprofitVerification
        )
    }

    public init(
        verificationStatus: String = "unverified",
        verificationTier: String = "unverified",
        verifiedAt: String? = nil,
        evidence: [BusinessVerificationEvidenceDTO] = [],
        canSelfAttest: Bool = false,
        canSelfAttestReason: String? = nil,
        canUploadEvidence: Bool = false,
        nonprofitVerification: BusinessNonprofitVerificationDTO? = nil
    ) {
        self.verificationStatus = verificationStatus
        self.verificationTier = verificationTier
        self.verifiedAt = verifiedAt
        self.evidence = evidence
        self.canSelfAttest = canSelfAttest
        self.canSelfAttestReason = canSelfAttestReason
        self.canUploadEvidence = canUploadEvidence
        self.nonprofitVerification = nonprofitVerification
    }
}

/// One row of the evidence ledger (`businessVerification.js:291` projects
/// `evidence_type` down to `type`).
public struct BusinessVerificationEvidenceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// `self_attestation | business_license | ein_letter | utility_bill |
    /// state_registration | ein_verification | tax_exempt_letter`.
    public let type: String
    /// `pending | approved | rejected`.
    public let status: String
    public let createdAt: String?
    public let reviewedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case status
        case createdAt = "created_at"
        case reviewedAt = "reviewed_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = (try? container.decodeIfPresent(String.self, forKey: .type)) ?? ""
        status = (try? container.decodeIfPresent(String.self, forKey: .status)) ?? "pending"
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        reviewedAt = try container.decodeIfPresent(String.self, forKey: .reviewedAt)
    }

    public init(
        id: String,
        type: String,
        status: String = "pending",
        createdAt: String? = nil,
        reviewedAt: String? = nil
    ) {
        self.id = id
        self.type = type
        self.status = status
        self.createdAt = createdAt
        self.reviewedAt = reviewedAt
    }
}

/// `nonprofit_verification` block — `businessVerification.js:323`.
public struct BusinessNonprofitVerificationDTO: Decodable, Sendable, Hashable {
    public let einSubmitted: Bool
    public let einApproved: Bool
    public let einPending: Bool
    public let awaitingVerification: Bool

    private enum CodingKeys: String, CodingKey {
        case einSubmitted = "ein_submitted"
        case einApproved = "ein_approved"
        case einPending = "ein_pending"
        case awaitingVerification = "awaiting_verification"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        einSubmitted = (try? container.decodeIfPresent(Bool.self, forKey: .einSubmitted)) ?? false
        einApproved = (try? container.decodeIfPresent(Bool.self, forKey: .einApproved)) ?? false
        einPending = (try? container.decodeIfPresent(Bool.self, forKey: .einPending)) ?? false
        awaitingVerification =
            (try? container.decodeIfPresent(Bool.self, forKey: .awaitingVerification)) ?? false
    }

    public init(
        einSubmitted: Bool = false,
        einApproved: Bool = false,
        einPending: Bool = false,
        awaitingVerification: Bool = false
    ) {
        self.einSubmitted = einSubmitted
        self.einApproved = einApproved
        self.einPending = einPending
        self.awaitingVerification = awaitingVerification
    }
}

/// Body for `POST /api/businesses/:id/verify/self-attest`. Both fields are
/// required and `address_confirmed` must literally be `true`
/// (`businessVerification.js:52`).
public struct BusinessSelfAttestRequest: Encodable, Sendable, Hashable {
    public let legalName: String
    public let addressConfirmed: Bool

    private enum CodingKeys: String, CodingKey {
        case legalName = "legal_name"
        case addressConfirmed = "address_confirmed"
    }

    public init(legalName: String, addressConfirmed: Bool = true) {
        self.legalName = legalName
        self.addressConfirmed = addressConfirmed
    }
}

/// `POST /api/businesses/:id/verify/self-attest` response
/// (`businessVerification.js:155`).
public struct BusinessSelfAttestResponse: Decodable, Sendable, Hashable {
    public let verificationStatus: String
    public let message: String?

    private enum CodingKeys: String, CodingKey {
        case verificationStatus = "verification_status"
        case message
    }
}

/// Body for `POST /api/businesses/:id/verify/upload-evidence`. `file_id` must
/// be the UUID of a `File` row (`POST /api/files/upload`).
public struct BusinessUploadEvidenceRequest: Encodable, Sendable, Hashable {
    public let evidenceType: String
    public let fileId: String

    private enum CodingKeys: String, CodingKey {
        case evidenceType = "evidence_type"
        case fileId = "file_id"
    }

    public init(evidenceType: String, fileId: String) {
        self.evidenceType = evidenceType
        self.fileId = fileId
    }
}

/// 201 response for `POST /api/businesses/:id/verify/upload-evidence`
/// (`businessVerification.js:245`).
public struct BusinessUploadEvidenceResponse: Decodable, Sendable, Hashable {
    public let evidenceId: String?
    public let status: String?
    public let message: String?

    private enum CodingKeys: String, CodingKey {
        case evidenceId = "evidence_id"
        case status
        case message
    }
}
