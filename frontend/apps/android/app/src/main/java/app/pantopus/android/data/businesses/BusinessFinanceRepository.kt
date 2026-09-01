package app.pantopus.android.data.businesses

import app.pantopus.android.data.api.models.businesses.BusinessInvoiceListResponse
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceResponse
import app.pantopus.android.data.api.models.businesses.BusinessPrivateResponse
import app.pantopus.android.data.api.models.businesses.BusinessSelfAttestRequest
import app.pantopus.android.data.api.models.businesses.BusinessSelfAttestResponse
import app.pantopus.android.data.api.models.businesses.BusinessStripeAccountLinkResponse
import app.pantopus.android.data.api.models.businesses.BusinessStripeAccountResponse
import app.pantopus.android.data.api.models.businesses.BusinessStripeConnectRequest
import app.pantopus.android.data.api.models.businesses.BusinessStripeConnectResponse
import app.pantopus.android.data.api.models.businesses.BusinessStripeDashboardLinkResponse
import app.pantopus.android.data.api.models.businesses.BusinessUploadEvidenceRequest
import app.pantopus.android.data.api.models.businesses.BusinessUploadEvidenceResponse
import app.pantopus.android.data.api.models.businesses.BusinessVerificationStatusResponse
import app.pantopus.android.data.api.models.businesses.CreateBusinessInvoiceRequest
import app.pantopus.android.data.api.models.businesses.UpdateBusinessPrivateRequest
import app.pantopus.android.data.api.models.businesses.VoidBusinessInvoiceRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessFinanceApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps [BusinessFinanceApi] in the [NetworkResult] taxonomy — the owner
 * side of a business's Stripe Connect payouts, invoicing, private legal
 * record and verification. Open so view-model tests can stub it.
 *
 * Nothing here logs its arguments: the private record and the self-attest
 * body both carry legal PII.
 */
@Singleton
open class BusinessFinanceRepository
    @Inject
    constructor(
        private val api: BusinessFinanceApi,
    ) {
        // ─── Stripe Connect ───────────────────────────────────────────

        /** `GET /{id}/stripe/account` — 404 means "never connected". */
        open suspend fun stripeAccount(businessId: String): NetworkResult<BusinessStripeAccountResponse> =
            safeApiCall { api.stripeAccount(businessId) }

        /** `POST /{id}/stripe/connect` — create/ensure the connected account. */
        open suspend fun connectStripe(businessId: String): NetworkResult<BusinessStripeConnectResponse> =
            safeApiCall { api.connectStripe(businessId, BusinessStripeConnectRequest()) }

        /** `POST /{id}/stripe/refresh-link` — Stripe-hosted Account Link. */
        open suspend fun stripeRefreshLink(businessId: String): NetworkResult<BusinessStripeAccountLinkResponse> =
            safeApiCall { api.stripeRefreshLink(businessId) }

        /** `POST /{id}/stripe/dashboard-link` — Express dashboard login link. */
        open suspend fun stripeDashboardLink(businessId: String): NetworkResult<BusinessStripeDashboardLinkResponse> =
            safeApiCall { api.stripeDashboardLink(businessId) }

        // ─── Invoicing ────────────────────────────────────────────────

        /** `GET /{id}/invoices` — paged, newest-first, optional status filter. */
        open suspend fun invoices(
            businessId: String,
            page: Int,
            pageSize: Int,
            status: String?,
        ): NetworkResult<BusinessInvoiceListResponse> = safeApiCall { api.invoices(businessId, page, pageSize, status) }

        /** `POST /{id}/invoices` — create and send. */
        open suspend fun createInvoice(
            businessId: String,
            request: CreateBusinessInvoiceRequest,
        ): NetworkResult<BusinessInvoiceResponse> = safeApiCall { api.createInvoice(businessId, request) }

        /** `PATCH /{id}/invoices/{invoiceId}` with `status = void`. */
        open suspend fun voidInvoice(
            businessId: String,
            invoiceId: String,
        ): NetworkResult<BusinessInvoiceResponse> = safeApiCall { api.voidInvoice(businessId, invoiceId, VoidBusinessInvoiceRequest()) }

        // ─── Private record ───────────────────────────────────────────

        /** `GET /{id}/private` — 403 for staff without `sensitive.view`. */
        open suspend fun privateRecord(businessId: String): NetworkResult<BusinessPrivateResponse> =
            safeApiCall { api.privateRecord(businessId) }

        /** `PATCH /{id}/private` — upsert legal name / tax-id last 4 / support email. */
        open suspend fun updatePrivateRecord(
            businessId: String,
            request: UpdateBusinessPrivateRequest,
        ): NetworkResult<BusinessPrivateResponse> = safeApiCall { api.updatePrivateRecord(businessId, request) }

        // ─── Verification ─────────────────────────────────────────────

        /** `GET /{id}/verify/status`. */
        open suspend fun verificationStatus(businessId: String): NetworkResult<BusinessVerificationStatusResponse> =
            safeApiCall { api.verificationStatus(businessId) }

        /** `POST /{id}/verify/self-attest`. */
        open suspend fun selfAttest(
            businessId: String,
            legalName: String,
        ): NetworkResult<BusinessSelfAttestResponse> =
            safeApiCall {
                api.selfAttest(businessId, BusinessSelfAttestRequest(legalName = legalName, addressConfirmed = true))
            }

        /** `POST /{id}/verify/upload-evidence` — `fileId` from `api/files/upload`. */
        open suspend fun uploadVerificationEvidence(
            businessId: String,
            evidenceType: String,
            fileId: String,
        ): NetworkResult<BusinessUploadEvidenceResponse> =
            safeApiCall {
                api.uploadVerificationEvidence(
                    businessId,
                    BusinessUploadEvidenceRequest(evidenceType = evidenceType, fileId = fileId),
                )
            }
    }
