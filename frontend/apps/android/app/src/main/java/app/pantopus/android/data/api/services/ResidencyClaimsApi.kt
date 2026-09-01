package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.IssueResidencyClaimRequest
import app.pantopus.android.data.api.models.place.ResidencyClaimResponse
import app.pantopus.android.data.api.models.place.ResidencyClaimsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * The Residency Pass — scoped, expiring, revocable residency claims.
 * Route `backend/routes/residencyClaims.js` (mounted under
 * `/api/homes`). Claims are personal per home+user.
 */
interface ResidencyClaimsApi {
    /**
     * Issue (verified T4 occupants only; 30/day limiter server-side).
     * A scope whose fact can't be resolved fails closed with 422.
     * Route `backend/routes/residencyClaims.js:36`.
     */
    @POST("api/homes/{id}/residency-claims")
    suspend fun issue(
        @Path("id") homeId: String,
        @Body body: IssueResidencyClaimRequest,
    ): ResidencyClaimResponse

    /**
     * The caller's own claims for this home, newest first.
     * Route `backend/routes/residencyClaims.js:70`.
     */
    @GET("api/homes/{id}/residency-claims")
    suspend fun list(
        @Path("id") homeId: String,
    ): ResidencyClaimsResponse

    /**
     * Kills the claim's public verification immediately.
     * Route `backend/routes/residencyClaims.js:107`.
     */
    @POST("api/homes/{id}/residency-claims/{claimId}/revoke")
    suspend fun revoke(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
    ): ResidencyClaimResponse
}
