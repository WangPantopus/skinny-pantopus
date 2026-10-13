package app.pantopus.android.data.location

import app.pantopus.android.data.api.models.location.SetViewingLocationRequest
import app.pantopus.android.data.api.models.location.SetViewingLocationResponse
import app.pantopus.android.data.api.models.location.SetViewingRadiusRequest
import app.pantopus.android.data.api.models.location.SetViewingRadiusResponse
import app.pantopus.android.data.api.models.location.ViewingLocationPayload
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ViewingLocationApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.asResult
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [ViewingLocationApi] in the [NetworkResult] taxonomy. */
@Singleton
class ViewingLocationRepository
    @Inject
    constructor(
        private val api: ViewingLocationApi,
        private val store: ScreenStore,
    ) {
        /**
         * `GET /api/location` through the screens' store (Instant Screens; kind You, fresh 10 minutes; [force] reads
         * now): the Nearby context bar, Pulse and the map share one copy. A failed read answers with the copy it holds.
         */
        suspend fun current(force: Boolean = false): NetworkResult<ViewingLocationPayload> {
            val stored = store.read(StoreKeys.viewingLocation, force) { etag -> conditionalApiCall { api.currentConditional(etag) } }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        /** The stored viewing location as it is now (a first frame), without a request. */
        fun currentCopy(): ViewingLocationPayload? = store.peek(StoreKeys.viewingLocation).data

        /** `PUT /api/location`. A new area drops the stored copy, so the next read asks again. */
        suspend fun set(request: SetViewingLocationRequest): NetworkResult<SetViewingLocationResponse> =
            safeApiCall { api.set(request) }.also(::changed)

        /** `PUT /api/location/radius`. */
        suspend fun setRadius(miles: Double): NetworkResult<SetViewingRadiusResponse> =
            safeApiCall { api.setRadius(SetViewingRadiusRequest(radiusMiles = miles)) }.also(::changed)

        private fun changed(result: NetworkResult<*>) {
            if (result is NetworkResult.Success) store.remove(StoreKeys.viewingLocation)
        }
    }
