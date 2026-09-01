package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.audience.PersonaCategoryPoliciesResponse
import app.pantopus.android.data.api.models.audience.PersonaWriteBody
import app.pantopus.android.data.api.models.audience.PersonaWriteResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Beacon (persona) create + edit. Split from [AudienceProfileApi] (the
 * read-side owner dashboard) so the write path owns its own bodies.
 *
 * The whole persona router is feature-gated behind `isPersonaEnabled()` in
 * `backend/app.js:359`; every route below 404s when the flag is off.
 */
interface PersonaEditApi {
    /**
     * Create the signed-in user's Beacon. 201 with `{ persona, channel }`;
     * 400 when the account already has an active Beacon, 409 when the handle
     * is taken. Route `backend/routes/personas.js:271`.
     */
    @POST("api/personas")
    suspend fun createPersona(
        @Body body: PersonaWriteBody,
    ): PersonaWriteResponse

    /**
     * Update an owned Beacon. 200 with `{ persona }`; 403 when the caller
     * doesn't own it, 409 on a handle conflict.
     * Route `backend/routes/personas.js:850`.
     */
    @PATCH("api/personas/{id}")
    suspend fun updatePersona(
        @Path("id") personaId: String,
        @Body body: PersonaWriteBody,
    ): PersonaWriteResponse

    /**
     * Category policy ladder — which categories are selectable and which are
     * gated behind credential verification.
     * Route `backend/routes/personas.js:404`.
     */
    @GET("api/personas/compliance/categories")
    suspend fun categoryPolicies(): PersonaCategoryPoliciesResponse
}
