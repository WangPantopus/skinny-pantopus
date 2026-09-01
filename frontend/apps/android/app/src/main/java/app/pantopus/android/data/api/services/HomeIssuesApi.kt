package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.CreateHomeIssueRequest
import app.pantopus.android.data.api.models.homes.HomeIssueResponse
import app.pantopus.android.data.api.models.homes.HomeIssuesResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeIssueRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Per-home **issue tracker** (`HomeIssue`) endpoints from
 * `backend/routes/home.js` (the `// ==== HOME ISSUES ====` block).
 *
 * A different backend collection from [HomesApi]'s
 * `/api/homes/:id/maintenance` (maintenance tasks). RN's "Maintenance"
 * screen (`src/app/homes/[id]/maintenance.tsx`) talks to THIS one.
 */
interface HomeIssuesApi {
    /**
     * `GET /api/homes/:id/issues` — route `backend/routes/home.js:4386`.
     * Optional server-side `status` / `severity` filters; the list screen
     * buckets client-side so one fetch feeds all three tabs.
     */
    @GET("api/homes/{id}/issues")
    suspend fun getHomeIssues(
        @Path("id") homeId: String,
        @Query("status") status: String? = null,
        @Query("severity") severity: String? = null,
    ): HomeIssuesResponse

    /** `POST /api/homes/:id/issues` — route `backend/routes/home.js:4420`. */
    @POST("api/homes/{id}/issues")
    suspend fun createHomeIssue(
        @Path("id") homeId: String,
        @Body body: CreateHomeIssueRequest,
    ): HomeIssueResponse

    /**
     * `PUT /api/homes/:id/issues/:issueId` — route
     * `backend/routes/home.js:4462`. Requires `can_manage_home`.
     */
    @PUT("api/homes/{id}/issues/{issueId}")
    suspend fun updateHomeIssue(
        @Path("id") homeId: String,
        @Path("issueId") issueId: String,
        @Body body: UpdateHomeIssueRequest,
    ): HomeIssueResponse
}
