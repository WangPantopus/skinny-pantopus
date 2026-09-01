package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.models.homes.UpdateHomePrivacyRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path

/** Per-home privacy toggles from `backend/routes/homePrivacy.js`. */
interface HomePrivacyApi {
    /** `GET /api/homes/:id/privacy` — route `backend/routes/homePrivacy.js:81`. */
    @GET("api/homes/{id}/privacy")
    suspend fun getPrivacy(
        @Path("id") homeId: String,
    ): HomePrivacyResponse

    /** `PATCH /api/homes/:id/privacy` — route `backend/routes/homePrivacy.js:110`. */
    @PATCH("api/homes/{id}/privacy")
    suspend fun updatePrivacy(
        @Path("id") homeId: String,
        @Body body: UpdateHomePrivacyRequest,
    ): HomePrivacyResponse
}
