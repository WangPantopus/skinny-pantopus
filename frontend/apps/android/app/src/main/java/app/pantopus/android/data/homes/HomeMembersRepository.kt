package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.InviteMemberRequest
import app.pantopus.android.data.api.models.homes.InviteMemberResponse
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.RemoveMemberResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeMembersApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
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
        private val store: ScreenStore,
    ) {
        /** `GET /api/homes/:id/occupants`. */
        open suspend fun listOccupants(homeId: String): NetworkResult<OccupantsResponse> = safeApiCall { api.listOccupants(homeId) }

        /** [listOccupants] through the screens' store: a fresh copy answers without a request. */
        open suspend fun listOccupantsStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<OccupantsResponse> =
            store.read(StoreKeys.homeOccupants(homeId), force) { etag ->
                conditionalApiCall { api.listOccupantsConditional(homeId, etag) }
            }

        /** The stored occupants, without a request. */
        open fun storedOccupants(homeId: String): OccupantsResponse? = store.peek(StoreKeys.homeOccupants(homeId)).data

        /** `POST /api/homes/:id/invite`. */
        open suspend fun invite(
            homeId: String,
            request: InviteMemberRequest,
        ): NetworkResult<InviteMemberResponse> = safeApiCall { api.invite(homeId, request) }.also { changed(homeId, it) }

        /** `DELETE /api/homes/:id/members/:userId`. */
        open suspend fun remove(
            homeId: String,
            userId: String,
        ): NetworkResult<RemoveMemberResponse> = safeApiCall { api.removeMember(homeId, userId) }.also { changed(homeId, it) }

        /** Own edit: this Home's stored screens, and the lists that name it, read again on their next use. */
        private fun changed(
            homeId: String,
            result: NetworkResult<*>,
        ) {
            if (result !is NetworkResult.Success) return
            store.markStale("home:$homeId")
            store.markStale("homes")
        }
    }
