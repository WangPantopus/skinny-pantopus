package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.models.homes.UpdateHomePrivacyRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomePrivacyApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HomePrivacyApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class HomePrivacyRepository
    @Inject
    constructor(
        private val api: HomePrivacyApi,
    ) {
        /** `GET /api/homes/:id/privacy`. */
        suspend fun getPrivacy(homeId: String): NetworkResult<HomePrivacyResponse> = safeApiCall { api.getPrivacy(homeId) }

        /** `PATCH /api/homes/:id/privacy`. */
        suspend fun updatePrivacy(
            homeId: String,
            body: UpdateHomePrivacyRequest,
        ): NetworkResult<HomePrivacyResponse> = safeApiCall { api.updatePrivacy(homeId, body) }
    }
