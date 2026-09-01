package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businessdiscovery.BusinessDiscoverySearchResponse
import retrofit2.http.GET
import retrofit2.http.QueryMap

/**
 * Business discovery routes from `backend/routes/businessDiscovery.js`,
 * mounted at `/api/businesses` (backend `app.js:339`).
 */
interface BusinessDiscoveryApi {
    /**
     * `GET /api/businesses/search` — route
     * `backend/routes/businessDiscovery.js:436`.
     *
     * T5.4.2 — Discover businesses uses this for the chip-filtered
     * browse list. The chip-strip id is passed as a comma-separated
     * value on `categories`; when "all" is selected the param is
     * omitted entirely.
     */
    @GET("api/businesses/search")
    suspend fun search(
        @QueryMap query: Map<String, String>,
    ): BusinessDiscoverySearchResponse
}
