package app.pantopus.android.data.universalsearch

import app.pantopus.android.data.api.models.universalsearch.UniversalSearchBusinessesResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchGigsResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchHomesResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchPeopleResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchProfilesResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UniversalSearchApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * S2 — thin wrapper around [UniversalSearchApi] returning the typed
 * [NetworkResult] taxonomy. Each of the five sources is called
 * independently so one failing surface never takes the screen down.
 */
@Singleton
open class UniversalSearchRepository
    @Inject
    constructor(
        private val api: UniversalSearchApi,
    ) {
        /** `GET api/gigs/search`. */
        open suspend fun gigs(
            query: String,
            limit: Int,
        ): NetworkResult<UniversalSearchGigsResponse> = safeApiCall { api.gigs(query, limit) }

        /** `GET api/users/search` scoped to `type=people`. */
        open suspend fun people(
            query: String,
            limit: Int,
        ): NetworkResult<UniversalSearchPeopleResponse> = safeApiCall { api.people(query, limit) }

        /**
         * `GET api/identity/search` scoped to `public_profiles`.
         * Feature-gated — a 404 means the Identity Firewall is off on
         * this deployment, not that the request was malformed.
         */
        open suspend fun profiles(
            query: String,
            limit: Int,
        ): NetworkResult<UniversalSearchProfilesResponse> = safeApiCall { api.profiles(query, limit) }

        /** `GET api/businesses/discover`. */
        open suspend fun businesses(
            query: String,
            limit: Int,
        ): NetworkResult<UniversalSearchBusinessesResponse> = safeApiCall { api.businesses(query, limit) }

        /** `GET api/homes/discover`. */
        open suspend fun homes(
            query: String,
            limit: Int,
        ): NetworkResult<UniversalSearchHomesResponse> = safeApiCall { api.homes(query, limit) }
    }
