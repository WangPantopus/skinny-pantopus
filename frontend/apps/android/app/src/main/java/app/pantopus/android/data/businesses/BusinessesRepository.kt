package app.pantopus.android.data.businesses

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
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessesApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the `/api/businesses` owner / staff endpoints in the
 *  [NetworkResult] taxonomy. */
@Singleton
open class BusinessesRepository
    @Inject
    constructor(
        private val api: BusinessesApi,
    ) {
        /** T6.3f / P14 — backs My businesses. Owner + staff seats. */
        open suspend fun myBusinesses(): NetworkResult<MyBusinessesResponse> = safeApiCall { api.myBusinesses() }

        /** P1.6 — backs the Business Profile detail fetch. */
        open suspend fun business(businessId: String): NetworkResult<BusinessDetailResponse> = safeApiCall { api.business(businessId) }

        /** P1.6 — best-effort public payload used to fold hours + catalog
         *  into the Business Profile screen. Callers expect this to
         *  fail silently for unpublished businesses. */
        open suspend fun publicBusiness(username: String): NetworkResult<BusinessPublicResponse> =
            safeApiCall { api.publicBusiness(username) }

        /** A13.10 — owner/staff catalog list. Answers before the profile is
         *  published, unlike [publicBusiness]. */
        open suspend fun catalogItems(businessId: String): NetworkResult<BusinessCatalogItemsResponse> =
            safeApiCall { api.catalogItems(businessId) }

        /** P1-C — owner-scoped dashboard (publish state + onboarding). */
        open suspend fun dashboard(businessId: String): NetworkResult<BusinessDashboardResponse> = safeApiCall { api.dashboard(businessId) }

        /** P1-C — owner analytics behind the "This week" tiles. */
        open suspend fun insights(
            businessId: String,
            period: String = "30d",
        ): NetworkResult<BusinessInsightsResponse> = safeApiCall { api.insights(businessId, period) }

        /** P1-C — owner reviews list behind the reply composer. */
        open suspend fun reviews(businessId: String): NetworkResult<BusinessOwnerReviewsResponse> = safeApiCall { api.reviews(businessId) }

        /** P1-C — save / update the owner's reply on a review. */
        open suspend fun respondToReview(
            businessId: String,
            reviewId: String,
            response: String,
        ): NetworkResult<Unit> = safeApiCall { api.respondToReview(businessId, reviewId, BusinessReviewRespondRequest(response)) }

        /** P1.6 — save/follow a public business profile. */
        open suspend fun followBusiness(businessId: String): NetworkResult<BusinessFollowResponse> = safeApiCall { api.follow(businessId) }

        /** Open (or resume) a direct inquiry chat with a business. */
        open suspend fun startInquiry(
            businessId: String,
            subject: String? = null,
        ): NetworkResult<StartBusinessInquiryResponse> = safeApiCall { api.startInquiry(businessId, StartBusinessInquiryRequest(subject)) }

        /** Owner/staff list of active business locations. */
        open suspend fun locations(businessId: String): NetworkResult<BusinessLocationsResponse> = safeApiCall { api.locations(businessId) }

        /** A13.10 — PATCH profile fields for the edit-business page. */
        open suspend fun updateBusiness(
            businessId: String,
            body: UpdateBusinessRequest,
        ): NetworkResult<BusinessMutationMessageResponse> = safeApiCall { api.updateBusiness(businessId, body) }

        /** A13.10 — publish profile. */
        open suspend fun publishBusiness(businessId: String): NetworkResult<BusinessMutationMessageResponse> =
            safeApiCall { api.publishBusiness(businessId) }

        /** A13.10 — load weekly hours for a location. */
        open suspend fun locationHours(
            businessId: String,
            locationId: String,
        ): NetworkResult<BusinessLocationHoursResponse> = safeApiCall { api.locationHours(businessId, locationId) }

        /** A13.10 — bulk replace weekly hours. */
        open suspend fun setLocationHours(
            businessId: String,
            locationId: String,
            body: SetBusinessHoursRequest,
        ): NetworkResult<BusinessLocationHoursResponse> = safeApiCall { api.setLocationHours(businessId, locationId, body) }

        /** A13.10 — PATCH a location row (address). */
        open suspend fun updateLocation(
            businessId: String,
            locationId: String,
            body: UpdateBusinessLocationRequest,
        ): NetworkResult<BusinessLocationUpdateResponse> = safeApiCall { api.updateLocation(businessId, locationId, body) }

        /** Create-business wizard — username availability (no auth). */
        open suspend fun checkUsername(username: String): NetworkResult<UsernameAvailabilityDto> =
            safeApiCall { api.checkUsername(username) }

        /** Create-business wizard — atomic create with optional location + hours. */
        open suspend fun createBusinessFull(body: CreateBusinessFullRequest): NetworkResult<CreateBusinessFullResponse> =
            safeApiCall { api.createBusinessFull(body) }
    }
