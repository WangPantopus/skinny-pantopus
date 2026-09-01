package app.pantopus.android.data.businesses

import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.posts.PostCreateResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessPostsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * "Post as this business" — publishes a business-authored post into the
 * neighborhood feed. Injected into `PulseComposeViewModel` so the owner
 * dashboard reuses the shared composer rather than a bespoke one.
 */
@Singleton
open class BusinessPostsRepository
    @Inject
    constructor(
        private val api: BusinessPostsApi,
    ) {
        /**
         * `POST /api/businesses/:businessId/posts` — requires `profile.edit`
         * (owner / admin / editor). Route `backend/routes/businesses.js:4192`.
         */
        open suspend fun createBusinessPost(
            businessId: String,
            body: PostCreateRequest,
        ): NetworkResult<PostCreateResponse> = safeApiCall { api.createBusinessPost(businessId, body) }
    }
