package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.identity.BridgesEchoResponse
import app.pantopus.android.data.api.models.identity.IdentityCenterResponse
import app.pantopus.android.data.api.models.identity.UpdateBridgesBody
import app.pantopus.android.data.api.models.identity.ViewAsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Identity-center endpoints from `backend/routes/identityCenter.js`.
 * Backend route paths keep the legacy "identity-center" / "bridges"
 * names; UI strings the user sees say "Profiles & Privacy" and
 * "Profile links" per the firewall doc.
 */
interface IdentityCenterApi {
    /** `GET /api/identity-center` — route `backend/routes/identityCenter.js:401`. */
    @GET("api/identity-center")
    suspend fun overview(): IdentityCenterResponse

    /** `PATCH /api/identity-center/bridges/:personaId` — toggle the
     *  "Profile links" preferences. Route
     *  `backend/routes/identityCenter.js:516`. */
    @PATCH("api/identity-center/bridges/{personaId}")
    suspend fun updateBridges(
        @Path("personaId") personaId: String,
        @Body body: UpdateBridgesBody,
    ): BridgesEchoResponse

    /** `GET /api/identity-center/view-as` — privacy preview: render the
     *  signed-in user's profile as a chosen `viewer` would see it. Route
     *  `backend/routes/identityCenter.js:489`. */
    @GET("api/identity-center/view-as")
    suspend fun viewAs(
        @Query("surface") surface: String,
        @Query("viewer") viewer: String,
        @Query("handle") handle: String? = null,
    ): ViewAsResponse
}
