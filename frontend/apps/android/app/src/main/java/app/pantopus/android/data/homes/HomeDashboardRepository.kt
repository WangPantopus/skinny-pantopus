package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.data.api.models.homedashboard.UpdateSeasonalChecklistItemRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeDashboardApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [HomeDashboardApi] returning the typed
 * [NetworkResult] taxonomy, so the Home dashboard view-model can render a
 * per-card error surface instead of a single screen-level failure.
 */
@Singleton
open class HomeDashboardRepository
    @Inject
    constructor(
        private val api: HomeDashboardApi,
    ) {
        /** `GET /api/homes/:id/dashboard`. */
        open suspend fun dashboard(homeId: String): NetworkResult<HomeDashboardResponse> = safeApiCall { api.dashboard(homeId) }

        /** `GET /api/homes/:id/health-score?force=true`. */
        open suspend fun healthScore(
            homeId: String,
            force: Boolean = true,
        ): NetworkResult<HomeHealthScoreDto> = safeApiCall { api.healthScore(homeId, force) }

        /** `GET /api/homes/:id/seasonal-checklist`. */
        open suspend fun seasonalChecklist(homeId: String): NetworkResult<SeasonalChecklistDto> =
            safeApiCall { api.seasonalChecklist(homeId) }

        /** `PATCH /api/homes/:id/seasonal-checklist/:itemId`. */
        open suspend fun updateSeasonalChecklistItem(
            homeId: String,
            itemId: String,
            status: String,
        ): NetworkResult<SeasonalChecklistItemDto> =
            safeApiCall {
                api.updateSeasonalChecklistItem(
                    homeId,
                    itemId,
                    UpdateSeasonalChecklistItemRequest(status = status),
                )
            }

        /** `GET /api/homes/:id/property-value`. */
        open suspend fun propertyValue(homeId: String): NetworkResult<HomePropertyValueDto> = safeApiCall { api.propertyValue(homeId) }

        /** `GET /api/homes/:id/bill-trends`. 403s without finance permission. */
        open suspend fun billTrends(homeId: String): NetworkResult<HomeBillTrendsDto> = safeApiCall { api.billTrends(homeId) }
    }
