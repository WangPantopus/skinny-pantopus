package app.pantopus.android.data.posts

import app.pantopus.android.data.api.models.posts.MatchedBusinessesResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MatchedBusinessesApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [MatchedBusinessesApi] in the [NetworkResult] taxonomy. */
@Singleton
class MatchedBusinessesRepository
    @Inject
    constructor(
        private val api: MatchedBusinessesApi,
    ) {
        /** `GET /api/posts/:id/matched-businesses?cached=true`. */
        suspend fun matchedBusinesses(postId: String): NetworkResult<MatchedBusinessesResponse> =
            safeApiCall { api.matchedBusinesses(postId) }
    }
