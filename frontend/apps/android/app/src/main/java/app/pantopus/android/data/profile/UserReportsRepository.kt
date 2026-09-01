package app.pantopus.android.data.profile

import app.pantopus.android.data.api.models.profile.UserReportRequest
import app.pantopus.android.data.api.models.profile.UserReportResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UserReportsApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the user-report endpoint in the [NetworkResult] taxonomy. */
@Singleton
class UserReportsRepository
    @Inject
    constructor(
        private val api: UserReportsApi,
    ) {
        /**
         * `POST /api/users/:userId/report` — submit an abuse report. Route
         * `backend/routes/users.js:4153`. The backend returns a 200 with
         * `already_reported = true` if this reporter already filed a report
         * against the target — that's a successful no-op.
         */
        suspend fun report(
            userId: String,
            body: UserReportRequest,
        ): NetworkResult<UserReportResponse> = safeApiCall { api.report(userId, body) }
    }
