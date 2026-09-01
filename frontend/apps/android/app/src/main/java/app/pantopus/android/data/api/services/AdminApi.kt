package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.admin.AdminClaimCountsResponse
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.AdminClaimReviewRequest
import app.pantopus.android.data.api.models.admin.AdminClaimReviewResponse
import app.pantopus.android.data.api.models.admin.AdminClaimsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * `/api/admin/[*]` — admin Review-claims endpoints from
 * `backend/routes/admin.js`. Server enforces `requireAdmin`
 * (`backend/middleware/verifyToken.js:128`) on every route; non-admin
 * sessions get 403. Used exclusively by the Admin → Review claims
 * surface (P1.1).
 */
interface AdminApi {
    /**
     * `GET /api/admin/claims?bucket=` — list claims for one bucket.
     * Route `backend/routes/admin.js:156`. Pending bucket returns
     * oldest-first; approved / rejected return newest-first.
     */
    @GET("api/admin/claims")
    suspend fun claims(
        @Query("bucket") bucket: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
    ): AdminClaimsResponse

    /**
     * `GET /api/admin/claims/counts` — single call returning the three
     * tab badges. Route `backend/routes/admin.js:230`.
     */
    @GET("api/admin/claims/counts")
    suspend fun claimCounts(): AdminClaimCountsResponse

    /**
     * `GET /api/admin/claims/:claimId` — full claim detail (record +
     * home + claimant + evidence, with presigned file URLs).
     * Route `backend/routes/admin.js:260`.
     */
    @GET("api/admin/claims/{claimId}")
    suspend fun claimDetail(
        @Path("claimId") claimId: String,
    ): AdminClaimDetailResponse

    /**
     * `POST /api/admin/claims/:claimId/review` — reviewer decision.
     * `action` is one of `approve | reject | request_more_info`; the
     * optional `note` is surfaced to the claimant in the resulting
     * notification. Route `backend/routes/admin.js:342`.
     */
    @POST("api/admin/claims/{claimId}/review")
    suspend fun reviewClaim(
        @Path("claimId") claimId: String,
        @Body body: AdminClaimReviewRequest,
    ): AdminClaimReviewResponse
}
