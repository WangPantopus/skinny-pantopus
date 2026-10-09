package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.models.homes.UpdateHomePrivacyRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomePrivacyApi
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HomePrivacyApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class HomePrivacyRepository
    @Inject
    constructor(
        private val api: HomePrivacyApi,
        private val store: ScreenStore,
    ) {
        /** `GET /api/homes/:id/privacy`. */
        suspend fun getPrivacy(homeId: String): NetworkResult<HomePrivacyResponse> = safeApiCall { api.getPrivacy(homeId) }

        /** [getPrivacy] through the screens' store: a fresh copy answers without a request. */
        suspend fun getPrivacyStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomePrivacyResponse> =
            store.read(HomeStoreKeys.privacy(homeId), force) { etag ->
                conditionalApiCall { api.getPrivacyConditional(homeId, etag) }
            }

        /** The stored privacy toggles, without a request. */
        fun storedPrivacy(homeId: String): HomePrivacyResponse? = store.peek(HomeStoreKeys.privacy(homeId)).data

        /** `PATCH /api/homes/:id/privacy`. The reply is the whole saved row, so it becomes the stored copy. */
        suspend fun updatePrivacy(
            homeId: String,
            body: UpdateHomePrivacyRequest,
        ): NetworkResult<HomePrivacyResponse> =
            safeApiCall { api.updatePrivacy(homeId, body) }.also { result ->
                if (result is NetworkResult.Success) store.put(HomeStoreKeys.privacy(homeId), result.data)
            }
    }
