package app.pantopus.android.data.professional

import app.pantopus.android.data.api.models.professional.ProfessionalEnableRequest
import app.pantopus.android.data.api.models.professional.ProfessionalProfileResponse
import app.pantopus.android.data.api.models.professional.ProfessionalProfileUpdateRequest
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStartRequest
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStartResponse
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStatusResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ProfessionalApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [ProfessionalApi] in the [NetworkResult] taxonomy. */
@Singleton
class ProfessionalRepository
    @Inject
    constructor(
        private val api: ProfessionalApi,
    ) {
        /** `GET /api/professional/profile/me`. */
        suspend fun profileMe(): NetworkResult<ProfessionalProfileResponse> = safeApiCall { api.profileMe() }

        /** `GET /api/professional/verification/status`. */
        suspend fun verificationStatus(): NetworkResult<ProfessionalVerificationStatusResponse> = safeApiCall { api.verificationStatus() }

        /** `PATCH /api/professional/profile/me`. */
        suspend fun updateProfileMe(body: ProfessionalProfileUpdateRequest): NetworkResult<ProfessionalProfileResponse> =
            safeApiCall { api.updateProfileMe(body) }

        /** `POST /api/professional/profile` — enable professional mode. */
        suspend fun createProfile(body: ProfessionalEnableRequest): NetworkResult<ProfessionalProfileResponse> =
            safeApiCall { api.createProfile(body) }

        /** `DELETE /api/professional/profile/me` — disable professional mode. */
        suspend fun disableProfile(): NetworkResult<ProfessionalProfileResponse> = safeApiCall { api.disableProfile() }

        /** `POST /api/professional/verification/start` — route `professional.js:310`. */
        suspend fun startVerification(tier: Int): NetworkResult<ProfessionalVerificationStartResponse> =
            safeApiCall { api.startVerification(ProfessionalVerificationStartRequest(tier = tier)) }
    }
