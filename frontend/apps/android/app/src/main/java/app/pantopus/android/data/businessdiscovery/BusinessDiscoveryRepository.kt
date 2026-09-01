package app.pantopus.android.data.businessdiscovery

import app.pantopus.android.data.api.models.businessdiscovery.BusinessDiscoverySearchResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessDiscoveryApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [BusinessDiscoveryApi] in the [NetworkResult] taxonomy. */
@Singleton
class BusinessDiscoveryRepository
    @Inject
    constructor(
        private val api: BusinessDiscoveryApi,
    ) {
        /**
         * `GET /api/businesses/search`. T5.4.2 — Discover businesses
         * passes the selected chip id as `categories` (omitted on "all").
         */
        @Suppress("LongParameterList")
        suspend fun search(
            q: String? = null,
            categories: List<String>? = null,
            sort: String? = null,
            page: Int = 1,
            pageSize: Int = 20,
            radiusMiles: Double? = null,
            openNow: Boolean? = null,
            ratingMin: Double? = null,
        ): NetworkResult<BusinessDiscoverySearchResponse> =
            safeApiCall {
                val query =
                    buildMap {
                        q?.takeIf { it.isNotBlank() }?.let { put("q", it) }
                        categories?.takeIf { it.isNotEmpty() }?.joinToString(",")?.let { put("categories", it) }
                        sort?.takeIf { it.isNotBlank() }?.let { put("sort", it) }
                        put("page", page.toString())
                        put("page_size", pageSize.toString())
                        radiusMiles?.let { put("radius_miles", it.toString()) }
                        if (openNow == true) put("open_now", "true")
                        ratingMin?.let { put("rating_min", it.toString()) }
                    }
                api.search(query)
            }
    }
