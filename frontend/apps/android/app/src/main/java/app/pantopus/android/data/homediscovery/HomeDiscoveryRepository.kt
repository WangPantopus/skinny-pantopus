package app.pantopus.android.data.homediscovery

import app.pantopus.android.data.api.models.homediscovery.HomeDiscoverResponse
import app.pantopus.android.data.api.models.homediscovery.HomePublicPreviewResponse
import app.pantopus.android.data.api.models.homediscovery.RequestHouseholdFromOwnerRequest
import app.pantopus.android.data.api.models.homediscovery.RequestHouseholdFromOwnerResponse
import app.pantopus.android.data.api.models.homediscovery.SubmitResidencyClaimRequest
import app.pantopus.android.data.api.models.homediscovery.SubmitResidencyClaimResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeDiscoveryApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [HomeDiscoveryApi] returning the typed
 * [NetworkResult] taxonomy.
 */
@Singleton
open class HomeDiscoveryRepository
    @Inject
    constructor(
        private val api: HomeDiscoveryApi,
    ) {
        /** `GET /api/homes/discover`. */
        open suspend fun discover(query: String): NetworkResult<HomeDiscoverResponse> = safeApiCall { api.discover(query) }

        /** `GET /api/homes/:id/public-profile`. */
        open suspend fun publicPreview(homeId: String): NetworkResult<HomePublicPreviewResponse> = safeApiCall { api.publicPreview(homeId) }

        /** `POST /api/homes/:id/request-household-from-owner`. */
        open suspend fun requestHouseholdFromOwner(
            homeId: String,
            requestedIdentity: String = "owner",
        ): NetworkResult<RequestHouseholdFromOwnerResponse> =
            safeApiCall {
                api.requestHouseholdFromOwner(
                    homeId,
                    RequestHouseholdFromOwnerRequest(requestedIdentity = requestedIdentity),
                )
            }

        /** `POST /api/homes/:id/claim`. */
        open suspend fun submitResidencyClaim(
            homeId: String,
            claimedRole: String?,
        ): NetworkResult<SubmitResidencyClaimResponse> =
            safeApiCall {
                api.submitResidencyClaim(
                    homeId,
                    SubmitResidencyClaimRequest(claimedRole = claimedRole),
                )
            }
    }
