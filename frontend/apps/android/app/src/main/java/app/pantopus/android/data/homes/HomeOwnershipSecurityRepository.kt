package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeOwnershipSecurityApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HomeOwnershipSecurityApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class HomeOwnershipSecurityRepository
    @Inject
    constructor(
        private val api: HomeOwnershipSecurityApi,
    ) {
        /** `GET /api/homes/:id/security`. */
        suspend fun getSecurity(homeId: String): NetworkResult<HomeOwnershipSecurityResponse> = safeApiCall { api.getSecurity(homeId) }

        /** `PATCH /api/homes/:id/security`. */
        suspend fun updateSecurity(
            homeId: String,
            body: UpdateHomeOwnershipSecurityRequest,
        ): NetworkResult<UpdateHomeOwnershipSecurityResponse> = safeApiCall { api.updateSecurity(homeId, body) }
    }
