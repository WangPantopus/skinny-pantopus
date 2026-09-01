package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemsResponse
import app.pantopus.android.data.api.models.businesses.BusinessDashboardResponse
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessFollowResponse
import app.pantopus.android.data.api.models.businesses.BusinessInsightsResponse
import app.pantopus.android.data.api.models.businesses.BusinessLocationHoursResponse
import app.pantopus.android.data.api.models.businesses.BusinessLocationUpdateResponse
import app.pantopus.android.data.api.models.businesses.BusinessLocationsResponse
import app.pantopus.android.data.api.models.businesses.BusinessMutationMessageResponse
import app.pantopus.android.data.api.models.businesses.BusinessOwnerReviewsResponse
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businesses.BusinessReviewRespondRequest
import app.pantopus.android.data.api.models.businesses.CreateBusinessFullRequest
import app.pantopus.android.data.api.models.businesses.CreateBusinessFullResponse
import app.pantopus.android.data.api.models.businesses.MyBusinessesResponse
import app.pantopus.android.data.api.models.businesses.SetBusinessHoursRequest
import app.pantopus.android.data.api.models.businesses.StartBusinessInquiryRequest
import app.pantopus.android.data.api.models.businesses.StartBusinessInquiryResponse
import app.pantopus.android.data.api.models.businesses.UpdateBusinessLocationRequest
import app.pantopus.android.data.api.models.businesses.UpdateBusinessRequest
import app.pantopus.android.data.api.models.businesses.UsernameAvailabilityDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Owner / staff endpoints under the `/api/businesses/` namespace. Distinct from
 * [BusinessDiscoveryApi] which covers public search / nearby.
 *
 * T6.3f / P14 — `myBusinesses()` backs the My businesses screen.
 * P1.6 — `business()` + `publicBusiness()` back the Business Profile screen.
 *
 * The visitor, location, and review routes live on [BusinessVisitorApi] /
 * [BusinessLocationsApi] / [BusinessReviewsApi] so each interface stays one
 * cohesive surface; callers (and `NetworkModule`) keep depending on this one
 * type.
 */
interface BusinessesApi :
    BusinessVisitorApi,
    BusinessLocationsApi,
    BusinessReviewsApi {
    /**
     * `GET /api/businesses/my-businesses` — every business the current
     * user owns or staffs (via BusinessSeat or legacy BusinessTeam).
     * Route `backend/routes/businesses.js:682`.
     */
    @GET("api/businesses/my-businesses")
    suspend fun myBusinesses(): MyBusinessesResponse

    /**
     * `GET /api/businesses/:businessId` — authenticated detail fetch.
     * Returns `business + profile + locations + access`. The `access`
     * block tells the caller whether the viewer owns / staffs the
     * business; for a non-owning viewer the rest of the response still
     * renders. Route `backend/routes/businesses.js:912`.
     */
    @GET("api/businesses/{businessId}")
    suspend fun business(
        @Path("businessId") businessId: String,
    ): BusinessDetailResponse

    /**
     * `GET /api/businesses/:businessId/dashboard` — the owner-scoped fetch:
     * publish state, edit recency, and the onboarding checklist behind the
     * owner dashboard's profile-strength card. 403s for a viewer with no
     * access. Route `backend/routes/businesses.js:979`.
     */
    @GET("api/businesses/{businessId}/dashboard")
    suspend fun dashboard(
        @Path("businessId") businessId: String,
    ): BusinessDashboardResponse

    /**
     * `GET /api/businesses/:businessId/catalog/items` — the owner/staff
     * catalog list (requires `catalog.view`). Unlike [publicBusiness] this
     * answers before the profile is published, so the editor's setup
     * checklist can tick "Services" on a never-published business.
     * Route `backend/routes/businesses.js:2386`.
     */
    @GET("api/businesses/{businessId}/catalog/items")
    suspend fun catalogItems(
        @Path("businessId") businessId: String,
    ): BusinessCatalogItemsResponse

    /**
     * `GET /api/businesses/:businessId/insights` — owner analytics (views /
     * followers / reviews + week-over-week trends) behind the dashboard's
     * "This week" tiles. `period` is `7d | 30d | 90d`. Route
     * `backend/routes/businesses.js:3915`.
     */
    @GET("api/businesses/{businessId}/insights")
    suspend fun insights(
        @Path("businessId") businessId: String,
        @Query("period") period: String = "30d",
    ): BusinessInsightsResponse

    /**
     * `PATCH /api/businesses/:businessId` — update business profile fields.
     * Route `backend/routes/businesses.js:1134`.
     */
    @PATCH("api/businesses/{businessId}")
    suspend fun updateBusiness(
        @Path("businessId") businessId: String,
        @Body body: UpdateBusinessRequest,
    ): BusinessMutationMessageResponse

    /**
     * `POST /api/businesses/:businessId/publish` — publish the business
     * profile. Route `backend/routes/businesses.js:1350`.
     */
    @POST("api/businesses/{businessId}/publish")
    suspend fun publishBusiness(
        @Path("businessId") businessId: String,
    ): BusinessMutationMessageResponse

    /**
     * `GET /api/businesses/check-username` — username availability check
     * (no auth). Returns `{ available, reason? }`.
     * Route `backend/routes/businesses.js:358`.
     */
    @GET("api/businesses/check-username")
    suspend fun checkUsername(
        @Query("username") username: String,
    ): UsernameAvailabilityDto

    /**
     * `POST /api/businesses/create-full` — atomic create with optional
     * location + hours. Route `backend/routes/businesses.js:554`.
     */
    @POST("api/businesses/create-full")
    suspend fun createBusinessFull(
        @Body body: CreateBusinessFullRequest,
    ): CreateBusinessFullResponse
}

