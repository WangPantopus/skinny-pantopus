package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homedashboard.BillBenchmarkPreferenceRequest
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.HomeSettingsUpdateResponse
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.data.api.models.homedashboard.UpdateSeasonalChecklistItemRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeDashboardApi
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
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
        private val store: ScreenStore,
    ) {
        /** `GET /api/homes/:id/dashboard`. */
        open suspend fun dashboard(homeId: String): NetworkResult<HomeDashboardResponse> = safeApiCall { api.dashboard(homeId) }

        /**
         * The dashboard through the screens' store (kind Homes, fresh 2 minutes; [force] reads now). Only for viewers
         * who may see a copy before the re-check (founder decision 3); everyone else calls [dashboard].
         */
        open suspend fun dashboardStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomeDashboardResponse> =
            store.read(StoreKeys.homeDashboard(homeId), force) { etag -> conditionalApiCall { api.dashboardConditional(homeId, etag) } }

        /** The stored dashboard as it is now, without a request. */
        open fun dashboardCopy(homeId: String): HomeDashboardResponse? = store.peek(StoreKeys.homeDashboard(homeId)).data

        /** [healthScore] (recomputed) through the screens' store. */
        open suspend fun healthScoreStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomeHealthScoreDto> =
            store.read(HomeStoreKeys.healthScore(homeId), force) { etag -> conditionalApiCall { api.healthScoreConditional(homeId, etag) } }

        /** [seasonalChecklist] through the screens' store. */
        open suspend fun seasonalChecklistStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<SeasonalChecklistDto> =
            store.read(HomeStoreKeys.seasonalChecklist(homeId), force) { etag ->
                conditionalApiCall { api.seasonalChecklistConditional(homeId, etag) }
            }

        /** [propertyValue] through the screens' store. */
        open suspend fun propertyValueStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomePropertyValueDto> =
            store.read(HomeStoreKeys.propertyValue(homeId), force) { etag ->
                conditionalApiCall { api.propertyValueConditional(homeId, etag) }
            }

        /** The stored dashboard pieces, without a request. */
        open fun storedDashboard(homeId: String): StoredDashboard =
            StoredDashboard(
                dashboard = dashboardCopy(homeId),
                healthScore = store.peek(HomeStoreKeys.healthScore(homeId)).data,
                checklist = store.peek(HomeStoreKeys.seasonalChecklist(homeId)).data,
                propertyValue = store.peek(HomeStoreKeys.propertyValue(homeId)).data,
            )

        /** Capture before a checklist mutation; publish only a confirmed projection after validating access. */
        open fun checklistWriter(homeId: String): (SeasonalChecklistDto) -> Unit = store.writer(HomeStoreKeys.seasonalChecklist(homeId))

        /** A checklist the screen spliced an own confirmed change into becomes the stored copy. */
        open fun rememberChecklist(
            homeId: String,
            checklist: SeasonalChecklistDto,
        ) = store.put(HomeStoreKeys.seasonalChecklist(homeId), checklist)

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
            }.also { changed(homeId, it) }

        /** `GET /api/homes/:id/property-value`. */
        open suspend fun propertyValue(homeId: String): NetworkResult<HomePropertyValueDto> = safeApiCall { api.propertyValue(homeId) }

        /** `GET /api/homes/:id/bill-trends`. 403s without finance permission. */
        open suspend fun billTrends(
            homeId: String,
            currency: String = "USD",
        ): NetworkResult<HomeBillTrendsDto> = safeApiCall { api.billTrends(homeId, currency) }

        /** `PATCH /api/homes/:id/settings`: the Home's anonymous bill comparison opt-in. */
        open suspend fun setBillBenchmarkOptIn(
            homeId: String,
            optedIn: Boolean,
        ): NetworkResult<HomeSettingsUpdateResponse> =
            safeApiCall {
                api.setBillBenchmarkOptIn(homeId, BillBenchmarkPreferenceRequest(BillBenchmarkPreferenceRequest.Preferences(optedIn)))
            }.also { changed(homeId, it) }

        /** Own edit: this Home's stored screens read again on their next use. */
        private fun changed(
            homeId: String,
            result: NetworkResult<*>,
        ) {
            if (result is NetworkResult.Success) store.markStale("home:$homeId")
        }
    }

/** The dashboard's stored pieces (any may be missing). */
data class StoredDashboard(
    val dashboard: HomeDashboardResponse?,
    val healthScore: HomeHealthScoreDto?,
    val checklist: SeasonalChecklistDto?,
    val propertyValue: HomePropertyValueDto?,
)
