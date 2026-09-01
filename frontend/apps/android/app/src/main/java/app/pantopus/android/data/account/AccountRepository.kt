package app.pantopus.android.data.account

import app.pantopus.android.data.api.models.settings.AuthMethodsResponse
import app.pantopus.android.data.api.models.settings.PasswordUpdateBody
import app.pantopus.android.data.api.models.settings.ResendVerificationBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UsersApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * P8 / T6.2c — account-management surfaces (password, verification,
 * auth methods). Lives apart from `ProfileRepository` because these
 * endpoints sit under Settings, not Profile, and have their own rate
 * limits + audit hooks server-side.
 */
@Singleton
class AccountRepository
    @Inject
    constructor(
        private val api: UsersApi,
    ) {
        /** `GET /api/users/auth-methods` — route `backend/routes/users.js:1739`. */
        suspend fun authMethods(): NetworkResult<AuthMethodsResponse> = safeApiCall { api.authMethods() }

        /** `POST /api/users/password` — route `backend/routes/users.js:1771`. */
        suspend fun updatePassword(body: PasswordUpdateBody): NetworkResult<Unit> = safeApiCall { api.updatePassword(body) }

        /** `POST /api/users/resend-verification` — route
         *  `backend/routes/users.js:3049`. */
        suspend fun resendVerification(email: String): NetworkResult<Unit> =
            safeApiCall {
                api.resendVerification(ResendVerificationBody(email = email))
            }
    }
