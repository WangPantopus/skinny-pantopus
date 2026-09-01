package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.profile.UserReportRequest
import app.pantopus.android.data.api.models.profile.UserReportResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * User-report endpoints from `backend/routes/users.js`. Mounted at
 * `/api/users`, so the concrete path is `/api/users/:userId/report`
 * (singular — `users.js:4153`).
 */
interface UserReportsApi {
    /**
     * `POST /api/users/:userId/report` — submit an abuse report. Route
     * `backend/routes/users.js:4153`.
     */
    @POST("api/users/{userId}/report")
    suspend fun report(
        @Path("userId") userId: String,
        @Body body: UserReportRequest,
    ): UserReportResponse
}
