package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.hub.DismissDensityMilestoneRequest
import app.pantopus.android.data.api.models.hub.DismissDensityMilestoneResponse
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Secondary hub routes that sit outside the three bootstrap calls in
 * [HubApi]. Kept in its own interface so parallel work on the hub bundle
 * doesn't collide.
 */
interface HubExtrasApi {
    /**
     * `POST /api/hub/dismiss-density-milestone` — marks the neighbor
     * density milestone banner as seen for this home so the next
     * `GET /api/hub` stops returning `neighborDensity.milestone`.
     * Route `backend/routes/hub.js:1024`.
     */
    @POST("api/hub/dismiss-density-milestone")
    suspend fun dismissDensityMilestone(
        @Body body: DismissDensityMilestoneRequest,
    ): DismissDensityMilestoneResponse
}
