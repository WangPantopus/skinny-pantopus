package app.pantopus.android.data.api.models.businesses

import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request / response models for the owner-side money + legal surface of a
 * business — Stripe Connect, invoicing, the private (legal / finance)
 * record, and verification. Routes live in `backend/routes/businesses.js`
 * and `backend/routes/businessVerification.js`; the Retrofit interface is
 * [app.pantopus.android.data.api.services.BusinessFinanceApi].
 *
 * PII rule: the private record carries a legal name plus the LAST FOUR
 * digits of the tax id (the server never stores a full EIN) and a support
 * email. Those values are held in view-model state for the lifetime of the
 * screen only — never logged, never persisted, never in a query string.
 */

// ─── Stripe Connect ───────────────────────────────────────────────────

/**
 * Body for `POST api/businesses/{id}/stripe/connect`. Both fields default
 * server-side (US / company, `backend/routes/businesses.js:4437`).
 */
@JsonClass(generateAdapter = true)
data class BusinessStripeConnectRequest(
    val country: String? = null,
    val businessType: String? = null,
)

/**
 * `GET api/businesses/{id}/stripe/account` — route
 * `backend/routes/businesses.js:4468`. Reuses [ConnectAccountDto]: the row
 * shape is the same `StripeAccount` projection as the personal payout side.
 */
@JsonClass(generateAdapter = true)
data class BusinessStripeAccountResponse(
    val account: ConnectAccountDto? = null,
)

/**
 * `POST api/businesses/{id}/stripe/connect` — route
 * `backend/routes/businesses.js:4447`. No onboarding link here; the caller
 * follows up with the refresh-link route.
 */
@JsonClass(generateAdapter = true)
data class BusinessStripeConnectResponse(
    val message: String? = null,
    val account: ConnectAccountDto? = null,
    val stripeAccountId: String? = null,
)

/**
 * `POST api/businesses/{id}/stripe/refresh-link` — route
 * `backend/routes/businesses.js:4511`. Single-use, short-lived Account Link.
 */
@JsonClass(generateAdapter = true)
data class BusinessStripeAccountLinkResponse(
    val accountLink: String,
    /** Unix seconds. */
    val expiresAt: Long? = null,
)

/**
 * `POST api/businesses/{id}/stripe/dashboard-link` — route
 * `backend/routes/businesses.js:4534`.
 */
@JsonClass(generateAdapter = true)
data class BusinessStripeDashboardLinkResponse(
    val dashboardUrl: String,
)

// ─── Invoicing (biller side) ──────────────────────────────────────────

/** `GET api/businesses/{id}/invoices` — route `backend/routes/businesses.js:4879`. */
@JsonClass(generateAdapter = true)
data class BusinessInvoiceListResponse(
    val invoices: List<BusinessInvoiceDto> = emptyList(),
    val pagination: BusinessInvoicePaginationDto? = null,
)

/** `{ page, page_size, total }`; the server clamps `page_size` to 50. */
@JsonClass(generateAdapter = true)
data class BusinessInvoicePaginationDto(
    val page: Int = 1,
    @Json(name = "page_size") val pageSize: Int = 20,
    val total: Int = 0,
)

/**
 * One line item on the way out. `createInvoiceSchema`,
 * `backend/routes/businesses.js:4549` — description ≤255 chars,
 * `amount_cents` a positive integer, `quantity` ≥1.
 */
@JsonClass(generateAdapter = true)
data class CreateBusinessInvoiceLineItem(
    val description: String,
    @Json(name = "amount_cents") val amountCents: Int,
    val quantity: Int = 1,
)

/**
 * Body for `POST api/businesses/{id}/invoices` — route
 * `backend/routes/businesses.js:4766`. 1–50 line items; the server derives
 * every money field, so the client sends only unit price × quantity.
 */
@JsonClass(generateAdapter = true)
data class CreateBusinessInvoiceRequest(
    @Json(name = "recipient_user_id") val recipientUserId: String,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "line_items") val lineItems: List<CreateBusinessInvoiceLineItem>,
    /** ISO date (`YYYY-MM-DD`), omitted when the owner leaves it blank. */
    @Json(name = "due_date") val dueDate: String? = null,
    val memo: String? = null,
)

/**
 * Body for `PATCH api/businesses/{id}/invoices/{invoiceId}`. `void` is the
 * only status the route accepts (`backend/routes/businesses.js:4934`).
 */
@JsonClass(generateAdapter = true)
data class VoidBusinessInvoiceRequest(
    val status: String = "void",
)

// ─── Private (legal / finance) record ─────────────────────────────────

/**
 * `GET`/`PATCH api/businesses/{id}/private` — routes
 * `backend/routes/businesses.js:3812` / `:3844`.
 */
