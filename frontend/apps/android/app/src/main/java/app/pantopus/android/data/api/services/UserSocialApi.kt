package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.users.FollowActionResponse
import app.pantopus.android.data.api.models.users.UserRelationshipDto
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * T3 — the `backend/routes/users.js` social routes the app never called:
 * handle-based profile resolution plus the plain follow graph for an
 * ordinary neighbour (distinct from the persona privacy handshake, which
 * lives under `/api/personas/…`).
 *
 * Kept in its own interface rather than piling onto [UsersApi] so parallel
 * work in the same tree doesn't collide.
 */
interface UserSocialApi {
    /**
     * `GET /api/users/username/:username` — resolve a profile from a handle
     * (`pantopus://u/mariak`). Same response body as
     * `GET /api/users/id/:id`, so both decode into [PublicProfileDto].
     * Route `backend/routes/users.js:3367`.
     */
    @GET("api/users/username/{username}")
    suspend fun publicProfileByUsername(
        @Path("username") username: String,
    ): PublicProfileDto

    /**
     * `POST /api/users/:id/follow` — follow an ordinary user. 400 when
     * already following or following yourself, 403 when blocked or the
     * target is a curator account. Route `backend/routes/users.js:3520`.
     */
    @POST("api/users/{id}/follow")
    suspend fun follow(
        @Path("id") userId: String,
    ): FollowActionResponse

    /**
     * `DELETE /api/users/:id/follow` — unfollow.
     * Route `backend/routes/users.js:3593`.
     */
    @DELETE("api/users/{id}/follow")
    suspend fun unfollow(
        @Path("id") userId: String,
    ): FollowActionResponse

    /**
     * `GET /api/users/:id/relationship` — combined connection + follow
     * status for the profile header.
     * Route `backend/routes/users.js:3685`.
     */
    @GET("api/users/{id}/relationship")
    suspend fun relationship(
        @Path("id") userId: String,
    ): UserRelationshipDto
}
