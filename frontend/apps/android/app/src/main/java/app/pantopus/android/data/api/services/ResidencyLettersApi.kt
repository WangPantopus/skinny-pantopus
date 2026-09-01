package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.IssueResidencyLetterRequest
import app.pantopus.android.data.api.models.place.ResidencyLetterResponse
import app.pantopus.android.data.api.models.place.ResidencyLetterVerification
import app.pantopus.android.data.api.models.place.ResidencyLettersResponse
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Streaming

/**
 * Residency letters — server-attested proof of residency. Route
 * `backend/routes/residencyLetters.js` (mounted under `/api/homes`)
 * plus the public third-party check on `backend/routes/public.js`.
 */
interface ResidencyLettersApi {
    /**
     * Issue (verified T4 occupants only; 10/day limiter server-side).
     * Route `backend/routes/residencyLetters.js:39`.
     */
    @POST("api/homes/{id}/residency-letters")
    suspend fun issue(
        @Path("id") homeId: String,
        @Body body: IssueResidencyLetterRequest,
    ): ResidencyLetterResponse

    /**
     * The caller's own letters for this home (issuer-scoped; household
     * members never see each other's letters).
     * Route `backend/routes/residencyLetters.js:67`.
     */
    @GET("api/homes/{id}/residency-letters")
    suspend fun list(
        @Path("id") homeId: String,
    ): ResidencyLettersResponse

    /**
     * The exact issued PDF artifact (raw bytes).
     * Route `backend/routes/residencyLetters.js:84`.
     */
    @Streaming
    @GET("api/homes/{id}/residency-letters/{letterId}/pdf")
    suspend fun pdf(
        @Path("id") homeId: String,
        @Path("letterId") letterId: String,
    ): ResponseBody

    /**
     * Kills the letter's public verification.
     * Route `backend/routes/residencyLetters.js:109`.
     */
    @POST("api/homes/{id}/residency-letters/{letterId}/revoke")
    suspend fun revoke(
        @Path("id") homeId: String,
        @Path("letterId") letterId: String,
    ): ResidencyLetterResponse

    /**
     * Anonymous third-party check; unknown codes come back as a
     * uniform `{ valid: false }`. Route `backend/routes/public.js:479`.
     */
    @GET("api/public/residency-letters/{code}")
    suspend fun publicVerify(
        @Path("code") code: String,
    ): ResidencyLetterVerification
}
