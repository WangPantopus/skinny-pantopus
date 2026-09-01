@file:Suppress("PackageNaming")

package app.pantopus.android.data.saved_places

import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDeleteResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlaceResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlacesListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.SavedPlacesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * BLOCK 2E — "Saved places". Wraps [SavedPlacesApi] in `safeApiCall` so the
 * ViewModel routes on the `NetworkResult` taxonomy.
 */
@Singleton
class SavedPlacesRepository
    @Inject
    constructor(
        private val api: SavedPlacesApi,
    ) {
        suspend fun list(): NetworkResult<SavedPlacesListResponse> = safeApiCall { api.list() }

        suspend fun save(body: SavePlaceBody): NetworkResult<SavedPlaceResponse> = safeApiCall { api.save(body) }

        suspend fun remove(id: String): NetworkResult<SavedPlaceDeleteResponse> = safeApiCall { api.remove(id) }
    }
