package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.OwnersResponse
import app.pantopus.android.data.api.models.homes.RemoveOwnerResponse
import app.pantopus.android.data.api.models.homes.TransferOwnerRequest
import app.pantopus.android.data.api.models.homes.TransferOwnerResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * P15 / T6.3g — Thin wrapper around the owners endpoints on
 * [HomesApi] returning the typed [NetworkResult] taxonomy. ViewModels
 * depend on this so they can expose a single error surface to the UI.
 *
 * Invite (POST) lives on [HomesRepository.inviteOwner] alongside the
 * other write surfaces it already covers.
 */
@Singleton
open class HomeOwnersRepository
    @Inject
    constructor(
        private val api: HomesApi,
    ) {
        /** `GET /api/homes/:id/owners`. */
        open suspend fun list(homeId: String): NetworkResult<OwnersResponse> = safeApiCall { api.listOwners(homeId) }

        /** `DELETE /api/homes/:id/owners/:ownerId`. */
        open suspend fun remove(
            homeId: String,
            ownerId: String,
        ): NetworkResult<RemoveOwnerResponse> = safeApiCall { api.removeOwner(homeId, ownerId) }

        /** `POST /api/homes/:id/owners/transfer`. */
        open suspend fun transfer(
            homeId: String,
            request: TransferOwnerRequest,
        ): NetworkResult<TransferOwnerResponse> = safeApiCall { api.transferOwner(homeId, request) }
    }
