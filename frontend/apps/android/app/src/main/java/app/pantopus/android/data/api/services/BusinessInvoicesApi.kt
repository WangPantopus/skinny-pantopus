package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businesses.BusinessInvoiceResponse
import app.pantopus.android.data.api.models.businesses.BusinessInvoicesResponse
import app.pantopus.android.data.api.models.businesses.PayInvoiceRequest
import app.pantopus.android.data.api.models.businesses.PayInvoiceResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Recipient-side business invoices from `backend/routes/businesses.js`
 * (mounted at `/api/businesses`). These are the three literal `invoices/…`
 * routes the backend declares before its `:businessId` catch-all: read the
 * invoice you were billed, start a Stripe PaymentIntent for it, then confirm
 * the charge landed. The server owns the amount, the fee split and every
 * status transition — the client never computes money.
 */
interface BusinessInvoicesApi {
    /**
     * `GET api/businesses/invoices/{invoiceId}` — route
     * `backend/routes/businesses.js:4596`. Scoped to the calling recipient
     * (404 for anyone else).
     */
    @GET("api/businesses/invoices/{invoiceId}")
    suspend fun receivedInvoice(
        @Path("invoiceId") invoiceId: String,
    ): BusinessInvoiceResponse

    /**
     * `GET api/businesses/invoices/received` — route
     * `backend/routes/businesses.js:4562`. Paged list of invoices billed to
     * the caller (`sent / viewed / overdue / paid`).
     */
    @GET("api/businesses/invoices/received")
    suspend fun receivedInvoices(
        @Query("page") page: Int,
        @Query("page_size") pageSize: Int,
    ): BusinessInvoicesResponse

    /**
     * `POST api/businesses/invoices/{invoiceId}/pay` — route
     * `backend/routes/businesses.js:4632`. Creates the PaymentIntent for the
     * invoice total and answers its `client_secret`; the invoice stays unpaid
     * until [confirmInvoicePayment] (or the Stripe webhook) lands.
     */
    @POST("api/businesses/invoices/{invoiceId}/pay")
    suspend fun payInvoice(
        @Path("invoiceId") invoiceId: String,
        @Body request: PayInvoiceRequest,
    ): PayInvoiceResponse

    /**
     * `POST api/businesses/invoices/{invoiceId}/confirm` — route
     * `backend/routes/businesses.js:4715`. Idempotent: flips the invoice to
     * `paid` (with `paid_at`) once the PaymentIntent has been confirmed.
     */
    @POST("api/businesses/invoices/{invoiceId}/confirm")
    suspend fun confirmInvoicePayment(
        @Path("invoiceId") invoiceId: String,
    ): BusinessInvoiceResponse
}
