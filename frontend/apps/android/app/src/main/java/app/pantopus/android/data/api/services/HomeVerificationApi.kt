package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.RequestPostcardResponse
import app.pantopus.android.data.api.models.homes.VerifyPostcardRequest
import app.pantopus.android.data.api.models.homes.VerifyPostcardResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Postcard ownership-verification endpoints from
 * `backend/routes/homeOwnership.js`. Kept separate from [HomesApi] so the
 * Verify-landlord feature owns its own service surface; both share the
 * same Retrofit instance via `di/NetworkModule.kt`.
 */
interface HomeVerificationApi {
    /**
     * `POST /api/homes/:id/request-postcard` — route
     * `backend/routes/homeOwnership.js:2452`. Mails a verification code
     * to the home address; takes no request body.
     */
    @POST("api/homes/{id}/request-postcard")
    suspend fun requestPostcard(
        @Path("id") homeId: String,
    ): RequestPostcardResponse

    /**
     * `POST /api/homes/:id/verify-postcard` — route
     * `backend/routes/homeOwnership.js:2548`. Verifies the mailed code.
     */
    @POST("api/homes/{id}/verify-postcard")
    suspend fun verifyPostcard(
        @Path("id") homeId: String,
        @Body body: VerifyPostcardRequest,
    ): VerifyPostcardResponse
}
