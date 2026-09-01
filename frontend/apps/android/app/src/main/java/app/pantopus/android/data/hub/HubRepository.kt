package app.pantopus.android.data.hub

import app.pantopus.android.data.api.models.hub.BriefingDeliveryResponse
import app.pantopus.android.data.api.models.hub.DismissDensityMilestoneRequest
import app.pantopus.android.data.api.models.hub.DismissDensityMilestoneResponse
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.HubTodayResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HubApi
import app.pantopus.android.data.api.services.HubExtrasApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HubApi] in the [NetworkResult] taxonomy. */
@Singleton
class HubRepository
    @Inject
    constructor(
        private val api: HubApi,
        private val extrasApi: HubExtrasApi,
    ) {
        /**
         * `POST /api/hub/dismiss-density-milestone` — records the
         * neighbor-density milestone as seen for [homeId].
         */
        suspend fun dismissDensityMilestone(
            homeId: String,
            milestone: Int,
        ): NetworkResult<DismissDensityMilestoneResponse> =
            safeApiCall {
                extrasApi.dismissDensityMilestone(
                    DismissDensityMilestoneRequest(homeId = homeId, milestone = milestone),
                )
            }

        /** `GET /api/hub`. */
        suspend fun overview(): NetworkResult<HubResponse> = safeApiCall { api.overview() }

        /** `GET /api/hub/today`. */
        suspend fun today(): NetworkResult<HubTodayResponse> = safeApiCall { api.today() }

        /** `GET /api/hub/today` (typed) — backs the full-screen Today briefing. */
        suspend fun todayDetail(): NetworkResult<HubTodayPayload> = safeApiCall { api.todayDetail() }

        /** `GET /api/hub/briefings/:id` — a stored Morning/Evening Briefing. */
        suspend fun briefingDelivery(id: String): NetworkResult<BriefingDeliveryResponse> = safeApiCall { api.briefingDelivery(id) }

        /**
         * `GET /api/hub/discovery?filter=...&limit=...`.
         *
         * T5.4.1 — chip-strip filter params (`since` / `verified` /
         * `freeOrWanted`) plumb through the same call so the Discover
         * hub VM can re-fetch with one parameterised entry point.
         */
        suspend fun discovery(
            filter: String = "gigs",
            limit: Int = 10,
            since: String? = null,
            verified: Boolean? = null,
            freeOrWanted: Boolean? = null,
        ): NetworkResult<HubDiscoveryResponse> =
            safeApiCall {
                api.discovery(
                    filter = filter,
                    limit = limit,
                    since = since,
                    verified = verified,
                    freeOrWanted = freeOrWanted,
                )
            }
    }
