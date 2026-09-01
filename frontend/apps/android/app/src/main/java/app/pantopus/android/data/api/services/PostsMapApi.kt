@file:Suppress("LongParameterList")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.postsmap.PostsMapResponse
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Multi-layer viewport marker route from `backend/routes/posts.js`.
 *
 * Kept out of [PostsApi] so the Pulse map mode and the Explore map share
 * one narrow interface (and so sibling feature work doesn't collide on
 * the large posts service file).
 */
interface PostsMapApi {
    /**
     * `GET /api/posts/map` — route `backend/routes/posts.js:1646`.
     *
     * All four bounding-box params are required; the handler 400s without
     * them. `layers` is a comma-separated subset of
     * `posts,tasks,offers,businesses,homes` and defaults to `posts`
     * server-side. `postType` and `surface` only narrow the `posts` layer.
     */
    @GET("api/posts/map")
    suspend fun markers(
        @Query("south") south: Double,
        @Query("west") west: Double,
        @Query("north") north: Double,
        @Query("east") east: Double,
        @Query("layers") layers: String? = null,
        @Query("postType") postType: String? = null,
        @Query("surface") surface: String? = null,
        @Query("limit") limit: Int = 200,
    ): PostsMapResponse
}
