package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.posts.MatchedBusinessesResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * "Nearby Providers" on Pulse post detail — the organically matched local
 * businesses the backend ranks for a post's `service_category`. Kept in its
 * own interface rather than piled into the heavily-shared `PostsApi`.
 */
interface MatchedBusinessesApi {
    /**
     * `GET /api/posts/:id/matched-businesses` — organically matched local
     * businesses for a post. Never paid placement: the backend ranks by
     * proximity, neighbor trust, and rating in `jobs/organicMatch.js`, caps
     * the list at 5, suppresses posts older than 30 days, and returns an empty
     * array when the post has no `service_category`.
     *
     * `cached=true` returns the pre-computed snapshot (top 3), the only
     * variant carrying `distance_miles`, `neighbor_count`, and
     * `is_new_business` — the three fields the card renders.
     * Route `backend/routes/posts.js:2550`.
     */
    @GET("api/posts/{postId}/matched-businesses")
    suspend fun matchedBusinesses(
        @Path("postId") postId: String,
        @Query("cached") cached: Boolean = true,
    ): MatchedBusinessesResponse
}
