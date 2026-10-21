@file:Suppress("PackageNaming")

package app.pantopus.android.data.saved_places

import app.pantopus.android.data.api.models.place.PlaceAddressRef
import app.pantopus.android.data.api.models.place.PlaceBand
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlaceGroupBlock
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewStatus
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceTier
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
import app.pantopus.android.data.store.StoreKind
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
            listStored().let { it.data?.let { data -> NetworkResult.Success(data) } ?: it.asResult() }

        fun todayCopy(id: String): Stored<PlaceIntelligence> = store.peek(StoreKeys.savedPlaceToday(id))

        suspend fun todayStored(
            id: String,
            force: Boolean = false,
        ): Stored<PlaceIntelligence> {
            val copy = todayCopy(id)
            val checkAlerts = !copy.isFresh(StoreKind.TODAY_ALERTS) || copy.failure != null
            return store.read(StoreKeys.savedPlaceToday(id), force || checkAlerts) { etag ->
                conditionalApiCall { api.todayConditional(id, etag) }
            }
        }

        suspend fun today(id: String): NetworkResult<PlaceIntelligence> =
            todayStored(id).let { it.data?.let { data -> NetworkResult.Success(data) } ?: it.asResult() }

        fun previewCopy(id: String): Stored<PlacePreview> = store.peek(StoreKeys.savedPlacePreview(id))

        suspend fun previewStored(
            id: String,
            force: Boolean = false,
        ): Stored<PlacePreview> =
            store.read(StoreKeys.savedPlacePreview(id), force) { etag -> conditionalApiCall { api.previewConditional(id, etag) } }

        fun detailsCopy(id: String): Stored<PlaceIntelligence> = previewCopy(id).publicDetails()

        suspend fun detailsStored(
            id: String,
            force: Boolean,
        ): Stored<PlaceIntelligence> = previewStored(id, force).publicDetails()

        /** What's public about the saved point itself (the Place tab's saved-address root). */
        suspend fun preview(id: String): NetworkResult<PlacePreview> = safeApiCall { api.preview(id) }

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

/** Only public envelopes enter the shared detail layouts; no Home identity or generated timestamp is invented. */
private fun Stored<PlacePreview>.publicDetails(): Stored<PlaceIntelligence> {
    val preview = data ?: return Stored(fetchedAt = fetchedAt, failure = failure)
    val order =
        listOf(
            PlaceGroup.RISK_READINESS to "Risk & readiness",
            PlaceGroup.HEALTH_ENVIRONMENT to "Health & environment",
            PlaceGroup.CIVIC to "Civic",
        )
    val available = preview.status == PlacePreviewStatus.READY || preview.status == PlacePreviewStatus.PARTIAL
    val groups =
        order.mapNotNull { (group, label) ->
            val sections =
                preview.sections.orEmpty().filter {
                    available && it.groupId == group && it.band == PlaceBand.A && it.access != PlaceSectionAccess.LOCKED
                }
            sections.takeIf { it.isNotEmpty() }?.let { PlaceGroupBlock(group.raw, label, it) }
        }
    val address = preview.place
    return Stored(
        data =
            PlaceIntelligence(
                place =
                    PlaceAddressRef(
                        address?.address.orEmpty(),
                        address?.address.orEmpty(),
                        address?.city.orEmpty(),
                        address?.state.orEmpty(),
                        address?.zipcode,
                    ),
                tier = PlaceTier.T1,
                regionSupported = preview.status != PlacePreviewStatus.UNSUPPORTED_REGION,
                generatedAt = "",
                groups = groups,
                verifyAvailable = false,
            ),
        fetchedAt = fetchedAt,
        refreshing = refreshing,
        failure = failure,
    )
}
