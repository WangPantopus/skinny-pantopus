package app.pantopus.android.data.account

import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AccountDeletionApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * T1 — the one irreversible account action. Separate from
 * [AccountRepository] so the destructive route has a single, obvious
 * owner and call sites can't reach it by accident.
 */
@Singleton
class AccountDeletionRepository
    @Inject
    constructor(
        private val api: AccountDeletionApi,
    ) {
        /**
         * `DELETE /api/users/account` — route `backend/routes/users.js:3945`.
         *
         * Callers must have obtained a `delete_account` step-up token first
         * (see `core/security/StepUpCoordinator`) — it rides on `X-Step-Up`
         * — and must erase local state on success. A
         * `NetworkError.ClientError(409, …)` carries the backend's "finish
         * your gigs / settle your payments" copy.
         */
        suspend fun deleteAccount(stepUpToken: String? = null): NetworkResult<Unit> = safeApiCall { api.deleteAccount(stepUpToken) }
    }
