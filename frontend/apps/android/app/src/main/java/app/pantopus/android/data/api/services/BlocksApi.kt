package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.settings.UserBlocksResponse
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Block/unblock endpoints from `backend/routes/blocks.js`. The router is
 * mounted at `/api/users` (see `backend/app.js:305`), so the concrete
 * paths are `/api/users/:userId/block` and `/api/users/blocked`.
 */
interface BlocksApi {
    /**
     * `POST /api/users/:userId/block` — block another user.
     * Route `backend/routes/blocks.js:13`.
     */
    @POST("api/users/{userId}/block")
    suspend fun block(
        @Path("userId") userId: String,
    ): Unit

    /**
     * `DELETE /api/users/:userId/block` — unblock a user.
     * Route `backend/routes/blocks.js:101`.
     */
    @DELETE("api/users/{userId}/block")
    suspend fun unblock(
        @Path("userId") userId: String,
    ): Unit

    /**
     * `GET /api/users/blocked` — the viewer's own personal blocks.
     * Route `backend/routes/blocks.js:138`. Mounted before `userRoutes`
     * (`backend/app.js:346`) so `/blocked` is not captured by the
     * `/:username` profile route.
     */
    @GET("api/users/blocked")
    suspend fun blocked(): UserBlocksResponse
}
