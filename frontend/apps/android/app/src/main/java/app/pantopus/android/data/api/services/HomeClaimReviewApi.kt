@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeClaimComparisonDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimActionResponse
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimResolveRelationshipRequest
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimReviewRequest
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimActionResponse
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimApproveRequest
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimRejectRequest
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * H6 — Retrofit surface for the **per-home owner** claim-review screen.
 *
 * Kept out of [HomesApi] (merge contention) and entirely separate from
 * `AdminApi` — the admin queue talks to `/api/admin/claims*`, this one
 * talks to the home-scoped routes an owner is authorised for
 * (`ownership.manage` / `members.manage`).
 *
 * Both collections mount on `/api/homes` in `backend/app.js`:
 *  - `app.js:322` → `routes/homeOwnership.js` (ownership claims)
 *  - `app.js:326` → `routes/home.js`          (residency claims)
 *
 * Mirrors iOS `HomeClaimReviewEndpoints.swift`.
 */
interface HomeClaimReviewApi {
    /**
     * `GET /api/homes/:id/ownership-claims` — route
     * `backend/routes/homeOwnership.js:490`. Owner-only
     * (`ownership.manage`). Claimants come back masked.
     */
    @GET("api/homes/{id}/ownership-claims")
    suspend fun ownershipClaims(
        @Path("id") homeId: String,
    ): HomeOwnershipClaimsResponse

    /**
     * `GET /api/homes/:id/ownership-claims/compare` — route
     * `backend/routes/homeOwnership.js:536`. Side-by-side
     * incumbent-vs-challenger payload built by
     * `backend/services/homeClaimComparisonService.js:19`.
     *
     * 404s when the `adminCompare` household-claim flag is off, so
     * callers must tolerate failure and fall back to [ownershipClaims].
     */
    @GET("api/homes/{id}/ownership-claims/compare")
    suspend fun ownershipClaimComparison(
        @Path("id") homeId: String,
    ): HomeClaimComparisonDto

    /**
     * `POST /api/homes/:id/ownership-claims/:claimId/review` — route
     * `backend/routes/homeOwnership.js:665`. `action` ∈
     * approve | reject | flag.
     */
    @POST("api/homes/{id}/ownership-claims/{claimId}/review")
    suspend fun reviewOwnershipClaim(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
        @Body body: HomeOwnershipClaimReviewRequest,
    ): HomeOwnershipClaimActionResponse

    /**
     * `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`
     * — route `backend/routes/homeOwnership.js:1014`. `action` ∈
     * invite_to_household | decline_relationship | flag_unknown_person.
     *
     * 404s when the `inviteMerge` flag is off, and 403s unless the
     * caller is a *verified* household authority.
     */
    @POST("api/homes/{id}/ownership-claims/{claimId}/resolve-relationship")
    suspend fun resolveOwnershipClaimRelationship(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
        @Body body: HomeOwnershipClaimResolveRelationshipRequest,
    ): HomeOwnershipClaimActionResponse

    /**
     * `GET /api/homes/:id/claims` — route `backend/routes/home.js:6716`.
     * Gated on `members.manage` (not `ownership.manage`).
     */
    @GET("api/homes/{id}/claims")
    suspend fun residencyClaims(
        @Path("id") homeId: String,
    ): HomeResidencyClaimsResponse

    /**
     * `POST /api/homes/:id/claim/:claimId/approve` — route
     * `backend/routes/home.js:6752`. Creates/activates the claimant's
     * `HomeOccupancy`. Note the singular `claim` segment — a different
     * path family from `ownership-claims`.
     */
    @POST("api/homes/{id}/claim/{claimId}/approve")
    suspend fun approveResidencyClaim(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
        @Body body: HomeResidencyClaimApproveRequest,
    ): HomeResidencyClaimActionResponse

    /**
     * `POST /api/homes/:id/claim/:claimId/reject` — route
     * `backend/routes/home.js:6838`. The claimant's notification is
     * opaque; `reason` is stored as `review_note` only.
     */
    @POST("api/homes/{id}/claim/{claimId}/reject")
    suspend fun rejectResidencyClaim(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
        @Body body: HomeResidencyClaimRejectRequest,
    ): HomeResidencyClaimActionResponse
}
