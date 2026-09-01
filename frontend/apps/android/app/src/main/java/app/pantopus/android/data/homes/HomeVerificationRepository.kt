package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.RequestPostcardResponse
import app.pantopus.android.data.api.models.homes.VerifyPostcardRequest
import app.pantopus.android.data.api.models.homes.VerifyPostcardResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeVerificationApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A12.5–A12.7 — Thin wrapper around the postcard ownership-verification
 * endpoints on [HomeVerificationApi] returning the typed [NetworkResult]
 * taxonomy. ViewModels depend on this so they can expose a single error
 * surface to the UI.
 */
@Singleton
open class HomeVerificationRepository
    @Inject
    constructor(
        private val api: HomeVerificationApi,
    ) {
        /** `POST /api/homes/:id/request-postcard`. */
        open suspend fun requestPostcard(homeId: String): NetworkResult<RequestPostcardResponse> =
            safeApiCall { api.requestPostcard(homeId) }

        /** `POST /api/homes/:id/verify-postcard`. */
        open suspend fun verifyPostcard(
            homeId: String,
            code: String,
        ): NetworkResult<VerifyPostcardResponse> = safeApiCall { api.verifyPostcard(homeId, VerifyPostcardRequest(code)) }
    }
