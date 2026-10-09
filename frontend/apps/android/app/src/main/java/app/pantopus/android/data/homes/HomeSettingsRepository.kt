package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.UpdateHomeRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeSettingsApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreTopics
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HomeSettingsApi] in the typed [NetworkResult] taxonomy. */
@Singleton
open class HomeSettingsRepository
    @Inject
    constructor(
        private val api: HomeSettingsApi,
        private val store: ScreenStore,
    ) {
        /** `PATCH /api/homes/:id` — rename (or otherwise edit) the home. */
        open suspend fun updateHome(
            homeId: String,
            body: UpdateHomeRequest,
        ): NetworkResult<UpdateHomeResponse> =
            safeApiCall { api.updateHome(homeId, body) }.also { result ->
                // The Home's stored screens and every list that names it read again on their next use.
                if (result is NetworkResult.Success) {
                    store.markStale("home:$homeId")
                    store.markStale(StoreTopics.HOMES)
                }
            }
    }
