package app.pantopus.android.data.neighborhood

import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.NeighborhoodApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
open class NeighborhoodRepository
    @Inject
    constructor(
        private val api: NeighborhoodApi,
    ) {
        open suspend fun meter(): NetworkResult<NeighborhoodMeter> = safeApiCall { api.meter() }

        open suspend fun cells(): NetworkResult<NeighborhoodCells> = safeApiCall { api.cells() }
    }
