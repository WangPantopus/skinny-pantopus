package app.pantopus.android.data.neighborhood

import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.NeighborhoodApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
open class NeighborhoodRepository
    @Inject
    constructor(
        private val api: NeighborhoodApi,
        private val store: ScreenStore,
    ) {
        open suspend fun meter(): NetworkResult<NeighborhoodMeter> = safeApiCall { api.meter() }

        open suspend fun cells(): NetworkResult<NeighborhoodCells> = safeApiCall { api.cells() }

        /** The density meter through the screens' store (fresh 2 minutes; [force] reads now). */
        open suspend fun meterStored(force: Boolean = false): Stored<NeighborhoodMeter> =
            store.read(StoreKeys.neighborhoodMeter, force) { etag -> conditionalApiCall { api.meterConditional(etag) } }

        /** The map cells through the screens' store (fresh 2 minutes; [force] reads now). */
        open suspend fun cellsStored(force: Boolean = false): Stored<NeighborhoodCells> =
            store.read(StoreKeys.neighborhoodCells, force) { etag -> conditionalApiCall { api.cellsConditional(etag) } }

        /** The stored meter and cells as they are now, without a request (null before the first read). */
        open fun meterCopy(): NeighborhoodMeter? = store.peek(StoreKeys.neighborhoodMeter).data

        open fun cellsCopy(): NeighborhoodCells? = store.peek(StoreKeys.neighborhoodCells).data

        /** True while both are fresh and no topic marked them out of date. */
        open fun isCurrent(): Boolean = store.isCurrent(StoreKeys.neighborhoodMeter) && store.isCurrent(StoreKeys.neighborhoodCells)
    }
