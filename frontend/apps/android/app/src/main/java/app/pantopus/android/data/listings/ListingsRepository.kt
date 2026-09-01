package app.pantopus.android.data.listings

import app.pantopus.android.data.api.models.listings.CreateListingRequest
import app.pantopus.android.data.api.models.listings.CreateListingResponse
import app.pantopus.android.data.api.models.listings.ListingDetailResponse
import app.pantopus.android.data.api.models.listings.ListingSaveResponse
import app.pantopus.android.data.api.models.listings.ListingsBrowseResponse
import app.pantopus.android.data.api.models.listings.ListingsCategoriesResponse
import app.pantopus.android.data.api.models.listings.ListingsInBoundsResponse
import app.pantopus.android.data.api.models.listings.ListingsNearbyResponse
import app.pantopus.android.data.api.models.listings.MessageListingBody
import app.pantopus.android.data.api.models.listings.MessageListingResponse
import app.pantopus.android.data.api.models.listings.MyListingsResponse
import app.pantopus.android.data.api.models.listings.UpdateListingRequest
import app.pantopus.android.data.api.models.listings.UpdateListingResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ListingsMutationApi
import app.pantopus.android.data.api.services.ListingsReadApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the `/api/listings` endpoints in the [NetworkResult] taxonomy. */
@Singleton
class ListingsRepository
    @Inject
    constructor(
        private val readApi: ListingsReadApi,
        private val mutationApi: ListingsMutationApi,
    ) {
        suspend fun nearby(
            latitude: Double,
            longitude: Double,
            radiusMiles: Double? = null,
            layer: String? = null,
            isFree: Boolean? = null,
            search: String? = null,
            sort: String = "newest",
            limit: Int = 30,
            offset: Int = 0,
        ): NetworkResult<ListingsNearbyResponse> =
            safeApiCall {
                readApi.nearby(
                    latitude = latitude,
                    longitude = longitude,
                    radiusMiles = radiusMiles,
                    layer = layer,
                    isFree = isFree,
                    search = search,
                    sort = sort,
                    limit = limit,
                    offset = offset,
                )
            }

        suspend fun browse(
            south: Double,
            west: Double,
            north: Double,
            east: Double,
            layer: String? = null,
            isFree: Boolean? = null,
            search: String? = null,
            sort: String = "newest",
            cursor: String? = null,
            limit: Int = 30,
        ): NetworkResult<ListingsBrowseResponse> =
            safeApiCall {
                readApi.browse(
                    south = south,
                    west = west,
                    north = north,
                    east = east,
                    layer = layer,
                    isFree = isFree,
                    search = search,
                    sort = sort,
                    cursor = cursor,
                    limit = limit,
                )
            }

        suspend fun inBounds(
            south: Double,
            west: Double,
            north: Double,
            east: Double,
            category: String? = null,
        ): NetworkResult<ListingsInBoundsResponse> = safeApiCall { readApi.inBounds(south, west, north, east, category) }

        suspend fun categories(): NetworkResult<ListingsCategoriesResponse> = safeApiCall { readApi.categories() }

        /** Wraps `POST /api/listings`. Used by the Snap & Sell wizard. */
        suspend fun create(request: CreateListingRequest): NetworkResult<CreateListingResponse> =
            safeApiCall { mutationApi.create(request) }

        /** Wraps `PATCH /api/listings/:id`. Used by the Edit-listing
         *  flow (P3.3). Owner-only on the backend. */
        suspend fun update(
            id: String,
            request: UpdateListingRequest,
        ): NetworkResult<UpdateListingResponse> = safeApiCall { mutationApi.update(id, request) }

        suspend fun save(id: String): NetworkResult<ListingSaveResponse> = safeApiCall { mutationApi.save(id) }

        suspend fun unsave(id: String): NetworkResult<ListingSaveResponse> = safeApiCall { mutationApi.unsave(id) }

        suspend fun detail(id: String): NetworkResult<ListingDetailResponse> = safeApiCall { readApi.detail(id) }

        suspend fun messageListing(
            id: String,
            body: MessageListingBody,
        ): NetworkResult<MessageListingResponse> = safeApiCall { mutationApi.messageListing(id, body) }

        /**
         * T6.3f / P14 — backs the My listings screen. Optional `status`
         * filters server-side; the screen typically loads all and buckets
         * client-side so tab counts stay honest.
         */
        suspend fun myListings(
            status: String? = null,
            limit: Int = 100,
            offset: Int = 0,
        ): NetworkResult<MyListingsResponse> = safeApiCall { readApi.myListings(status, limit, offset) }
    }
