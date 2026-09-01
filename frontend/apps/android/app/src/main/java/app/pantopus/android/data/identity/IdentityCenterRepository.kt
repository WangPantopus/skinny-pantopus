package app.pantopus.android.data.identity

import app.pantopus.android.data.api.models.identity.BridgesEchoResponse
import app.pantopus.android.data.api.models.identity.IdentityCenterResponse
import app.pantopus.android.data.api.models.identity.UpdateBridgesBody
import app.pantopus.android.data.api.models.identity.ViewAsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.IdentityCenterApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps `/api/identity-center/[*]` in the [NetworkResult] taxonomy. */
@Singleton
class IdentityCenterRepository
    @Inject
    constructor(
        private val api: IdentityCenterApi,
    ) {
        suspend fun overview(): NetworkResult<IdentityCenterResponse> = safeApiCall { api.overview() }

        suspend fun updateBridges(
            personaId: String,
            body: UpdateBridgesBody,
        ): NetworkResult<BridgesEchoResponse> = safeApiCall { api.updateBridges(personaId, body) }

        /** `GET /api/identity-center/view-as`. */
        suspend fun viewAs(
            surface: String,
            viewer: String,
            handle: String? = null,
        ): NetworkResult<ViewAsResponse> = safeApiCall { api.viewAs(surface, viewer, handle) }
    }
