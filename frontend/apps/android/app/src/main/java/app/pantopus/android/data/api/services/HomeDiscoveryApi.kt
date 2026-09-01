package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homediscovery.HomeDiscoverResponse
import app.pantopus.android.data.api.models.homediscovery.HomePublicPreviewResponse
import app.pantopus.android.data.api.models.homediscovery.RequestHouseholdFromOwnerRequest
import app.pantopus.android.data.api.models.homediscovery.RequestHouseholdFromOwnerResponse
import app.pantopus.android.data.api.models.homediscovery.SubmitResidencyClaimRequest
import app.pantopus.android.data.api.models.homediscovery.SubmitResidencyClaimResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * A12.1 Find-or-Add-Home discovery + the two "join an existing home"
 * paths that hang off it. Kept separate from [HomesApi] so the
 * discovery surface can grow without merge contention.
 */
interface HomeDiscoveryApi {
    /**
     * `GET /api/homes/discover?q=&limit=&offset=` — route
     * `backend/routes/home.js:2297`. Searches `public_preview` homes
     * with `privacy_mask_level = normal`. A `q` shorter than 2
     * characters is rejected with a 400.
     */
    @GET("api/homes/discover")
    suspend fun discover(
        @Query("q") query: String,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
    ): HomeDiscoverResponse

    /**
     * `GET /api/homes/:id/public-profile` — route
     * `backend/routes/home.js:2443`. Carries `has_verified_owner` and
     * `is_member`, the two flags the claim-start method picker needs.
     */
    @GET("api/homes/{id}/public-profile")
    suspend fun publicPreview(
        @Path("id") homeId: String,
    ): HomePublicPreviewResponse

    /**
     * `POST /api/homes/:id/request-household-from-owner` — route
     * `backend/routes/home.js:2561`. Notifies verified owner(s) that a
     * non-member wants to be added to the household.
     */
    @POST("api/homes/{id}/request-household-from-owner")
    suspend fun requestHouseholdFromOwner(
        @Path("id") homeId: String,
        @Body body: RequestHouseholdFromOwnerRequest,
    ): RequestHouseholdFromOwnerResponse

    /**
     * `POST /api/homes/:id/claim` — route `backend/routes/home.js:6479`.
     * Provisional residency claim against an existing home instead of
     * creating a duplicate `Home` row.
     *
     * The parity doc calls this `/:id/residency-claims`; that path does
     * not exist — `/:id/claim` is the real route.
     */
    @POST("api/homes/{id}/claim")
    suspend fun submitResidencyClaim(
        @Path("id") homeId: String,
        @Body body: SubmitResidencyClaimRequest,
    ): SubmitResidencyClaimResponse
}
