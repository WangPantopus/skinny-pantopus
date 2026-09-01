@file:Suppress("PackageNaming")

package app.pantopus.android.data.admin

import app.pantopus.android.data.api.models.admin.AdminClaimBucket
import app.pantopus.android.data.api.models.admin.AdminClaimCountsResponse
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.AdminClaimReviewRequest
import app.pantopus.android.data.api.models.admin.AdminClaimReviewResponse
import app.pantopus.android.data.api.models.admin.AdminClaimsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AdminApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps `/api/admin/[*]` calls in the [NetworkResult] taxonomy. Drives
 * the admin Review-claims surface (P1.1) — see `AdminApi` for the
 * backend route table.
 */
@Singleton
class AdminRepository
    @Inject
    constructor(
        private val api: AdminApi,
    ) {
        /** `GET /api/admin/claims?bucket=` — list one bucket. */
        suspend fun claims(
            bucket: AdminClaimBucket,
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<AdminClaimsResponse> =
            safeApiCall {
                api.claims(bucket = bucket.backendValue, limit = limit, offset = offset)
            }

        /** `GET /api/admin/claims/counts` — three tab badges. */
        suspend fun claimCounts(): NetworkResult<AdminClaimCountsResponse> = safeApiCall { api.claimCounts() }

        /** `GET /api/admin/claims/:claimId` — full claim detail. */
        suspend fun claimDetail(claimId: String): NetworkResult<AdminClaimDetailResponse> = safeApiCall { api.claimDetail(claimId) }

        /**
         * `POST /api/admin/claims/:claimId/review` — reviewer decision
         * + optional note.
         */
        suspend fun reviewClaim(
            claimId: String,
            request: AdminClaimReviewRequest,
        ): NetworkResult<AdminClaimReviewResponse> = safeApiCall { api.reviewClaim(claimId, request) }
    }
