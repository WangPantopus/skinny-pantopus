package app.pantopus.android.data.posts

import app.pantopus.android.data.api.models.posts.PostPrecheckRequest
import app.pantopus.android.data.api.models.posts.PostPrecheckResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PostPrecheckApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [PostPrecheckApi] in the [NetworkResult] taxonomy. */
@Singleton
class PostPrecheckRepository
    @Inject
    constructor(
        private val api: PostPrecheckApi,
    ) {
        /** `POST /api/posts/precheck`. */
        suspend fun precheck(request: PostPrecheckRequest): NetworkResult<PostPrecheckResponse> = safeApiCall { api.precheck(request) }
    }
