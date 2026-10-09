package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeOwnershipSecurityApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HomeOwnershipSecurityApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class HomeOwnershipSecurityRepository
    @Inject
    constructor(
        private val api: HomeOwnershipSecurityApi,
        private val store: ScreenStore,
    ) {
        /** `GET /api/homes/:id/security`. */
        suspend fun getSecurity(homeId: String): NetworkResult<HomeOwnershipSecurityResponse> = safeApiCall { api.getSecurity(homeId) }

        /** [getSecurity] through the screens' store: a fresh copy answers without a request. */
        suspend fun getSecurityStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomeOwnershipSecurityResponse> =
            store.read(StoreKeys.homeSecurity(homeId), force) { etag ->
                conditionalApiCall { api.getSecurityConditional(homeId, etag) }
            }

        /** The stored policy, without a request. */
        fun storedSecurity(homeId: String): HomeOwnershipSecurityResponse? = store.peek(StoreKeys.homeSecurity(homeId)).data

        /** `PATCH /api/homes/:id/security`. */
        suspend fun updateSecurity(
            homeId: String,
            body: UpdateHomeOwnershipSecurityRequest,
        ): NetworkResult<UpdateHomeOwnershipSecurityResponse> =
            safeApiCall { api.updateSecurity(homeId, body) }.also { result ->
                // The PATCH echo lacks the GET-only fields, so the stored policy is re-read on its next use.
                if (result is NetworkResult.Success) store.markStale("home:$homeId")
            }
    }