@JsonClass(generateAdapter = true)
data class BusinessPrivateResponse(
    @Json(name = "private") val privateRecord: BusinessPrivateDto = BusinessPrivateDto(),
)

/**
 * The subset of the `BusinessPrivate` row this client decodes. The route
 * answers `select('*')`, so `banking_info` and `legal_doc_ids` DO travel on
 * the wire — they are simply not decoded here. That is why the GET carries
 * `Cache-Control: no-store` in `BusinessFinanceApi`: the raw body, not this
 * DTO, is what the shared OkHttp disk cache would otherwise store.
 */
@JsonClass(generateAdapter = true)
data class BusinessPrivateDto(
    /** Present only once the row exists — drives Save vs. Update copy. */
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "legal_name") val legalName: String? = null,
    /** LAST FOUR digits only. The backend never stores a full EIN. */
    @Json(name = "tax_id_last4") val taxIdLast4: String? = null,
    @Json(name = "support_email") val supportEmail: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/**
 * Body for `PATCH api/businesses/{id}/private`. Only the fields the owner
 * actually edited are sent — the route treats absent keys as "leave alone".
 */
@JsonClass(generateAdapter = true)
data class UpdateBusinessPrivateRequest(
    @Json(name = "legal_name") val legalName: String? = null,
    @Json(name = "tax_id_last4") val taxIdLast4: String? = null,
    @Json(name = "support_email") val supportEmail: String? = null,
)

// ─── Verification ─────────────────────────────────────────────────────

/**
 * `GET api/businesses/{id}/verify/status` — route
 * `backend/routes/businessVerification.js:303`.
 */
@JsonClass(generateAdapter = true)
data class BusinessVerificationStatusResponse(
    /** `unverified | self_attested | document_verified | government_verified`. */
    @Json(name = "verification_status") val verificationStatus: String = "unverified",
    @Json(name = "verification_tier") val verificationTier: String = "unverified",
    @Json(name = "verified_at") val verifiedAt: String? = null,
    val evidence: List<BusinessVerificationEvidenceDto> = emptyList(),
    @Json(name = "can_self_attest") val canSelfAttest: Boolean = false,
    @Json(name = "can_self_attest_reason") val canSelfAttestReason: String? = null,
    @Json(name = "can_upload_evidence") val canUploadEvidence: Boolean = false,
    /** Present only for `business_type == nonprofit_501c3`. */
    @Json(name = "nonprofit_verification") val nonprofitVerification: BusinessNonprofitVerificationDto? = null,
)

/**
 * One row of the evidence ledger — `businessVerification.js:291` projects
 * `evidence_type` down to `type`.
 */
@JsonClass(generateAdapter = true)
data class BusinessVerificationEvidenceDto(
    val id: String,
    val type: String = "",
    /** `pending | approved | rejected`. */
    val status: String = "pending",
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "reviewed_at") val reviewedAt: String? = null,
)

/** `nonprofit_verification` block — `businessVerification.js:323`. */
@JsonClass(generateAdapter = true)
data class BusinessNonprofitVerificationDto(
    @Json(name = "ein_submitted") val einSubmitted: Boolean = false,
    @Json(name = "ein_approved") val einApproved: Boolean = false,
    @Json(name = "ein_pending") val einPending: Boolean = false,
    @Json(name = "awaiting_verification") val awaitingVerification: Boolean = false,
)

/**
 * Body for `POST api/businesses/{id}/verify/self-attest`. Both fields are
 * required and `address_confirmed` must literally be `true`
 * (`businessVerification.js:52`).
 */
@JsonClass(generateAdapter = true)
data class BusinessSelfAttestRequest(
    @Json(name = "legal_name") val legalName: String,
    @Json(name = "address_confirmed") val addressConfirmed: Boolean = true,
)

/** Response for self-attest (`businessVerification.js:155`). */
@JsonClass(generateAdapter = true)
data class BusinessSelfAttestResponse(
    @Json(name = "verification_status") val verificationStatus: String = "unverified",
    val message: String? = null,
)

/**
 * Body for `POST api/businesses/{id}/verify/upload-evidence`. `file_id` is
 * the UUID of a `File` row created by `POST api/files/upload`.
 */
@JsonClass(generateAdapter = true)
data class BusinessUploadEvidenceRequest(
    @Json(name = "evidence_type") val evidenceType: String,
    @Json(name = "file_id") val fileId: String,
)

/** 201 response for upload-evidence (`businessVerification.js:245`). */
@JsonClass(generateAdapter = true)
data class BusinessUploadEvidenceResponse(
    @Json(name = "evidence_id") val evidenceId: String? = null,
    val status: String? = null,
    val message: String? = null,
)
