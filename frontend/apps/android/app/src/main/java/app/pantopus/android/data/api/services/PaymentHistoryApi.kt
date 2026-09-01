package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.payments.PaymentHistoryResponse
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * The combined payment + payout history feed behind Settings → Payments →
 * Activity (`backend/routes/pays.js`, mounted at `/api/payments`). Kept in
 * its own interface so the shared [PaymentsApi] doesn't grow a merge hot-spot.
 */
interface PaymentHistoryApi {
    /**
     * `GET api/payments/history` — route `backend/routes/pays.js:732`.
     * Merged `Payment` + `Payout` rows for the signed-in user, newest first.
     * `limit` is clamped server-side to 1…100; `offset` must stay under 500
     * (the handler 400s beyond that).
     */
    @GET("api/payments/history")
    suspend fun history(
        @Query("limit") limit: Int,
        @Query("offset") offset: Int,
    ): PaymentHistoryResponse
}
