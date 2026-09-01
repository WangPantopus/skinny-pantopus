package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.InviteMemberRequest
import app.pantopus.android.data.api.models.homes.InviteMemberResponse
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.RemoveMemberResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeMembersApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [HomeMembersApi] returning the typed
 * [NetworkResult] taxonomy. View-models depend on this so they can
 * expose a single error surface to the UI.
 */
@Singleton
open class HomeMembersRepository
    @Inject
    constructor(
        private val api: HomeMembersApi,
    ) {
        /** `GET /api/homes/:id/occupants`. */
        open suspend fun listOccupants(homeId: String): NetworkResult<OccupantsResponse> = safeApiCall { api.listOccupants(homeId) }

        /** `POST /api/homes/:id/invite`. */
        open suspend fun invite(
            homeId: String,
            request: InviteMemberRequest,
        ): NetworkResult<InviteMemberResponse> = safeApiCall { api.invite(homeId, request) }

        /** `DELETE /api/homes/:id/members/:userId`. */
        open suspend fun remove(
            homeId: String,
            userId: String,
        ): NetworkResult<RemoveMemberResponse> = safeApiCall { api.removeMember(homeId, userId) }
    }
