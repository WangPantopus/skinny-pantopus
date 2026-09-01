package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.posts.PostCreateResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * "Post as this business" — the owner dashboard's compose affordance.
 *
 * iOS twin: `Core/Networking/Endpoints/BusinessPostsEndpoints.swift`.
 */
interface BusinessPostsApi {
    /**
     * `POST /api/businesses/:businessId/posts` — create a post authored by
     * the business. Requires `profile.edit` (owner / admin / editor); a
     * staff or viewer seat gets a 403.
     *
     * The handler destructures the camelCase keys `content` (required),
     * `title`, `mediaUrls`, `mediaTypes`, `postType`, `visibility`, `tags`,
     * `audience`, `targetPlaceId`, `eventDate`, `eventEndDate`,
     * `eventVenue`, `dealExpiresAt`, `dealBusinessName`, `serviceCategory`,
     * `latitude`, `longitude`, `locationName`, `locationAddress` — a subset
     * of [PostCreateRequest], which is why the shared Pulse compose body is
     * reused verbatim. It sets `business_author_id` / `post_as = business`
     * itself and back-fills coordinates from the primary location.
     *
     * Route `backend/routes/businesses.js:4192`.
     */
    @POST("api/businesses/{businessId}/posts")
    suspend fun createBusinessPost(
        @Path("businessId") businessId: String,
        @Body body: PostCreateRequest,
    ): PostCreateResponse
}
