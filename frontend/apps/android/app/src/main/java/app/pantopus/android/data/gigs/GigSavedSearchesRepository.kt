package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.CreateGigSavedSearchBody
import app.pantopus.android.data.api.models.gigs.GigSavedSearchDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigSavedSearchMutationResponse
import app.pantopus.android.data.api.models.gigs.GigSavedSearchesResponse
import app.pantopus.android.data.api.models.gigs.UpdateGigSavedSearchBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigSavedSearchesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * P6a — wraps the `/api/gigs/saved-searches` endpoints
 * (`backend/routes/gigSavedSearches.js`) in the [NetworkResult] taxonomy.
 */
@Singleton
class GigSavedSearchesRepository
    @Inject
    constructor(
        private val api: GigSavedSearchesApi,
    ) {
        /** `GET /api/gigs/saved-searches` — newest first. */
        suspend fun list(): NetworkResult<GigSavedSearchesResponse> = safeApiCall { api.list() }

        /** `POST /api/gigs/saved-searches` — duplicates upsert (`deduped: true`). */
        suspend fun create(body: CreateGigSavedSearchBody): NetworkResult<GigSavedSearchMutationResponse> = safeApiCall { api.create(body) }

        /** `PATCH /api/gigs/saved-searches/:id` — rename / notify / radius. */
        suspend fun update(
            id: String,
            name: String? = null,
            notify: Boolean? = null,
            radiusMiles: Double? = null,
        ): NetworkResult<GigSavedSearchMutationResponse> =
            safeApiCall {
                api.update(id, UpdateGigSavedSearchBody(name = name, notify = notify, radiusMiles = radiusMiles))
            }

        /** `DELETE /api/gigs/saved-searches/:id`. */
        suspend fun delete(id: String): NetworkResult<GigSavedSearchDeleteResponse> = safeApiCall { api.delete(id) }
    }
