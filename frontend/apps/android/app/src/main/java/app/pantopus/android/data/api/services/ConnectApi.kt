package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.connect.ConnectAccountStatusResponse
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountRequest
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountResponse
import app.pantopus.android.data.api.models.connect.ConnectDashboardResponse
import app.pantopus.android.data.api.models.connect.ConnectOnboardingRequest
import app.pantopus.android.data.api.models.connect.ConnectOnboardingResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Stripe Connect (Express) onboarding + payout-account routes from
 * `backend/routes/pays.js` (mounted at `/api/payments`). Block 3C — seller
 * payout side: create/ensure the connected account, fetch a Stripe-hosted
 * Account Link, read onboarding / payouts-enabled state, open the dashboard.
 */
interface ConnectApi {
    /** `POST /api/payments/connect/account` — route `backend/routes/pays.js:161`. */
    @POST("api/payments/connect/account")
    suspend fun createAccount(
        @Body request: ConnectCreateAccountRequest,
    ): ConnectCreateAccountResponse

    /** `POST /api/payments/connect/onboarding` — route `backend/routes/pays.js:213`. */
    @POST("api/payments/connect/onboarding")
    suspend fun onboarding(
        @Body request: ConnectOnboardingRequest,
    ): ConnectOnboardingResponse

    /** `GET /api/payments/connect/account` — route `backend/routes/pays.js:243`. 404 when none. */
    @GET("api/payments/connect/account")
    suspend fun accountStatus(): ConnectAccountStatusResponse

    /** `POST /api/payments/connect/dashboard` — route `backend/routes/pays.js:265`. */
    @POST("api/payments/connect/dashboard")
    suspend fun dashboard(): ConnectDashboardResponse
}
