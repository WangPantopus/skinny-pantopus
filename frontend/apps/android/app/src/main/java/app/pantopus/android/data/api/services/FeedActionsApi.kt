package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.feed.FeedActionAckResponse
import app.pantopus.android.data.api.models.feed.FeedMuteRequest
import app.pantopus.android.data.api.models.feed.FeedMuteTopicRequest
import app.pantopus.android.data.api.models.feed.FeedNotHelpfulRequest
import app.pantopus.android.data.api.models.feed.FeedNotHelpfulResponse
import app.pantopus.android.data.api.models.feed.FeedPreferencesResponse
import app.pantopus.android.data.api.models.feed.FeedPreferencesUpdateRequest
import app.pantopus.android.data.api.models.feed.FeedSeededDismissResponse
import app.pantopus.android.data.api.models.feed.FeedSolveResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Feed-row moderation + feed-preference routes from
 * `backend/routes/posts.js`. Kept apart from `PostsApi` because the Pulse
 * card overflow menu and the Pulse preferences sheet own this whole
 * cluster (hide / mute / not-helpful / solve / seeded-dismiss / prefs).
 */
interface FeedActionsApi {
    /**
     * `POST /api/posts/hide/:id` — hides a single post from the signed-in
     * viewer's feed. Route `backend/routes/posts.js:2094`.
     */
    @POST("api/posts/hide/{id}")
    suspend fun hidePost(
        @Path("id") id: String,
    ): FeedActionAckResponse

    /**
     * `POST /api/posts/mute` — mutes a user or a business across every
     * feed surface. Route `backend/routes/posts.js:2117`.
     */
    @POST("api/posts/mute")
    suspend fun mute(
        @Body body: FeedMuteRequest,
    ): FeedActionAckResponse

    /**
     * `DELETE /api/posts/mute` — reverses [mute]. The handler reads the
     * body, so the request has to carry one. Route
     * `backend/routes/posts.js:2147`.
     */
    @HTTP(method = "DELETE", path = "api/posts/mute", hasBody = true)
    suspend fun unmute(
        @Body body: FeedMuteRequest,
    ): FeedActionAckResponse

    /**
     * `POST /api/posts/mute/topic` — mutes a post type, optionally scoped
     * to one surface. Route `backend/routes/posts.js:2328`.
     */
    @POST("api/posts/mute/topic")
    suspend fun muteTopic(
        @Body body: FeedMuteTopicRequest,
    ): FeedActionAckResponse

    /**
     * `POST /api/posts/:id/not-helpful` — community "this isn't useful
     * here" signal; the surface is normalised server-side to
     * `nearby` / `connections`. Route `backend/routes/posts.js:3191`.
     */
    @POST("api/posts/{id}/not-helpful")
    suspend fun notHelpful(
        @Path("id") id: String,
        @Body body: FeedNotHelpfulRequest,
    ): FeedNotHelpfulResponse

    /**
     * `PATCH /api/posts/:id/solve` — author-only; marks an Ask post
     * solved. Route `backend/routes/posts.js:3245`.
     */
    @PATCH("api/posts/{id}/solve")
    suspend fun solve(
        @Path("id") id: String,
    ): FeedSolveResponse

    /**
     * `POST /api/posts/seeded/:factId/dismiss` — drops a cold-start
     * neighborhood fact from this viewer's feed forever. Route
     * `backend/routes/posts.js:3309`.
     */
    @POST("api/posts/seeded/{factId}/dismiss")
    suspend fun dismissSeededFact(
        @Path("factId") factId: String,
    ): FeedSeededDismissResponse

    /**
     * `GET /api/posts/feed-preferences` — hide-deals / hide-alerts /
     * politics toggles. Route `backend/routes/posts.js:2257`.
     */
    @GET("api/posts/feed-preferences")
    suspend fun feedPreferences(): FeedPreferencesResponse

    /**
     * `PUT /api/posts/feed-preferences` — partial update; only the keys
     * present in the body are written. Route
     * `backend/routes/posts.js:2286`.
     */
    @PUT("api/posts/feed-preferences")
    suspend fun updateFeedPreferences(
        @Body body: FeedPreferencesUpdateRequest,
    ): FeedPreferencesResponse
}
