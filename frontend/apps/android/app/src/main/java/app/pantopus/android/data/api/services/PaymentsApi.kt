package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto
import app.pantopus.android.data.api.models.payments.CreatePaymentIntentRequest
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.models.payments.PaymentMethodAckResponse
import app.pantopus.android.data.api.models.payments.PaymentMethodsResponse
import app.pantopus.android.data.api.models.payments.PaymentsEarningsResponse
import app.pantopus.android.data.api.models.payments.SpendingSummaryResponse
import app.pantopus.android.data.api.models.payments.TipRefreshStatusResponse
import app.pantopus.android.data.api.models.payments.TipRequest
import app.pantopus.android.data.api.models.payments.TipResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Stripe payment-methods routes from `backend/routes/pays.js` (mounted at
 * `/api/payments`). Phase 3 (3A) wires the Settings → Payments methods
 * card. Connect onboarding, payouts, checkout and tips are 3B/3C/3D.
 */
interface PaymentsApi {
    /** `GET /api/payments/methods` — route `backend/routes/pays.js:701`. */
    @GET("api/payments/methods")
    suspend fun methods(): PaymentMethodsResponse

    /**
     * `POST /api/payments/payment-sheet-add-card` — route
     * `backend/routes/pays.js:1095`. SetupIntent params for the mobile
     * PaymentSheet "add a card" flow.
     */
    @POST("api/payments/payment-sheet-add-card")
    suspend fun addCardSheet(): AddCardSheetParamsDto

    /**
     * `POST /api/payments/intent` — route `backend/routes/pays.js:280`.
     * Block 3B checkout: creates a PaymentIntent for the gig / marketplace
     * order and returns the full PaymentSheet params (clientSecret + customer
     * + ephemeralKey + publishableKey). The charge is reconciled into the
     * `Payment` table by Stripe webhooks; the client refreshes the order from
     * the backend on success — it never marks paid locally.
     */
    @POST("api/payments/intent")
    suspend fun createIntent(
        @Body request: CreatePaymentIntentRequest,
    ): PaymentIntentSheetParamsDto

    /**
     * `POST /api/payments/tip` — route `backend/routes/pays.js:913`. Block 3D:
     * the poster tips the worker; returns the mobile PaymentSheet params +
     * `paymentId` for reconciliation.
     */
    @POST("api/payments/tip")
    suspend fun tip(
        @Body request: TipRequest,
    ): TipResponse

    /**
     * `POST /api/payments/tip/{paymentId}/refresh-status` — route
     * `backend/routes/pays.js:1012`. Best-effort tip status sync after the
     * mobile PaymentSheet succeeds (before the webhook lands).
     */
    @POST("api/payments/tip/{paymentId}/refresh-status")
    suspend fun tipRefreshStatus(
        @Path("paymentId") paymentId: String,
    ): TipRefreshStatusResponse

    /**
     * `GET api/payments/earnings` — route `backend/routes/pays.js:1111`.
     * Lifetime earned / paid / escrowed / available for the signed-in user,
     * in integer cents. Distinct from `GET api/mailbox/earnings/summary`,
     * which counts mailbox offer-engagement points.
     */
    @GET("api/payments/earnings")
    suspend fun earnings(): PaymentsEarningsResponse

    /**
     * `GET api/payments/spending` — route `backend/routes/pays.js:1142`.
     * Lifetime spent / paid / refunded for the signed-in user, integer cents.
     */
    @GET("api/payments/spending")
    suspend fun spending(): SpendingSummaryResponse

    /** `PUT /api/payments/methods/{id}/default` — route `backend/routes/pays.js:754`. */
    @PUT("api/payments/methods/{id}/default")
    suspend fun setDefault(
        @Path("id") id: String,
    ): PaymentMethodAckResponse

    /** `DELETE /api/payments/methods/{id}` — route `backend/routes/pays.js:776`. */
    @DELETE("api/payments/methods/{id}")
    suspend fun removeMethod(
        @Path("id") id: String,
    ): PaymentMethodAckResponse
}
