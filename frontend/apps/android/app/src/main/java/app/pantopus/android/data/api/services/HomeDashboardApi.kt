package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.data.api.models.homedashboard.UpdateSeasonalChecklistItemRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Home dashboard aggregate + the four Home Intelligence reads.
 *
 * Kept separate from [HomesApi] (which is already at the detekt
 * `TooManyFunctions` threshold and is edited by every Homes surface).
 */
interface HomeDashboardApi {
    /**
     * `GET /api/homes/:id/dashboard` — route `backend/routes/home.js:6224`.
     *
     * Single-request aggregate: `{ home, myAccess, today, counts, members,
     * recent_activity }`.
     */
    @GET("api/homes/{id}/dashboard")
    suspend fun dashboard(
        @Path("id") homeId: String,
        @Query("include_health_score") includeHealthScore: Boolean? = null,
    ): HomeDashboardResponse

    /**
     * `GET /api/homes/:id/health-score` — route `backend/routes/home.js:7482`.
     *
     * The server caches for 5 minutes; `force=true` bypasses that cache
     * (mirrors RN's `useHomeIntelligence`, which always forces on mount so
     * a stale zero-score can't mask a freshly-populated home).
     */
    @GET("api/homes/{id}/health-score")
    suspend fun healthScore(
        @Path("id") homeId: String,
        @Query("force") force: Boolean? = null,
    ): HomeHealthScoreDto

    /**
     * `GET /api/homes/:id/seasonal-checklist` — route
     * `backend/routes/home.js:7504`. Idempotently generates the current
     * season's checklist when the home has none, so this doubles as the
     * "Generate checklist" action.
     */
    @GET("api/homes/{id}/seasonal-checklist")
    suspend fun seasonalChecklist(
        @Path("id") homeId: String,
    ): SeasonalChecklistDto

    /**
     * `PATCH /api/homes/:id/seasonal-checklist/:itemId` — route
     * `backend/routes/home.js:7577`. Responds with the updated
     * `HomeSeasonalChecklistItem` row.
     */
    @PATCH("api/homes/{id}/seasonal-checklist/{itemId}")
    suspend fun updateSeasonalChecklistItem(
        @Path("id") homeId: String,
        @Path("itemId") itemId: String,
        @Body body: UpdateSeasonalChecklistItemRequest,
    ): SeasonalChecklistItemDto

    /** `GET /api/homes/:id/property-value` — route `backend/routes/home.js:7752`. */
    @GET("api/homes/{id}/property-value")
    suspend fun propertyValue(
        @Path("id") homeId: String,
    ): HomePropertyValueDto

    /**
     * `GET /api/homes/:id/bill-trends` — route `backend/routes/home.js:7599`.
     * 403s for members without `finance.view` / `finance.manage`.
     */
    @GET("api/homes/{id}/bill-trends")
    suspend fun billTrends(
        @Path("id") homeId: String,
    ): HomeBillTrendsDto
}
