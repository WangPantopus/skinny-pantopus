package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.OwnersResponse
import app.pantopus.android.data.api.models.homes.RemoveOwnerResponse
import app.pantopus.android.data.api.models.homes.TransferOwnerRequest
import app.pantopus.android.data.api.models.homes.TransferOwnerResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomesApi
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
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
        private val store: ScreenStore,
    ) {
        /** `GET /api/homes/:id/owners`. */
        open suspend fun list(homeId: String): NetworkResult<OwnersResponse> = safeApiCall { api.listOwners(homeId) }

        /** [list] through the screens' store: a fresh copy answers without a request. */
        open suspend fun listStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<OwnersResponse> =
            store.read(HomeStoreKeys.owners(homeId), force) { etag -> conditionalApiCall { api.listOwnersConditional(homeId, etag) } }

        /** The stored owners, without a request. */
        open fun storedList(homeId: String): OwnersResponse? = store.peek(HomeStoreKeys.owners(homeId)).data

        /** `DELETE /api/homes/:id/owners/:ownerId`. */
        open suspend fun remove(
            homeId: String,
            ownerId: String,
        ): NetworkResult<RemoveOwnerResponse> = safeApiCall { api.removeOwner(homeId, ownerId) }.also { changed(homeId, it) }

        /** `POST /api/homes/:id/owners/transfer`. */
        open suspend fun transfer(
            homeId: String,
            request: TransferOwnerRequest,
        ): NetworkResult<TransferOwnerResponse> = safeApiCall { api.transferOwner(homeId, request) }.also { changed(homeId, it) }

        /** Own edit: this Home's stored screens, and the lists that name it, read again on their next use. */
        private fun changed(
            homeId: String,
            result: NetworkResult<*>,
        ) {
            if (result !is NetworkResult.Success) return
            store.markStale("home:$homeId")
            store.markStale(StoreTopics.HOMES)
        }
    }
