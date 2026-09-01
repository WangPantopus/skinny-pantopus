package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.posts.PostPrecheckRequest
import app.pantopus.android.data.api.models.posts.PostPrecheckResponse
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Pre-post safety precheck. Kept out of `PostsApi` so parallel work on
 * the feed routes doesn't collide.
 */
interface PostPrecheckApi {
    /**
     * `POST /api/posts/precheck` — runs the cooldown / tone / callout /
     * politics / visitor heuristics against a draft before it is
     * submitted. The handler always fails open (`canPost: true`) on an
     * internal error, so a transport failure must never block posting.
     * Route `backend/routes/posts.js:707`.
     */
    @POST("api/posts/precheck")
    suspend fun precheck(
        @Body body: PostPrecheckRequest,
    ): PostPrecheckResponse
}
