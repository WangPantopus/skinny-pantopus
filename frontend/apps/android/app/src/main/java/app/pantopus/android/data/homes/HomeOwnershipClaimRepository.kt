package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.ChallengeClaimRequest
import app.pantopus.android.data.api.models.homes.ChallengeClaimResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeOwnershipClaimApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [HomeOwnershipClaimApi] returning the typed
 * [NetworkResult] taxonomy so view-models expose a single error surface.
 */
@Singleton
open class HomeOwnershipClaimRepository
    @Inject
    constructor(
        private val api: HomeOwnershipClaimApi,
    ) {
        /** `POST /api/homes/:id/ownership-claims/:claimId/challenge`. */
        open suspend fun challengeClaim(
            homeId: String,
            claimId: String,
            note: String? = null,
        ): NetworkResult<ChallengeClaimResponse> = safeApiCall { api.challengeClaim(homeId, claimId, ChallengeClaimRequest(note = note)) }
    }
