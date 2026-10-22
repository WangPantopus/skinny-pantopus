package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.posts.BeforeYouAskResponse
import app.pantopus.android.data.api.models.posts.PostPrecheckRequest
import app.pantopus.android.data.api.models.posts.PostPrecheckResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

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

    /**
     * `GET /api/posts/before-you-ask` — "Before you ask": up to 3 earlier
     * questions and recommendations nearby matching the question being
     * written, each with its best reply (AI phase 2 contract §6.5).
     * Route `backend/routes/posts.js` `GET /before-you-ask`.
     */
    @GET("api/posts/before-you-ask")
    suspend fun beforeYouAsk(
        @Query("q") query: String,
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null,
    ): BeforeYouAskResponse
}
