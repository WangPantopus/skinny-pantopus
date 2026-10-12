package app.pantopus.android.data.hub

import app.pantopus.android.data.api.models.hub.BriefingDeliveryResponse
import app.pantopus.android.data.api.models.hub.DismissDensityMilestoneRequest
import app.pantopus.android.data.api.models.hub.DismissDensityMilestoneResponse
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.HubTodayResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.failIf
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HubApi
import app.pantopus.android.data.api.services.HubExtrasApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [HubApi] in the [NetworkResult] taxonomy. */
@Singleton
class HubRepository
    @Inject
    constructor(
        private val api: HubApi,
        private val extrasApi: HubExtrasApi,
        private val store: ScreenStore,
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

        /**
         * The Hub's overview through the screens' store (Instant Screens; kind Homes, fresh 2 minutes, memory only):
         * a fresh copy answers without a request, an older one is read again with its ETag. [force] reads now.
         */
        suspend fun overviewStored(force: Boolean = false): Stored<HubResponse> =
            store.read(StoreKeys.hubOverview, force) { etag -> conditionalApiCall { api.overviewConditional(etag) } }

        /** The stored overview as it is now (a first frame), without a request. */
        fun overviewCopy(): HubResponse? = store.peek(StoreKeys.hubOverview).data

        /** The Hub's Today card through the store (kind Today); a reply that says it failed keeps the last copy. */
        suspend fun todayStored(force: Boolean = false): Stored<HubTodayResponse> =
            store.read(StoreKeys.hubToday, force) { etag ->
                conditionalApiCall { api.todayConditional(etag) }.failIf { it.today == null && it.error != null }
            }

        /** The stored Today card as it is now, without a request. */
        fun todayCopy(): HubTodayResponse? = store.peek(StoreKeys.hubToday).data

        /** The Hub's Discover rail for [filter] through the store (kind Nearby): a tab seen before shows at once. */
        suspend fun discoveryStored(
            filter: String,
            force: Boolean = false,
        ): Stored<HubDiscoveryResponse> =
            store.read(StoreKeys.hubDiscovery(filter), force) { etag ->
                conditionalApiCall { api.discoveryConditional(filter, StoreKeys.HUB_DISCOVERY_LIMIT, etag) }
            }

        /** The stored rail for [filter] as it is now, without a request. */
        fun discoveryCopy(filter: String): HubDiscoveryResponse? = store.peek(StoreKeys.hubDiscovery(filter)).data

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
