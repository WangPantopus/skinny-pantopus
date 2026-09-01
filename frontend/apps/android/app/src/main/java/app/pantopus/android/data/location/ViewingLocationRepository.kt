package app.pantopus.android.data.location

import app.pantopus.android.data.api.models.location.SetViewingLocationRequest
import app.pantopus.android.data.api.models.location.SetViewingLocationResponse
import app.pantopus.android.data.api.models.location.SetViewingRadiusRequest
import app.pantopus.android.data.api.models.location.SetViewingRadiusResponse
import app.pantopus.android.data.api.models.location.ViewingLocationPayload
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ViewingLocationApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [ViewingLocationApi] in the [NetworkResult] taxonomy. */
@Singleton
class ViewingLocationRepository
    @Inject
    constructor(
        private val api: ViewingLocationApi,
    ) {
        /** `GET /api/location`. */
        suspend fun current(): NetworkResult<ViewingLocationPayload> = safeApiCall { api.current() }

        /** `PUT /api/location`. */
        suspend fun set(request: SetViewingLocationRequest): NetworkResult<SetViewingLocationResponse> = safeApiCall { api.set(request) }

        /** `PUT /api/location/radius`. */
        suspend fun setRadius(miles: Double): NetworkResult<SetViewingRadiusResponse> =
            safeApiCall { api.setRadius(SetViewingRadiusRequest(radiusMiles = miles)) }
    }
