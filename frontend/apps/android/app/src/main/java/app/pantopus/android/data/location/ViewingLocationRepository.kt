package app.pantopus.android.data.location

import app.pantopus.android.data.api.models.location.SavedViewingArea
import app.pantopus.android.data.api.models.location.SetViewingLocationRequest
import app.pantopus.android.data.api.models.location.SetViewingLocationResponse
import app.pantopus.android.data.api.models.location.SetViewingRadiusRequest
import app.pantopus.android.data.api.models.location.SetViewingRadiusResponse
import app.pantopus.android.data.api.models.location.ViewingLocationDto
import app.pantopus.android.data.api.models.location.ViewingLocationPayload
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.refusesStoredCopy
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
        /** Selected area, home, then saved address; a failed read never means no location. */
        suspend fun resolve(): NetworkResult<ViewingLocationPayload> =
            when (val result = safeApiCall { api.resolve() }) {
                is NetworkResult.Success -> NetworkResult.Success(ViewingLocationPayload(viewingLocation = result.data.viewingLocation))
                is NetworkResult.Failure -> result
            }

        /**
         * `GET /api/location` through the screens' store (Instant Screens; kind You, fresh 10 minutes; [force] reads
         * now): the Nearby context bar, Pulse and the map share one copy. A failed read answers with the copy it holds,
         * or, cold and offline, with the last chosen area alone, so the saved pages it produced can still open.
         */
        suspend fun current(force: Boolean = false): NetworkResult<ViewingLocationPayload> {
            val stored = store.read(StoreKeys.viewingLocation, force) { etag -> conditionalApiCall { api.currentConditional(etag) } }
            stored.data?.let { payload ->
                if (stored.failure == null) rememberArea(payload.viewingLocation)
                return NetworkResult.Success(payload)
            }
            if (stored.failure.refusesStoredCopy) {
                store.remove(StoreKeys.viewingArea)
            } else {
                savedArea()?.let { return NetworkResult.Success(it) }
            }
            return stored.asResult()
        }

        /** The stored viewing location as it is now (a first frame), without a request. */
        fun currentCopy(): ViewingLocationPayload? = store.peek(StoreKeys.viewingLocation).data ?: savedArea()

        private fun savedArea(): ViewingLocationPayload? =
            store.peek(StoreKeys.viewingArea).data?.let { ViewingLocationPayload(viewingLocation = it.viewingLocation) }

        /** Only the chosen area is written to the phone; the reply's homes and recent places never are. */
        private fun rememberArea(area: ViewingLocationDto?) {
            val saved = SavedViewingArea(area)
            if (store.peek(StoreKeys.viewingArea).data != saved) store.put(StoreKeys.viewingArea, saved)
        }

        /** `PUT /api/location`. A new area drops the stored copy, so the next read asks again. */
        suspend fun set(request: SetViewingLocationRequest): NetworkResult<SetViewingLocationResponse> =
            safeApiCall { api.set(request) }.also(::changed)

        /** `PUT /api/location/radius`. */
        suspend fun setRadius(miles: Double): NetworkResult<SetViewingRadiusResponse> =
            safeApiCall { api.setRadius(SetViewingRadiusRequest(radiusMiles = miles)) }.also(::changed)

        private fun changed(result: NetworkResult<*>) {
            if (result is NetworkResult.Success) {
                store.remove(StoreKeys.viewingLocation)
                // A new choice must not open the old area's pages offline before it has been read once.
                store.remove(StoreKeys.viewingArea)
            }
        }
    }
