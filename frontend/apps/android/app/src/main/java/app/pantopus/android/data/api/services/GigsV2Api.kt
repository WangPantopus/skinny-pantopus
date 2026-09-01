package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.GigScoredOffersResponse
import app.pantopus.android.data.api.models.gigs.GigShareStatusResponse
import app.pantopus.android.data.api.models.gigs.GigsFeedNearbyTrainsResponse
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The Gigs "v2" routes that nothing native called, kept out of the
 * heavily-shared [GigsApi] because they are mounted from three different
 * routers.
 */
interface GigsV2Api {
    /**
     * `POST /api/gigs/:gigId/share-status` — mints a random token on the
     * gig, stamps `status_share_expires_at` 24h out, and returns
     * `{ share_url, expires_at }`. Caller must be the poster (`user_id`)
     * or the assigned helper (`accepted_by`), otherwise 403.
     *
     * Route `backend/routes/gigsV2.js:244` (mounted at `/api/gigs`,
     * `backend/app.js:310`).
     */
    @POST("api/gigs/{gigId}/share-status")
    suspend fun shareStatus(
        @Path("gigId") gigId: String,
    ): GigShareStatusResponse

    /**
     * `GET /api/v2/gigs/:gigId/offers` — owner-only ranked offers with
     * trust capsules. Non-owners get 403, so callers fall back to
     * `GET /api/gigs/:gigId/bids` on any failure (mirrors RN
     * `gig-v2/[id].tsx:108`).
     *
     * Route `backend/routes/offersV2.js:47` (mounted at `/api/v2`,
     * `backend/app.js:311`).
     */
    @GET("api/v2/gigs/{gigId}/offers")
    suspend fun scoredOffers(
        @Path("gigId") gigId: String,
    ): GigScoredOffersResponse

    /**
     * `GET /api/activities/support-trains/nearby` — published Support
     * Trains inside the radius, for the Tasks feed's All / Support Trains
     * scopes. Declared here (rather than reusing `SupportTrainsApi.nearby`)
     * because the handler forwards the `list_support_trains_nearby` RPC
     * rows verbatim: they are keyed `support_train_id`, which the shared
     * `SupportTrainListItemDto` cannot decode.
     *
     * Route `backend/routes/supportTrains.js:570` (mounted at
     * `/api/activities/support-trains`, `backend/app.js:404`).
     */
    @GET("api/activities/support-trains/nearby")
    suspend fun nearbySupportTrains(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius_meters") radiusMeters: Double? = null,
        @Query("limit") limit: Int = 40,
    ): GigsFeedNearbyTrainsResponse
}
