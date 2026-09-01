package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateGuestPassRequest
import app.pantopus.android.data.api.models.homes.CreateGuestPassResponse
import app.pantopus.android.data.api.models.homes.GuestPassesResponse
import app.pantopus.android.data.api.models.homes.RevokeGuestPassResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeGuestPassesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A13.1 — Thin wrapper around the guest-pass endpoints on
 * [HomeGuestPassesApi] returning the typed [NetworkResult] taxonomy.
 * ViewModels depend on this so they can expose a single error surface.
 */
@Singleton
open class HomeGuestPassesRepository
    @Inject
    constructor(
        private val api: HomeGuestPassesApi,
    ) {
        /** `POST /api/homes/:id/guest-passes`. */
        open suspend fun create(
            homeId: String,
            request: CreateGuestPassRequest,
        ): NetworkResult<CreateGuestPassResponse> = safeApiCall { api.createGuestPass(homeId, request) }

        /** `GET /api/homes/:id/guest-passes`. */
        open suspend fun list(
            homeId: String,
            includeRevoked: Boolean = false,
        ): NetworkResult<GuestPassesResponse> = safeApiCall { api.listGuestPasses(homeId, includeRevoked) }

        /** `DELETE /api/homes/:id/guest-passes/:passId`. */
        open suspend fun revoke(
            homeId: String,
            passId: String,
        ): NetworkResult<RevokeGuestPassResponse> = safeApiCall { api.revokeGuestPass(homeId, passId) }
    }
