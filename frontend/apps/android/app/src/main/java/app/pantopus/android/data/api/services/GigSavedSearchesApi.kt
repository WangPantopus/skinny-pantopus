package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.CreateGigSavedSearchBody
import app.pantopus.android.data.api.models.gigs.GigSavedSearchDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigSavedSearchMutationResponse
import app.pantopus.android.data.api.models.gigs.GigSavedSearchesResponse
import app.pantopus.android.data.api.models.gigs.UpdateGigSavedSearchBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * P6a — gig saved searches + alerts. Routes live in
 * `backend/routes/gigSavedSearches.js`, mounted at `/api/gigs` before
 * `routes/gigs.js` so the static `/saved-searches` paths never collide
 * with `/:id`. Matches alert as a `gig_saved_search_match` notification.
 */
interface GigSavedSearchesApi {
    /**
     * `GET /api/gigs/saved-searches` — the caller's saved searches,
     * newest first. Route `backend/routes/gigSavedSearches.js:46`.
     */
    @GET("api/gigs/saved-searches")
    suspend fun list(): GigSavedSearchesResponse

    /**
     * `POST /api/gigs/saved-searches` — save the current filter set.
     * Duplicate criteria upsert onto the existing row (`deduped: true`,
     * re-enabling notify). Route `backend/routes/gigSavedSearches.js:66`.
     */
    @POST("api/gigs/saved-searches")
    suspend fun create(
        @Body body: CreateGigSavedSearchBody,
    ): GigSavedSearchMutationResponse

    /**
     * `PATCH /api/gigs/saved-searches/:id` — rename / toggle notify /
     * adjust radius. Route `backend/routes/gigSavedSearches.js:144`.
     */
    @PATCH("api/gigs/saved-searches/{id}")
    suspend fun update(
        @Path("id") id: String,
        @Body body: UpdateGigSavedSearchBody,
    ): GigSavedSearchMutationResponse

    /** `DELETE /api/gigs/saved-searches/:id`. Route `backend/routes/gigSavedSearches.js:162`. */
    @DELETE("api/gigs/saved-searches/{id}")
    suspend fun delete(
        @Path("id") id: String,
    ): GigSavedSearchDeleteResponse
}
