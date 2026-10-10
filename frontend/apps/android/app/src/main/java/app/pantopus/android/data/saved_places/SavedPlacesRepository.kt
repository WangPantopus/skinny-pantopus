@file:Suppress("PackageNaming")

package app.pantopus.android.data.saved_places

import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDeleteResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlaceResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlacesListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.SavedPlacesApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
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
        private val store: ScreenStore,
    ) {
        fun listCopy(): SavedPlacesListResponse? = store.peek(StoreKeys.savedPlaces).data

        suspend fun listStored(force: Boolean = false): Stored<SavedPlacesListResponse> =
            store.read(StoreKeys.savedPlaces, force) { etag -> conditionalApiCall { api.listConditional(etag) } }

        suspend fun list(): NetworkResult<SavedPlacesListResponse> =
            listStored().let {
                it.data?.let { data -> NetworkResult.Success(data) } ?: it.asResult()
            }

        fun todayCopy(id: String): Stored<PlaceIntelligence> = store.peek(StoreKeys.savedPlaceToday(id))

        suspend fun todayStored(
            id: String,
            force: Boolean = false,
        ): Stored<PlaceIntelligence> =
            store.read(StoreKeys.savedPlaceToday(id), force) { etag -> conditionalApiCall { api.todayConditional(id, etag) } }

        suspend fun today(id: String): NetworkResult<PlaceIntelligence> =
            todayStored(id).let {
                it.data?.let { data -> NetworkResult.Success(data) } ?: it.asResult()
            }

        suspend fun save(body: SavePlaceBody): NetworkResult<SavedPlaceResponse> = safeApiCall { api.save(body) }.changed()

        suspend fun remove(id: String): NetworkResult<SavedPlaceDeleteResponse> = safeApiCall { api.remove(id) }.changed()

        private fun <T> NetworkResult<T>.changed(): NetworkResult<T> =
            also {
                if (it is NetworkResult.Success) {
                    store.markEdited(StoreTopics.HOMES)
                    store.markEdited(StoreTopics.TODAY)
                }
            }
    }
