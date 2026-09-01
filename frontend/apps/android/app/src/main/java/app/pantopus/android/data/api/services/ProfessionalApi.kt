package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.professional.ProfessionalEnableRequest
import app.pantopus.android.data.api.models.professional.ProfessionalProfileResponse
import app.pantopus.android.data.api.models.professional.ProfessionalProfileUpdateRequest
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStartRequest
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStartResponse
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStatusResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST

/** Professional-profile routes from `backend/routes/professional.js`. */
interface ProfessionalApi {
    /** `GET /api/professional/profile/me` — route `professional.js:164`. */
    @GET("api/professional/profile/me")
    suspend fun profileMe(): ProfessionalProfileResponse

    /**
     * `POST /api/professional/profile` — route `professional.js:89`. Turns
     * professional mode on: 201 for a brand-new record, 200 when it
     * re-activates a soft-disabled one, 400 when an active profile already
     * exists.
     */
    @POST("api/professional/profile")
    suspend fun createProfile(
        @Body body: ProfessionalEnableRequest,
    ): ProfessionalProfileResponse

    /**
     * `DELETE /api/professional/profile/me` — route `professional.js:221`.
     * Soft-disable: flips `is_active` + `is_public` to false and returns the
     * updated row, so the record survives for a later re-enable.
     */
    @DELETE("api/professional/profile/me")
    suspend fun disableProfile(): ProfessionalProfileResponse

    /** `PATCH /api/professional/profile/me` — route `professional.js:190`. */
    @PATCH("api/professional/profile/me")
    suspend fun updateProfileMe(
        @Body body: ProfessionalProfileUpdateRequest,
    ): ProfessionalProfileResponse

    /** `GET /api/professional/verification/status` — route `professional.js:372`. */
    @GET("api/professional/verification/status")
    suspend fun verificationStatus(): ProfessionalVerificationStatusResponse

    /**
     * `POST /api/professional/verification/start` — route
     * `professional.js:310`. Moves `verification_status` to `pending` for
     * admin review. Tier must be 1 or 2 (`professional.js:315`); 400 when a
     * review is already running or the tier is already verified, 404 when
     * professional mode is off. Mirrors RN's "Start verification" CTA
     * (`professional.tsx:386`).
     */
    @POST("api/professional/verification/start")
    suspend fun startVerification(
        @Body body: ProfessionalVerificationStartRequest,
    ): ProfessionalVerificationStartResponse
}
