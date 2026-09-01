package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.handshake.FanHandleSuggestionResponse
import app.pantopus.android.data.api.models.handshake.FollowPreferencesBody
import app.pantopus.android.data.api.models.handshake.FollowPreferencesResponse
import app.pantopus.android.data.api.models.handshake.FollowStatusResponse
import app.pantopus.android.data.api.models.handshake.HandshakeBody
import app.pantopus.android.data.api.models.handshake.HandshakeSubmitResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Privacy Handshake — backed by the existing persona / follow / tier
 * routes. The POST returns either an active free Follower membership
 * (tier 1) or `{requiresPayment, subscribeUrl}` for a Stripe Checkout
 * URL (tier > 1) — see `backend/routes/personas.js:1474`.
 */
interface PrivacyHandshakeApi {
    /** `GET /api/personas/:handle` — visitor-side persona summary.
     *  Route `backend/routes/personas.js:1028`. */
    @GET("api/personas/{handle}")
    suspend fun persona(
        @Path("handle") handle: String,
    ): PersonaMeResponse

    /** `GET /api/personas/:handle/tiers` — public tier ladder. */
    @GET("api/personas/{handle}/tiers")
    suspend fun tiers(
        @Path("handle") handle: String,
    ): PersonaTiersResponse

    /** `GET /api/personas/:handle/fan-handle-suggestion` — random or
     *  bound fan handle suggestion. */
    @GET("api/personas/{handle}/fan-handle-suggestion")
    suspend fun fanHandleSuggestion(
        @Path("handle") handle: String,
    ): FanHandleSuggestionResponse

    /** `GET /api/personas/:id/follow/status` — short-circuit for the
     *  return-visitor-already-member frame. */
    @GET("api/personas/{id}/follow/status")
    suspend fun followStatus(
        @Path("id") personaId: String,
    ): FollowStatusResponse

    /** `POST /api/personas/:id/follow` — handshake submit.
     *  `Response<HandshakeSubmitResponse>` so the repository can
     *  surface 400/409 codes via the error body. */
    @POST("api/personas/{id}/follow")
    suspend fun submit(
        @Path("id") personaId: String,
        @Body body: HandshakeBody,
    ): Response<HandshakeSubmitResponse>

    /** `PATCH /api/personas/:id/follow/preferences` — notification
     *  preferences after a successful free follow. */
    @PATCH("api/personas/{id}/follow/preferences")
    suspend fun updatePreferences(
        @Path("id") personaId: String,
        @Body body: FollowPreferencesBody,
    ): FollowPreferencesResponse
}
