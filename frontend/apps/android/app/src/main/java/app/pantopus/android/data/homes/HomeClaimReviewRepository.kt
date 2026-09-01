package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeClaimComparisonDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimActionResponse
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimResolveRelationshipRequest
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimReviewRequest
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimActionResponse
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimApproveRequest
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimRejectRequest
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeClaimReviewApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * H6 — Thin wrapper around [HomeClaimReviewApi] returning the typed
 * [NetworkResult] taxonomy. Backs the per-home **owner** claim-review
 * screen only; the platform-admin queue keeps using `AdminRepository`.
 */
@Singleton
open class HomeClaimReviewRepository
    @Inject
    constructor(
        private val api: HomeClaimReviewApi,
    ) {
        /** `GET /api/homes/:id/ownership-claims`. */
        open suspend fun ownershipClaims(homeId: String): NetworkResult<HomeOwnershipClaimsResponse> =
            safeApiCall { api.ownershipClaims(homeId) }

        /**
         * `GET /api/homes/:id/ownership-claims/compare`. Fails with a 404
         * when the server-side `adminCompare` flag is off — callers must
         * treat failure as "comparison unavailable", not as an error.
         */
        open suspend fun ownershipClaimComparison(homeId: String): NetworkResult<HomeClaimComparisonDto> =
            safeApiCall { api.ownershipClaimComparison(homeId) }

        /** `POST /api/homes/:id/ownership-claims/:claimId/review`. */
        open suspend fun reviewOwnershipClaim(
            homeId: String,
            claimId: String,
            action: String,
            note: String? = null,
        ): NetworkResult<HomeOwnershipClaimActionResponse> =
            safeApiCall {
                api.reviewOwnershipClaim(
                    homeId,
                    claimId,
                    HomeOwnershipClaimReviewRequest(action = action, note = note),
                )
            }

        /**
         * `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`.
         */
        open suspend fun resolveOwnershipClaimRelationship(
            homeId: String,
            claimId: String,
            action: String,
            note: String? = null,
        ): NetworkResult<HomeOwnershipClaimActionResponse> =
            safeApiCall {
                api.resolveOwnershipClaimRelationship(
                    homeId,
                    claimId,
                    HomeOwnershipClaimResolveRelationshipRequest(action = action, note = note),
                )
            }

        /** `GET /api/homes/:id/claims`. */
        open suspend fun residencyClaims(homeId: String): NetworkResult<HomeResidencyClaimsResponse> =
            safeApiCall { api.residencyClaims(homeId) }

        /** `POST /api/homes/:id/claim/:claimId/approve`. */
        open suspend fun approveResidencyClaim(
            homeId: String,
            claimId: String,
            proposedRole: String? = null,
        ): NetworkResult<HomeResidencyClaimActionResponse> =
            safeApiCall {
                api.approveResidencyClaim(
                    homeId,
                    claimId,
                    HomeResidencyClaimApproveRequest(proposedRole = proposedRole),
                )
            }

        /** `POST /api/homes/:id/claim/:claimId/reject`. */
        open suspend fun rejectResidencyClaim(
            homeId: String,
            claimId: String,
            reason: String? = null,
        ): NetworkResult<HomeResidencyClaimActionResponse> =
            safeApiCall {
                api.rejectResidencyClaim(
                    homeId,
                    claimId,
                    HomeResidencyClaimRejectRequest(reason = reason),
                )
            }
    }