/**
 * Visitor-side routes: the public profile fetch plus the two things a
 * non-owner can do with a business (follow it, open an inquiry chat).
 * Inherited by [BusinessesApi].
 */
interface BusinessVisitorApi {
    /**
     * `GET /api/businesses/public/:username` — unauthenticated public
     * view. Used by the Business Profile screen to fold in `hours` +
     * `catalog` once the username is known from the detail fetch. 404s
     * for unpublished businesses; the repository absorbs that silently.
     * Route `backend/routes/businesses.js:3277`.
     */
    @GET("api/businesses/public/{username}")
    suspend fun publicBusiness(
        @Path("username") username: String,
    ): BusinessPublicResponse

    /**
     * `POST /api/businesses/:businessId/follow` — save/follow a public
     * business. Route `backend/routes/businesses.js:3621`.
     */
    @POST("api/businesses/{businessId}/follow")
    suspend fun follow(
        @Path("businessId") businessId: String,
    ): BusinessFollowResponse

    /**
     * `POST /api/businesses/:businessId/inbox/start` — open (or resume) a
     * direct inquiry chat with a business. Body `{ subject? }`; returns
     * `{ roomId, existing }`. Route `backend/routes/businesses.js:3939`.
     */
    @POST("api/businesses/{businessId}/inbox/start")
    suspend fun startInquiry(
        @Path("businessId") businessId: String,
        @Body body: StartBusinessInquiryRequest,
    ): StartBusinessInquiryResponse
}

/**
 * Location + weekly-hours routes under `/api/businesses/:businessId/locations`.
 * Inherited by [BusinessesApi] — Retrofit builds one proxy over the whole
 * hierarchy, so there is still a single `BusinessesApi` binding in DI.
 */
interface BusinessLocationsApi {
    /**
     * `GET /api/businesses/:businessId/locations` — owner/staff list of
     * active locations. Route `backend/routes/businesses.js:1742`.
     */
    @GET("api/businesses/{businessId}/locations")
    suspend fun locations(
        @Path("businessId") businessId: String,
    ): BusinessLocationsResponse

    /**
     * `GET /api/businesses/:businessId/locations/:locationId/hours` —
     * weekly hours for a location. Route `backend/routes/businesses.js:2084`.
     */
    @GET("api/businesses/{businessId}/locations/{locationId}/hours")
    suspend fun locationHours(
        @Path("businessId") businessId: String,
        @Path("locationId") locationId: String,
    ): BusinessLocationHoursResponse

    /**
     * `PUT /api/businesses/:businessId/locations/:locationId/hours` — bulk
     * replace weekly hours. Route `backend/routes/businesses.js:2023`.
     */
    @PUT("api/businesses/{businessId}/locations/{locationId}/hours")
    suspend fun setLocationHours(
        @Path("businessId") businessId: String,
        @Path("locationId") locationId: String,
        @Body body: SetBusinessHoursRequest,
    ): BusinessLocationHoursResponse

    /**
     * `PATCH /api/businesses/:businessId/locations/:locationId` — update a
     * location row. Route `backend/routes/businesses.js:1776`.
     */
    @PATCH("api/businesses/{businessId}/locations/{locationId}")
    suspend fun updateLocation(
        @Path("businessId") businessId: String,
        @Path("locationId") locationId: String,
        @Body body: UpdateBusinessLocationRequest,
    ): BusinessLocationUpdateResponse
}

/**
 * Owner-side review routes under `/api/businesses/:businessId/reviews`.
 * Inherited by [BusinessesApi].
 */
interface BusinessReviewsApi {
    /**
     * `GET /api/businesses/:businessId/reviews` — owner reviews list (enriched
     * with reviewer + gig + any published owner response) behind the reply
     * composer. Route `backend/routes/businesses.js:3441`.
     */
    @GET("api/businesses/{businessId}/reviews")
    suspend fun reviews(
        @Path("businessId") businessId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): BusinessOwnerReviewsResponse

    /**
     * `POST /api/businesses/:businessId/reviews/:reviewId/respond` — save or
     * update the owner's reply on a review. Route
     * `backend/routes/businesses.js:3552`.
     */
    @POST("api/businesses/{businessId}/reviews/{reviewId}/respond")
    suspend fun respondToReview(
        @Path("businessId") businessId: String,
        @Path("reviewId") reviewId: String,
        @Body body: BusinessReviewRespondRequest,
    )
}
