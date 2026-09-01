package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.ChallengeClaimRequest
import app.pantopus.android.data.api.models.homes.ChallengeClaimResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Claim-lifecycle routes that sit beside the submit / evidence pair on
 * [HomesApi]. Kept in their own service so the claim flow can grow
 * without touching the shared homes surface.
 */
interface HomeOwnershipClaimApi {
    /**
     * `POST /api/homes/:id/ownership-claims/:claimId/challenge` — route
     * `backend/routes/homeOwnership.js:1282`.
     *
     * Moves an active ownership claim onto the challenge path against
     * the home's currently-verified household. The backend re-derives
     * the claim's evidence strength and answers
     * `409 INSUFFICIENT_CHALLENGE_EVIDENCE` when the uploaded documents
     * aren't strong enough, so the client only calls this after a strong
     * document (deed / closing disclosure / escrow attestation / title
     * match) has been registered.
     */
    @POST("api/homes/{id}/ownership-claims/{claimId}/challenge")
    suspend fun challengeClaim(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
        @Body body: ChallengeClaimRequest = ChallengeClaimRequest(),
    ): ChallengeClaimResponse
}
