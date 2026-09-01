package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.beacon.BeaconActionEcho
import app.pantopus.android.data.api.models.beacon.BeaconFollowPreferencesBody
import app.pantopus.android.data.api.models.beacon.BeaconPersonaResponse
import app.pantopus.android.data.api.models.beacon.BeaconPostsResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path

/**
 * A21.1 — the public Beacon profile, driven by the persona backend. One
 * persona shape serves both the owner ("My Beacon", `me`) and visitor
 * (`{handle}`) roles. Mirrors iOS — same endpoints the
 * `AudienceProfileEndpoints` / `PrivacyHandshakeEndpoints` declare.
 */
interface BeaconProfileApi {
    /** `GET /api/personas/me` — owner persona + primary channel.
     *  Route `backend/routes/personas.js:367`. */
    @GET("api/personas/me")
    suspend fun me(): BeaconPersonaResponse

    /** `GET /api/personas/:handle` — visitor persona view (carries `viewer`).
     *  Route `backend/routes/personas.js:1028`. */
    @GET("api/personas/{handle}")
    suspend fun persona(
        @Path("handle") handle: String,
    ): BeaconPersonaResponse

    /** `GET /api/personas/:handle/posts` — recent broadcasts.
     *  Route `backend/routes/personas.js:1046`. */
    @GET("api/personas/{handle}/posts")
    suspend fun posts(
        @Path("handle") handle: String,
    ): BeaconPostsResponse

    /** `GET /api/personas/:handle/tiers` — tier ladder.
     *  Route `backend/routes/personas.js:1111`. */
    @GET("api/personas/{handle}/tiers")
    suspend fun tiers(
        @Path("handle") handle: String,
    ): PersonaTiersResponse

    /** `DELETE /api/personas/:id/follow` — unfollow a Beacon.
     *  Route `backend/routes/personas.js:1692`. */
    @DELETE("api/personas/{personaId}/follow")
    suspend fun unfollow(
        @Path("personaId") personaId: String,
    ): BeaconActionEcho

    /** `PATCH /api/personas/:id/follow/preferences` — notification level.
     *  Route `backend/routes/personas.js:1743`. */
    @PATCH("api/personas/{personaId}/follow/preferences")
    suspend fun updatePreferences(
        @Path("personaId") personaId: String,
        @Body body: BeaconFollowPreferencesBody,
    ): BeaconActionEcho
}
