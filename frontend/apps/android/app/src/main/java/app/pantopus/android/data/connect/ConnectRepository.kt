package app.pantopus.android.data.connect

import app.pantopus.android.data.api.models.connect.ConnectAccountStatusResponse
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountRequest
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountResponse
import app.pantopus.android.data.api.models.connect.ConnectDashboardResponse
import app.pantopus.android.data.api.models.connect.ConnectOnboardingRequest
import app.pantopus.android.data.api.models.connect.ConnectOnboardingResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ConnectApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the Stripe Connect [ConnectApi] in the [NetworkResult] taxonomy (Block 3C). */
@Singleton
class ConnectRepository
    @Inject
    constructor(
        private val api: ConnectApi,
    ) {
        /** `POST /api/payments/connect/account` — create/ensure the connected account. */
        suspend fun createAccount(): NetworkResult<ConnectCreateAccountResponse> =
            safeApiCall { api.createAccount(ConnectCreateAccountRequest()) }

        /** `POST /api/payments/connect/onboarding` — Stripe-hosted Account Link URL. */
        suspend fun onboarding(): NetworkResult<ConnectOnboardingResponse> = safeApiCall { api.onboarding(ConnectOnboardingRequest()) }

        /** `GET /api/payments/connect/account` — onboarding / payouts-enabled status. */
        suspend fun accountStatus(): NetworkResult<ConnectAccountStatusResponse> = safeApiCall { api.accountStatus() }

        /** `POST /api/payments/connect/dashboard` — Express dashboard login link. */
        suspend fun dashboard(): NetworkResult<ConnectDashboardResponse> = safeApiCall { api.dashboard() }
    }
