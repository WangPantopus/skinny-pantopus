package app.pantopus.android.data.api.services

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
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Listings endpoints from `backend/routes/listings.js`. T2.4 wired
 * in-bounds for the Nearby map; T2.5 adds browse / nearby / categories
 * / save for the Marketplace tab.
 */
@Suppress("LongParameterList")
interface ListingsReadApi {
    /** `GET /api/listings/browse` — paginated browse with bbox filter. */
    @GET("api/listings/browse")
    suspend fun browse(
        @Query("south") south: Double,
        @Query("west") west: Double,
        @Query("north") north: Double,
        @Query("east") east: Double,
        @Query("category") category: String? = null,
        @Query("layer") layer: String? = null,
        @Query("is_free") isFree: Boolean? = null,
        @Query("min_price") minPrice: Double? = null,
        @Query("max_price") maxPrice: Double? = null,
        @Query("condition") condition: String? = null,
        @Query("search") search: String? = null,
        @Query("sort") sort: String = "newest",
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 30,
        @Query("ref_lat") refLat: Double? = null,
        @Query("ref_lng") refLng: Double? = null,
    ): ListingsBrowseResponse

    /** `GET /api/listings/nearby` — radius search around lat/lng. */
    @GET("api/listings/nearby")
    suspend fun nearby(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radiusMiles") radiusMiles: Double? = null,
        @Query("radius") radiusMeters: Int? = null,
        @Query("category") category: String? = null,
        @Query("layer") layer: String? = null,
        @Query("isFree") isFree: Boolean? = null,
        @Query("condition") condition: String? = null,
        @Query("minPrice") minPrice: Double? = null,
        @Query("maxPrice") maxPrice: Double? = null,
        @Query("search") search: String? = null,
        @Query("sort") sort: String = "newest",
        @Query("limit") limit: Int = 30,
        @Query("offset") offset: Int = 0,
    ): ListingsNearbyResponse

    /** `GET /api/listings/in-bounds` — map-viewport pins (T2.4). */
    @GET("api/listings/in-bounds")
    suspend fun inBounds(
        @Query("south") south: Double,
        @Query("west") west: Double,
        @Query("north") north: Double,
        @Query("east") east: Double,
        @Query("category") category: String? = null,
        @Query("layer") layer: String? = null,
        @Query("limit") limit: Int = 100,
    ): ListingsInBoundsResponse

    /**
     * `GET /api/listings/me` — the current user's own listings.
     * Route `backend/routes/listings.js:1058`. Optional `status` filter
     * matches the backend's `Listing.status` enum:
     * `draft / active / pending_pickup / sold / archived`.
     */
    @GET("api/listings/me")
    suspend fun myListings(
        @Query("status") status: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
    ): MyListingsResponse

    /** `GET /api/listings/categories` — backend's canonical enums. */
    @GET("api/listings/categories")
    suspend fun categories(): ListingsCategoriesResponse

    /** `GET /api/listings/:id` — single-listing detail wrapper. */
    @GET("api/listings/{id}")
    suspend fun detail(
        @Path("id") id: String,
    ): ListingDetailResponse
}

interface ListingsMutationApi {
    /** `POST /api/listings` — create a new listing. Route `backend/routes/listings.js:426`. */
    @POST("api/listings")
    suspend fun create(
        @Body body: CreateListingRequest,
    ): CreateListingResponse

    /** `PATCH /api/listings/:id` — owner-only update. Route `backend/routes/listings.js:1479`. */
    @PATCH("api/listings/{id}")
    suspend fun update(
        @Path("id") id: String,
        @Body body: UpdateListingRequest,
    ): UpdateListingResponse

    /** `POST /api/listings/:id/save` — bookmark. */
    @POST("api/listings/{id}/save")
    suspend fun save(
        @Path("id") id: String,
    ): ListingSaveResponse

    /** `DELETE /api/listings/:id/save` — un-bookmark. */
    @DELETE("api/listings/{id}/save")
    suspend fun unsave(
        @Path("id") id: String,
    ): ListingSaveResponse

    /** `POST /api/listings/:id/message` — buyer → seller message / offer. */
    @POST("api/listings/{id}/message")
    suspend fun messageListing(
        @Path("id") id: String,
        @Body body: MessageListingBody,
    ): MessageListingResponse
}
