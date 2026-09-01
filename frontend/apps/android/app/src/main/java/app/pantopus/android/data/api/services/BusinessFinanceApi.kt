@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.api.services

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
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Owner-side money + legal routes for a single business. Three families,
 * all mounted at `/api/businesses`:
 *
 *  - Stripe Connect — `backend/routes/businesses.js` `stripe/…`
 *  - Invoicing      — `backend/routes/businesses.js` `invoices…`
 *  - Private record — `backend/routes/businesses.js` `private`
 *  - Verification   — `backend/routes/businessVerification.js` `verify/…`
 *    (mounted at `app.js:347`, BEFORE the businesses router, so its
 *    `:businessId` catch-all never swallows the verify paths).
 *
 * The recipient side of invoicing (pay / confirm) lives in
 * [BusinessInvoicesApi]; this interface is strictly the biller's view.
 * Legal / PII values travel in JSON bodies only — never in a query string.
 */
interface BusinessFinanceApi {
    // ─── Stripe Connect ───────────────────────────────────────────────

    /**
     * `GET api/businesses/{businessId}/stripe/account` — route
     * `backend/routes/businesses.js:4468`. 404 when the business has never
     * connected an account.
     */
    @GET("api/businesses/{businessId}/stripe/account")
    suspend fun stripeAccount(
        @Path("businessId") businessId: String,
    ): BusinessStripeAccountResponse

    /**
     * `POST api/businesses/{businessId}/stripe/connect` — route
     * `backend/routes/businesses.js:4414`. Owner-only. Creates the Express
     * connected account; answers no onboarding link, so callers follow up
     * with [stripeRefreshLink].
     */
    @POST("api/businesses/{businessId}/stripe/connect")
    suspend fun connectStripe(
        @Path("businessId") businessId: String,
        @Body request: BusinessStripeConnectRequest,
    ): BusinessStripeConnectResponse

    /**
     * `POST api/businesses/{businessId}/stripe/refresh-link` — route
     * `backend/routes/businesses.js:4495`. Mints a fresh single-use Account
     * Link; used both to start and to resume onboarding.
     */
    @POST("api/businesses/{businessId}/stripe/refresh-link")
    suspend fun stripeRefreshLink(
        @Path("businessId") businessId: String,
    ): BusinessStripeAccountLinkResponse

    /**
     * `POST api/businesses/{businessId}/stripe/dashboard-link` — route
     * `backend/routes/businesses.js:4522`. Express dashboard login link.
     */
    @POST("api/businesses/{businessId}/stripe/dashboard-link")
    suspend fun stripeDashboardLink(
        @Path("businessId") businessId: String,
    ): BusinessStripeDashboardLinkResponse

    // ─── Invoicing (biller side) ──────────────────────────────────────

    /**
     * `GET api/businesses/{businessId}/invoices` — route
     * `backend/routes/businesses.js:4847`. Paged, newest-first, optionally
     * filtered by `status`; `page_size` is clamped to 50 server-side.
     */
    @GET("api/businesses/{businessId}/invoices")
    suspend fun invoices(
        @Path("businessId") businessId: String,
        @Query("page") page: Int,
        @Query("page_size") pageSize: Int,
        @Query("status") status: String? = null,
    ): BusinessInvoiceListResponse

    /**
     * `POST api/businesses/{businessId}/invoices` — route
     * `backend/routes/businesses.js:4766`. Requires `profile.edit`. The
     * server computes subtotal / fee / total and sends the invoice.
     */
    @POST("api/businesses/{businessId}/invoices")
    suspend fun createInvoice(
        @Path("businessId") businessId: String,
        @Body request: CreateBusinessInvoiceRequest,
    ): BusinessInvoiceResponse

    /**
     * `PATCH api/businesses/{businessId}/invoices/{invoiceId}` — route
     * `backend/routes/businesses.js:4923`. Only `status = void` is accepted;
     * a paid or already-void invoice answers 400.
     */
    @PATCH("api/businesses/{businessId}/invoices/{invoiceId}")
    suspend fun voidInvoice(
        @Path("businessId") businessId: String,
        @Path("invoiceId") invoiceId: String,
        @Body request: VoidBusinessInvoiceRequest,
    ): BusinessInvoiceResponse

    // ─── Private (legal / finance) record ─────────────────────────────

    /**
     * `GET api/businesses/{businessId}/private` — route
     * `backend/routes/businesses.js:3812`. Requires `sensitive.view` (owner
     * by default); 403 otherwise.
     *
     * `Cache-Control: no-store` is mandatory here and is NOT cosmetic. The
     * shared OkHttp client installs a 10 MB on-disk HTTP cache
     * (`NetworkModule.provideOkHttpCache`), and OkHttp stores any cacheable
     * GET whose response carries no `Cache-Control` — which this route does
     * not. The handler answers `select('*')` on `BusinessPrivate`, so the
     * body on the wire carries the legal name, the tax-id last four AND the
     * `banking_info` / `legal_doc_ids` columns this client never decodes.
     * Without `no-store` all of that lands in the app cache directory in
     * plaintext and outlives the screen. `request.cacheControl.noStore`
     * makes `CacheStrategy.isCacheable` refuse the write.
     */
    @Headers("Cache-Control: no-store")
    @GET("api/businesses/{businessId}/private")
    suspend fun privateRecord(
        @Path("businessId") businessId: String,
    ): BusinessPrivateResponse

    /**
     * `PATCH api/businesses/{businessId}/private` — route
     * `backend/routes/businesses.js:3844`. Upserts the row. The server's
     * allow-list is legal_name / tax_id_last4 / support_email /
     * banking_info / legal_doc_ids; this client writes only the first three.
     */
    @PATCH("api/businesses/{businessId}/private")
    suspend fun updatePrivateRecord(
        @Path("businessId") businessId: String,
        @Body request: UpdateBusinessPrivateRequest,
    ): BusinessPrivateResponse

    // ─── Verification ─────────────────────────────────────────────────

    /**
     * `GET api/businesses/{businessId}/verify/status` — route
     * `backend/routes/businessVerification.js:261`.
     */
    @GET("api/businesses/{businessId}/verify/status")
    suspend fun verificationStatus(
        @Path("businessId") businessId: String,
    ): BusinessVerificationStatusResponse

    /**
     * `POST api/businesses/{businessId}/verify/self-attest` — route
     * `backend/routes/businessVerification.js:36`. Needs `profile.edit` plus
     * one active geocoded location, else 400 `NO_VERIFIED_LOCATION`.
     * Idempotent above `self_attested`.
     */
    @POST("api/businesses/{businessId}/verify/self-attest")
    suspend fun selfAttest(
        @Path("businessId") businessId: String,
        @Body request: BusinessSelfAttestRequest,
    ): BusinessSelfAttestResponse

    /**
     * `POST api/businesses/{businessId}/verify/upload-evidence` — route
     * `backend/routes/businessVerification.js:170`. `file_id` is the UUID of
     * a `File` row already created by `POST api/files/upload`. 409
     * `DUPLICATE_PENDING` / `ALREADY_VERIFIED` when in flight or approved.
     */
    @POST("api/businesses/{businessId}/verify/upload-evidence")
    suspend fun uploadVerificationEvidence(
        @Path("businessId") businessId: String,
        @Body request: BusinessUploadEvidenceRequest,
    ): BusinessUploadEvidenceResponse
}
